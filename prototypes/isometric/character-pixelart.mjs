// Pokemon-GBA-proportioned isometric pixel character: oversized head (~45%
// of total height), tiny torso/legs, flat 2-tone shading (front/side only,
// no extra gradation bands — GBA overworld sprites don't have them), bold
// 1px outline. Same set()/rect()/outlinePass technique as portraitArt.ts.
import { writeFileSync } from 'node:fs';

const PW = 20, PH = 32;
const OUTLINE = [40, 34, 46];

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return [clamp(((n >> 16) & 255) * f), clamp(((n >> 8) & 255) * f), clamp((n & 255) * f)];
}
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function makeBuf(w, h) { return new Uint8ClampedArray(w * h * 4); }
function set(buf, w, h, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function rect(buf, w, h, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(buf, w, h, x, y, c);
}
function clear(buf, w, h, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  buf[(y * w + x) * 4 + 3] = 0;
}
function alphaAt(buf, w, h, x, y) {
  if (x < 0 || x >= w || y < 0 || y >= h) return 0;
  return buf[(y * w + x) * 4 + 3];
}
function outlinePass(buf, w, h) {
  const toPaint = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alphaAt(buf, w, h, x, y) !== 0) continue;
    if (alphaAt(buf, w, h, x - 1, y) || alphaAt(buf, w, h, x + 1, y) || alphaAt(buf, w, h, x, y - 1) || alphaAt(buf, w, h, x, y + 1)) {
      toPaint.push([x, y]);
    }
  }
  for (const [x, y] of toPaint) set(buf, w, h, x, y, [...OUTLINE]);
}

function drawChar(buf, p) {
  const skin = hexRgb(p.skin), skinSide = shade(p.skin, 0.7);
  const cloth = hexRgb(p.cloth), clothSide = shade(p.cloth, 0.68);
  const hair = hexRgb(p.hair), hairSide = shade(p.hair, 0.65);
  const shoe = [58, 49, 64], shoeSide = shade('#3a3140', 0.7);
  const brow = shade(p.hair, 0.4);
  const mouth = shade(p.skin, 0.55);

  // ground shadow
  rect(buf, PW, PH, 5, 30, 14, 31, [0, 0, 0, 55]);

  // legs — short and stubby, front pair lighter, side pair darker
  rect(buf, PW, PH, 6, 24, 8, 27, shoe);
  rect(buf, PW, PH, 11, 24, 13, 27, shoeSide);
  rect(buf, PW, PH, 6, 28, 8, 29, [42, 36, 48]);
  rect(buf, PW, PH, 11, 28, 13, 29, shade('#3a3140', 0.6));

  // torso — small, front + side face
  rect(buf, PW, PH, 5, 17, 12, 23, cloth);
  rect(buf, PW, PH, 12, 18, 15, 23, clothSide);
  // stub arms
  rect(buf, PW, PH, 2, 18, 4, 22, cloth);
  rect(buf, PW, PH, 16, 18, 18, 22, clothSide);
  set(buf, PW, PH, 2, 22, skin); set(buf, PW, PH, 3, 22, skin);
  set(buf, PW, PH, 17, 22, skinSide); set(buf, PW, PH, 18, 22, skinSide);
  // neck collar
  rect(buf, PW, PH, 8, 16, 11, 17, clothSide);

  // head — big block, front + side face, carved corners for a rounder read
  rect(buf, PW, PH, 3, 2, 16, 15, skin);
  rect(buf, PW, PH, 13, 3, 16, 15, skinSide);
  for (const [x, y] of [[3, 2], [3, 3], [4, 2], [16, 2], [16, 3], [15, 2], [3, 15], [16, 15]]) clear(buf, PW, PH, x, y);

  // eyebrows + eyes + mouth
  rect(buf, PW, PH, 5, 7, 7, 7, brow);
  rect(buf, PW, PH, 10, 7, 12, 7, brow);
  set(buf, PW, PH, 6, 9, [42, 36, 48]);
  set(buf, PW, PH, 11, 9, [42, 36, 48]);
  rect(buf, PW, PH, 7, 12, 9, 12, mouth);

  // hair — one bold color block on top + a side wedge, style differs by silhouette only
  if (p.hairStyle === 'swept') {
    rect(buf, PW, PH, 2, 0, 16, 4, hair);
    rect(buf, PW, PH, 13, 3, 17, 6, hairSide);
    for (const [x, y] of [[2, 0], [16, 0]]) clear(buf, PW, PH, x, y);
  } else {
    rect(buf, PW, PH, 2, 0, 16, 4, hair);
    rect(buf, PW, PH, 13, 2, 17, 5, hairSide);
    rect(buf, PW, PH, 1, 3, 3, 9, hair);
    rect(buf, PW, PH, 15, 3, 18, 9, hairSide);
    for (const [x, y] of [[2, 0], [16, 0]]) clear(buf, PW, PH, x, y);
  }

  outlinePass(buf, PW, PH);
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

const CHARS = [
  { name: 'Mateo', skin: '#d6a274', hair: '#1c1612', cloth: '#32466e', hairStyle: 'swept' },
  { name: 'Sofia', skin: '#f7c9aa', hair: '#8c4632', cloth: '#3c9696', hairStyle: 'layered' },
];
const F = 12;
const cellW = PW * F, cellH = PH * F, GAP = 24;
const sheetW = cellW * CHARS.length + GAP, sheetH = cellH;
const sheet = new Uint8ClampedArray(sheetW * sheetH * 4);
for (let i = 0; i < sheetW * sheetH; i++) { sheet[i * 4] = 244; sheet[i * 4 + 1] = 241; sheet[i * 4 + 2] = 234; sheet[i * 4 + 3] = 255; }

function blit(dst, dstW, src, srcW, srcH, ox) {
  for (let y = 0; y < srcH; y++) for (let x = 0; x < srcW; x++) {
    const si = (y * srcW + x) * 4, a = src[si + 3];
    if (!a) continue;
    const di = (y * dstW + (x + ox)) * 4;
    dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = 255;
  }
}

CHARS.forEach((p, i) => {
  const buf = makeBuf(PW, PH);
  drawChar(buf, p);
  const up = upscale(buf, PW, PH, F);
  blit(sheet, sheetW, up, cellW, cellH, i * (cellW + GAP));
});

function toPPM(buf, w, h) {
  const pixels = Buffer.alloc(w * h * 3);
  for (let i = 0, o = 0; i < buf.length; i += 4, o += 3) { pixels[o] = buf[i]; pixels[o + 1] = buf[i + 1]; pixels[o + 2] = buf[i + 2]; }
  return Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), pixels]);
}
writeFileSync('/tmp/iso-characters-pixel-v2.ppm', toPPM(sheet, sheetW, sheetH));
console.log('wrote', sheetW, 'x', sheetH);
