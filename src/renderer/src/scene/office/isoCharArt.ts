// Isometric chibi character sprites for the in-scene cast — the Pokémon-GBA
// look approved in prototypes/isometric (oversized head, tiny torso/legs, flat
// 2-tone shading with a front-light/side-dark face, 1px outline). Ported from
// that prototype's lib/char.mjs + lib/cast-iso.mjs + lib/pixel.mjs and extended
// with a walk cycle (stand / step-L / step-R) and a back view, so it drops into
// the same frame contract the office already consumes (cast.ts getCastFrames).
//
// The old top-down generator (portraitArt.sceneFrameBufs) stays in place as a
// fallback; swap the import in cast.ts to revert.
import type { OfficeCharacterName } from './cast';

export const ISO_W = 20, ISO_H = 33;
const OX = 2, FOOT_Y = 35; // native draw box: feet land on the bottom row

type RGB = [number, number, number];
const OUTLINE: RGB = [40, 34, 46];

interface IsoParams {
  skin: 'light' | 'tan' | 'brown' | 'dark';
  hairc: RGB;
  hair: 'short' | 'floppy' | 'frame' | 'bun' | 'curly' | 'messy' | 'recede' | 'spiky' | 'bald';
  c: RGB;                 // clothing accent
  tie?: RGB;
  facial?: 'mustache' | 'goatee' | 'stubble';
  part?: 'L' | 'R';
  hlen?: number;
  fem?: boolean;
  heavy?: boolean;
  glasses?: boolean;
  suit?: boolean;
  recede?: boolean;
}

const SKIN_BASE: Record<IsoParams['skin'], RGB> = {
  light: [247, 201, 170], tan: [214, 162, 116], brown: [158, 112, 78], dark: [120, 80, 56],
};

// One entry per office character, transcribed 1:1 from portraitArt's recipes so
// the iso sprite carries the same identity (skin / hair / accent / silhouette).
const CAST: Record<OfficeCharacterName, IsoParams> = {
  sofia: { skin: 'light', hairc: [140, 70, 50], hair: 'frame', hlen: 19, c: [60, 150, 150], fem: true },
  mateo: { skin: 'tan', hairc: [30, 24, 20], hair: 'short', part: 'L', c: [50, 70, 110], tie: [30, 45, 80] },
  valentina: { skin: 'brown', hairc: [20, 16, 14], hair: 'curly', c: [120, 40, 55], fem: true },
  diego: { skin: 'dark', hairc: [35, 28, 22], hair: 'spiky', c: [50, 120, 70] },
  camila: { skin: 'tan', hairc: [200, 160, 60], hair: 'bun', c: [220, 110, 90], fem: true },
  lucas: { skin: 'light', hairc: [180, 140, 80], hair: 'messy', hlen: 9, c: [190, 150, 40] },
  elena: { skin: 'dark', hairc: [20, 16, 14], hair: 'frame', hlen: 20, c: [40, 150, 160], fem: true },
  andres: { skin: 'brown', hairc: [150, 150, 150], hair: 'recede', c: [110, 110, 120], tie: [70, 70, 85], glasses: true },
  mariana: { skin: 'light', hairc: [110, 50, 40], hair: 'curly', c: [170, 140, 190], fem: true },
  javier: { skin: 'tan', hairc: [35, 28, 22], hair: 'short', part: 'R', c: [50, 50, 58], tie: [120, 40, 40], glasses: true, suit: true },
  isabella: { skin: 'brown', hairc: [15, 12, 12], hair: 'bun', c: [200, 160, 50], fem: true },
  carlos: { skin: 'dark', hairc: [25, 20, 18], hair: 'bald', c: [40, 60, 110] },
  gabriela: { skin: 'tan', hairc: [110, 65, 40], hair: 'floppy', c: [220, 130, 150], fem: true },
  rafael: { skin: 'light', hairc: [30, 24, 20], hair: 'frame', hlen: 14, c: [45, 55, 80], tie: [150, 40, 40], suit: true },
  daniela: { skin: 'dark', hairc: [20, 16, 14], hair: 'messy', hlen: 10, c: [60, 160, 170], fem: true },
  tomas: { skin: 'brown', hairc: [195, 155, 70], hair: 'spiky', c: [180, 50, 50] },
  paula: { skin: 'light', hairc: [210, 180, 90], hair: 'short', part: 'L', c: [120, 190, 160], fem: true },
  nicolas: { skin: 'tan', hairc: [20, 16, 14], hair: 'curly', c: [40, 90, 55], facial: 'stubble' },
  renata: { skin: 'brown', hairc: [120, 116, 122], hair: 'bun', c: [110, 60, 100], fem: true },
  emilio: { skin: 'dark', hairc: [20, 16, 14], hair: 'recede', c: [90, 100, 55], facial: 'goatee' },
  michael: { skin: 'light', hairc: [58, 42, 28], hair: 'short', part: 'L', c: [58, 63, 74], tie: [170, 58, 58], suit: true },
  jim: { skin: 'light', hairc: [92, 60, 34], hair: 'floppy', c: [172, 196, 224], tie: [120, 130, 150] },
  pam: { skin: 'light', hairc: [120, 76, 42], hair: 'frame', hlen: 18, c: [236, 174, 192], fem: true },
  dwight: { skin: 'light', hairc: [64, 48, 28], hair: 'short', part: 'L', recede: true, c: [184, 155, 62], tie: [120, 82, 46], glasses: true },
  kevin: { skin: 'light', hairc: [58, 44, 30], hair: 'bald', c: [110, 140, 180], heavy: true },
  angela: { skin: 'light', hairc: [186, 154, 90], hair: 'bun', c: [150, 146, 170], fem: true },
  oscar: { skin: 'tan', hairc: [28, 22, 18], hair: 'short', part: 'L', c: [122, 60, 74] },
  stanley: { skin: 'dark', hairc: [60, 54, 48], hair: 'recede', c: [150, 120, 86], tie: [120, 78, 52], glasses: true, facial: 'mustache', heavy: true },
  phyllis: { skin: 'light', hairc: [196, 162, 110], hair: 'curly', c: [202, 160, 192], glasses: true, fem: true, heavy: true },
  andy: { skin: 'light', hairc: [74, 51, 32], hair: 'short', part: 'R', c: [176, 65, 58] },
  kelly: { skin: 'tan', hairc: [24, 18, 22], hair: 'frame', hlen: 20, c: [212, 90, 158], fem: true },
  ryan: { skin: 'light', hairc: [42, 32, 24], hair: 'spiky', c: [58, 58, 68], tie: [40, 40, 50], suit: true },
  toby: { skin: 'light', hairc: [106, 90, 66], hair: 'short', part: 'L', recede: true, c: [150, 150, 120], facial: 'mustache' },
  creed: { skin: 'light', hairc: [170, 166, 156], hair: 'bald', c: [126, 130, 96], facial: 'stubble' },
  meredith: { skin: 'light', hairc: [154, 82, 46], hair: 'messy', hlen: 15, c: [176, 86, 74], fem: true },
};

// ── pixel primitives (native-grid RGBA, hard edges) ─────────────────────────
const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const shade = (c: RGB, f: number): RGB => [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)];
function set(buf: Uint8ClampedArray, x: number, y: number, c: RGB, a = 255): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H) return;
  const i = (y * ISO_W + x) * 4, alpha = a / 255;
  buf[i] = buf[i] * (1 - alpha) + c[0] * alpha;
  buf[i + 1] = buf[i + 1] * (1 - alpha) + c[1] * alpha;
  buf[i + 2] = buf[i + 2] * (1 - alpha) + c[2] * alpha;
  buf[i + 3] = 255;
}
function rect(buf: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(buf, x, y, c, a);
}
function outline(buf: Uint8ClampedArray): void {
  const alphaAt = (x: number, y: number): number => (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H ? 0 : buf[(y * ISO_W + x) * 4 + 3]);
  const toPaint: [number, number][] = [];
  for (let y = 0; y < ISO_H; y++) for (let x = 0; x < ISO_W; x++) {
    if (alphaAt(x, y) !== 0) continue;
    if (alphaAt(x - 1, y) || alphaAt(x + 1, y) || alphaAt(x, y - 1) || alphaAt(x, y + 1)) toPaint.push([x, y]);
  }
  for (const [x, y] of toPaint) set(buf, x, y, OUTLINE);
}

// ── one character, one walk phase, front or back ────────────────────────────
function drawChar(buf: Uint8ClampedArray, p: IsoParams, back: boolean, phase: 0 | 1 | 2): void {
  const skin = SKIN_BASE[p.skin], skinSide = shade(skin, 0.7);
  const cloth = p.c, clothSide = shade(p.c, 0.68);
  const hair = p.hairc, hairSide = shade(p.hairc, 0.65);
  const brow = shade(p.hairc, 0.4), mouth = shade(skin, 0.55);
  const y0 = FOOT_Y - 30;
  const X = (dx: number): number => OX + dx, Y = (dy: number): number => y0 + dy;
  const R = (x0: number, y0_: number, x1: number, y1: number, c: RGB, a?: number): void => rect(buf, X(x0), Y(y0_), X(x1), Y(y1), c, a);
  const S = (x: number, y: number, c: RGB, a?: number): void => set(buf, X(x), Y(y), c, a);
  const SHOE: RGB = [58, 49, 64], SHOE_SIDE = shade(SHOE, 0.7), SHOE_DK: RGB = [42, 36, 48], DARK: RGB = [42, 36, 48];

  // legs — upper legs fixed to the torso; the FEET clearly alternate (one foot
  // lifted 2px + nudged forward, the other planted on the ground) so it reads as
  // a real step instead of sliding. phase 0 = both planted (stand).
  R(4, 22, 6, 25, SHOE); R(9, 22, 11, 25, SHOE_SIDE);           // upper legs
  const lLift = phase === 1, rLift = phase === 2;
  R(4 + (lLift ? 1 : 0), lLift ? 23 : 26, 6 + (lLift ? 1 : 0), lLift ? 24 : 27, SHOE_DK);          // left foot (planted low / lifted high+fwd)
  R(9 + (rLift ? 1 : 0), rLift ? 23 : 26, 11 + (rLift ? 1 : 0), rLift ? 24 : 27, shade(SHOE, 0.6)); // right foot

  // torso (heavy widens it), front + side face
  const tw = p.heavy ? 1 : 0;
  R(3 - tw, 15, 10 + tw, 21, cloth); R(10 + tw, 16, 13 + tw, 21, clothSide);
  if (p.suit && !back) { R(6, 15, 9, 21, shade(p.c, 0.8)); R(7, 15, 8, 19, [225, 222, 214]); } // lapels + shirt V
  if (p.tie && !back) R(7, 15, 8, 20, p.tie);
  R(0 - tw, 16, 2 - tw, 20, cloth); R(14 + tw, 16, 16 + tw, 20, clothSide); // arms
  S(1 - tw, 20, skin); S(15 + tw, 20, skinSide);                            // hands
  R(6, 14, 9, 15, clothSide);                                              // collar/neck

  // head block — from behind it's the back of the head (hair), except baldish
  const baldish = p.hair === 'bald' || p.hair === 'recede';
  const headF = back && !baldish ? hair : skin, headS = back && !baldish ? hairSide : skinSide;
  R(1, 0, 14, 13, headF); R(11, 1, 14, 13, headS);
  for (const [x, y] of [[1, 0], [1, 1], [2, 0], [14, 0], [14, 1], [13, 0], [1, 13], [14, 13]]) S(x, y, headF, 0);

  if (!back) { // face only from the front
    S(4, 5, brow); S(5, 5, brow); S(8, 5, brow); S(9, 5, brow);
    S(4, 7, DARK); S(9, 7, DARK);
    if (p.fem) { S(3, 7, DARK, 120); S(10, 7, DARK, 120); }
    R(5, 10, 7, 10, mouth);
    if (p.glasses) { const fr: RGB = [64, 60, 72]; for (const x of [3, 4, 5]) { S(x, 6, fr); S(x, 8, fr); } S(3, 7, fr); S(5, 7, fr); for (const x of [8, 9, 10]) { S(x, 6, fr); S(x, 8, fr); } S(8, 7, fr); S(10, 7, fr); S(6, 7, fr); S(7, 7, fr); }
    if (p.facial === 'mustache') R(4, 9, 9, 9, hairSide);
    else if (p.facial === 'goatee') { R(5, 9, 8, 9, hairSide); R(6, 11, 8, 13, hairSide); }
    else if (p.facial === 'stubble') for (const [x, y] of [[3, 11], [5, 12], [7, 11], [9, 12], [4, 13], [8, 13], [6, 13]]) S(x, y, hairSide, 150);
  }

  drawHair(R, S, p, hair, hairSide);
}

type RFn = (x0: number, y0: number, x1: number, y1: number, c: RGB, a?: number) => void;
type SFn = (x: number, y: number, c: RGB, a?: number) => void;
function drawHair(R: RFn, S: SFn, p: IsoParams, hair: RGB, side: RGB): void {
  switch (p.hair) {
    case 'short': {
      const top = p.recede ? -1 : -2;
      R(0, top, 14, 2, hair); R(11, 0, 15, 4, side); R(0, 3, 1, 6, hair); R(14, 3, 15, 6, side);
      if (p.recede) { R(2, -1, 12, 0, hair); }
      if (p.part === 'R') S(9, -1, side); else if (p.part === 'L') S(4, -1, side);
      for (const x of [0, 14]) S(x, top, hair, 0); break;
    }
    case 'floppy': R(0, -2, 14, 1, hair), R(11, 0, 15, 4, side), R(6, 2, 13, 3, hair), R(0, 3, 1, 5, hair), R(14, 3, 15, 5, side), [0, 14].forEach((x) => S(x, -2, hair, 0)); break;
    case 'frame': {
      const bottom = Math.min(21, 1 + Math.round((p.hlen ?? 16) * 0.9));
      R(0, -2, 14, 2, hair); R(11, 0, 15, 3, side); R(-1, 1, 1, bottom, hair); R(14, 1, 16, bottom, side);
      R(0, bottom - 1, 1, bottom, hair); R(14, bottom - 1, 15, bottom, side); for (const x of [0, 14]) S(x, -2, hair, 0); break;
    }
    case 'bun': R(0, -1, 14, 2, hair), R(11, 0, 15, 3, side), R(11, -4, 15, -1, hair), R(13, -4, 15, -1, side), R(0, 3, 1, 5, hair), R(14, 3, 15, 5, side), [0, 14].forEach((x) => S(x, -1, hair, 0)); break;
    case 'curly': {
      R(0, -2, 14, 3, hair); R(11, 0, 15, 4, side); for (const x of [1, 4, 7, 10, 13]) S(x, -3, hair);
      R(-1, 3, 1, 8, hair); R(14, 3, 16, 8, side); for (const [x, y] of [[0, 8], [1, 9], [14, 8], [15, 9]]) S(x, y, hair);
      for (const x of [0, 14]) S(x, -2, hair, 0); break;
    }
    case 'messy': {
      R(0, -2, 14, 1, hair); R(11, 0, 15, 3, side); for (const [x, y] of [[1, -3], [3, -4], [6, -3], [9, -4], [12, -3], [14, -3]]) S(x, y, hair);
      if ((p.hlen ?? 10) > 12) { R(-1, 2, 1, 7, hair); R(14, 2, 16, 7, side); } for (const x of [0, 14]) S(x, -2, hair, 0); break;
    }
    case 'recede': R(10, -1, 14, 1, hair), R(13, -1, 15, 2, side), R(-1, 2, 1, 9, hair), R(14, 2, 16, 9, side), R(0, 1, 2, 2, hair), R(13, 1, 15, 2, side); break;
    case 'spiky': {
      R(0, -1, 14, 2, hair); R(11, 0, 15, 3, side); for (const [x, y] of [[1, -4], [4, -5], [7, -4], [10, -5], [13, -4]]) { S(x, y, hair); S(x, y + 1, hair); S(x, y + 2, hair); }
      for (const x of [0, 14]) S(x, -1, hair, 0); break;
    }
    case 'bald': R(-1, 6, 0, 9, hair), R(15, 6, 16, 9, side); break;
  }
}

// ── public: same shape portraitArt.sceneFrameBufs returns ───────────────────
export interface IsoFrames { front: Uint8ClampedArray[]; back: Uint8ClampedArray[] }
const cache = new Map<OfficeCharacterName, IsoFrames>();

function frame(p: IsoParams, back: boolean, phase: 0 | 1 | 2): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(ISO_W * ISO_H * 4);
  drawChar(buf, p, back, phase);
  outline(buf);
  return buf;
}

/** Walk-phase frames (stand, step-L, step-R) for front + back, iso chibi style. */
export function isoSceneFrameBufs(name: OfficeCharacterName): IsoFrames {
  let f = cache.get(name);
  if (!f) {
    const p = CAST[name] ?? CAST.jim;
    f = {
      front: [frame(p, false, 0), frame(p, false, 1), frame(p, false, 2)],
      back: [frame(p, true, 0), frame(p, true, 1), frame(p, true, 2)],
    };
    cache.set(name, f);
  }
  return f;
}
