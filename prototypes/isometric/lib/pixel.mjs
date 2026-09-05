// Shared low-level pixel-art helpers for the isometric prototypes.
//
// Same grammar as the approved prototypes (character-pixelart.mjs /
// combined-scene-pixelart.mjs): everything is drawn on a native low-res RGBA
// grid with hard edges (no anti-aliasing), then upscaled once with
// nearest-neighbor so every edge steps in whole pixels. The one addition here
// is a real PNG encoder built on Node's own zlib — no third-party deps — so the
// output is viewable straight in a browser / the Browser pane instead of PPM.
import { deflateSync } from 'node:zlib';

export const OUTLINE = [40, 34, 46];
export const PAPER = [244, 241, 234];

export function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
export function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(rgb, f) { return [clamp(rgb[0] * f), clamp(rgb[1] * f), clamp(rgb[2] * f)]; }
export function shadeHex(hex, f) { return shade(hexRgb(hex), f); }
export function mix(a, b, t) { return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)]; }

export function makeBuf(w, h, bg) {
  const buf = new Uint8ClampedArray(w * h * 4);
  if (bg) for (let i = 0; i < w * h; i++) { buf[i * 4] = bg[0]; buf[i * 4 + 1] = bg[1]; buf[i * 4 + 2] = bg[2]; buf[i * 4 + 3] = 255; }
  return buf;
}
export function set(buf, w, h, x, y, c, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4, alpha = a / 255;
  buf[i] = buf[i] * (1 - alpha) + c[0] * alpha;
  buf[i + 1] = buf[i + 1] * (1 - alpha) + c[1] * alpha;
  buf[i + 2] = buf[i + 2] * (1 - alpha) + c[2] * alpha;
  buf[i + 3] = 255;
}
export function rect(buf, w, h, x0, y0, x1, y1, c, a = 255) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(buf, w, h, x, y, c, a);
}
export function clearPx(buf, w, h, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  buf[(y * w + x) * 4 + 3] = 0;
}
export function alphaAt(buf, w, h, x, y) { if (x < 0 || x >= w || y < 0 || y >= h) return 0; return buf[(y * w + x) * 4 + 3]; }

// hard-edged iso diamond: per-row linear extent, no anti-aliasing
export function diamond(buf, w, h, cx, cy, tw, th, c) {
  const halfH = th / 2, halfW = tw / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH;
    const halfRow = Math.round(halfW * frac);
    for (let dx = -halfRow; dx <= halfRow; dx++) set(buf, w, h, cx + dx, cy + dy, c);
  }
}

// 1px outline around every opaque, non-paper pixel. When occMask is supplied
// (scene mode) paper counts as empty; in sprite mode alpha==0 is empty.
export function outlineSprite(buf, w, h) {
  const toPaint = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alphaAt(buf, w, h, x, y) !== 0) continue;
    if (alphaAt(buf, w, h, x - 1, y) || alphaAt(buf, w, h, x + 1, y) || alphaAt(buf, w, h, x, y - 1) || alphaAt(buf, w, h, x, y + 1)) toPaint.push([x, y]);
  }
  for (const [x, y] of toPaint) set(buf, w, h, x, y, [...OUTLINE]);
}

export function upscale(buf, w, h, f) {
  const ow = w * f, out = new Uint8ClampedArray(ow * h * f * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const di = ((y * f + dy) * ow + (x * f + dx)) * 4;
      out[di] = buf[si]; out[di + 1] = buf[si + 1]; out[di + 2] = buf[si + 2]; out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

// copy src (already upscaled) onto dst, honoring alpha (0 = skip)
export function blit(dst, dstW, dstH, src, srcW, srcH, ox, oy) {
  for (let y = 0; y < srcH; y++) for (let x = 0; x < srcW; x++) {
    const si = (y * srcW + x) * 4;
    if (!src[si + 3]) continue;
    set(dst, dstW, dstH, x + ox, y + oy, [src[si], src[si + 1], src[si + 2]]);
  }
}

// ─── PNG encoder (zlib stored/deflate; RGBA, no external deps) ──────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
export function encodePNG(buf, w, h) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = buf[y * stride + x];
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
