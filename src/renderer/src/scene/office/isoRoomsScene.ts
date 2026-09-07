// Isometric office as independent, furnished department rooms — the in-app
// version of the prototypes/isometric/office-iso-*.mjs design mocks. Draws floor
// + walls + furniture into a Pixi container and exposes the per-department seat
// tiles + a matching Projection, so the real agents sit inside their room.
//
// Layout is decoupled from office.tmj's tile art but kept within its 34x22 grid
// bounds so the existing walkability/seat machinery still addresses valid tiles.
// ORIGINAL art (dark "security-camera" ambience inspired by, not copied from,
// the referenced look). Painter's-algorithm depth via per-piece zIndex.
import { Container, Graphics } from 'pixi.js';
import { accentByName } from '@/design/tokens';
import { DEPARTMENT_ACCENT, type Department } from '@/data/hermesRoster';
import { Projection } from './projection';

export interface Tile { x: number; y: number; }

const TILE = 16, TW = 32, TH = 16, WALL_H = 26;
const ROOM_W = 7, ROOM_H = 8, WALL = 1;
const PX = ROOM_W + WALL, PY = ROOM_H + WALL, COLS = 4, ROWS = 2;
export const ISO_GW = COLS * PX + WALL, ISO_GH = ROWS * PY + WALL; // 33 x 19
const ORIGIN_X = ISO_GH * (TW / 2), ORIGIN_Y = WALL_H + 4;

// which department (or a shared lounge) lives in each room cell
const GRID: (Department | 'lounge')[][] = [
  ['Dirección', 'Desarrollo', 'Creativo', 'Marketing'],
  ['Finanzas', 'Redacción', 'Ciberseguridad', 'lounge'],
];

export function isoRoomsProjection(): Projection {
  return { kind: 'iso', tileSize: TILE, tileW: TW, tileH: TH, originX: ORIGIN_X, originY: ORIGIN_Y };
}

const project = (tx: number, ty: number): { x: number; y: number } => ({ x: ORIGIN_X + (tx - ty) * (TW / 2), y: ORIGIN_Y + (tx + ty) * (TH / 2) });
const cellOf = (x: number, y: number): { cc: number; rr: number } => ({ cc: Math.floor(x / PX), rr: Math.floor(y / PY) });
const inGrid = (cc: number, rr: number): boolean => rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS;
const roomAt = (cc: number, rr: number): Department | 'lounge' | null => (inGrid(cc, rr) ? GRID[rr][cc] : null);

const doorSet = new Set<string>();
for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) doorSet.add(`${cc * PX + Math.round(PX / 2)},${(rr + 1) * PY}`);
const isDoor = (x: number, y: number): boolean => doorSet.has(`${x},${y}`);
const isWallTile = (x: number, y: number): boolean => (x % PX === 0 || y % PY === 0) && !isDoor(x, y);

/** interior (walkable) tiles: everything that isn't a wall, within the grid */
export function isoWalkable(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < ISO_GW && y < ISO_GH && !isWallTile(x, y);
}

const shade = (n: number, f: number): number => {
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
  return (r << 16) | (g << 8) | b;
};
const mixHex = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  return (r << 16) | (g << 8) | bl;
};

const BG = 0x14161f;

function diamond(g: Graphics, cx: number, cy: number, hw: number, hh: number, color: number, alpha = 1): void {
  g.poly([cx, cy - hh, cx + hw, cy, cx, cy + hh, cx - hw, cy]).fill({ color, alpha });
}
function prism(g: Graphics, cx: number, cy: number, hw: number, hh: number, ht: number, top: number, left: number, right: number): void {
  diamond(g, cx, cy + 2, hw + 3, hh + 2, 0x000000, 0.28);                       // ground shadow
  g.poly([cx - hw, cy - ht, cx, cy - ht + hh, cx, cy + hh, cx - hw, cy]).fill(left);   // left face
  g.poly([cx, cy - ht + hh, cx + hw, cy - ht, cx + hw, cy, cx, cy + hh]).fill(right);  // right face
  diamond(g, cx, cy - ht, hw, hh, top);                                          // top
}

// ── furniture (screen-space, tuned for TW=32) ───────────────────────────────
function desk(g: Graphics, tx: number, ty: number): void {
  const p = project(tx, ty), w = 0x8a714a;
  prism(g, p.x, p.y, 13, 7, 9, mixHex(w, 0xffffff, 0.12), shade(w, 0.72), shade(w, 0.55));
  g.rect(p.x - 6, p.y - 25, p.x + 6 - (p.x - 6), 12).fill(0x24282f); // monitor
  g.rect(p.x - 4, p.y - 23, 8, 8).fill(0x6ea0b0);
  g.rect(p.x - 3, p.y - 22, 2, 2).fill(0x9fd0dc);
}
function bookshelf(g: Graphics, tx: number, ty: number): void {
  const p = project(tx, ty), w = 0x63432a;
  prism(g, p.x, p.y, 13, 6, 34, shade(w, 1.05), shade(w, 0.7), shade(w, 0.5));
  const books = [0xbe4638, 0xd2aa46, 0x4678aa, 0x5aa06e, 0xaa6eb4];
  for (let s = 0; s < 3; s++) { const yy = p.y - 8 - s * 9; for (let i = 0; i < 6; i++) g.rect(p.x - 8 + i * 3, yy - 5, 2, 5).fill(books[(i + s) % books.length]); g.rect(p.x - 11, yy, 22, 1).fill(shade(w, 0.4)); }
}
function plant(g: Graphics, tx: number, ty: number): void {
  const p = project(tx, ty);
  diamond(g, p.x, p.y + 2, 8, 5, 0x000000, 0.25);
  g.rect(p.x - 4, p.y - 10, 8, 10).fill(0x966044);
  diamond(g, p.x, p.y - 18, 16, 11, 0x407a46); diamond(g, p.x - 2, p.y - 24, 12, 9, 0x568e5c); diamond(g, p.x + 3, p.y - 22, 9, 7, 0x4a8452);
}
function sofa(g: Graphics, tx: number, ty: number): void {
  const p = project(tx, ty), c = 0x964650;
  prism(g, p.x, p.y, 26, 11, 9, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55));
  g.rect(p.x - 26, p.y - 30, 52, 16).fill(shade(c, 0.8));
}
function pool(g: Graphics, tx: number, ty: number): void {
  const p = project(tx, ty);
  prism(g, p.x, p.y, 34, 17, 9, 0x5c3e28, 0x46301c, 0x362416);
  diamond(g, p.x, p.y - 9, 30, 15, 0x287846);
  for (const [bx, by, c] of [[-12, -3, 0xe6dc3c], [-6, 3, 0xc83c3c], [8, -3, 0xe6e6eb], [14, 3, 0x3c5abe]] as [number, number, number][]) g.rect(p.x + bx, p.y - 9 + by, 2, 2).fill(c);
}

function floorColor(dept: Department | 'lounge' | null, tx: number, ty: number): number {
  if (!dept) return (tx + ty) % 2 ? 0x2a2e3c : 0x242835;         // corridor / outside
  if (dept === 'lounge') return (tx + ty) % 2 ? 0x5a3550 : 0x4e2e46;
  const accent = accentByName[DEPARTMENT_ACCENT[dept]];
  return (tx + ty) % 2 ? mixHex(accent, 0x141414, 0.55) : mixHex(accent, 0x141414, 0.62);
}

/** Draw the whole iso office into a fresh container; return it + per-dept seats. */
export function buildIsoRooms(): { container: Container; seatsByDept: Map<Department, Tile[]>; godSeat: Tile; worldW: number; worldH: number } {
  const container = new Container();
  container.sortableChildren = true;

  // floor + walls, each as its own Graphics so it can carry a depth zIndex
  for (let ty = 0; ty < ISO_GH; ty++) {
    for (let tx = 0; tx < ISO_GW; tx++) {
      const { cc, rr } = cellOf(tx, ty);
      const dept = roomAt(cc, rr);
      const p = project(tx, ty);
      const g = new Graphics();
      if (isWallTile(tx, ty)) {
        const face = 0x343c52, side = shade(0x343c52, 0.72), rim = 0x545c78;
        g.poly([p.x - TW / 2, p.y - WALL_H, p.x, p.y - WALL_H + TH / 2, p.x, p.y + TH / 2, p.x - TW / 2, p.y]).fill(side);
        g.poly([p.x, p.y - WALL_H + TH / 2, p.x + TW / 2, p.y - WALL_H, p.x + TW / 2, p.y, p.x, p.y + TH / 2]).fill(face);
        diamond(g, p.x, p.y - WALL_H, TW / 2, TH / 2, rim);
        g.zIndex = tx + ty;
      } else {
        diamond(g, p.x, p.y, TW / 2, TH / 2, floorColor(dept, tx, ty));
        g.zIndex = tx + ty - 0.3;
      }
      container.addChild(g);
    }
  }

  // furniture + seat tiles per department
  const seatsByDept = new Map<Department, Tile[]>();
  const deskOffsets = [[2, 2], [5, 2], [2, 5], [5, 5], [3, 7]];
  const fg = new Graphics(); fg.zIndex = 1e6; // furniture drawn above floor/walls (agents go above this)
  const furnitureFor = (ox: number, oy: number, dept: Department | 'lounge'): void => {
    if (dept === 'lounge') { pool(fg, ox + 3, oy + 4); plant(fg, ox + 1, oy + 1); plant(fg, ox + 6, oy + 7); sofa(fg, ox + 5, oy + 1); return; }
    bookshelf(fg, ox + 1, oy); bookshelf(fg, ox + 4, oy);
    plant(fg, ox + 6, oy + 7);
    const seats: Tile[] = [];
    for (const [dx, dy] of deskOffsets) { desk(fg, ox + dx, oy + dy); seats.push({ x: ox + dx, y: oy + dy }); }
    seatsByDept.set(dept, seats);
  };
  for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
    const dept = GRID[rr][cc];
    furnitureFor(cc * PX + 1, rr * PY + 1, dept);
  }
  container.addChild(fg);

  // god sits in the Dirección room's first seat slot
  const godSeat = { x: 0 * PX + 1 + 3, y: 0 * PY + 1 + 3 };

  const bottom = project(ISO_GW, ISO_GH);
  return { container, seatsByDept, godSeat, worldW: ORIGIN_X + ISO_GW * (TW / 2) + 20, worldH: bottom.y + 40 };
}
