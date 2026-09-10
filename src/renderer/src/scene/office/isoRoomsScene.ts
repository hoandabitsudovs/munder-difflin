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

const TILE = 16, TW = 32, TH = 16, WALL_H = 36, CORR = 2;   // 2-tile corridors, clearly readable as hallways

type RoomName = Department | 'lounge' | 'waiting';
interface RoomDef { name: RoomName; n: number; iw: number; ih: number; ix: number; iy: number; }

// agent head-count per department (from data/hermesRoster.ts ROSTER)
const DEPT_N: Record<Department, number> = {
  'Dirección': 2, 'Desarrollo': 3, 'Creativo': 3, 'Marketing': 3, 'Finanzas': 2, 'Redacción': 3, 'Ciberseguridad': 1,
};
const sizeFor = (n: number): { iw: number; ih: number } => (n >= 3 ? { iw: 9, ih: 6 } : n === 2 ? { iw: 7, ih: 5 } : { iw: 6, ih: 5 });

// ── place rooms: two department rows around a big central waiting room ───────
const rooms: RoomDef[] = [];
(function layoutRooms(): void {
  const top: RoomName[] = ['Dirección', 'Desarrollo', 'Creativo', 'Marketing'];
  const bottom: RoomName[] = ['Finanzas', 'Redacción', 'Ciberseguridad', 'lounge'];
  const mk = (name: RoomName): RoomDef => {
    const n = name === 'lounge' ? 3 : name === 'waiting' ? 0 : DEPT_N[name];
    const s = name === 'lounge' ? { iw: 9, ih: 6 } : sizeFor(n);
    return { name, n: name === 'waiting' || name === 'lounge' ? 0 : n, iw: s.iw, ih: s.ih, ix: 0, iy: 0 };
  };
  const placeRow = (names: RoomName[], oy: number): RoomDef[] => {
    let ox = 2; const row: RoomDef[] = [];
    for (const nm of names) { const r = mk(nm); r.ix = ox + 1; r.iy = oy + 1; row.push(r); ox += r.iw + 2 + CORR; }
    return row;
  };
  const topRow = placeRow(top, 1);
  const topH = Math.max(...topRow.map((r) => r.ih)) + 2;
  const waiting: RoomDef = { name: 'waiting', n: 0, iw: 20, ih: 14, ix: 0, iy: 1 + topH + CORR + 1 };
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
const roomFloorOf = new Map<string, RoomDef>();  // tile -> room, incl. border tiles under the walls (so floor meets walls)
const wallCollide = new Set<string>();            // all room-border tiles (non-walkable)
const wallDrawN = new Set<string>();              // north-border (tall back wall)
const wallDrawW = new Set<string>();              // west-border  (tall back wall)
const wallDrawS = new Set<string>();              // south-border (short front wall)
const wallDrawE = new Set<string>();              // east-border  (short front wall)
const doorSet = new Set<string>();
const blocked = new Set<string>();                // furniture (non-walkable)
type Kind = 'desk' | 'bookshelf' | 'plant' | 'bench' | 'pool' | 'sofa' | 'arcade' | 'vending' | 'chair' | 'cabinet' | 'cooler'
  | 'serverrack' | 'meeting' | 'easel' | 'whiteboard'; // per-department signature pieces
const pieces: { x: number; y: number; kind: Kind }[] = [];
const seatsByDept = new Map<Department, Tile[]>();
const waitingSpots: Tile[] = [];
let godSeat: Tile = { x: 1, y: 1 };

const key = (x: number, y: number): string => `${x},${y}`;
const addPiece = (x: number, y: number, kind: Kind, block = true): void => { pieces.push({ x, y, kind }); if (block) blocked.add(key(x, y)); };

// Per-department decor so rooms don't all look identical. Each department gets
// its own accessories in the 4 interior corners (BL/BR back, FL/FR front) plus
// an optional wall clock — giving each room a distinct signature (Finanzas =
// filing cabinets, Redacción = bookshelves, Creativo = plants, etc.).
type Corner = 'BL' | 'BR' | 'FL' | 'FR';
// `feature` = the room's signature piece, set against the back wall so each
// department reads at a glance (Dirección = boardroom table, Desarrollo/Ciber =
// server rack, Creativo = easel, Marketing/Finanzas = whiteboard).
interface DeptDecor { corners: Partial<Record<Corner, Kind>>; clock?: boolean; feature?: Kind }
const DEPT_DECOR: Record<Department, DeptDecor> = {
  'Dirección':      { corners: { BL: 'sofa',      BR: 'bookshelf', FL: 'plant',   FR: 'plant'     }, clock: true, feature: 'meeting' },
  'Desarrollo':     { corners: { BL: 'cabinet',   BR: 'bookshelf', FL: 'cooler',  FR: 'bookshelf' }, feature: 'serverrack' },
  'Creativo':       { corners: { BL: 'plant',     BR: 'plant',     FL: 'bench',   FR: 'plant'     }, feature: 'easel' },
  'Marketing':      { corners: { BL: 'cabinet',   BR: 'bookshelf', FL: 'plant',   FR: 'cooler'    }, clock: true, feature: 'whiteboard' },
  'Finanzas':       { corners: { BL: 'cabinet',   BR: 'cabinet',   FL: 'cooler',  FR: 'plant'     }, feature: 'whiteboard' },
  'Redacción':      { corners: { BL: 'bookshelf', BR: 'bookshelf', FL: 'cabinet', FR: 'plant'     }, clock: true },
  'Ciberseguridad': { corners: { BL: 'cabinet',                                   FR: 'cooler'    }, feature: 'serverrack' },
};

(function computeTiles(): void {
  for (const r of rooms) {
    const x0 = r.ix - 1, y0 = r.iy - 1, x1 = r.ix + r.iw, y1 = r.iy + r.ih; // border coords
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const border = x === x0 || x === x1 || y === y0 || y === y1;
      roomFloorOf.set(key(x, y), r); // whole room rect (incl. walls) gets the room floor
      if (border) {
        wallCollide.add(key(x, y));
        // tall back walls (top + left) run corner-to-corner and MEET at the back
        // corner; low front walls (bottom + right) fill the rest — every corner
        // is covered so walls join with no gaps.
        // draw every edge on every border tile — corner tiles get BOTH their
        // edges, so the walls actually meet at all four corners (no gaps).
        if (y === y0) wallDrawN.add(key(x, y));   // top    (tall)
        if (x === x0) wallDrawW.add(key(x, y));   // left   (tall)
        if (y === y1) wallDrawS.add(key(x, y));   // bottom (low)
        if (x === x1) wallDrawE.add(key(x, y));   // right  (low)
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
      // a tidy grid of chairs; one agent sits per chair (chairs drawn in buildIsoRooms)
      const cols = [2, 6, 10, 14, 18], rows = [2, 5, 8, 11];
      for (const dy of rows) for (const dx of cols) if (dx < r.iw && dy < r.ih) waitingSpots.push({ x: ix + dx, y: iy + dy });
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
      // per-department accessories in the 4 interior corners (see DEPT_DECOR) so
      // each room reads distinct instead of every room sharing one layout
      const corner: Record<Corner, Tile> = {
        BL: { x: ix, y: iy }, BR: { x: ix + r.iw - 1, y: iy },
        FL: { x: ix, y: iy + r.ih - 1 }, FR: { x: ix + r.iw - 1, y: iy + r.ih - 1 },
      };
      const decor = DEPT_DECOR[r.name as Department];
      for (const [c, kind] of Object.entries(decor.corners) as [Corner, Kind][]) {
        addPiece(corner[c].x, corner[c].y, kind);
      }
      // signature piece against the back wall, in a free even column (never a
      // desk column, which are odd) so it doesn't collide with a desk/seat
      if (decor.feature) addPiece(ix + r.iw - 2, iy, decor.feature);
      seatsByDept.set(r.name, seats);
    }
  }
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
    case 'chair': { const c = 0x3a4152; // dark office chair with a tall back
      prism(g, x, y, 5, 3, 5, shade(c, 1.2), shade(c, 0.74), shade(c, 0.56));   // seat
      g.rect(x - 4, y - 23, 8, 14).fill(shade(c, 1.0));                          // tall backrest (peeks behind the seated agent)
      g.rect(x - 4, y - 23, 8, 2).fill(shade(c, 1.35));                          // headrest highlight
      break; }
    case 'cabinet': { const c = 0x6f7784; prism(g, x, y, 10, 6, 20, shade(c, 1.08), shade(c, 0.72), shade(c, 0.55)); for (const yy of [-4, -10, -16]) g.rect(x - 5, y + yy, 10, 1).fill(shade(c, 0.45)); g.rect(x - 1, y - 12, 2, 1).fill(0xcfd6e0); break; }
    case 'cooler': { const c = 0xdfe6ec; prism(g, x, y, 5, 3, 12, c, shade(c, 0.78), shade(c, 0.62)); diamond(g, x, y - 14, 8, 5, 0x66b8e0); g.rect(x - 2, y - 5, 4, 3).fill(0x4a90c0); break; }
    case 'serverrack': { const c = 0x24282f; prism(g, x, y, 8, 5, 30, shade(c, 1.25), shade(c, 0.7), shade(c, 0.48)); // dark tech cabinet
      const led = [0x50e070, 0xe0c040, 0x50e070, 0xe05a4a]; // rows of blinking indicators
      for (let rr = 0; rr < 5; rr++) { g.rect(x - 5, y - 26 + rr * 5, 10, 3).fill(0x14161b); for (let i = 0; i < 3; i++) g.rect(x - 4 + i * 3, y - 25 + rr * 5, 1, 1).fill(led[(rr + i) % led.length]); } break; }
    case 'meeting': { const w = 0x6f4e2e; prism(g, x, y, 18, 9, 7, mixHex(w, 0xffffff, 0.14), shade(w, 0.72), shade(w, 0.5)); // wide boardroom table
      g.rect(x - 9, y - 9, 6, 3).fill(0xf3f0e7); g.rect(x + 3, y - 8, 6, 3).fill(0xdadde2); g.rect(x - 2, y - 10, 4, 3).fill(0xf3f0e7); break; } // papers + laptop
    case 'easel': { // art easel: tripod + canvas
      g.poly([x - 8, y, x - 1, y - 24, x + 1, y - 24, x - 6, y]).fill(0x6b4a2c); g.poly([x + 8, y, x + 6, y, x + 1, y - 24, x - 1, y - 24]).fill(0x7a5636);
      g.rect(x - 10, y - 31, 20, 18).fill(0x8a7a5a); g.rect(x - 9, y - 30, 18, 16).fill(0xece7db); // framed canvas
      g.circle(x - 3, y - 24, 2).fill(0xd24a5a); g.rect(x + 1, y - 21, 5, 3).fill(0x4a86c0); g.circle(x + 4, y - 26, 1).fill(0xe6c23c); break; } // paint
    case 'whiteboard': { g.rect(x - 9, y - 5, 2, 5).fill(0x3a3f48); g.rect(x + 7, y - 5, 2, 5).fill(0x3a3f48); // legs
      g.rect(x - 11, y - 25, 22, 21).fill(0x2a2f38); g.rect(x - 10, y - 24, 20, 19).fill(0xf2f3f5); // frame + surface
      g.rect(x - 7, y - 20, 11, 1).fill(0x4a86c0); g.rect(x - 7, y - 17, 8, 1).fill(0xd24a5a); // header lines
      for (let i = 0; i < 4; i++) g.rect(x - 6 + i * 3, y - 8 - i, 2, 4 + i).fill([0x4a86c0, 0x50b070, 0xe0a040, 0xd24a5a][i]); break; } // bar chart
  }
}

// wall decor (drawn on the tall back-wall face, screen-space)
function wallClock(g: Graphics, sx: number, sy: number): void {
  g.circle(sx, sy, 5).fill(0x20242c);
  g.circle(sx, sy, 4).fill(0xececef);
  g.rect(sx, sy - 3, 1, 3).fill(0x20242c);
  g.rect(sx, sy, 3, 1).fill(0x20242c);
}

function floorColor(x: number, y: number): number {
  const r = roomFloorOf.get(key(x, y));
  if (!r) return (x + y) % 2 ? 0x9ea6b8 : 0x8f97a9; // corridor: light hallway tile (clearly distinct from rooms)
  if (r.name === 'waiting') return (x + y) % 2 ? 0x6a6152 : 0x5f5748;
  if (r.name === 'lounge') return (x + y) % 2 ? 0x5a3550 : 0x4e2e46;
  const accent = accentByName[DEPARTMENT_ACCENT[r.name]];
  return (x + y) % 2 ? mixHex(accent, 0x141414, 0.5) : mixHex(accent, 0x141414, 0.58);
}

// Thin walls on all 4 room edges. The two BACK edges (N/W) are tall; the two
// FRONT edges (S/E) are short low walls (a murito) so the room reads enclosed on
// 4 sides without hiding the interior — the trick the reference uses.
const WALL_BASE = 0xccd0da, WALL_TOP = 0xe7eaf1, WALL_FOOT = 0x9298a8; // light office walls
// Wall with real thickness: a face + a lighter TOP CAP (the slab's top surface),
// plus a baseboard. The cap is what makes it read as a solid 3D wall, not a flat
// line. Back walls (N/W) tall; front walls (S/E) low muritos.
function drawWall(g: Graphics, x: number, y: number, edge: 'N' | 'W' | 'S' | 'E'): void {
  const p = project(x, y), TH2 = TH / 2, TW2 = TW / 2;
  const H = edge === 'N' || edge === 'W' ? WALL_H : 18;
  let ax: number, ay: number, bx: number, by: number, inx: number, iny: number, f: number;
  if (edge === 'N') { ax = p.x; ay = p.y - TH2; bx = p.x + TW2; by = p.y; inx = -7; iny = 3; f = WALL_BASE; }
  else if (edge === 'W') { ax = p.x - TW2; ay = p.y; bx = p.x; by = p.y - TH2; inx = 7; iny = 3; f = shade(WALL_BASE, 0.82); }
  else if (edge === 'S') { ax = p.x - TW2; ay = p.y; bx = p.x; by = p.y + TH2; inx = 7; iny = -3; f = shade(WALL_BASE, 0.72); }
  else { ax = p.x; ay = p.y + TH2; bx = p.x + TW2; by = p.y; inx = -7; iny = -3; f = shade(WALL_BASE, 0.6); }
  g.poly([ax, ay - H, bx, by - H, bx, by, ax, ay]).fill(f);                                          // outer face
  g.poly([ax, ay - 4, bx, by - 4, bx, by, ax, ay]).fill(shade(WALL_FOOT, edge === 'N' ? 1 : 0.85));  // baseboard
  g.poly([ax, ay - H, bx, by - H, bx + inx, by - H + iny, ax + inx, ay - H + iny]).fill(WALL_TOP);    // top cap (thickness)
}

// a vertical corner column that plugs the junction where two walls meet. Wider
// than a wall's thickness with a two-tone body + a diamond top cap, so it reads
// as a solid post and fully covers the seam (drawn with a z IN FRONT of the two
// walls it joins — see the posts loop — otherwise the walls hide it and the
// corner looks open).
function drawCornerPost(g: Graphics, sx: number, sy: number, H: number): void {
  const hw = 4;
  g.poly([sx - hw, sy, sx, sy, sx, sy - H, sx - hw, sy - H]).fill(shade(WALL_BASE, 0.8)); // left face (shaded)
  g.poly([sx, sy, sx + hw, sy, sx + hw, sy - H, sx, sy - H]).fill(WALL_BASE);             // right face (lit)
  diamond(g, sx, sy - H, hw, 3, WALL_TOP);                                                // diamond top cap
}

export interface DepthItem { g: Graphics; z: number; }
export function buildIsoRooms(): { floor: Container; depthItems: DepthItem[]; labels: Container; seatsByDept: Map<Department, Tile[]>; godSeat: Tile; worldW: number; worldH: number } {
  // Floor stays behind everything.
  const floorC = new Container();
  const floor = new Graphics();
  for (let ty = 0; ty < ISO_GH; ty++) for (let tx = 0; tx < ISO_GW; tx++) {
    const p = project(tx, ty), c = floorColor(tx, ty), inRoom = roomFloorOf.has(key(tx, ty));
    diamond(floor, p.x, p.y, TW / 2, TH / 2, shade(c, 0.84)); // grout
    diamond(floor, p.x, p.y, TW / 2 - 1, TH / 2 - 1, c);      // tile face
    if (inRoom) {                                             // wood-plank seams inside rooms
      for (const off of [-3, 3]) { const hw = Math.round((TW / 2 - 1) * (1 - Math.abs(off) / (TH / 2))); floor.rect(p.x - hw, p.y + off, hw * 2, 1).fill(shade(c, 0.9)); }
    } else {                                                  // corridor: cool tint + a lighter center for a walked look
      diamond(floor, p.x, p.y, TW / 2 - 1, TH / 2 - 1, 0x0a1a33, 0.12); // cool wash → contrast vs. warm rooms
      floor.rect(p.x - 2, p.y - 1, 4, 2).fill(shade(c, 1.08));
    }
  }
  // ── ambient lighting: warm wash inside rooms (vs. cool corridors) + a soft
  // shadow (AO) along the walls, so the floor doesn't read as flat and even.
  for (const r of rooms) {
    const p = project(r.ix + (r.iw - 1) / 2, r.iy + (r.ih - 1) / 2);
    diamond(floor, p.x, p.y - 1, r.iw * TW / 2 * 0.95, r.ih * TH / 2 * 0.95, 0xffdf9c, 0.12);
    diamond(floor, p.x, p.y - 1, r.iw * TW / 2 * 0.55, r.ih * TH / 2 * 0.55, 0xfff1cc, 0.15);
    for (let dy = 0; dy < r.ih; dy++) for (let dx = 0; dx < r.iw; dx++) {
      if (dx === 0 || dy === 0 || dx === r.iw - 1 || dy === r.ih - 1) {
        const q = project(r.ix + dx, r.iy + dy);
        diamond(floor, q.x, q.y, TW / 2 - 1, TH / 2 - 1, 0x0a0a16, 0.18); // wall shadow (AO)
      }
    }
  }
  // area rugs: a bordered rhombus over each room's interior, tinted by the
  // department accent — warms the floor, fills the empty front, and reinforces
  // each room's identity (original art, inspired by iso office interiors). Desks
  // sit against the back wall outside the rug; agents stand on it.
  const rugTint = (r: RoomDef): number =>
    r.name === 'waiting' ? 0x8a7a52 : r.name === 'lounge' ? 0x8a4a86 : accentByName[DEPARTMENT_ACCENT[r.name as Department]];
  const rhombus = (pts: { x: number; y: number }[], s: number, col: number, alpha = 1): void => {
    const cx = (pts[0].x + pts[2].x) / 2, cy = (pts[0].y + pts[2].y) / 2;
    floor.poly(pts.flatMap((p) => [cx + (p.x - cx) * s, cy + (p.y - cy) * s])).fill({ color: col, alpha });
  };
  for (const r of rooms) {
    const a = r.ix + 1, b = r.iy + 1, c = r.ix + r.iw - 2, d = r.iy + r.ih - 2;
    if (c < a || d < b) continue;
    const P = [project(a, b), project(c, b), project(c, d), project(a, d)];
    const tint = rugTint(r);
    rhombus(P, 1.0, mixHex(tint, 0x1a1512, 0.62));   // dark border band
    rhombus(P, 0.9, mixHex(tint, 0x2c2620, 0.5));    // rug field
    rhombus(P, 0.62, mixHex(tint, 0xece2c8, 0.28));  // woven inner medallion
    rhombus(P, 0.34, mixHex(tint, 0x1a1512, 0.5), 0.55);
  }
  // furniture cast shadows on the floor, offset toward the front-right to match
  // the back-left key light, so pieces read as grounded and lit (not floating).
  for (const p of pieces) {
    const q = project(p.x, p.y);
    diamond(floor, q.x + 3, q.y + 3, TW / 2 - 2, TH / 2 - 2, 0x080810, 0.16);
  }
  floorC.addChild(floor);

  // Walls + furniture become individually depth-keyed items so they INTERLEAVE
  // with the agents (added to the same sortable layer, sorted by baseline Y) —
  // an agent behind a wall/shelf is occluded, in front it occludes. This is what
  // makes it read as 3D space instead of flat.
  const depthItems: DepthItem[] = [];
  const wallSets: [Set<string>, 'N' | 'W' | 'S' | 'E'][] = [[wallDrawN, 'N'], [wallDrawW, 'W'], [wallDrawS, 'S'], [wallDrawE, 'E']];
  for (const [set, edge] of wallSets) for (const k of set) {
    if (doorSet.has(k)) continue;                          // leave the doorway open
    const [x, y] = k.split(',').map(Number);
    const g = new Graphics(); drawWall(g, x, y, edge);
    depthItems.push({ g, z: project(x, y).y + (edge === 'S' || edge === 'E' ? 0.6 : 0) });
  }

  // OUTER perimeter wall: encloses the whole floor so it reads as a building,
  // not rooms floating on an endless grey plaza.
  const outer = (x: number, y: number, edge: 'N' | 'W' | 'S' | 'E'): void => {
    const g = new Graphics(); drawWall(g, x, y, edge);
    depthItems.push({ g, z: project(x, y).y + (edge === 'S' || edge === 'E' ? 0.6 : 0) });
  };
  for (let x = 0; x < ISO_GW; x++) { outer(x, 0, 'N'); outer(x, ISO_GH - 1, 'S'); }
  for (let y = 0; y < ISO_GH; y++) { outer(0, y, 'W'); outer(ISO_GW - 1, y, 'E'); }
  // corner posts plug every wall junction so corners always read as joined. Each
  // post's z is the corner tile's own baseline + 4, so it paints IN FRONT of the
  // two walls meeting there and actually covers the seam (with a low z it hid
  // behind the wall and the corner looked open).
  const addPost = (sx: number, sy: number, h: number, zBaseY: number): void => {
    const g = new Graphics(); drawCornerPost(g, sx, sy, h); depthItems.push({ g, z: zBaseY + 4 });
  };
  for (const r of rooms) {
    const x0 = r.ix - 1, y0 = r.iy - 1, x1 = r.ix + r.iw, y1 = r.iy + r.ih;
    const bk = project(x0, y0), rt = project(x1, y0), lf = project(x0, y1), fr = project(x1, y1);
    addPost(bk.x, bk.y - TH / 2, WALL_H, bk.y);   // back corner  (tall)
    addPost(rt.x + TW / 2, rt.y, WALL_H, rt.y);   // right corner (tall N∩low E)
    addPost(lf.x - TW / 2, lf.y, WALL_H, lf.y);   // left corner  (tall W∩low S)
    addPost(fr.x, fr.y + TH / 2, 18, fr.y);       // front corner (low S∩low E)
  }
  // the building's own 4 outer corners (the perimeter wall has none otherwise)
  {
    const tp = project(0, 0), rp = project(ISO_GW - 1, 0), lp = project(0, ISO_GH - 1), fp = project(ISO_GW - 1, ISO_GH - 1);
    addPost(tp.x, tp.y - TH / 2, WALL_H, tp.y);   // top    (tall N∩W)
    addPost(rp.x + TW / 2, rp.y, WALL_H, rp.y);   // right  (tall N∩low E)
    addPost(lp.x - TW / 2, lp.y, WALL_H, lp.y);   // left   (tall W∩low S)
    addPost(fp.x, fp.y + TH / 2, 18, fp.y);       // front  (low S∩low E)
  }

  for (const p of pieces) { const g = new Graphics(); drawPiece(g, p); depthItems.push({ g, z: project(p.x, p.y).y + 0.4 }); }

  // a chair at every waiting-room spot, drawn BEHIND the agent (lower z) so the
  // agent reads as sitting on it
  for (const s of waitingSpots) { const g = new Graphics(); drawPiece(g, { x: s.x, y: s.y, kind: 'chair' }); depthItems.push({ g, z: project(s.x, s.y).y - 0.4 }); }

  // wall decor: only a clock on the west wall, and only for the departments
  // flagged in DEPT_DECOR (so it's a per-room accent, not the same on every
  // wall). No framed picture — the label above the room is the only nameplate.
  for (const r of rooms) {
    if (r.name === 'waiting' || r.name === 'lounge') continue;
    if (!DEPT_DECOR[r.name as Department].clock) continue;
    const x0 = r.ix - 1, midy = r.iy + Math.floor(r.ih / 2);
    const wp = project(x0, midy); const gc = new Graphics(); wallClock(gc, wp.x, wp.y - WALL_H * 0.55); depthItems.push({ g: gc, z: wp.y + 0.2 });
  }

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
