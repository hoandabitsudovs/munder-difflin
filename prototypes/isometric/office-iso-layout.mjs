// Design mock v2: the office as ONE isometric floor divided by interior walls
// into independent department rooms ("salas independientes"). Improvements over
// v1: bigger rooms, a strong accent-tinted floor per department (clear identity),
// warmer/cleaner walls with a light top trim, a DOOR opening in each room, and a
// potted plant for warmth. Same native-grid pixel technique + painter's sort.
//   node office-iso-layout.mjs [out.png]
import { writeFileSync } from 'node:fs';
import { makeBuf, set, rect, diamond, mix, shade, upscale, encodePNG, OUTLINE, alphaAt } from './lib/pixel.mjs';
import { drawChar } from './lib/char.mjs';
import { CAST, ACCENT, DEPARTMENT_ACCENT, ROOM_MEMBERS } from './lib/cast-iso.mjs';

const TILE_W = 16, TILE_H = 8, WALL_H = 12;
const ROOM_W = 6, ROOM_H = 5, WALL = 1;
const PX = ROOM_W + WALL, PY = ROOM_H + WALL;
const COLS = 4, ROWS = 2;
const GW = COLS * PX + WALL, GH = ROWS * PY + WALL;
const W = 372, H = 236, F = 3;
const ORIGIN_X = GH * (TILE_W / 2) + 12, ORIGIN_Y = 20;
const paper = [244, 241, 234];
const project = (tx, ty) => ({ x: ORIGIN_X + (tx - ty) * (TILE_W / 2), y: ORIGIN_Y + (tx + ty) * (TILE_H / 2) });

const GRID = [
  ['Dirección', 'Desarrollo', 'Creativo', 'Marketing'],
  ['Finanzas', 'Redacción', 'Ciberseguridad', null],
];
const cellOf = (x, y) => ({ cc: Math.floor(x / PX), rr: Math.floor(y / PY) });
const deptAt = (x, y) => { const { cc, rr } = cellOf(x, y); return (rr < ROWS && cc < COLS) ? GRID[rr][cc] : null; };

// door gap: skip the wall tile at the centre of each room's south (front-facing)
// edge, so rooms read as enterable and connect to the room in front.
const doors = new Set();
for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
  if (!GRID[rr][cc]) continue;
  doors.add(`${cc * PX + Math.round(PX / 2)},${(rr + 1) * PY}`);
}
const isDoor = (x, y) => doors.has(`${x},${y}`);
const isWall = (x, y) => (x % PX === 0 || y % PY === 0) && !isDoor(x, y);

const buf = makeBuf(W, H, paper);

function floorTile(tx, ty) {
  const dept = deptAt(tx, ty);
  const accent = dept ? ACCENT[DEPARTMENT_ACCENT[dept]] : [172, 170, 160];
  const light = mix(accent, [255, 255, 255], dept ? 0.42 : 0.7);
  const dark = mix(accent, [255, 255, 255], dept ? 0.3 : 0.63);
  const p = project(tx, ty);
  diamond(buf, W, H, p.x, p.y, TILE_W, TILE_H, (tx + ty) % 2 ? light : dark);
}

function wallTile(tx, ty) {
  const p = project(tx, ty);
  const face = [201, 193, 181], side = shade([201, 193, 181], 0.74), lip = [224, 218, 206];
  const halfH = TILE_H / 2, halfW = TILE_W / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, rw = Math.round(halfW * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, k >= WALL_H - 2 ? lip : face);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, k >= WALL_H - 2 ? lip : side);
  }
}

function desk(tx, ty) {
  const p = project(tx, ty), dh = 6, hw = TILE_W / 2 - 1, hh = TILE_H / 2 - 1, wood = [138, 113, 74];
  for (let dy = -hh; dy <= hh; dy++) {
    const frac = 1 - Math.abs(dy) / hh, rw = Math.round(hw * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < dh; k++) set(buf, W, H, p.x + dx, p.y + dy - k, shade(wood, 0.72));
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < dh; k++) set(buf, W, H, p.x + dx, p.y + dy - k, shade(wood, 0.55));
  }
  diamond(buf, W, H, p.x, p.y - dh, TILE_W - 2, TILE_H - 2, mix(wood, [255, 255, 255], 0.12));
  rect(buf, W, H, p.x - 1, p.y - dh - 6, p.x + 1, p.y - dh - 3, [40, 44, 52]);
  set(buf, W, H, p.x, p.y - dh - 2, [90, 96, 110]);
}

function plant(tx, ty) {
  const p = project(tx, ty);
  rect(buf, W, H, p.x - 2, p.y - 4, p.x + 2, p.y, [150, 92, 60]);        // pot
  rect(buf, W, H, p.x - 2, p.y - 5, p.x + 2, p.y - 4, [120, 72, 46]);
  const g1 = [70, 130, 74], g2 = [92, 158, 96];
  diamond(buf, W, H, p.x, p.y - 9, 10, 8, g1);
  diamond(buf, W, H, p.x - 1, p.y - 12, 7, 6, g2);
  diamond(buf, W, H, p.x + 2, p.y - 11, 6, 5, g1);
}

function outlineScene() {
  const occ = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) occ[i] = alphaAt(buf, W, H, i % W, (i / W) | 0) === 255 && !(buf[i * 4] === paper[0] && buf[i * 4 + 1] === paper[1] && buf[i * 4 + 2] === paper[2]) ? 1 : 0;
  const paint = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (occ[i]) continue; if (occ[i - 1] || occ[i + 1] || occ[i - W] || occ[i + W]) paint.push(i); }
  for (const i of paint) set(buf, W, H, i % W, (i / W) | 0, OUTLINE);
}

const draw = [];
for (let ty = 0; ty < GH; ty++) for (let tx = 0; tx < GW; tx++) {
  if (isWall(tx, ty)) draw.push({ z: tx + ty, fn: () => wallTile(tx, ty) });
  else draw.push({ z: tx + ty - 0.2, fn: () => floorTile(tx, ty) });
}
// people (char + desk) and a plant per department room
const SLOTS = [[2, 1], [4, 1], [3, 3]];
for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
  const dept = GRID[rr][cc];
  if (!dept) continue;
  const ox = cc * PX, oy = rr * PY;
  (ROOM_MEMBERS[dept] || []).forEach(([name], i) => {
    const [sx, sy] = SLOTS[i % SLOTS.length];
    const tx = ox + sx, ty = oy + sy;
    draw.push({ z: tx + ty - 0.05, fn: () => { const pr = project(tx, ty); drawChar(buf, W, H, pr.x - 8, pr.y + 3, CAST[name]); } });
    draw.push({ z: tx + ty + 0.9, fn: () => desk(ox + sx, oy + sy + 1) });
  });
  // a plant in the back corner of each room
  const ptx = ox + 1, pty = oy + 1;
  draw.push({ z: ptx + pty - 0.1, fn: () => plant(ptx, pty) });
}
draw.sort((a, b) => a.z - b.z);
for (const d of draw) d.fn();
outlineScene();

const up = upscale(buf, W, H, F);
const out = process.argv[2] || '/tmp/office-iso-layout.png';
writeFileSync(out, encodePNG(up, W * F, H * F));
console.log('wrote', out);
