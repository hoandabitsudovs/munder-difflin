// Combined pixel-art isometric scene: floor + a pillar with height, drawn on
// the SAME native low-res grid as the character (no anti-aliasing anywhere),
// nearest-neighbor upscaled once at the end so every edge steps in whole
// pixels. Two renders (character behind / in front of the pillar) to
// reconfirm the depth-sort still holds with real pixel art instead of the
// smooth-polygon placeholder from the first prototype.
import { writeFileSync } from 'node:fs';

const TILE_W = 16, TILE_H = 8; // native px per floor tile (2:1 iso ratio)
const WALL_H = 14;
const GRID = 5;
const OUTLINE = [40, 34, 46];

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return [clamp(((n >> 16) & 255) * f), clamp(((n >> 8) & 255) * f), clamp((n & 255) * f)];
}
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function set(buf, w, h, x, y, c, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  const alpha = a / 255;
  buf[i] = buf[i] * (1 - alpha) + c[0] * alpha;
  buf[i + 1] = buf[i + 1] * (1 - alpha) + c[1] * alpha;
  buf[i + 2] = buf[i + 2] * (1 - alpha) + c[2] * alpha;
  buf[i + 3] = 255;
}
function rect(buf, w, h, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(buf, w, h, x, y, c); }

// hard-edged diamond: per-row linear extent, no anti-aliasing
function diamond(buf, w, h, cx, cy, tw, th, c) {
  const halfH = th / 2, halfW = tw / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH;
    const halfRow = Math.round(halfW * frac);
    for (let dx = -halfRow; dx <= halfRow; dx++) set(buf, w, h, cx + dx, cy + dy, c);
  }
}

function project(tx, ty, originX, originY) {
  return { x: originX + (tx - ty) * (TILE_W / 2), y: originY + (tx + ty) * (TILE_H / 2) };
}

function drawPillar(buf, w, h, base, c) {
  const top = { x: base.x, y: base.y - WALL_H };
  const [hi, mid, dark] = [shadeHex(c, 1), shadeHex(c, 0.72), shadeHex(c, 0.55)];
  // left face
  for (let dy = -TILE_H / 2; dy <= 0; dy++) {
    const frac = 1 - Math.abs(dy) / (TILE_H / 2);
    const rowW = Math.round((TILE_W / 2) * frac);
    for (let dx = -rowW; dx <= 0; dx++) {
      rect(buf, w, h, base.x + dx, top.y + dy, base.x + dx, base.y + dy, mid);
    }
  }
  // right face
  for (let dy = -TILE_H / 2; dy <= 0; dy++) {
    const frac = 1 - Math.abs(dy) / (TILE_H / 2);
    const rowW = Math.round((TILE_W / 2) * frac);
    for (let dx = 0; dx <= rowW; dx++) {
      rect(buf, w, h, base.x + dx, top.y + dy, base.x + dx, base.y + dy, dark);
    }
  }
  diamond(buf, w, h, top.x, top.y, TILE_W, TILE_H, hi);
}

function alphaAt(buf, w, h, x, y) { if (x < 0 || x >= w || y < 0 || y >= h) return 0; return buf[(y * w + x) * 4 + 3]; }
function outlinePass(buf, w, h, occMask) {
  const toPaint = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (occMask[i]) continue;
    if (occMask[i - 1] || occMask[i + 1] || occMask[i - w] || occMask[i + w]) toPaint.push([x, y]);
  }
  for (const [x, y] of toPaint) { set(buf, w, h, x, y, OUTLINE); occMask[y * w + x] = 1; }
}

// ─── character (same recipe as iso-char-pixel-v2.mjs, offset to feet=0) ──
function drawChar(buf, w, h, ox, footY, p) {
  const skin = hexRgb(p.skin), skinSide = shadeHex(p.skin, 0.7);
  const cloth = hexRgb(p.cloth), clothSide = shadeHex(p.cloth, 0.68);
  const hair = hexRgb(p.hair), hairSide = shadeHex(p.hair, 0.65);
  const shoe = [58, 49, 64], shoeSide = shadeHex('#3a3140', 0.7);
  const brow = shadeHex(p.hair, 0.4);
  const mouth = shadeHex(p.skin, 0.55);
  const y0 = footY - 30; // sprite is 30px tall, feet at footY
  const X = (dx) => ox + dx;
  const Y = (dy) => y0 + dy;

  rect(buf, w, h, X(3), Y(28), X(12), Y(29), [0, 0, 0]);
  for (let dx = 3; dx <= 12; dx++) set(buf, w, h, X(dx), Y(28), [0, 0, 0], 55);
  rect(buf, w, h, X(4), Y(22), X(6), Y(25), shoe);
  rect(buf, w, h, X(9), Y(22), X(11), Y(25), shoeSide);
  rect(buf, w, h, X(4), Y(26), X(6), Y(27), [42, 36, 48]);
  rect(buf, w, h, X(9), Y(26), X(11), Y(27), shadeHex('#3a3140', 0.6));
  rect(buf, w, h, X(3), Y(15), X(10), Y(21), cloth);
  rect(buf, w, h, X(10), Y(16), X(13), Y(21), clothSide);
  rect(buf, w, h, X(0), Y(16), X(2), Y(20), cloth);
  rect(buf, w, h, X(14), Y(16), X(16), Y(20), clothSide);
  rect(buf, w, h, X(6), Y(14), X(9), Y(15), clothSide);
  rect(buf, w, h, X(1), Y(0), X(14), Y(13), skin);
  rect(buf, w, h, X(11), Y(1), X(14), Y(13), skinSide);
  set(buf, w, h, X(5), Y(5), brow); set(buf, w, h, X(6), Y(5), brow);
  set(buf, w, h, X(8), Y(5), brow); set(buf, w, h, X(9), Y(5), brow);
  set(buf, w, h, X(4), Y(7), [42, 36, 48]);
  set(buf, w, h, X(9), Y(7), [42, 36, 48]);
  rect(buf, w, h, X(5), Y(10), X(7), Y(10), mouth);
  rect(buf, w, h, X(0), Y(-2), X(14), Y(2), hair);
  rect(buf, w, h, X(11), Y(1), X(15), Y(4), hairSide);
}

function upscale(buf, w, h, f) {
  const out = new Uint8ClampedArray(w * f * h * f * 4);
  const ow = w * f;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const di = ((y * f + dy) * ow + (x * f + dx)) * 4;
      out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

function renderScene(charTx, charTy) {
  const W = 140, H = 110;
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { buf[i * 4] = 244; buf[i * 4 + 1] = 241; buf[i * 4 + 2] = 234; buf[i * 4 + 3] = 255; }
  const originX = W / 2, originY = 18;
  const PILLAR = { tx: 2, ty: 1 };
  const FLOOR_A = '#cbb894', FLOOR_B = '#c2ad86', PILLAR_C = '#8a714a';

  const drawables = [];
  for (let ty = 0; ty < GRID; ty++) for (let tx = 0; tx < GRID; tx++) {
    if (tx === PILLAR.tx && ty === PILLAR.ty) continue;
    drawables.push({ depth: tx + ty - 0.1, draw: () => {
      const pr = project(tx, ty, originX, originY);
      diamond(buf, W, H, pr.x, pr.y, TILE_W, TILE_H, hexRgb((tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B));
    } });
  }
  drawables.push({ depth: PILLAR.tx + PILLAR.ty, draw: () => drawPillar(buf, W, H, project(PILLAR.tx, PILLAR.ty, originX, originY), PILLAR_C) });
  drawables.push({ depth: charTx + charTy + 0.05, draw: () => {
    const pr = project(charTx, charTy, originX, originY);
    drawChar(buf, W, H, pr.x - 8, pr.y + 4, { skin: '#d6a274', hair: '#1c1612', cloth: '#32466e' });
  } });
  drawables.sort((a, b) => a.depth - b.depth);
  for (const d of drawables) d.draw();

  const occ = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) occ[i] = buf[i * 4 + 3] === 255 && !(buf[i * 4] === 244 && buf[i * 4 + 1] === 241 && buf[i * 4 + 2] === 234) ? 1 : 0;
  outlinePass(buf, W, H, occ);
  return { buf, W, H };
}

const behind = renderScene(2, 0); // same column, one row back -> occluded
const front = renderScene(2, 3);  // same column, in front -> occludes pillar

const F = 6;
const up1 = upscale(behind.buf, behind.W, behind.H, F);
const up2 = upscale(front.buf, front.W, front.H, F);
const cellW = behind.W * F, cellH = behind.H * F, GAP = 20;
const sheetW = cellW * 2 + GAP, sheetH = cellH;
const sheet = new Uint8ClampedArray(sheetW * sheetH * 4);
for (let i = 0; i < sheetW * sheetH; i++) { sheet[i * 4] = 255; sheet[i * 4 + 1] = 255; sheet[i * 4 + 2] = 255; sheet[i * 4 + 3] = 255; }
function blit(dst, dstW, src, srcW, srcH, ox) {
  for (let y = 0; y < srcH; y++) for (let x = 0; x < srcW; x++) {
    const si = (y * srcW + x) * 4, di = (y * dstW + (x + ox)) * 4;
    dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = 255;
  }
}
blit(sheet, sheetW, up1, cellW, cellH, 0);
blit(sheet, sheetW, up2, cellW, cellH, cellW + GAP);

function toPPM(buf, w, h) {
  const pixels = Buffer.alloc(w * h * 3);
  for (let i = 0, o = 0; i < buf.length; i += 4, o += 3) { pixels[o] = buf[i]; pixels[o + 1] = buf[i + 1]; pixels[o + 2] = buf[i + 2]; }
  return Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), pixels]);
}
writeFileSync('/tmp/iso-scene-pixel.ppm', toPPM(sheet, sheetW, sheetH));
console.log('wrote', sheetW, 'x', sheetH);
