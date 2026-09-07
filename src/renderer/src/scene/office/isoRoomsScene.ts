// Isometric office: a 3x3 grid of rooms separated by 1-tile CORRIDORS, with a
// central SALA DE ESPERA (waiting room) ringed by the 7 department rooms + a
// lounge. Agents wait in the centre until they are active, then walk (through
// doors + corridors, respecting collision) to their department seat. Walls AND
// furniture are non-walkable — the layout is the physics.
//
// Kept within office.tmj's 34x22 grid so the existing walkability/seat/pathfind
// machinery still addresses valid tiles. ORIGINAL art. Painter's depth via
// per-piece zIndex; agents render above furniture (per-piece occlusion is a
// later pass).
import { Container, Graphics } from 'pixi.js';
import { accentByName } from '@/design/tokens';
import { DEPARTMENT_ACCENT, type Department } from '@/data/hermesRoster';
import { Projection } from './projection';

export interface Tile { x: number; y: number; }

const TILE = 16, TW = 32, TH = 16, WALL_H = 26;
const BLOCK_W = 9, BLOCK_H = 6;                 // room block incl. its walls
const BX0 = [0, BLOCK_W + 1, 2 * (BLOCK_W + 1)];        // 0, 10, 20
const BY0 = [0, BLOCK_H + 1, 2 * (BLOCK_H + 1)];        // 0, 7, 14
export const ISO_GW = 3 * BLOCK_W + 2 + 1;      // 30 (blocks + 2 corridors, +1 pad col unused)
export const ISO_GH = 3 * BLOCK_H + 2 + 1;      // 21
const ORIGIN_X = ISO_GH * (TW / 2), ORIGIN_Y = WALL_H + 4;

const GRID: (Department | 'lounge' | 'waiting')[][] = [
  ['Dirección', 'Desarrollo', 'Creativo'],
  ['Marketing', 'waiting', 'Finanzas'],
  ['Redacción', 'Ciberseguridad', 'lounge'],
];

const project = (tx: number, ty: number): { x: number; y: number } => ({ x: ORIGIN_X + (tx - ty) * (TW / 2), y: ORIGIN_Y + (tx + ty) * (TH / 2) });

// which block a tile is in (or -1 if it's a corridor / outside)
const CORR_X = new Set([BLOCK_W, 2 * BLOCK_W + 1]);      // x = 9, 19
const CORR_Y = new Set([BLOCK_H, 2 * BLOCK_H + 1]);      // y = 6, 13
function blockOf(x: number, y: number): { cc: number; rr: number } | null {
  if (CORR_X.has(x) || CORR_Y.has(y)) return null;
  const cc = BX0.findIndex((x0) => x >= x0 && x < x0 + BLOCK_W);
  const rr = BY0.findIndex((y0) => y >= y0 && y < y0 + BLOCK_H);
  if (cc < 0 || rr < 0) return null;
  return { cc, rr };
}

// ── layout computed once (doors, furniture, seats, waiting spots) ────────────
type Kind = 'desk' | 'bookshelf' | 'plant' | 'bench' | 'pool' | 'sofa';
interface Piece { x: number; y: number; kind: Kind; }

const doorSet = new Set<string>();
const blocked = new Set<string>();     // non-walkable furniture tiles
const pieces: Piece[] = [];
const seatsByDept = new Map<Department, Tile[]>();
const waitingSpots: Tile[] = [];
let godSeat: Tile = { x: 1, y: 1 };

const key = (x: number, y: number): string => `${x},${y}`;
function addPiece(x: number, y: number, kind: Kind, block = true): void { pieces.push({ x, y, kind }); if (block) blocked.add(key(x, y)); }

(function computeLayout(): void {
  for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
    const room = GRID[rr][cc];
    const ox = BX0[cc] + 1, oy = BY0[rr] + 1; // interior origin (7x4: dx0..6, dy0..3)
    // door: on a wall facing the centre, at wall mid
    const bx0 = BX0[cc], by0 = BY0[rr];
    const doors: [number, number][] = [];
    if (room === 'waiting') { doors.push([bx0, by0 + 3], [bx0 + BLOCK_W - 1, by0 + 2], [bx0 + 4, by0], [bx0 + 4, by0 + BLOCK_H - 1]); }
    else {
      if (cc === 0) doors.push([bx0 + BLOCK_W - 1, by0 + 2]);        // right
      else if (cc === 2) doors.push([bx0, by0 + 2]);                 // left
      else if (rr === 0) doors.push([bx0 + 4, by0 + BLOCK_H - 1]);   // bottom
      else doors.push([bx0 + 4, by0]);                              // top
    }
    for (const [dx, dy] of doors) doorSet.add(key(dx, dy));

    if (room === 'waiting') {
      for (let dx = 0; dx < 7; dx++) addPiece(ox + dx, oy, 'bench');         // bench row at back
      for (let dy = 1; dy < 4; dy++) for (let dx = 0; dx < 7; dx++) waitingSpots.push({ x: ox + dx, y: oy + dy });
    } else if (room === 'lounge') {
      addPiece(ox + 3, oy + 1, 'pool'); addPiece(ox + 3, oy + 2, 'pool', false);
      addPiece(ox + 5, oy, 'sofa'); addPiece(ox + 1, oy, 'plant'); addPiece(ox + 6, oy + 3, 'plant');
    } else {
      addPiece(ox + 1, oy, 'bookshelf'); addPiece(ox + 4, oy, 'bookshelf'); addPiece(ox + 6, oy, 'plant');
      const seats: Tile[] = [];
      for (const dx of [1, 3, 5]) { addPiece(ox + dx, oy + 1, 'desk'); seats.push({ x: ox + dx, y: oy + 2 }); } // seat in front of desk
      seatsByDept.set(room, seats);
    }
  }
  // god oversees from the front-centre of the waiting room
  const wOx = BX0[1] + 1, wOy = BY0[1] + 1;
  godSeat = { x: wOx + 3, y: wOy + 3 };
})();

export function isoRoomsProjection(): Projection {
  return { kind: 'iso', tileSize: TILE, tileW: TW, tileH: TH, originX: ORIGIN_X, originY: ORIGIN_Y };
}

function isWallTile(x: number, y: number): boolean {
  const b = blockOf(x, y);
  if (!b) return false; // corridor
  const bx = x - BX0[b.cc], by = y - BY0[b.rr];
  const border = bx === 0 || bx === BLOCK_W - 1 || by === 0 || by === BLOCK_H - 1;
  return border && !doorSet.has(key(x, y));
}
/** walkable = corridors + room interiors + doors, minus furniture, within grid */
export function isoWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= ISO_GW || y >= ISO_GH) return false;
  if (isWallTile(x, y)) return false;
  if (blocked.has(key(x, y))) return false;
  return true;
}
export function isoWaitingSpots(): Tile[] { return waitingSpots; }
export function isoGodSeat(): Tile { return godSeat; }

// ── colours + primitives ────────────────────────────────────────────────────
const shade = (n: number, f: number): number => { const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f)); return (r << 16) | (g << 8) | b; };
const mixHex = (a: number, b: number, t: number): number => { const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t); const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t); const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t); return (r << 16) | (g << 8) | bl; };

function diamond(g: Graphics, cx: number, cy: number, hw: number, hh: number, color: number, alpha = 1): void { g.poly([cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy]).fill({ color, alpha }); }
function prism(g: Graphics, cx: number, cy: number, hw: number, hh: number, ht: number, top: number, left: number, right: number): void {
  diamond(g, cx, cy + 2, hw + 3, hh + 2, 0x000000, 0.28);
  g.poly([cx - hw, cy - ht, cx, cy - ht + hh, cx, cy + hh, cx - hw, cy]).fill(left);
  g.poly([cx, cy - ht + hh, cx + hw, cy - ht, cx + hw, cy, cx, cy + hh]).fill(right);
  diamond(g, cx, cy - ht, hw, hh, top);
}

function drawPiece(g: Graphics, p: Piece): void {
  const { x, y } = project(p.x, p.y);
  switch (p.kind) {
    case 'desk': { const w = 0x8a714a; prism(g, x, y, 13, 7, 9, mixHex(w, 0xffffff, 0.12), shade(w, 0.72), shade(w, 0.55)); g.rect(x - 6, y - 25, 12, 12).fill(0x24282f); g.rect(x - 4, y - 23, 8, 8).fill(0x6ea0b0); break; }
    case 'bookshelf': { const w = 0x63432a; prism(g, x, y, 13, 6, 34, shade(w, 1.05), shade(w, 0.7), shade(w, 0.5)); const bk = [0xbe4638, 0xd2aa46, 0x4678aa, 0x5aa06e, 0xaa6eb4]; for (let s = 0; s < 3; s++) { const yy = y - 8 - s * 9; for (let i = 0; i < 6; i++) g.rect(x - 8 + i * 3, yy - 5, 2, 5).fill(bk[(i + s) % 5]); } break; }
    case 'plant': { diamond(g, x, y + 2, 8, 5, 0x000000, 0.25); g.rect(x - 4, y - 10, 8, 10).fill(0x966044); diamond(g, x, y - 18, 16, 11, 0x407a46); diamond(g, x - 2, y - 24, 12, 9, 0x568e5c); break; }
    case 'bench': { const c = 0x7a5a3c; prism(g, x, y, 12, 6, 6, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55)); g.rect(x - 12, y - 16, 24, 8).fill(shade(c, 0.85)); break; }
    case 'pool': { prism(g, x, y, 15, 8, 8, 0x5c3e28, 0x46301c, 0x362416); diamond(g, x, y - 8, 13, 7, 0x287846); break; }
    case 'sofa': { const c = 0x964650; prism(g, x, y, 15, 8, 8, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55)); g.rect(x - 15, y - 22, 30, 12).fill(shade(c, 0.8)); break; }
  }
}

function floorColor(x: number, y: number): number {
  const b = blockOf(x, y);
  if (!b) return (x + y) % 2 ? 0x2e3342 : 0x272b38;            // corridor
  const room = GRID[b.rr][b.cc];
  if (room === 'waiting') return (x + y) % 2 ? 0x6a6152 : 0x5f5748;   // warm neutral
  if (room === 'lounge') return (x + y) % 2 ? 0x5a3550 : 0x4e2e46;
  const accent = accentByName[DEPARTMENT_ACCENT[room]];
  return (x + y) % 2 ? mixHex(accent, 0x141414, 0.55) : mixHex(accent, 0x141414, 0.62);
}

export function buildIsoRooms(): { container: Container; seatsByDept: Map<Department, Tile[]>; godSeat: Tile; worldW: number; worldH: number } {
  const container = new Container();
  container.sortableChildren = true;

  for (let ty = 0; ty < ISO_GH; ty++) for (let tx = 0; tx < ISO_GW; tx++) {
    const p = project(tx, ty), g = new Graphics();
    if (isWallTile(tx, ty)) {
      const face = 0x343c52, side = shade(0x343c52, 0.72), rim = 0x545c78;
      g.poly([p.x - TW / 2, p.y - WALL_H, p.x, p.y - WALL_H + TH / 2, p.x, p.y + TH / 2, p.x - TW / 2, p.y]).fill(side);
      g.poly([p.x, p.y - WALL_H + TH / 2, p.x + TW / 2, p.y - WALL_H, p.x + TW / 2, p.y, p.x, p.y + TH / 2]).fill(face);
      diamond(g, p.x, p.y - WALL_H, TW / 2, TH / 2, rim);
      g.zIndex = tx + ty;
    } else {
      // only paint floor for in-grid tiles (skip the unused pad row/col)
      if (blockOf(tx, ty) || CORR_X.has(tx) || CORR_Y.has(ty)) {
        diamond(g, p.x, p.y, TW / 2, TH / 2, floorColor(tx, ty));
      }
      g.zIndex = tx + ty - 0.3;
    }
    container.addChild(g);
  }

  const fg = new Graphics(); fg.zIndex = 1e6;
  for (const p of pieces) drawPiece(fg, p);
  container.addChild(fg);

  const bottom = project(ISO_GW, ISO_GH);
  return { container, seatsByDept, godSeat, worldW: ORIGIN_X + ISO_GW * (TW / 2) + 20, worldH: bottom.y + 40 };
}
