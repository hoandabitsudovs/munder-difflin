// Design mock v3 — aiming at the richer, atmospheric look the user referenced
// (dark "security-camera" ambience, themed rooms full of furniture). ORIGINAL
// art: the reference is Agent-Pixels, which has no license, so nothing is copied
// — this only borrows the idea (dark bg, varied furnished rooms, wall decor,
// CCTV framing). Same native-grid pixel technique + painter's-algorithm sort.
//   node office-iso-rich.mjs [out.png]
import { writeFileSync } from 'node:fs';
import { makeBuf, set, rect, diamond, mix, shade, upscale, encodePNG, OUTLINE, alphaAt } from './lib/pixel.mjs';
import { drawChar } from './lib/char.mjs';
import { CAST } from './lib/cast-iso.mjs';

const TW = 16, TH = 8;
const ROOM_W = 13, ROOM_H = 11, WALL = 1, WALL_H = 24;   // much bigger rooms
const PX = ROOM_W + WALL, PY = ROOM_H + WALL, COLS = 2, ROWS = 2;
const GW = COLS * PX + WALL, GH = ROWS * PY + WALL;
const F = 2;
const OX = GH * (TW / 2) + 12, OY = 40;
const W = OX + GW * (TW / 2) + 14, H = OY + (GW + GH) * (TH / 2) + 30;
const BG = [20, 22, 33];
const project = (tx, ty) => ({ x: OX + (tx - ty) * (TW / 2), y: OY + (tx + ty) * (TH / 2) });
const buf = makeBuf(W, H, BG);

// ── room themes ───────────────────────────────────────────────────────────
const ROOMS = [
  ['work', 'wood'],       // top-left  : trabajo (escritorios + estantería)
  ['board', 'carpetB'],   // top-right : sala de reuniones
  ['game', 'pink'],       // bot-left  : lounge / juegos
  ['kitchen', 'tan'],     // bot-right : cocina / break
];
const roomAt = (cc, rr) => ROOMS[rr * COLS + cc];
const cellOf = (x, y) => ({ cc: Math.floor(x / PX), rr: Math.floor(y / PY) });
const inGrid = (cc, rr) => cc < COLS && rr < ROWS;

const doors = new Set();
for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) doors.add(`${cc * PX + Math.round(PX / 2)},${(rr + 1) * PY}`);
const isDoor = (x, y) => doors.has(`${x},${y}`);
const isWall = (x, y) => (x % PX === 0 || y % PY === 0) && !isDoor(x, y);

const FLOORS = {
  wood: [[128, 92, 56], [116, 82, 48]],
  carpetB: [[70, 86, 120], [60, 76, 108]],
  pink: [[150, 96, 120], [136, 84, 108]],
  tan: [[176, 152, 120], [162, 138, 108]],
};

function floorTile(tx, ty) {
  const { cc, rr } = cellOf(tx, ty);
  const theme = inGrid(cc, rr) ? roomAt(cc, rr)[1] : null;
  const mat = theme ? FLOORS[theme] : [[40, 44, 58], [34, 38, 50]];
  const p = project(tx, ty);
  const base = (tx + ty) % 2 ? mat[0] : mat[1];
  diamond(buf, W, H, p.x, p.y, TW, TH, base);
  // per-material texture
  if (theme === 'wood') {                         // plank seam across the tile
    for (let dx = -TW / 2 + 1; dx <= TW / 2 - 1; dx++) set(buf, W, H, p.x + dx, p.y, shade(base, 0.86));
  } else if (theme === 'tan') {                    // kitchen tile grout (diamond outline)
    for (let d = 0; d <= TW / 2; d++) { const yy = Math.round(TH / 2 * (1 - d / (TW / 2))); set(buf, W, H, p.x - d, p.y - yy, shade(base, 0.8)); set(buf, W, H, p.x + d, p.y - yy, shade(base, 0.8)); set(buf, W, H, p.x - d, p.y + yy, shade(base, 0.8)); set(buf, W, H, p.x + d, p.y + yy, shade(base, 0.8)); }
  } else if (theme) {                              // carpet/pink: subtle fleck
    if ((tx * 7 + ty * 3) % 5 === 0) set(buf, W, H, p.x + 2, p.y - 1, shade(base, 1.12));
    if ((tx * 5 + ty * 11) % 4 === 0) set(buf, W, H, p.x - 2, p.y + 1, shade(base, 0.9));
  }
}

function wallTile(tx, ty) {
  const p = project(tx, ty);
  const face = [52, 60, 82], side = shade([52, 60, 82], 0.72), rim = [84, 94, 120];
  const halfH = TH / 2, halfW = TW / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, rw = Math.round(halfW * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, k >= WALL_H - 2 ? rim : face);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, k >= WALL_H - 2 ? rim : side);
  }
}

// soft filled diamond with alpha (shadows, rugs)
function softDiamond(cx, cy, hw, hh, c, a) {
  for (let dy = -hh; dy <= hh; dy++) {
    const frac = 1 - Math.abs(dy) / hh, rw = Math.round(hw * frac);
    for (let dx = -rw; dx <= rw; dx++) set(buf, W, H, cx + dx, cy + dy, c, a);
  }
}

// generic iso prism (furniture body): center-bottom (cx,cy), screen half-extents
function prism(cx, cy, hw, hh, ht, top, left, right) {
  softDiamond(cx, cy + 1, hw + 2, hh + 1, [0, 0, 0], 70); // ground shadow
  for (let dy = -hh; dy <= hh; dy++) {
    const frac = 1 - Math.abs(dy) / hh, rw = Math.round(hw * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < ht; k++) set(buf, W, H, cx + dx, cy + dy - k, left);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < ht; k++) set(buf, W, H, cx + dx, cy + dy - k, right);
  }
  diamond(buf, W, H, cx, cy - ht, hw * 2, hh * 2, top);
}

// ── furniture (all at a tile via project) ───────────────────────────────────
function desk(tx, ty) {
  const p = project(tx, ty), w = [138, 113, 74];
  prism(p.x, p.y, 7, 5, 6, mix(w, [255, 255, 255], 0.12), shade(w, 0.72), shade(w, 0.55));
  rect(buf, W, H, p.x - 1, p.y - 8, p.x + 1, p.y - 6, [40, 44, 54]);    // monitor stand
  rect(buf, W, H, p.x - 4, p.y - 16, p.x + 4, p.y - 8, [30, 34, 44]);   // monitor bezel
  rect(buf, W, H, p.x - 3, p.y - 15, p.x + 3, p.y - 9, [98, 156, 176]); // screen
  set(buf, W, H, p.x - 2, p.y - 14, [150, 200, 214]);                   // glare
}
function bookshelf(tx, ty) {
  const p = project(tx, ty), w = [96, 66, 42];
  prism(p.x, p.y, 7, 4, 22, shade(w, 1.05), shade(w, 0.7), shade(w, 0.5));
  const books = [[190, 70, 60], [210, 170, 70], [70, 120, 170], [90, 160, 110], [170, 110, 180]];
  for (let s = 0; s < 3; s++) {           // three shelves of colour ticks on the front face
    const yy = p.y - 5 - s * 6;
    for (let i = 0; i < 6; i++) set(buf, W, H, p.x + 1 + i * 1, yy, books[(i + s) % books.length]);
    rect(buf, W, H, p.x - 6, yy + 1, p.x + 6, yy + 1, shade(w, 0.4));
  }
}
function confTable(tx, ty) {
  const p = project(tx, ty), w = [120, 96, 62];
  prism(p.x, p.y, 40, 16, 6, mix(w, [255, 255, 255], 0.1), shade(w, 0.72), shade(w, 0.55));
  diamond(buf, W, H, p.x, p.y - 7, 68, 24, mix(w, [255, 255, 255], 0.16)); // table top
  for (const dx of [-24, -8, 8, 24]) diamond(buf, W, H, p.x + dx, p.y - 7, 8, 5, [70, 110, 90]); // papers/plant
}
function chair(tx, ty, c = [70, 120, 90]) {
  const p = project(tx, ty);
  prism(p.x, p.y, 4, 3, 6, shade(c, 1.1), shade(c, 0.7), shade(c, 0.55));
  rect(buf, W, H, p.x - 3, p.y - 12, p.x + 3, p.y - 7, shade(c, 0.8));  // backrest
}
function sofa(tx, ty, c = [150, 70, 80]) {
  const p = project(tx, ty);
  prism(p.x, p.y, 14, 6, 6, shade(c, 1.1), shade(c, 0.72), shade(c, 0.55));   // seat
  rect(buf, W, H, p.x - 14, p.y - 16, p.x + 14, p.y - 7, shade(c, 0.8));       // back
  prism(p.x - 13, p.y - 1, 2, 5, 8, shade(c, 1.05), shade(c, 0.7), shade(c, 0.5)); // arm L
  prism(p.x + 13, p.y - 1, 2, 5, 8, shade(c, 1.05), shade(c, 0.7), shade(c, 0.5)); // arm R
}
function coffee(tx, ty) {
  const p = project(tx, ty), w = [90, 70, 60];
  prism(p.x, p.y, 8, 4, 4, mix(w, [255, 255, 255], 0.15), shade(w, 0.72), shade(w, 0.55));
  set(buf, W, H, p.x + 2, p.y - 5, [230, 230, 235]); set(buf, W, H, p.x + 2, p.y - 6, [230, 230, 235]);
}
function arcade(tx, ty) {
  const p = project(tx, ty), c = [60, 40, 90];
  prism(p.x, p.y, 6, 5, 26, shade(c, 1.1), shade(c, 0.7), shade(c, 0.5));
  rect(buf, W, H, p.x - 3, p.y - 22, p.x + 3, p.y - 16, [40, 200, 220]);  // glowing screen
  rect(buf, W, H, p.x - 3, p.y - 14, p.x + 3, p.y - 12, [220, 90, 90]);   // controls
}
function poolTable(tx, ty) {
  const p = project(tx, ty);
  prism(p.x, p.y, 30, 15, 6, [92, 62, 40], [70, 46, 28], [54, 36, 22]);   // wooden body
  diamond(buf, W, H, p.x, p.y - 6, 52, 24, [40, 120, 70]);                // green felt
  for (const [bx, by, c] of [[-10, -2, [230, 220, 60]], [-5, 2, [200, 60, 60]], [6, -2, [230, 230, 235]], [12, 2, [60, 90, 190]], [0, 0, [230, 150, 40]]]) set(buf, W, H, p.x + bx, p.y - 6 + by, c);
}
function vending(tx, ty) {
  const p = project(tx, ty), c = [180, 60, 60];
  prism(p.x, p.y, 7, 5, 24, shade(c, 1.05), shade(c, 0.7), shade(c, 0.5));
  rect(buf, W, H, p.x - 4, p.y - 22, p.x + 4, p.y - 8, [40, 46, 60]);     // glass
  const items = [[240, 210, 80], [90, 170, 220], [230, 120, 90]];
  for (let r = 0; r < 3; r++) for (let cc = 0; cc < 3; cc++) set(buf, W, H, p.x - 3 + cc * 3, p.y - 20 + r * 4, items[(r + cc) % 3]);
}
function cooler(tx, ty) {
  const p = project(tx, ty);
  prism(p.x, p.y, 4, 3, 12, [220, 224, 230], [150, 156, 168], [120, 126, 140]);
  diamond(buf, W, H, p.x, p.y - 14, 8, 5, [110, 180, 220]);              // bottle
}
function counter(tx, ty, len = 3) {
  const p = project(tx, ty), c = [206, 200, 188];
  prism(p.x, p.y, TW / 2 * len, TH / 2, 10, mix(c, [255, 255, 255], 0.1), shade(c, 0.74), shade(c, 0.58));
  diamond(buf, W, H, p.x, p.y - 10, TW * len - 2, TH - 2, mix(c, [255, 255, 255], 0.2));
}
function coffeeMachine(tx, ty) {
  const p = project(tx, ty), c = [46, 50, 60];
  prism(p.x, p.y, 5, 3, 9, shade(c, 1.2), shade(c, 0.8), shade(c, 0.6));
  rect(buf, W, H, p.x - 2, p.y - 7, p.x + 2, p.y - 5, [180, 60, 50]);   // red panel
  set(buf, W, H, p.x - 1, p.y - 4, [90, 60, 40]); set(buf, W, H, p.x + 1, p.y - 4, [90, 60, 40]); // two pots
}
function plant(tx, ty) {
  const p = project(tx, ty);
  rect(buf, W, H, p.x - 2, p.y - 5, p.x + 2, p.y, [150, 92, 60]); rect(buf, W, H, p.x - 2, p.y - 6, p.x + 2, p.y - 5, [120, 72, 46]);
  diamond(buf, W, H, p.x, p.y - 10, 11, 8, [64, 122, 70]);
  diamond(buf, W, H, p.x - 1, p.y - 13, 8, 6, [86, 150, 92]);
  diamond(buf, W, H, p.x + 2, p.y - 12, 6, 5, [72, 132, 78]);
}

function rug(tx, ty, wt, ht, c) {
  const p = project(tx, ty);
  softDiamond(p.x, p.y, wt * TW / 2, ht * TH / 2, c, 205);
  softDiamond(p.x, p.y, wt * TW / 2 - 3, ht * TH / 2 - 2, shade(c, 1.12), 120);
}
function filingCabinet(tx, ty) {
  const p = project(tx, ty), c = [110, 118, 130];
  prism(p.x, p.y, 6, 4, 16, shade(c, 1.08), shade(c, 0.72), shade(c, 0.55));
  for (const yy of [-3, -8, -13]) rect(buf, W, H, p.x - 3, p.y + yy, p.x + 3, p.y + yy, shade(c, 0.5));
}
function lamp(tx, ty) {
  const p = project(tx, ty);
  softDiamond(p.x, p.y + 2, 16, 9, [255, 236, 170], 40);           // warm light pool on the floor
  softDiamond(p.x, p.y + 1, 5, 3, [0, 0, 0], 70);                  // base shadow
  rect(buf, W, H, p.x, p.y - 22, p.x, p.y, [78, 72, 64]);          // pole
  rect(buf, W, H, p.x - 2, p.y - 1, p.x + 2, p.y, [78, 72, 64]);   // base
  diamond(buf, W, H, p.x, p.y - 26, 13, 8, [120, 100, 70]);        // shade underside
  diamond(buf, W, H, p.x, p.y - 27, 13, 8, [250, 230, 158]);       // shade (lit)
  softDiamond(p.x, p.y - 24, 8, 5, [255, 248, 214], 150);          // glow
}
// wall decor drawn at screen coords (small flat pieces on the back walls)
function picture(sx, sy, c) {
  rect(buf, W, H, sx - 5, sy - 4, sx + 5, sy + 4, [40, 32, 26]);   // frame
  rect(buf, W, H, sx - 4, sy - 3, sx + 4, sy + 3, c);
  rect(buf, W, H, sx - 4, sy + 1, sx + 4, sy + 3, shade(c, 0.7));
}
function whiteboard(sx, sy) {
  rect(buf, W, H, sx - 14, sy - 7, sx + 14, sy + 7, [210, 214, 220]);
  rect(buf, W, H, sx - 15, sy - 8, sx + 15, sy - 7, [150, 154, 162]);
  for (const [x0, x1, yy, c] of [[-11, -3, -3, [90, 130, 200]], [-11, -6, 0, [200, 100, 90]], [-11, -8, 3, [110, 170, 120]], [3, 11, -2, [90, 130, 200]], [3, 8, 2, [150, 150, 160]]]) rect(buf, W, H, sx + x0, sy + yy, sx + x1, sy + yy, c);
}
function clock(sx, sy) {
  softDiamond(sx, sy, 6, 6, [235, 235, 238], 255);
  rect(buf, W, H, sx, sy - 3, sx, sy, [40, 40, 46]);
  rect(buf, W, H, sx, sy, sx + 2, sy, [40, 40, 46]);
}

function outlineScene() {
  const occ = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) occ[i] = alphaAt(buf, W, H, i % W, (i / W) | 0) === 255 && !(buf[i * 4] === BG[0] && buf[i * 4 + 1] === BG[1] && buf[i * 4 + 2] === BG[2]) ? 1 : 0;
  const paint = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (occ[i]) continue; if (occ[i - 1] || occ[i + 1] || occ[i - W] || occ[i + W]) paint.push(i); }
  for (const i of paint) set(buf, W, H, i % W, (i / W) | 0, [12, 13, 20]);
}

// ── build drawables ─────────────────────────────────────────────────────────
const draw = [];
for (let ty = 0; ty < GH; ty++) for (let tx = 0; tx < GW; tx++) {
  if (isWall(tx, ty)) draw.push({ z: tx + ty, fn: () => wallTile(tx, ty) });
  else draw.push({ z: tx + ty - 0.3, fn: () => floorTile(tx, ty) });
}
const add = (tx, ty, fn, zoff = 0) => draw.push({ z: tx + ty + zoff, fn });
const person = (tx, ty, name) => add(tx, ty, () => { const p = project(tx, ty); drawChar(buf, W, H, p.x - 8, p.y + 3, CAST[name]); }, -0.05);

// room origins
const O = (cc, rr) => ({ x: cc * PX + 1, y: rr * PY + 1 });
let A = O(0, 0), B = O(1, 0), C = O(0, 1), D = O(1, 1);

// WORK room (13x11): bookshelves along the back wall, desks+people spread out
[1, 4, 7, 10].forEach((dx) => add(A.x + dx, A.y, () => bookshelf(A.x + dx, A.y - 0.4)));
[[1, 3, 'mateo'], [5, 3, 'diego'], [9, 3, 'andres'], [3, 7, 'nicolas'], [8, 8, 'valentina']].forEach(([dx, dy, name]) => {
  add(A.x + dx, A.y + dy, () => desk(A.x + dx, A.y + dy), 0.9);
  person(A.x + dx, A.y + dy, name);
});
add(A.x + 12, A.y + 10, () => plant(A.x + 12, A.y + 10));
add(A.x, A.y + 9, () => plant(A.x, A.y + 9));

// BOARD room: one big conference table, chairs around it, a few seated
add(B.x + 6, B.y + 5, () => confTable(B.x + 6, B.y + 5), 0.9);
[[2, 3], [6, 2], [10, 3], [2, 7], [6, 8], [10, 7]].forEach(([dx, dy]) => add(B.x + dx, B.y + dy, () => chair(B.x + dx, B.y + dy)));
person(B.x + 2, B.y + 3, 'javier'); person(B.x + 10, B.y + 7, 'sofia'); person(B.x + 6, B.y + 8, 'rafael');
add(B.x + 12, B.y + 10, () => plant(B.x + 12, B.y + 10));

// LOUNGE / juegos: pool table in the middle, arcade + sofa + coffee at the edges
add(C.x + 6, C.y + 6, () => poolTable(C.x + 6, C.y + 6), 0.9);
add(C.x + 1, C.y + 1, () => arcade(C.x + 1, C.y + 1), 0.9);
add(C.x + 11, C.y + 2, () => sofa(C.x + 11, C.y + 2), 0.9);
add(C.x + 11, C.y + 4, () => coffee(C.x + 11, C.y + 4), 0.9);
person(C.x + 2, C.y + 8, 'gabriela'); person(C.x + 9, C.y + 9, 'lucas'); person(C.x + 3, C.y + 5, 'camila');
add(C.x + 12, C.y + 10, () => plant(C.x + 12, C.y + 10));

// KITCHEN / break: a counter run along the back, vending + cooler, a café corner
add(D.x + 2, D.y, () => counter(D.x + 2, D.y, 3), 0.5);
add(D.x + 8, D.y, () => vending(D.x + 8, D.y), 0.9);
add(D.x + 11, D.y + 1, () => cooler(D.x + 11, D.y + 1), 0.9);
add(D.x + 5, D.y, () => coffeeMachine(D.x + 5, D.y), 0.6); // on the counter run
add(D.x + 5, D.y + 6, () => coffee(D.x + 5, D.y + 6), 0.9);
[[3, 6], [7, 6], [5, 4]].forEach(([dx, dy]) => add(D.x + dx, D.y + dy, () => chair(D.x + dx, D.y + dy, [150, 110, 70])));
person(D.x + 3, D.y + 6, 'carlos'); person(D.x + 8, D.y + 8, 'daniela');
add(D.x + 12, D.y + 10, () => plant(D.x + 12, D.y + 10));

// rugs (under furniture, above the floor) + filing cabinets + lamps
draw.push({ z: B.x + B.y + 5 - 0.15, fn: () => rug(B.x + 6, B.y + 5, 9, 7, [42, 66, 92]) });
draw.push({ z: C.x + C.y + 6 - 0.15, fn: () => rug(C.x + 6, C.y + 6, 8, 6, [96, 46, 56]) });
add(A.x + 12, A.y + 3, () => filingCabinet(A.x + 12, A.y + 3), 0.9);
add(A.x + 12, A.y + 5, () => filingCabinet(A.x + 12, A.y + 5), 0.9);
add(C.x + 11, C.y + 8, () => lamp(C.x + 11, C.y + 8), 0.9);
add(B.x + 11, B.y + 2, () => lamp(B.x + 11, B.y + 2), 0.9);

// wall decor on the two back walls of each room
const northDecor = (tileX, wallY, fn) => { const p = project(tileX, wallY); draw.push({ z: tileX + wallY + 0.6, fn: () => fn(p.x, p.y - WALL_H + 9) }); };
const westDecor = (wallX, tileY, fn) => { const p = project(wallX, tileY); draw.push({ z: wallX + tileY + 0.6, fn: () => fn(p.x, p.y - WALL_H + 9) }); };
northDecor(A.x + 2, 0, (x, y) => picture(x, y, [90, 140, 170]));
northDecor(A.x + 8, 0, (x, y) => picture(x, y, [180, 130, 80]));
northDecor(B.x + 5, 0, (x, y) => whiteboard(x, y));
northDecor(B.x + 10, 0, (x, y) => clock(x, y));
westDecor(0, C.y + 4, (x, y) => picture(x, y, [150, 90, 150]));
northDecor(D.x + 3, PY, (x, y) => clock(x, y));

draw.sort((a, b) => a.z - b.z);
for (const d of draw) d.fn();
outlineScene();

// ── upscale + CCTV corner frame ─────────────────────────────────────────────
const up = upscale(buf, W, H, F);
const UW = W * F, UH = H * F;
function line(x0, y0, x1, y1, c) { if (x0 === x1) { for (let y = y0; y <= y1; y++) for (let t = 0; t < 3; t++) put(x0 + t, y, c); } else { for (let x = x0; x <= x1; x++) for (let t = 0; t < 3; t++) put(x, y0 + t, c); } }
function put(x, y, c) { if (x < 0 || y < 0 || x >= UW || y >= UH) return; const i = (y * UW + x) * 4; up[i] = c[0]; up[i + 1] = c[1]; up[i + 2] = c[2]; up[i + 3] = 255; }
const br = [225, 228, 235], L = 60, M = 26;
for (const [cx, cy, sx, sy] of [[M, M, 1, 1], [UW - M, M, -1, 1], [M, UH - M, 1, -1], [UW - M, UH - M, -1, -1]]) {
  line(cx, cy, cx + sx * L, cy, br); line(cx, cy, cx, cy + sy * L, br);
}

const out = process.argv[2] || '/tmp/office-iso-rich.png';
writeFileSync(out, encodePNG(up, UW, UH));
console.log('wrote', out);
