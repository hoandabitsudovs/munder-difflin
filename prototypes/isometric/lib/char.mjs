// Isometric chibi character, Pokémon-GBA proportions (oversized head, tiny
// torso/legs), flat 2-tone shading (front face light / side face dark), 1px
// outline. Extends the approved character-pixelart.mjs sprite so every hair
// recipe in the top-down cast has a matching iso silhouette. Native footprint
// ~17×32px; feet sit at footY. No anti-aliasing — caller upscales once.
import { set, rect, shade } from './pixel.mjs';
import { SKIN_BASE } from './cast-iso.mjs';

const SHOE = [58, 49, 64], SHOE_SIDE = shade([58, 49, 64], 0.7), SHOE_DK = [42, 36, 48];
const DARK = [42, 36, 48];

// draw p (a cast-iso.mjs CAST entry) with feet at (ox is left of a 17px box, footY = ground)
export function drawChar(buf, w, h, ox, footY, p) {
  const skinBase = SKIN_BASE[p.skin];
  const skin = skinBase, skinSide = shade(skinBase, 0.7);
  const cloth = p.c, clothSide = shade(p.c, 0.68);
  const hair = p.hairc, hairSide = shade(p.hairc, 0.65);
  const brow = shade(p.hairc, 0.4);
  const mouth = shade(skinBase, 0.55);
  const y0 = footY - 30;
  const X = (dx) => ox + dx, Y = (dy) => y0 + dy;
  const R = (x0, y0_, x1, y1, c, a) => rect(buf, w, h, X(x0), Y(y0_), X(x1), Y(y1), c, a);
  const S = (x, y, c, a) => set(buf, w, h, X(x), Y(y), c, a);

  // ground shadow
  R(3, 28, 12, 29, [0, 0, 0], 55);

  // legs — short, front pair lighter / back pair darker
  R(4, 22, 6, 25, SHOE); R(9, 22, 11, 25, SHOE_SIDE);
  R(4, 26, 6, 27, SHOE_DK); R(9, 26, 11, 27, shade([58, 49, 64], 0.6));

  // torso (heavy widens it), front + side face
  const tw = p.heavy ? 1 : 0;
  R(3 - tw, 15, 10 + tw, 21, cloth); R(10 + tw, 16, 13 + tw, 21, clothSide);
  if (p.suit) { // lapels + shirt V
    R(6, 15, 9, 21, shade(p.c, 0.8));
    R(7, 15, 8, 19, [225, 222, 214]);
  }
  if (p.tie) rect(buf, w, h, X(7), Y(15), X(8), Y(20), p.tie);
  // arms
  R(0 - tw, 16, 2 - tw, 20, cloth); R(14 + tw, 16, 16 + tw, 20, clothSide);
  S(1 - tw, 20, skin); S(15 + tw, 20, skinSide);
  // collar/neck
  R(6, 14, 9, 15, clothSide);

  // head block, front + side face
  R(1, 0, 14, 13, skin); R(11, 1, 14, 13, skinSide);
  // round the corners a touch
  for (const [x, y] of [[1, 0], [1, 1], [2, 0], [14, 0], [14, 1], [13, 0], [1, 13], [14, 13]]) S(x, y, skin, 0);

  // face — eyes, brow, mouth (fem gets a lash tick)
  S(4, 5, brow); S(5, 5, brow); S(8, 5, brow); S(9, 5, brow);
  S(4, 7, DARK); S(9, 7, DARK);
  if (p.fem) { S(3, 7, DARK, 120); S(10, 7, DARK, 120); }
  R(5, 10, 7, 10, mouth);
  if (p.glasses) drawGlasses(S);
  if (p.facial) drawFacial(R, S, p.facial, hairSide);

  HAIR[p.hair](R, S, hair, hairSide, p);
}

function drawGlasses(S) {
  // thin hollow lenses (3px box) around each eye pixel (x4, x9), leaving skin
  // showing through so it reads as spectacles, not a dark mask.
  const fr = [64, 60, 72];
  for (const x of [3, 4, 5]) { S(x, 6, fr); S(x, 8, fr); }
  S(3, 7, fr); S(5, 7, fr);
  for (const x of [8, 9, 10]) { S(x, 6, fr); S(x, 8, fr); }
  S(8, 7, fr); S(10, 7, fr);
  S(6, 7, fr); S(7, 7, fr); // bridge
}

function drawFacial(R, S, kind, hairSide) {
  if (kind === 'mustache') R(4, 9, 9, 9, hairSide);
  else if (kind === 'goatee') { R(5, 9, 8, 9, hairSide); R(6, 11, 8, 13, hairSide); }
  else if (kind === 'stubble') { for (const [x, y] of [[3, 11], [5, 12], [7, 11], [9, 12], [4, 13], [8, 13], [6, 13]]) S(x, y, hairSide, 150); }
}

// ── hair silhouettes, keyed by cast-iso.mjs `hair` ──────────────────────────
const HAIR = {
  short(R, S, hair, side, p) {
    const top = p.recede ? -1 : -2;
    R(0, top, 14, 2, hair); R(11, 0, 15, 4, side);
    R(0, 3, 1, 6, hair); R(14, 3, 15, 6, side); // sideburns
    if (p.recede) R(4, top, 10, 0, hair, 0), R(2, -1, 12, 0, hair); // higher hairline
    if (p.part === 'R') S(9, -1, side); else if (p.part === 'L') S(4, -1, side);
    for (const x of [0, 14]) S(x, top, hair, 0);
  },
  floppy(R, S, hair, side) {
    R(0, -2, 14, 1, hair); R(11, 0, 15, 4, side);
    R(6, 2, 13, 3, hair); // swept fringe over forehead
    R(0, 3, 1, 5, hair); R(14, 3, 15, 5, side);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  frame(R, S, hair, side, p) {
    const len = (p.hlen ?? 16);
    const bottom = Math.min(21, 1 + Math.round(len * 0.9));
    R(0, -2, 14, 2, hair); R(11, 0, 15, 3, side);
    R(-1, 1, 1, bottom, hair);            // long left panel
    R(14, 1, 16, bottom, side);           // long right panel (shaded)
    R(0, bottom - 1, 1, bottom, hair); R(14, bottom - 1, 15, bottom, side);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  bun(R, S, hair, side) {
    R(0, -1, 14, 2, hair); R(11, 0, 15, 3, side);
    R(11, -4, 15, -1, hair); R(13, -4, 15, -1, side); // bun bump, back-top
    R(0, 3, 1, 5, hair); R(14, 3, 15, 5, side);
    for (const x of [0, 14]) S(x, -1, hair, 0);
  },
  curly(R, S, hair, side) {
    R(0, -2, 14, 3, hair); R(11, 0, 15, 4, side);
    for (const x of [1, 4, 7, 10, 13]) S(x, -3, hair);   // lumpy top
    R(-1, 3, 1, 8, hair); R(14, 3, 16, 8, side);         // fuller sides
    for (const [x, y] of [[0, 8], [1, 9], [14, 8], [15, 9]]) S(x, y, hair);
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  messy(R, S, hair, side, p) {
    const len = (p.hlen ?? 10);
    R(0, -2, 14, 1, hair); R(11, 0, 15, 3, side);
    for (const [x, y] of [[1, -3], [3, -4], [6, -3], [9, -4], [12, -3], [14, -3]]) S(x, y, hair); // spikes
    if (len > 12) { R(-1, 2, 1, 7, hair); R(14, 2, 16, 7, side); } // longer -> side length
    for (const x of [0, 14]) S(x, -2, hair, 0);
  },
  recede(R, S, hair, side) {
    R(10, -1, 14, 1, hair); R(13, -1, 15, 2, side);   // thin back band
    R(-1, 2, 1, 9, hair); R(14, 2, 16, 9, side);      // side/back hair only, bare forehead
    R(0, 1, 2, 2, hair); R(13, 1, 15, 2, side);
  },
  spiky(R, S, hair, side) {
    R(0, -1, 14, 2, hair); R(11, 0, 15, 3, side);
    for (const [x, y] of [[1, -4], [4, -5], [7, -4], [10, -5], [13, -4]]) { S(x, y, hair); S(x, y + 1, hair); S(x, y + 2, hair); }
    for (const x of [0, 14]) S(x, -1, hair, 0);
  },
  bald(R, S, hair, side) {
    // shaved / bald: no crown; only a faint low band so grey-haired ones read.
    R(-1, 6, 0, 9, hair); R(15, 6, 16, 9, side);
  },
};
