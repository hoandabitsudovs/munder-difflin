// Browser-safe port of prototypes/isometric/lib (pixel.mjs + char.mjs +
// cast-iso.mjs) and the room renderer (rooms-all.mjs), for the in-app ISO
// PREVIEW overlay. Same native-grid / 2-tone / nearest-neighbor technique as the
// standalone prototypes — the ONLY differences are: no PNG encoder (we hand the
// raw RGBA buffer to a <canvas> via ImageData) and no upscale (CSS
// image-rendering: pixelated scales it crisply). This does NOT touch the
// production office renderer; it's an isolated showcase of the iso art set.

export type RGB = [number, number, number];

const OUTLINE: RGB = [40, 34, 46];
const PAPER: RGB = [244, 241, 234];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
export const hexRgb = (hex: string): RGB => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (rgb: RGB, f: number): RGB => [clamp(rgb[0] * f), clamp(rgb[1] * f), clamp(rgb[2] * f)];
const mix = (a: RGB, b: RGB, t: number): RGB => [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];

export interface Buf { data: Uint8ClampedArray; w: number; h: number; }

function makeBuf(w: number, h: number, bg?: RGB): Buf {
  const data = new Uint8ClampedArray(w * h * 4);
  if (bg) for (let i = 0; i < w * h; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
  return { data, w, h };
}
function set(b: Buf, x: number, y: number, c: RGB, a = 255): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= b.w || y < 0 || y >= b.h) return;
  const i = (y * b.w + x) * 4, al = a / 255;
  b.data[i] = b.data[i] * (1 - al) + c[0] * al;
  b.data[i + 1] = b.data[i + 1] * (1 - al) + c[1] * al;
  b.data[i + 2] = b.data[i + 2] * (1 - al) + c[2] * al;
  b.data[i + 3] = 255;
}
function rect(b: Buf, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(b, x, y, c, a);
}
const alphaAt = (b: Buf, x: number, y: number): number => (x < 0 || x >= b.w || y < 0 || y >= b.h ? 0 : b.data[(y * b.w + x) * 4 + 3]);

function diamond(b: Buf, cx: number, cy: number, tw: number, th: number, c: RGB): void {
  const halfH = th / 2, halfW = tw / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, hr = Math.round(halfW * frac);
    for (let dx = -hr; dx <= hr; dx++) set(b, cx + dx, cy + dy, c);
  }
}

function outlineSprite(b: Buf): void {
  const paint: [number, number][] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (alphaAt(b, x, y) !== 0) continue;
    if (alphaAt(b, x - 1, y) || alphaAt(b, x + 1, y) || alphaAt(b, x, y - 1) || alphaAt(b, x, y + 1)) paint.push([x, y]);
  }
  for (const [x, y] of paint) set(b, x, y, [...OUTLINE] as RGB);
}
function outlineScene(b: Buf): void {
  const occ = new Uint8Array(b.w * b.h);
  for (let i = 0; i < b.w * b.h; i++) {
    const on = b.data[i * 4 + 3] === 255 && !(b.data[i * 4] === PAPER[0] && b.data[i * 4 + 1] === PAPER[1] && b.data[i * 4 + 2] === PAPER[2]);
    occ[i] = on ? 1 : 0;
  }
  const paint: number[] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const i = y * b.w + x; if (occ[i]) continue; if (occ[i - 1] || occ[i + 1] || occ[i - b.w] || occ[i + b.w]) paint.push(i); }
  for (const i of paint) set(b, i % b.w, (i / b.w) | 0, OUTLINE);
}

// ── cast data (transcribed from cast-iso.mjs / portraitArt.ts recipes) ────────
const SKIN_BASE: Record<string, RGB> = { light: [247, 201, 170], tan: [214, 162, 116], brown: [158, 112, 78], dark: [120, 80, 56] };
const ACCENT: Record<string, RGB> = { coral: [0xd9, 0x6a, 0x62], mint: [0x5c, 0xa9, 0x7a], sky: [0x4f, 0x9f, 0xaf], lemon: [0xdc, 0xab, 0x3c], lilac: [0x94, 0x82, 0xd3], peach: [0xd9, 0x91, 0x68] };
export const DEPARTMENT_ACCENT: Record<string, string> = { 'Dirección': 'coral', 'Desarrollo': 'sky', 'Creativo': 'lilac', 'Marketing': 'peach', 'Finanzas': 'mint', 'Redacción': 'lemon', 'Ciberseguridad': 'coral' };
export const DEPARTMENTS = ['Dirección', 'Desarrollo', 'Creativo', 'Marketing', 'Finanzas', 'Redacción', 'Ciberseguridad'];

export interface Cast {
  display: string; skin: string; hairc: RGB; hair: string; c: RGB;
  hlen?: number; part?: 'L' | 'R'; recede?: boolean; tie?: RGB; suit?: boolean;
  glasses?: boolean; facial?: string; fem?: boolean; heavy?: boolean;
}

export const CAST: Record<string, Cast> = {
  sofia: { display: 'Sofía', skin: 'light', hairc: [140, 70, 50], hair: 'frame', hlen: 19, c: [60, 150, 150], fem: true },
  mateo: { display: 'Mateo', skin: 'tan', hairc: [30, 24, 20], hair: 'short', part: 'L', c: [50, 70, 110], tie: [30, 45, 80] },
  valentina: { display: 'Valentina', skin: 'brown', hairc: [20, 16, 14], hair: 'curly', c: [120, 40, 55], fem: true },
  diego: { display: 'Diego', skin: 'dark', hairc: [35, 28, 22], hair: 'spiky', c: [50, 120, 70] },
  camila: { display: 'Camila', skin: 'tan', hairc: [200, 160, 60], hair: 'bun', c: [220, 110, 90], fem: true },
  lucas: { display: 'Lucas', skin: 'light', hairc: [180, 140, 80], hair: 'messy', hlen: 9, c: [190, 150, 40] },
  elena: { display: 'Elena', skin: 'dark', hairc: [20, 16, 14], hair: 'frame', hlen: 20, c: [40, 150, 160], fem: true },
  andres: { display: 'Andrés', skin: 'brown', hairc: [150, 150, 150], hair: 'recede', c: [110, 110, 120], tie: [70, 70, 85], glasses: true },
  mariana: { display: 'Mariana', skin: 'light', hairc: [110, 50, 40], hair: 'curly', c: [170, 140, 190], fem: true },
  javier: { display: 'Javier', skin: 'tan', hairc: [35, 28, 22], hair: 'short', part: 'R', c: [50, 50, 58], tie: [120, 40, 40], glasses: true, suit: true },
  isabella: { display: 'Isabella', skin: 'brown', hairc: [15, 12, 12], hair: 'bun', c: [200, 160, 50], fem: true },
  carlos: { display: 'Carlos', skin: 'dark', hairc: [25, 20, 18], hair: 'bald', c: [40, 60, 110] },
  gabriela: { display: 'Gabriela', skin: 'tan', hairc: [110, 65, 40], hair: 'floppy', c: [220, 130, 150], fem: true },
  rafael: { display: 'Rafael', skin: 'light', hairc: [30, 24, 20], hair: 'frame', hlen: 14, c: [45, 55, 80], tie: [150, 40, 40], suit: true },
  daniela: { display: 'Daniela', skin: 'dark', hairc: [20, 16, 14], hair: 'messy', hlen: 10, c: [60, 160, 170], fem: true },
  tomas: { display: 'Tomás', skin: 'brown', hairc: [195, 155, 70], hair: 'spiky', c: [180, 50, 50] },
  paula: { display: 'Paula', skin: 'light', hairc: [210, 180, 90], hair: 'short', part: 'L', c: [120, 190, 160], fem: true },
  nicolas: { display: 'Nicolás', skin: 'tan', hairc: [20, 16, 14], hair: 'curly', c: [40, 90, 55], facial: 'stubble' },
  renata: { display: 'Renata', skin: 'brown', hairc: [120, 116, 122], hair: 'bun', c: [110, 60, 100], fem: true },
  emilio: { display: 'Emilio', skin: 'dark', hairc: [20, 16, 14], hair: 'recede', c: [90, 100, 55], facial: 'goatee' },
  michael: { display: 'Michael', skin: 'light', hairc: [58, 42, 28], hair: 'short', part: 'L', c: [58, 63, 74], tie: [170, 58, 58], suit: true },
  jim: { display: 'Jim', skin: 'light', hairc: [92, 60, 34], hair: 'floppy', c: [172, 196, 224], tie: [120, 130, 150] },
  pam: { display: 'Pam', skin: 'light', hairc: [120, 76, 42], hair: 'frame', hlen: 18, c: [236, 174, 192], fem: true },
  dwight: { display: 'Dwight', skin: 'light', hairc: [64, 48, 28], hair: 'short', part: 'L', recede: true, c: [184, 155, 62], tie: [120, 82, 46], glasses: true },
  kevin: { display: 'Kevin', skin: 'light', hairc: [58, 44, 30], hair: 'bald', c: [110, 140, 180], heavy: true },
  angela: { display: 'Angela', skin: 'light', hairc: [186, 154, 90], hair: 'bun', c: [150, 146, 170], fem: true },
  oscar: { display: 'Oscar', skin: 'tan', hairc: [28, 22, 18], hair: 'short', part: 'L', c: [122, 60, 74] },
  stanley: { display: 'Stanley', skin: 'dark', hairc: [60, 54, 48], hair: 'recede', c: [150, 120, 86], tie: [120, 78, 52], glasses: true, facial: 'mustache', heavy: true },
  phyllis: { display: 'Phyllis', skin: 'light', hairc: [196, 162, 110], hair: 'curly', c: [202, 160, 192], glasses: true, fem: true, heavy: true },
  andy: { display: 'Andy', skin: 'light', hairc: [74, 51, 32], hair: 'short', part: 'R', c: [176, 65, 58] },
  kelly: { display: 'Kelly', skin: 'tan', hairc: [24, 18, 22], hair: 'frame', hlen: 20, c: [212, 90, 158], fem: true },
  ryan: { display: 'Ryan', skin: 'light', hairc: [42, 32, 24], hair: 'spiky', c: [58, 58, 68], tie: [40, 40, 50], suit: true },
  toby: { display: 'Toby', skin: 'light', hairc: [106, 90, 66], hair: 'short', part: 'L', recede: true, c: [150, 150, 120], facial: 'mustache' },
  creed: { display: 'Creed', skin: 'light', hairc: [170, 166, 156], hair: 'bald', c: [126, 130, 96], facial: 'stubble' },
  meredith: { display: 'Meredith', skin: 'light', hairc: [154, 82, 46], hair: 'messy', hlen: 15, c: [176, 86, 74], fem: true },
};

export const CAST_ORDER = [
  'sofia', 'mateo', 'valentina', 'diego', 'camila', 'lucas', 'elena', 'andres', 'mariana', 'javier',
  'isabella', 'carlos', 'gabriela', 'rafael', 'daniela', 'tomas', 'paula', 'nicolas', 'renata', 'emilio',
  'michael', 'jim', 'pam', 'dwight', 'kevin', 'angela', 'oscar', 'stanley', 'phyllis', 'andy', 'kelly', 'ryan', 'toby', 'creed', 'meredith',
];
export const IMAJU_NAMES = new Set(CAST_ORDER.slice(0, 20));

export const ROOM_MEMBERS: Record<string, [string, string][]> = {
  'Dirección': [['paula', 'Recepcionista'], ['javier', 'Orquestador · CEO']],
  'Desarrollo': [['mateo', 'Arquitecto'], ['diego', 'Implementador'], ['andres', 'Revisor Dev']],
  'Creativo': [['valentina', 'Director de Arte'], ['isabella', 'Productor'], ['gabriela', 'Revisor Creativo']],
  'Marketing': [['sofia', 'Estratega'], ['camila', 'SEO'], ['rafael', 'Revisor Marketing']],
  'Finanzas': [['carlos', 'Analista'], ['daniela', 'Contralor']],
  'Redacción': [['lucas', 'Redactor'], ['mariana', 'Editor'], ['tomas', 'Revisor Redacción']],
  'Ciberseguridad': [['elena', 'Auditor de Seguridad'], ['emilio', 'Seg. de sistemas']],
};

// ── character sprite (port of char.mjs drawChar) ─────────────────────────────
const SHOE: RGB = [58, 49, 64], SHOE_SIDE = shade([58, 49, 64], 0.7), SHOE_DK: RGB = [42, 36, 48], DARK: RGB = [42, 36, 48];

function drawChar(b: Buf, ox: number, footY: number, p: Cast): void {
  const skin = SKIN_BASE[p.skin], skinSide = shade(SKIN_BASE[p.skin], 0.7);
  const cloth = p.c, clothSide = shade(p.c, 0.68);
  const hair = p.hairc, hairSide = shade(p.hairc, 0.65);
  const brow = shade(p.hairc, 0.4), mouth = shade(SKIN_BASE[p.skin], 0.55);
  const y0 = footY - 30;
  const R = (x0: number, yy0: number, x1: number, y1: number, c: RGB, a?: number): void => rect(b, ox + x0, y0 + yy0, ox + x1, y0 + y1, c, a);
  const S = (x: number, y: number, c: RGB, a?: number): void => set(b, ox + x, y0 + y, c, a);

  R(3, 28, 12, 29, [0, 0, 0], 55);
  R(4, 22, 6, 25, SHOE); R(9, 22, 11, 25, SHOE_SIDE);
  R(4, 26, 6, 27, SHOE_DK); R(9, 26, 11, 27, shade([58, 49, 64], 0.6));
  const tw = p.heavy ? 1 : 0;
  R(3 - tw, 15, 10 + tw, 21, cloth); R(10 + tw, 16, 13 + tw, 21, clothSide);
  if (p.suit) { R(6, 15, 9, 21, shade(p.c, 0.8)); R(7, 15, 8, 19, [225, 222, 214]); }
  if (p.tie) rect(b, ox + 7, y0 + 15, ox + 8, y0 + 20, p.tie);
  R(0 - tw, 16, 2 - tw, 20, cloth); R(14 + tw, 16, 16 + tw, 20, clothSide);
  S(1 - tw, 20, skin); S(15 + tw, 20, skinSide);
  R(6, 14, 9, 15, clothSide);
  R(1, 0, 14, 13, skin); R(11, 1, 14, 13, skinSide);
  for (const [x, y] of [[1, 0], [1, 1], [2, 0], [14, 0], [14, 1], [13, 0], [1, 13], [14, 13]] as [number, number][]) S(x, y, skin, 0);
  S(4, 5, brow); S(5, 5, brow); S(8, 5, brow); S(9, 5, brow);
  S(4, 7, DARK); S(9, 7, DARK);
  if (p.fem) { S(3, 7, DARK, 120); S(10, 7, DARK, 120); }
  R(5, 10, 7, 10, mouth);
  if (p.glasses) drawGlasses(S);
  if (p.facial) drawFacial(R, S, p.facial, hairSide);
  HAIR[p.hair](R, S, hair, hairSide, p);
}

type Rfn = (x0: number, y0: number, x1: number, y1: number, c: RGB, a?: number) => void;
type Sfn = (x: number, y: number, c: RGB, a?: number) => void;

function drawGlasses(S: Sfn): void {
  const fr: RGB = [64, 60, 72];
  for (const x of [3, 4, 5]) { S(x, 6, fr); S(x, 8, fr); } S(3, 7, fr); S(5, 7, fr);
  for (const x of [8, 9, 10]) { S(x, 6, fr); S(x, 8, fr); } S(8, 7, fr); S(10, 7, fr);
  S(6, 7, fr); S(7, 7, fr);
}
function drawFacial(R: Rfn, S: Sfn, kind: string, hairSide: RGB): void {
  if (kind === 'mustache') R(4, 9, 9, 9, hairSide);
  else if (kind === 'goatee') { R(5, 9, 8, 9, hairSide); R(6, 11, 8, 13, hairSide); }
  else if (kind === 'stubble') { for (const [x, y] of [[3, 11], [5, 12], [7, 11], [9, 12], [4, 13], [8, 13], [6, 13]] as [number, number][]) S(x, y, hairSide, 150); }
}

const HAIR: Record<string, (R: Rfn, S: Sfn, hair: RGB, side: RGB, p: Cast) => void> = {
  short(R, S, hair, side, p) {
    const top = p.recede ? -1 : -2;
    R(0, top, 14, 2, hair); R(11, 0, 15, 4, side);
    R(0, 3, 1, 6, hair); R(14, 3, 15, 6, side);
    if (p.recede) { R(4, top, 10, 0, hair, 0); R(2, -1, 12, 0, hair); }
    if (p.part === 'R') S(9, -1, side); else if (p.part === 'L') S(4, -1, side);
    for (const x of [0, 14]) S(x, top, hair, 0);
  },
  floppy(R, S, hair, side) {
    R(0, -2, 14, 1, hair); R(11, 0, 15, 4, side);
    R(6, 2, 13, 3, hair); R(0, 3, 1, 5, hair); R(14, 3, 15, 5, side);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  frame(R, S, hair, side, p) {
    const len = p.hlen ?? 16, bottom = Math.min(21, 1 + Math.round(len * 0.9));
    R(0, -2, 14, 2, hair); R(11, 0, 15, 3, side);
    R(-1, 1, 1, bottom, hair); R(14, 1, 16, bottom, side);
    R(0, bottom - 1, 1, bottom, hair); R(14, bottom - 1, 15, bottom, side);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  bun(R, S, hair, side) {
    R(0, -1, 14, 2, hair); R(11, 0, 15, 3, side);
    R(11, -4, 15, -1, hair); R(13, -4, 15, -1, side);
    R(0, 3, 1, 5, hair); R(14, 3, 15, 5, side);
    for (const x of [0, 14]) S(x, -1, hair, 0);
  },
  curly(R, S, hair, side) {
    R(0, -2, 14, 3, hair); R(11, 0, 15, 4, side);
    for (const x of [1, 4, 7, 10, 13]) S(x, -3, hair);
    R(-1, 3, 1, 8, hair); R(14, 3, 16, 8, side);
    for (const [x, y] of [[0, 8], [1, 9], [14, 8], [15, 9]] as [number, number][]) S(x, y, hair);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  messy(R, S, hair, side, p) {
    const len = p.hlen ?? 10;
    R(0, -2, 14, 1, hair); R(11, 0, 15, 3, side);
    for (const [x, y] of [[1, -3], [3, -4], [6, -3], [9, -4], [12, -3], [14, -3]] as [number, number][]) S(x, y, hair);
    if (len > 12) { R(-1, 2, 1, 7, hair); R(14, 2, 16, 7, side); }
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  recede(R, S, hair, side) {
    R(10, -1, 14, 1, hair); R(13, -1, 15, 2, side);
    R(-1, 2, 1, 9, hair); R(14, 2, 16, 9, side);
    R(0, 1, 2, 2, hair); R(13, 1, 15, 2, side);
  },
  spiky(R, S, hair, side) {
    R(0, -1, 14, 2, hair); R(11, 0, 15, 3, side);
    for (const [x, y] of [[1, -4], [4, -5], [7, -4], [10, -5], [13, -4]] as [number, number][]) { S(x, y, hair); S(x, y + 1, hair); S(x, y + 2, hair); }
    for (const x of [0, 14]) S(x, -1, hair, 0);
  },
  bald(R, _S, hair, side) { R(-1, 6, 0, 9, hair); R(15, 6, 16, 9, side); },
};

export function renderCharacter(name: string): Buf {
  const b = makeBuf(20, 34);
  drawChar(b, 2, 31, CAST[name]);
  outlineSprite(b);
  return b;
}

// ── room (port of rooms-all.mjs renderRoom) ──────────────────────────────────
const TILE_W = 16, TILE_H = 8, WALL_H = 19, GX = 6, GY = 5, RW = 130, RH = 116;
const R_ORIGIN_X = 54, R_ORIGIN_Y = 28;
const rproject = (tx: number, ty: number): { x: number; y: number } => ({ x: R_ORIGIN_X + (tx - ty) * (TILE_W / 2), y: R_ORIGIN_Y + (tx + ty) * (TILE_H / 2) });

function floorTile(b: Buf, tx: number, ty: number, cA: RGB, cB: RGB): void {
  const p = rproject(tx, ty);
  diamond(b, p.x, p.y, TILE_W, TILE_H, (tx + ty) % 2 === 0 ? cA : cB);
}
function backWall(b: Buf, edge: { x: number; y: number }[], face: RGB, lip: RGB): void {
  for (const { x, y } of edge) for (let dy = 0; dy < WALL_H; dy++) set(b, x, y - dy, dy < 2 ? lip : face);
}
function edgePoints(fn: (t: number) => { x: number; y: number }): { x: number; y: number }[] {
  const byX = new Map<number, { x: number; y: number }>();
  for (let t = 0; t <= 1; t += 0.02) { const p = fn(t); const k = Math.round(p.x); const e = byX.get(k); if (!e || p.y > e.y) byX.set(k, { x: k, y: Math.round(p.y) }); }
  return [...byX.values()].sort((a, c) => a.x - c.x);
}
function drawDesk(b: Buf, tx: number, ty: number, wood: RGB): void {
  const p = rproject(tx, ty);
  const top = mix(wood, [255, 255, 255], 0.12), lf = shade(wood, 0.72), rf = shade(wood, 0.55), dh = 6;
  const halfH = TILE_H / 2 - 1, halfW = TILE_W / 2 - 1;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const frac = 1 - Math.abs(dy) / halfH, rw = Math.round(halfW * frac);
    for (let dx = -rw; dx <= 0; dx++) for (let k = 0; k < dh; k++) set(b, p.x + dx, p.y + dy - k, lf);
    for (let dx = 0; dx <= rw; dx++) for (let k = 0; k < dh; k++) set(b, p.x + dx, p.y + dy - k, rf);
  }
  diamond(b, p.x, p.y - dh, TILE_W - 2, TILE_H - 2, top);
  const mc: RGB = [40, 44, 52];
  rect(b, p.x - 1, p.y - dh - 6, p.x + 1, p.y - dh - 3, mc);
  set(b, p.x, p.y - dh - 2, [90, 96, 110]);
}
function layout(n: number): { tx: number; ty: number }[] {
  if (n <= 2) return [{ tx: 1.3, ty: 1.2 }, { tx: 4.3, ty: 2.8 }].slice(0, n);
  return [{ tx: 1.2, ty: 1.1 }, { tx: 4.6, ty: 1.7 }, { tx: 2.7, ty: 3.6 }];
}

export function renderRoom(dept: string): Buf {
  const accent = ACCENT[DEPARTMENT_ACCENT[dept]];
  const b = makeBuf(RW, RH, PAPER);
  const fA = mix(accent, [255, 255, 255], 0.62), fB = mix(accent, [255, 255, 255], 0.5);
  const wallNE = mix(accent, [255, 255, 255], 0.18), lip = mix(accent, [255, 255, 255], 0.4);
  const wood: RGB = [138, 113, 74];
  for (let ty = 0; ty <= GY; ty++) for (let tx = 0; tx <= GX; tx++) floorTile(b, tx, ty, fA, fB);
  backWall(b, edgePoints((t) => rproject(t * GX, 0)), wallNE, lip);
  backWall(b, edgePoints((t) => rproject(0, t * GY)), shade(accent, 0.62), shade(lip, 0.7));
  const members = ROOM_MEMBERS[dept] || [];
  const slots = layout(members.length);
  const draw: { depth: number; fn: () => void }[] = [];
  members.forEach(([name], i) => {
    const { tx, ty } = slots[i];
    draw.push({ depth: tx + ty - 0.5, fn: () => { const pr = rproject(tx, ty); drawChar(b, pr.x - 8, pr.y + 3, CAST[name]); } });
    draw.push({ depth: tx + ty, fn: () => drawDesk(b, tx, ty + 0.9, wood) });
  });
  draw.sort((a, c) => a.depth - c.depth);
  for (const d of draw) d.fn();
  outlineScene(b);
  return b;
}

/** Paint a native-resolution Buf onto a canvas (caller CSS-scales it, pixelated). */
export function paintBuf(canvas: HTMLCanvasElement, b: Buf): void {
  canvas.width = b.w; canvas.height = b.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(b.w, b.h);
  img.data.set(b.data);
  ctx.putImageData(img, 0, 0);
}
