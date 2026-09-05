// Minimal validation scene for RETROFIT_PLAN.md steps 2-3: prove that ONE
// sortable container keyed by the unified baseline depth (foot screen-Y, exactly
// what src/.../projection.ts `depthKey` returns for the iso projection) orders a
// wall and two characters correctly — one behind it, one in front — without any
// explicit tx+ty layer stack. Floor, wall and characters all go through the same
// depthKey sort, which is the change the real engine's buildTileLayers needs.
//
//   node engine-parity-scene.mjs [outFile.png]
import { writeFileSync } from 'node:fs';
import { makeBuf, set, diamond, mix, shade, upscale, encodePNG, OUTLINE, alphaAt } from './lib/pixel.mjs';
import { drawChar } from './lib/char.mjs';
import { CAST } from './lib/cast-iso.mjs';

// ── iso projection: identical formulas to projection.ts (iso branch) ──────────
const TILE_SIZE = 16, TILE_W = TILE_SIZE * 2, TILE_H = TILE_SIZE; // 32x16, 2:1
const GRID = 4;
const ORIGIN_X = GRID * (TILE_W / 2), ORIGIN_Y = 8;
const tileCentre = (tx, ty) => ({ x: ORIGIN_X + (tx - ty) * (TILE_W / 2), y: ORIGIN_Y + (tx + ty) * (TILE_H / 2) });
const depthKey = (tx, ty) => tileCentre(tx, ty).y;    // == projection.ts depthKey (iso)

const W = 160, H = 150, F = 4, WALL_H = 22;
const paper = [244, 241, 234];

function drawWall(buf, tx, ty, c) {
  const p = tileCentre(tx, ty);
  const mid = shade(c, 0.8), dark = shade(c, 0.62), lip = mix(c, [255, 255, 255], 0.35);
  const halfH = TILE_H / 2, halfW = TILE_W / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, rw = Math.round(halfW * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, mid);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < WALL_H; k++) set(buf, W, H, p.x + dx, p.y + dy - k, dark);
  }
  diamond(buf, W, H, p.x, p.y - WALL_H, TILE_W, TILE_H, lip);
}

function outlineScene(buf) {
  const occ = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) occ[i] = alphaAt(buf, W, H, i % W, (i / W) | 0) === 255 && !(buf[i * 4] === paper[0] && buf[i * 4 + 1] === paper[1] && buf[i * 4 + 2] === paper[2]) ? 1 : 0;
  const paint = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (occ[i]) continue; if (occ[i - 1] || occ[i + 1] || occ[i - W] || occ[i + W]) paint.push(i); }
  for (const i of paint) set(buf, W, H, i % W, (i / W) | 0, OUTLINE);
}

const WALL = { tx: 2, ty: 2 };
function scene(charTx, charTy) {
  const buf = makeBuf(W, H, paper);
  const floorA = [206, 224, 233], floorB = [190, 212, 223];
  const drawables = [];
  for (let ty = 0; ty <= GRID; ty++) for (let tx = 0; tx <= GRID; tx++) {
    if (tx === WALL.tx && ty === WALL.ty) continue;
    drawables.push({ z: depthKey(tx, ty) - 0.1, fn: () => { const p = tileCentre(tx, ty); diamond(buf, W, H, p.x, p.y, TILE_W, TILE_H, (tx + ty) % 2 ? floorA : floorB); } });
  }
  drawables.push({ z: depthKey(WALL.tx, WALL.ty), fn: () => drawWall(buf, WALL.tx, WALL.ty, [79, 159, 175]) });
  drawables.push({ z: depthKey(charTx, charTy) + 0.05, fn: () => { const p = tileCentre(charTx, charTy); drawChar(buf, W, H, p.x - 8, p.y + 2, CAST.mateo); } });
  // the ONE unified sort — baseline depth only, no layer stack:
  drawables.sort((a, b) => a.z - b.z);
  for (const d of drawables) d.fn();
  outlineScene(buf);
  return upscale(buf, W, H, F);
}

// same screen column as the wall (tx-ty == 0) so they actually overlap; only
// the depth (tx+ty) differs -> a real occlusion test, not a side-by-side.
const behind = scene(1, 1); // depth 2 < wall 4 -> drawn first, occluded by wall
const front = scene(3, 3);  // depth 6 > wall 4 -> drawn last, occludes wall
const cw = W * F, ch = H * F, gap = 16, sw = cw * 2 + gap;
const sheet = makeBuf(sw, ch, [255, 255, 255]);
const blitAt = (src, ox) => { for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const s = (y * cw + x) * 4; set(sheet, sw, ch, x + ox, y, [src[s], src[s + 1], src[s + 2]]); } };
blitAt(behind, 0); blitAt(front, cw + gap);

const outFile = process.argv[2] || '/tmp/iso-engine-parity.png';
writeFileSync(outFile, encodePNG(sheet, sw, ch));
console.log('wrote', outFile, `(left: char behind wall, depthKey ${depthKey(1, 1).toFixed(1)} < wall ${depthKey(2, 2).toFixed(1)}; right: char in front, ${depthKey(3, 3).toFixed(1)} > wall)`);
