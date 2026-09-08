// Isometric office: variable-size department rooms sized by how many agents work
// in each, arranged around a big central SALA DE ESPERA (where every agent waits
// until it becomes active), joined by wide corridors. Walls are thin — only each
// room's two BACK walls are drawn (open-box iso look), so rooms read open, not
// boxed-in. Walls AND furniture are non-walkable: the layout is the collision.
//
// Rendered into a Pixi container; agents (positioned via the exported Projection)
// seat inside their room when active and wait in the centre otherwise. Uses its
// own synthetic grid (see isoSyntheticMap) so room sizes aren't capped by
// office.tmj. ORIGINAL art. Painter's depth via per-piece zIndex.
import { Container, Graphics, Text } from 'pixi.js';
import { accentByName } from '@/design/tokens';
import { DEPARTMENT_ACCENT, type Department } from '@/data/hermesRoster';
import { Projection } from './projection';

export interface Tile { x: number; y: number; }

const TILE = 16, TW = 32, TH = 16, WALL_H = 36, CORR = 3;

type RoomName = Department | 'lounge' | 'waiting';
interface RoomDef { name: RoomName; n: number; iw: number; ih: number; ix: number; iy: number; }

// agent head-count per department (from data/hermesRoster.ts ROSTER)
const DEPT_N: Record<Department, number> = {
  'Dirección': 2, 'Desarrollo': 3, 'Creativo': 3, 'Marketing': 3, 'Finanzas': 2, 'Redacción': 3, 'Ciberseguridad': 1,
};
const sizeFor = (n: number): { iw: number; ih: number } => (n >= 3 ? { iw: 8, ih: 5 } : n === 2 ? { iw: 6, ih: 4 } : { iw: 5, ih: 4 });

// ── place rooms: two department rows around a big central waiting room ───────
const rooms: RoomDef[] = [];
(function layoutRooms(): void {
  const top: RoomName[] = ['Dirección', 'Desarrollo', 'Creativo', 'Marketing'];
  const bottom: RoomName[] = ['Finanzas', 'Redacción', 'Ciberseguridad', 'lounge'];
  const mk = (name: RoomName): RoomDef => {
    const n = name === 'lounge' ? 3 : name === 'waiting' ? 0 : DEPT_N[name];
    const s = name === 'lounge' ? { iw: 8, ih: 5 } : sizeFor(n);
    return { name, n: name === 'waiting' || name === 'lounge' ? 0 : n, iw: s.iw, ih: s.ih, ix: 0, iy: 0 };
  };
  const placeRow = (names: RoomName[], oy: number): RoomDef[] => {
    let ox = 2; const row: RoomDef[] = [];
    for (const nm of names) { const r = mk(nm); r.ix = ox + 1; r.iy = oy + 1; row.push(r); ox += r.iw + 2 + CORR; }
    return row;
  };
  const topRow = placeRow(top, 1);
  const topH = Math.max(...topRow.map((r) => r.ih)) + 2;
  const waiting: RoomDef = { name: 'waiting', n: 0, iw: 15, ih: 10, ix: 0, iy: 1 + topH + CORR + 1 };
  const bottomRow = placeRow(bottom, waiting.iy - 1 + waiting.ih + 2 + CORR);
  // centre the waiting room under the widest row
  const rowRight = (row: RoomDef[]): number => { const last = row[row.length - 1]; return last.ix + last.iw + 1; };
  const fullW = Math.max(rowRight(topRow), rowRight(bottomRow));
  waiting.ix = Math.round((fullW - waiting.iw) / 2) + 1;
  rooms.push(...topRow, waiting, ...bottomRow);
})();

const roomRight = Math.max(...rooms.map((r) => r.ix + r.iw));
const roomBottom = Math.max(...rooms.map((r) => r.iy + r.ih));
export const ISO_GW = roomRight + 2;
export const ISO_GH = roomBottom + 2;
const ORIGIN_X = ISO_GH * (TW / 2), ORIGIN_Y = WALL_H + 6;

const project = (tx: number, ty: number): { x: number; y: number } => ({ x: ORIGIN_X + (tx - ty) * (TW / 2), y: ORIGIN_Y + (tx + ty) * (TH / 2) });

// ── per-tile classification (interior / wall / door) computed once ───────────
const interiorOf = new Map<string, RoomDef>();   // tile -> room whose interior it is
const wallCollide = new Set<string>();            // all room-border tiles (non-walkable)
const wallDrawN = new Set<string>();              // north-border tiles to draw
const wallDrawW = new Set<string>();              // west-border tiles to draw
const doorSet = new Set<string>();
const blocked = new Set<string>();                // furniture (non-walkable)
type Kind = 'desk' | 'bookshelf' | 'plant' | 'bench' | 'pool' | 'sofa' | 'arcade' | 'vending' | 'chair';
const pieces: { x: number; y: number; kind: Kind }[] = [];
const seatsByDept = new Map<Department, Tile[]>();
const waitingSpots: Tile[] = [];
let godSeat: Tile = { x: 1, y: 1 };

const key = (x: number, y: number): string => `${x},${y}`;
const addPiece = (x: number, y: number, kind: Kind, block = true): void => { pieces.push({ x, y, kind }); if (block) blocked.add(key(x, y)); };

(function computeTiles(): void {
  for (const r of rooms) {
    const x0 = r.ix - 1, y0 = r.iy - 1, x1 = r.ix + r.iw, y1 = r.iy + r.ih; // border coords
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const border = x === x0 || x === x1 || y === y0 || y === y1;
      if (border) {
        wallCollide.add(key(x, y));
        if (y === y0 && x < x1) wallDrawN.add(key(x, y));   // north run (skip the shared corner)
        if (x === x0 && y < y1) wallDrawW.add(key(x, y));   // west run
      } else {
        interiorOf.set(key(x, y), r);
      }
    }
    // door on the wall facing the nearest corridor
    const midx = r.ix + Math.floor(r.iw / 2), midy = r.iy + Math.floor(r.ih / 2);
    if (r.name === 'waiting') { doorSet.add(key(midx, y0)); doorSet.add(key(midx, y1)); doorSet.add(key(x0, midy)); doorSet.add(key(x1, midy)); }
    else if (r.iy < ISO_GH / 2) doorSet.add(key(midx, y1)); // top rooms open downward
    else doorSet.add(key(midx, y0));                        // bottom rooms open upward

    // furniture + seats
    const ix = r.ix, iy = r.iy;
    if (r.name === 'waiting') {
      for (let dx = 0; dx < r.iw; dx += 2) addPiece(ix + dx, iy, 'bench');
      // spaced spots (every other tile) so waiting agents don't pile up
      for (let dy = 2; dy < r.ih; dy += 2) for (let dx = 0; dx < r.iw; dx += 2) waitingSpots.push({ x: ix + dx, y: iy + dy });
      godSeat = { x: ix + Math.floor(r.iw / 2), y: iy + r.ih - 1 };
    } else if (r.name === 'lounge') {
      addPiece(ix + 2, iy + 1, 'pool'); addPiece(ix + 2, iy + 2, 'pool', false);
      addPiece(ix, iy, 'arcade'); addPiece(ix + r.iw - 1, iy, 'vending');
      addPiece(ix + r.iw - 1, iy + r.ih - 1, 'plant'); addPiece(ix, iy + r.ih - 1, 'sofa');
    } else {
      const seats: Tile[] = [];
      for (let k = 0; k < r.n; k++) {
        const dx = 1 + k * 2;
        addPiece(ix + dx, iy, 'desk');          // desk against the back wall
        seats.push({ x: ix + dx, y: iy + 1 });  // agent stands in front of the desk
      }
      addPiece(ix + r.iw - 1, iy, 'bookshelf');
      addPiece(ix + r.iw - 1, iy + r.ih - 1, 'plant');
      seatsByDept.set(r.name, seats);
    }
  }
})();

// spread waiting-room assignment so consecutive agents don't fill one diagonal
// (deterministic interleave: large stride through the spaced spots)
(function spreadWaiting(): void {
  if (waitingSpots.length < 3) return;
  const src = waitingSpots.slice(), out: Tile[] = [], stride = 5;
  for (let i = 0, idx = 0; i < src.length; i++) { while (out.includes(src[idx % src.length])) idx++; out.push(src[idx % src.length]); idx += stride; }
  waitingSpots.length = 0; waitingSpots.push(...out);
})();

export function isoRoomsProjection(): Projection {
  return { kind: 'iso', tileSize: TILE, tileW: TW, tileH: TH, originX: ORIGIN_X, originY: ORIGIN_Y };
}
export function isoWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= ISO_GW || y >= ISO_GH) return false;
  if (wallCollide.has(key(x, y)) && !doorSet.has(key(x, y))) return false;
  if (blocked.has(key(x, y))) return false;
  return true; // corridors + room interiors + doors
}
export function isoWaitingSpots(): Tile[] { return waitingSpots; }
/** synthetic Tiled map so room sizes aren't capped by office.tmj's 34x22. */
export function isoSyntheticMap(): { width: number; height: number; tilewidth: number; tileheight: number; layers: []; tilesets: [] } {
  return { width: ISO_GW, height: ISO_GH, tilewidth: TILE, tileheight: TILE, layers: [], tilesets: [] };
}

// ── colours + primitives ────────────────────────────────────────────────────
const shade = (n: number, f: number): number => { const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f)); return (r << 16) | (g << 8) | b; };
const mixHex = (a: number, b: number, t: number): number => { const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t); const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t); const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t); return (r << 16) | (g << 8) | bl; };
const diamond = (g: Graphics, cx: number, cy: number, hw: number, hh: number, color: number, alpha = 1): void => { g.poly([cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy]).fill({ color, alpha }); };
function prism(g: Graphics, cx: number, cy: number, hw: number, hh: number, ht: number, top: number, left: number, right: number): void {
  diamond(g, cx, cy + 2, hw + 3, hh + 2, 0x000000, 0.28);
  g.poly([cx - hw, cy - ht, cx, cy - ht + hh, cx, cy + hh, cx - hw, cy]).fill(left);
  g.poly([cx, cy - ht + hh, cx + hw, cy - ht, cx + hw, cy, cx, cy + hh]).fill(right);
  diamond(g, cx, cy - ht, hw, hh, top);
}

function drawPiece(g: Graphics, p: { x: number; y: number; kind: Kind }): void {
  const { x, y } = project(p.x, p.y);
  switch (p.kind) {
    case 'desk': { const w = 0x8a714a; prism(g, x, y, 12, 6, 8, mixHex(w, 0xffffff, 0.14), shade(w, 0.72), shade(w, 0.55));
      g.rect(x - 6, y - 24, 12, 11).fill(0x1c2028); g.rect(x - 5, y - 23, 10, 8).fill(0x74b4c8); g.rect(x - 4, y - 22, 3, 2).fill(0xbfe6ee); // monitor
      g.rect(x - 6, y - 8, 9, 3).fill(0xdadde2); g.rect(x + 4, y - 7, 2, 2).fill(0xdadde2); g.rect(x + 1, y - 11, 4, 3).fill(0xf3f0e7); break; } // keyboard/mouse/papers
    case 'bookshelf': { const w = 0x63432a; prism(g, x, y, 12, 6, 30, shade(w, 1.05), shade(w, 0.7), shade(w, 0.48)); const bk = [0xbe4638, 0xd2aa46, 0x4678aa, 0x5aa06e, 0xaa6eb4, 0xd98a4a]; for (let s = 0; s < 3; s++) { const yy = y - 7 - s * 8; for (let i = 0; i < 6; i++) g.rect(x - 8 + i * 3, yy - 5, 2, 5).fill(bk[(i + s) % bk.length]); g.rect(x - 9, yy, 18, 1).fill(shade(w, 0.4)); } break; }
    case 'plant': { diamond(g, x, y + 2, 8, 5, 0x000000, 0.25); g.rect(x - 3, y - 9, 6, 9).fill(0x9a6444); g.rect(x - 3, y - 10, 6, 1).fill(0x7a4e34); diamond(g, x, y - 17, 15, 10, 0x3e7644); diamond(g, x - 2, y - 23, 11, 8, 0x548a58); diamond(g, x + 3, y - 21, 8, 6, 0x468050); break; }
    case 'bench': { const c = 0x7a5a3c; prism(g, x, y, 11, 6, 6, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55)); g.rect(x - 11, y - 15, 22, 7).fill(shade(c, 0.85)); break; }
    case 'pool': { prism(g, x, y, 15, 8, 8, 0x5c3e28, 0x46301c, 0x362416); diamond(g, x, y - 8, 13, 7, 0x2a7a48); for (const [bx, by, c] of [[-6, -1, 0xe6dc3c], [-2, 2, 0xc83c3c], [4, -1, 0xe6e6eb], [7, 2, 0x3c5abe]] as [number, number, number][]) g.circle(x + bx, y - 8 + by, 1).fill(c); break; }
    case 'sofa': { const c = 0x8c4450; prism(g, x, y, 14, 7, 8, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55)); g.rect(x - 14, y - 22, 28, 12).fill(shade(c, 0.82)); g.rect(x - 13, y - 9, 8, 3).fill(shade(c, 1.15)); g.rect(x - 3, y - 9, 8, 3).fill(shade(c, 1.15)); break; }
    case 'arcade': { const c = 0x3a2a66; prism(g, x, y, 7, 5, 26, shade(c, 1.15), shade(c, 0.72), shade(c, 0.5)); g.rect(x - 4, y - 24, 8, 4).fill(0xe24a7a); g.rect(x - 4, y - 20, 8, 6).fill(0x28c8dc); g.rect(x - 3, y - 12, 8, 3).fill(0x1a1a24); g.circle(x - 1, y - 10, 1).fill(0xe6d23c); break; }
    case 'vending': { const c = 0xb03a3a; prism(g, x, y, 7, 5, 24, shade(c, 1.08), shade(c, 0.72), shade(c, 0.5)); g.rect(x - 4, y - 22, 8, 14).fill(0x1e2836); const it = [0xf0d24a, 0x5aaad2, 0xe6785a]; for (let r = 0; r < 3; r++) for (let cc = 0; cc < 3; cc++) g.rect(x - 3 + cc * 3, y - 20 + r * 4, 2, 2).fill(it[(r + cc) % 3]); break; }
    case 'chair': { const c = 0x50845e; prism(g, x, y, 4, 3, 6, shade(c, 1.1), shade(c, 0.7), shade(c, 0.55)); g.rect(x - 3, y - 12, 6, 5).fill(shade(c, 0.8)); break; }
  }
}

function floorColor(x: number, y: number): number {
  const r = interiorOf.get(key(x, y));
  if (!r) return (x + y) % 2 ? 0x2f3442 : 0x282c38;              // corridor
  if (r.name === 'waiting') return (x + y) % 2 ? 0x6a6152 : 0x5f5748;
  if (r.name === 'lounge') return (x + y) % 2 ? 0x5a3550 : 0x4e2e46;
  const accent = accentByName[DEPARTMENT_ACCENT[r.name]];
  return (x + y) % 2 ? mixHex(accent, 0x141414, 0.5) : mixHex(accent, 0x141414, 0.58);
}

// A solid but THIN back wall (only the room's two back edges are drawn → open
// box). north edge = the tile's top-right edge; west edge = top-left edge.
// Panel + top trim + baseboard so it reads clearly as a wall.
function drawWall(g: Graphics, x: number, y: number, north: boolean): void {
  const p = project(x, y), TH2 = TH / 2, TW2 = TW / 2;
  const faceN = 0x424b68, faceW = shade(0x424b68, 0.8);
  const trim = 0x646e92, base = 0x2b3149;
  const [ax, ay, bx, by] = north
    ? [p.x, p.y - TH2, p.x + TW2, p.y]        // top-right edge
    : [p.x - TW2, p.y, p.x, p.y - TH2];       // top-left edge
  const face = north ? faceN : faceW;
  g.poly([ax, ay - WALL_H, bx, by - WALL_H, bx, by, ax, ay]).fill(face);              // full panel
  g.poly([ax, ay - WALL_H, bx, by - WALL_H, bx, by - WALL_H + 3, ax, ay - WALL_H + 3]).fill(trim); // top trim
  g.poly([ax, ay - 4, bx, by - 4, bx, by, ax, ay]).fill(shade(base, north ? 1 : 0.85)); // baseboard
}

export interface DepthItem { g: Graphics; z: number; }
export function buildIsoRooms(): { floor: Container; depthItems: DepthItem[]; labels: Container; seatsByDept: Map<Department, Tile[]>; godSeat: Tile; worldW: number; worldH: number } {
  // Floor stays behind everything.
  const floorC = new Container();
  const floor = new Graphics();
  for (let ty = 0; ty < ISO_GH; ty++) for (let tx = 0; tx < ISO_GW; tx++) {
    const p = project(tx, ty);
    diamond(floor, p.x, p.y, TW / 2, TH / 2, floorColor(tx, ty));
  }
  floorC.addChild(floor);

  // Walls + furniture become individually depth-keyed items so they INTERLEAVE
  // with the agents (added to the same sortable layer, sorted by baseline Y) —
  // an agent behind a wall/shelf is occluded, in front it occludes. This is what
  // makes it read as 3D space instead of flat.
  const depthItems: DepthItem[] = [];
  for (const k of wallDrawN) { const [x, y] = k.split(',').map(Number); const g = new Graphics(); drawWall(g, x, y, true); depthItems.push({ g, z: project(x, y).y }); }
  for (const k of wallDrawW) { const [x, y] = k.split(',').map(Number); const g = new Graphics(); drawWall(g, x, y, false); depthItems.push({ g, z: project(x, y).y }); }
  for (const p of pieces) { const g = new Graphics(); drawPiece(g, p); depthItems.push({ g, z: project(p.x, p.y).y + 0.5 }); }

  // Labels always on top.
  const labels = new Container();
  for (const r of rooms) {
    const label = r.name === 'waiting' ? 'SALA DE ESPERA' : r.name === 'lounge' ? 'LOUNGE' : r.name.toUpperCase();
    const p = project(r.ix + r.iw / 2, r.iy);
    const t = new Text({ text: label, style: { fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold', fill: 0xf2eedd, stroke: { color: 0x1a1d29, width: 3 } } });
    t.anchor.set(0.5, 1);
    t.position.set(p.x, p.y - WALL_H - 3);
    labels.addChild(t);
  }

  const bottom = project(ISO_GW, ISO_GH);
  return { floor: floorC, depthItems, labels, seatsByDept, godSeat, worldW: ORIGIN_X + ISO_GW * (TW / 2) + 20, worldH: bottom.y + 40 };
}
