// Tile <-> screen geometry, isolated so switching the office from a top-down
// (orthogonal) grid to isometric lands in ONE place instead of being spread
// across the renderer and Character.ts. See prototypes/isometric/RETROFIT_PLAN.md
// (steps 2-3). The orthogonal projection reproduces the previous hard-coded math
// exactly, so wiring the renderer through this is a no-op until 'iso' is chosen.
//
// Depth: both tile sprites and characters sort on a single key — the baseline
// screen-Y of where the thing stands. In ortho that is the tile's bottom edge;
// in iso it is the diamond centre, which is monotonic in (tx+ty), so a character
// and the floor/wall tiles it walks past sort consistently in one sortable
// container (painter's algorithm, validated in the prototypes).

export interface Point {
  x: number;
  y: number;
}

export type Projection =
  | { readonly kind: 'ortho'; readonly tileSize: number }
  | {
      readonly kind: 'iso';
      readonly tileSize: number;
      /** on-screen diamond footprint (px). 2:1 is the classic pixel-art ratio. */
      readonly tileW: number;
      readonly tileH: number;
      /** screen offset of tile (0,0) so the diamond map is not clipped left/top. */
      readonly originX: number;
      readonly originY: number;
    };

export function orthoProjection(tileSize: number): Projection {
  return { kind: 'ortho', tileSize };
}

/** Iso projection whose origin is chosen so a `cols`x`rows` map sits fully on
 *  screen (the left-most column is at x=0). tileW/tileH default to 2:1 at 2x the
 *  logical tile size, matching the prototype's 32x16 diamonds for tileSize 16. */
export function isoProjection(
  tileSize: number,
  cols: number,
  rows: number,
  tileW = tileSize * 2,
  tileH = tileSize,
): Projection {
  // x spans [-(rows)*tileW/2, cols*tileW/2]; shift right by rows*tileW/2.
  return {
    kind: 'iso',
    tileSize,
    tileW,
    tileH,
    originX: rows * (tileW / 2),
    originY: 0,
  };
}

/** Top-left anchor for a tile sprite of this projection. */
export function tileToPixel(p: Projection, tx: number, ty: number): Point {
  if (p.kind === 'ortho') return { x: tx * p.tileSize, y: ty * p.tileSize };
  const c = tileCentre(p, tx, ty);
  return { x: c.x - p.tileW / 2, y: c.y - p.tileH / 2 };
}

/** Where a character standing on this tile plants their feet (sprite anchor at
 *  bottom-centre). Single source for the old `+tileSize/2, +tileSize` offset. */
export function tileToFoot(p: Projection, tx: number, ty: number): Point {
  if (p.kind === 'ortho') {
    return { x: tx * p.tileSize + p.tileSize / 2, y: ty * p.tileSize + p.tileSize };
  }
  return tileCentre(p, tx, ty);
}

/** The single depth-sort key (higher = drawn in front). Baseline screen-Y. */
export function depthKey(p: Projection, tx: number, ty: number): number {
  return tileToFoot(p, tx, ty).y;
}

function tileCentre(p: Extract<Projection, { kind: 'iso' }>, tx: number, ty: number): Point {
  return {
    x: p.originX + (tx - ty) * (p.tileW / 2),
    y: p.originY + (tx + ty) * (p.tileH / 2),
  };
}
