// Scale the approved 2-character iso sprite to the whole 35-strong office cast.
// Reuses the exact same native-grid / 2-tone / nearest-neighbor technique;
// only the per-character params (skin/hair/cloth/silhouette) change, pulled
// straight from the top-down recipes via lib/cast-iso.mjs.
//
//   node characters-all.mjs [outDir]   (default: ./out)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeBuf, outlineSprite, upscale, encodePNG } from './lib/pixel.mjs';
import { CAST, CAST_ORDER } from './lib/cast-iso.mjs';
import { drawChar } from './lib/char.mjs';

const outDir = process.argv[2] || join(process.cwd(), 'out');
mkdirSync(outDir, { recursive: true });

const W = 20, H = 34, FOOT = 31, F = 8;

function renderSprite(p) {
  const buf = makeBuf(W, H);           // transparent
  drawChar(buf, W, H, 2, FOOT, p);
  outlineSprite(buf, W, H);
  return upscale(buf, W, H, F);
}

const manifest = [];
for (const name of CAST_ORDER) {
  const p = { ...CAST[name] };
  const up = renderSprite(p);
  const png = encodePNG(up, W * F, H * F);
  const file = `char-${name}.png`;
  writeFileSync(join(outDir, file), png);
  manifest.push({ name, display: p.display, file });
}

writeFileSync(join(outDir, 'characters.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} character sprites to ${outDir}`);
