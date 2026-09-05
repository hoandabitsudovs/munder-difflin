// Scale the approved single-pillar iso scene to the 7 real department rooms.
// Same painter's-algorithm depth sort (by tx+ty) that the prototype validated,
// same native-grid pixel-art grammar (hard edges, 2-tone faces, 1px outline,
// nearest-neighbor upscale). Each room: accent-tinted iso floor, two back walls
// with real screen-vertical height, a desk per seat, and that department's cast
// standing at their desks — pulled from lib/cast-iso.mjs (ROOM_MEMBERS).
//
//   node rooms-all.mjs [outDir]   (default: ./out)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeBuf, set, rect, diamond, mix, shade, upscale, encodePNG, OUTLINE, alphaAt } from './lib/pixel.mjs';
import { CAST, ACCENT, DEPARTMENT_ACCENT, DEPARTMENTS, ROOM_MEMBERS } from './lib/cast-iso.mjs';
import { drawChar } from './lib/char.mjs';

const outDir = process.argv[2] || join(process.cwd(), 'out');
mkdirSync(outDir, { recursive: true });

const TILE_W = 16, TILE_H = 8, WALL_H = 19;
const GX = 6, GY = 5;                       // tiles: tx 0..GX, ty 0..GY
const W = 130, H = 116, F = 5;
const ORIGIN_X = 54, ORIGIN_Y = 28;
const paper = [244, 241, 234];

const project = (tx, ty) => ({ x: ORIGIN_X + (tx - ty) * (TILE_W / 2), y: ORIGIN_Y + (tx + ty) * (TILE_H / 2) });

function floorTile(buf, tx, ty, cA, cB) {
  const p = project(tx, ty);
  diamond(buf, W, H, p.x, p.y, TILE_W, TILE_H, (tx + ty) % 2 === 0 ? cA : cB);
}

// wall as screen-vertical columns whose base follows a floor edge (correct for
// iso pixel art: height goes straight up in screen space). `along` walks the
// edge in tile units; face is the lit/shaded accent, plus a top lip.
function backWall(buf, edge, face, lip) {
  const N = edge.length;
  for (let i = 0; i < N; i++) {
    const { x, y } = edge[i];
    for (let dy = 0; dy < WALL_H; dy++) set(buf, W, H, x, y - dy, dy < 2 ? lip : face);
  }
}

function edgePoints(fn) {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.02) pts.push(fn(t));
  // dedupe by rounded x, keep the lowest base y (front-most) per column
  const byX = new Map();
  for (const p of pts) { const k = Math.round(p.x); const e = byX.get(k); if (!e || p.y > e.y) byX.set(k, { x: k, y: Math.round(p.y) }); }
  return [...byX.values()].sort((a, b) => a.x - b.x);
}

function drawDesk(buf, tx, ty, wood) {
  const p = project(tx, ty);
  const top = mix(wood, [255, 255, 255], 0.12), lf = shade(wood, 0.72), rf = shade(wood, 0.55);
  const dh = 6;
  // legs implied by side faces of a slab raised dh, top surface = diamond
  const halfH = TILE_H / 2 - 1, halfW = TILE_W / 2 - 1;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, rw = Math.round(halfW * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < dh; k++) set(buf, W, H, p.x + dx, p.y + dy - k, lf);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < dh; k++) set(buf, W, H, p.x + dx, p.y + dy - k, rf);
  }
  diamond(buf, W, H, p.x, p.y - dh, TILE_W - 2, TILE_H - 2, top);
  // a little monitor on the desk
  const mc = [40, 44, 52];
  rect(buf, W, H, p.x - 1, p.y - dh - 6, p.x + 1, p.y - dh - 3, mc);
  set(buf, W, H, p.x, p.y - dh - 2, [90, 96, 110]);
}

// scene-only outline: paper stays empty, everything drawn gets a 1px frame.
function outlineScene(buf) {
  const occ = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) occ[i] = alphaAt(buf, W, H, i % W, (i / W) | 0) === 255 && !(buf[i * 4] === paper[0] && buf[i * 4 + 1] === paper[1] && buf[i * 4 + 2] === paper[2]) ? 1 : 0;
  const paint = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (occ[i]) continue;
    if (occ[i - 1] || occ[i + 1] || occ[i - W] || occ[i + W]) paint.push(i);
  }
  for (const i of paint) { const x = i % W, y = (i / W) | 0; set(buf, W, H, x, y, OUTLINE); }
}

function renderRoom(dept) {
  const accent = ACCENT[DEPARTMENT_ACCENT[dept]];
  const buf = makeBuf(W, H, paper);
  const fA = mix(accent, [255, 255, 255], 0.62), fB = mix(accent, [255, 255, 255], 0.5);
  const wallNE = mix(accent, [255, 255, 255], 0.18), wallNW = shade(accent, 0.62);
  const lip = mix(accent, [255, 255, 255], 0.4);
  const wood = [138, 113, 74];

  // floor
  for (let ty = 0; ty <= GY; ty++) for (let tx = 0; tx <= GX; tx++) floorTile(buf, tx, ty, fA, fB);

  // back walls (drawn behind everything in front of them)
  backWall(buf, edgePoints((t) => project(t * GX, 0)), wallNE, lip);        // NE wall (ty=0 row)
  backWall(buf, edgePoints((t) => project(0, t * GY)), wallNW, shade(lip, 0.7)); // NW wall (tx=0 col)

  // members -> desk in front + character behind it, depth-sorted together
  const members = ROOM_MEMBERS[dept] || [];
  const slots = layout(members.length);
  const draw = [];
  members.forEach(([name], i) => {
    const { tx, ty } = slots[i];
    const p = CAST[name];
    draw.push({ depth: tx + ty - 0.5, fn: () => { const pr = project(tx, ty); drawChar(buf, W, H, pr.x - 8, pr.y + 3, p); } });
    draw.push({ depth: tx + ty, fn: () => drawDesk(buf, tx, ty + 0.9, wood) });
  });
  draw.sort((a, b) => a.depth - b.depth);
  for (const d of draw) d.fn();

  outlineScene(buf);
  return upscale(buf, W, H, F);
}

function layout(n) {
  if (n <= 2) return [{ tx: 1.3, ty: 1.2 }, { tx: 4.3, ty: 2.8 }].slice(0, n);
  return [{ tx: 1.2, ty: 1.1 }, { tx: 4.6, ty: 1.7 }, { tx: 2.7, ty: 3.6 }];
}

const manifest = [];
for (const dept of DEPARTMENTS) {
  const up = renderRoom(dept);
  const png = encodePNG(up, W * F, H * F);
  const file = `room-${dept.normalize('NFD').replace(/[^\w]/g, '').toLowerCase()}.png`;
  writeFileSync(join(outDir, file), png);
  manifest.push({ dept, file, members: (ROOM_MEMBERS[dept] || []).map((m) => m[1]).join(' · ') });
}
writeFileSync(join(outDir, 'rooms.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} rooms to ${outDir}`);
