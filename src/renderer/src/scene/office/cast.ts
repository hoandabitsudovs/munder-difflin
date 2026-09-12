// The Office cast — roster metadata + sprite frames.
//
// Both the static portraits (cards / picker) and the in-scene walking sprites are
// now fully custom-drawn from the same per-character recipes in portraitArt.ts:
// the scene sprite reuses the portrait's exact head/face/clothing and adds legs,
// so an agent on the office floor looks identical to its card. The LimeZu base
// sheets are no longer used for the cast. See assets/ATTRIBUTION.md.

import { Texture } from 'pixi.js';
import { PORTRAIT_W, PORTRAIT_H } from './portraitArt'; // paintPortrait/sceneFrameBufs kept there as fallback
import { isoSceneFrameBufs, isoPortraitBuf, ISO_W, ISO_H } from './isoCharArt';

export type OfficeCharacterName =
  | 'michael' | 'jim' | 'pam' | 'dwight' | 'kevin' | 'angela'
  | 'oscar' | 'stanley' | 'phyllis' | 'andy' | 'kelly' | 'ryan'
  | 'toby' | 'creed' | 'meredith'
  // IMAJU cast — generated via the parametrized recipe builder in portraitArt.ts
  // (buildParamRecipe), not hand-tuned per-character like the names above. Same
  // procedural engine, no LimeZu, free to expand.
  | 'sofia' | 'mateo' | 'valentina' | 'diego' | 'camila' | 'lucas' | 'elena'
  | 'andres' | 'mariana' | 'javier' | 'isabella' | 'carlos' | 'gabriela'
  | 'rafael' | 'daniela' | 'tomas' | 'paula' | 'nicolas' | 'renata' | 'emilio';

export interface CastMember {
  name: OfficeCharacterName;
  displayName: string;
  /** Signature accent color (hex) — used for the in-scene selection glow. */
  shirt: string;
  /** Blurb shown when this character is picked / has no description yet. */
  blurb: string;
}

/** Selectable roster, in display order. */
export const OFFICE_CAST: CastMember[] = [
  { name: 'michael',  displayName: 'Michael',  shirt: '#5a6b8c', blurb: "World's best boss" },
  { name: 'jim',      displayName: 'Jim',      shirt: '#6fa8dc', blurb: 'Salesman, prankster' },
  { name: 'pam',      displayName: 'Pam',      shirt: '#9caf88', blurb: 'Receptionist, artist' },
  { name: 'dwight',   displayName: 'Dwight',   shirt: '#b89b3e', blurb: 'Assistant (to the) RM' },
  { name: 'kevin',    displayName: 'Kevin',    shirt: '#4a7ab5', blurb: 'Accounting' },
  { name: 'angela',   displayName: 'Angela',   shirt: '#8a86a6', blurb: 'Head of accounting' },
  { name: 'oscar',    displayName: 'Oscar',    shirt: '#7a4b6b', blurb: 'Accountant' },
  { name: 'stanley',  displayName: 'Stanley',  shirt: '#8c5a4b', blurb: 'Sales, crossword' },
  { name: 'phyllis',  displayName: 'Phyllis',  shirt: '#b08bbf', blurb: 'Sales' },
  { name: 'andy',     displayName: 'Andy',     shirt: '#6fae6f', blurb: 'Cornell, a cappella' },
  { name: 'kelly',    displayName: 'Kelly',    shirt: '#d16ba5', blurb: 'Customer service' },
  { name: 'ryan',     displayName: 'Ryan',     shirt: '#3a3a44', blurb: 'The temp' },
  { name: 'toby',     displayName: 'Toby',     shirt: '#9a8c5a', blurb: 'Human resources' },
  { name: 'creed',    displayName: 'Creed',    shirt: '#6b7a4b', blurb: 'Quality assurance' },
  { name: 'meredith', displayName: 'Meredith', shirt: '#b5544a', blurb: 'Supplier relations' },
  // ─── IMAJU cast (procedural, parametrized — see portraitArt.ts) ───────────
  { name: 'sofia',     displayName: 'Sofía',     shirt: '#3C9696', blurb: 'Estrategia y crecimiento' },
  { name: 'mateo',     displayName: 'Mateo',     shirt: '#32466E', blurb: 'Arquitectura de software' },
  { name: 'valentina', displayName: 'Valentina', shirt: '#782837', blurb: 'Dirección de arte' },
  { name: 'diego',     displayName: 'Diego',     shirt: '#327846', blurb: 'Implementación' },
  { name: 'camila',    displayName: 'Camila',    shirt: '#DC6E5A', blurb: 'SEO técnico' },
  { name: 'lucas',     displayName: 'Lucas',     shirt: '#BE9628', blurb: 'Redacción' },
  { name: 'elena',     displayName: 'Elena',     shirt: '#2896A0', blurb: 'Auditoría de seguridad' },
  { name: 'andres',    displayName: 'Andrés',    shirt: '#6E6E78', blurb: 'Revisión de desarrollo' },
  { name: 'mariana',   displayName: 'Mariana',   shirt: '#AA8CBE', blurb: 'Edición y tono' },
  { name: 'javier',    displayName: 'Javier',    shirt: '#32323A', blurb: 'Coordinación central' },
  { name: 'isabella',  displayName: 'Isabella',  shirt: '#C8A032', blurb: 'Producción visual' },
  { name: 'carlos',    displayName: 'Carlos',    shirt: '#283C6E', blurb: 'Análisis financiero' },
  { name: 'gabriela',  displayName: 'Gabriela',  shirt: '#DC8296', blurb: 'Revisión creativa' },
  { name: 'rafael',    displayName: 'Rafael',    shirt: '#2D3750', blurb: 'Revisión de marketing' },
  { name: 'daniela',   displayName: 'Daniela',   shirt: '#3CA0AA', blurb: 'Contraloría' },
  { name: 'tomas',     displayName: 'Tomás',     shirt: '#B43232', blurb: 'Revisión de redacción' },
  { name: 'paula',     displayName: 'Paula',     shirt: '#78BEA0', blurb: 'Atención al detalle' },
  { name: 'nicolas',   displayName: 'Nicolás',   shirt: '#285A37', blurb: 'Desarrollo backend' },
  { name: 'renata',    displayName: 'Renata',    shirt: '#6E3C64', blurb: 'Consultoría senior' },
  { name: 'emilio',    displayName: 'Emilio',    shirt: '#5A6437', blurb: 'Seguridad de sistemas' },
];

export const CAST_BY_NAME: Record<OfficeCharacterName, CastMember> =
  Object.fromEntries(OFFICE_CAST.map((c) => [c.name, c])) as Record<OfficeCharacterName, CastMember>;

export const DEFAULT_CHARACTER: OfficeCharacterName = 'jim';

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── scene frames ────────────────────────────────────────────────────────────
const frameCache = new Map<OfficeCharacterName, Texture[][]>();

function bufToTexture(buf: Uint8ClampedArray, w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  img.data.set(buf);
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/**
 * Frame grid CharacterSprite expects: 3 rows (down, up, right) × 7 frames
 * [walk1, walk2, walk3, type1, type2, read1, read2]. We provide a front view
 * (down — and reused for the side row, so left/right walkers still show a face)
 * and a back view (up — agents seated facing their desk show their back). The
 * three walk frames are stand / step-left / step-right.
 */
export async function getCastFrames(name: OfficeCharacterName): Promise<Texture[][]> {
  const cached = frameCache.get(name);
  if (cached) return cached;
  // iso chibi sprites (isoCharArt) — swap back to sceneFrameBufs(name) + SCENE_W/H
  // to restore the old top-down cast.
  const { front, back } = isoSceneFrameBufs(name);
  const toRow = (bufs: Uint8ClampedArray[]): Texture[] => {
    const [stand, stepL, stepR] = bufs.map((b) => bufToTexture(b, ISO_W, ISO_H));
    return [stand, stepL, stepR, stand, stand, stand, stand];
  };
  const frontRow = toRow(front);
  const frames: Texture[][] = [frontRow, toRow(back), frontRow]; // down, up, right
  frameCache.set(name, frames);
  return frames;
}

/**
 * Paint a character's static portrait for cards / the picker (delegates to the
 * custom procedural composer in portraitArt.ts).
 */
export async function paintCastPortrait(
  ctx: CanvasRenderingContext2D,
  name: OfficeCharacterName,
  scale = 2,
): Promise<void> {
  // Draw the iso chibi standing sprite, top-anchored + horizontally centered, so
  // the card shows the head+torso (legs crop below) — the card now matches the
  // floor character. Swap back to paintPortrait(ctx, name, scale) to restore the
  // old top-down bust.
  const { buf, w, h } = isoPortraitBuf(name);
  const stage = document.createElement('canvas');
  stage.width = w; stage.height = h;
  const sctx = stage.getContext('2d')!;
  const img = sctx.createImageData(w, h);
  img.data.set(buf);
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, PORTRAIT_W * scale, PORTRAIT_H * scale);
  const dx = Math.round(((PORTRAIT_W - w) / 2) * scale); // center the 20-wide sprite in the 18-wide frame
  ctx.drawImage(stage, 0, 0, w, h, dx, 0, w * scale, h * scale);
}
