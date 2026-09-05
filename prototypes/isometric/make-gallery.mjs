// Build a static HTML gallery of the generated PNGs (characters + rooms) for
// visual review. Pixelated rendering so the native grid stays crisp.
//   node make-gallery.mjs <outDir>
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || join(process.cwd(), 'out');
const chars = existsSync(join(outDir, 'characters.json')) ? JSON.parse(readFileSync(join(outDir, 'characters.json'))) : [];
const rooms = existsSync(join(outDir, 'rooms.json')) ? JSON.parse(readFileSync(join(outDir, 'rooms.json'))) : [];

// Inline every PNG as a data URI so the page is fully self-contained (the
// Browser pane renders local files as static snapshots that can't fetch
// sibling files, so external <img src> would break).
const dataUri = (file) => 'data:image/png;base64,' + readFileSync(join(outDir, file)).toString('base64');

const IMAJU = new Set(['sofia','mateo','valentina','diego','camila','lucas','elena','andres','mariana','javier','isabella','carlos','gabriela','rafael','daniela','tomas','paula','nicolas','renata','emilio']);

const charCards = chars.map(c => `
  <figure class="${IMAJU.has(c.name) ? 'imaju' : 'office'}">
    <img src="${dataUri(c.file)}" alt="${c.display}">
    <figcaption>${c.display}</figcaption>
  </figure>`).join('');

const roomCards = rooms.map(r => `
  <figure class="room">
    <img src="${dataUri(r.file)}" alt="${r.dept}">
    <figcaption><b>${r.dept}</b><br><span>${r.members}</span></figcaption>
  </figure>`).join('');

const html = `<!doctype html><meta charset="utf-8"><title>IMAJU iso pixel art</title>
<style>
  body { margin: 0; background: #201b28; color: #e8e2f0; font: 14px/1.4 -apple-system, system-ui, sans-serif; padding: 28px 32px 60px; }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 34px 0 14px; color: #b9a9e0; letter-spacing: .04em; text-transform: uppercase; }
  p.note { color: #9a8fb0; margin: 0 0 8px; }
  img { image-rendering: pixelated; display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
  figure { margin: 0; background: #2b2436; border: 1px solid #3a3348; border-radius: 10px; padding: 12px 8px 8px; text-align: center; }
  figure.imaju { border-color: #4f6f9f; } figure.office { opacity: .82; }
  figure img { height: 132px; margin: 0 auto 8px; }
  figcaption { font-size: 12px; color: #d8d0e6; }
  figure.imaju figcaption { color: #cfe5e9; }
  .rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
  figure.room { padding: 0 0 12px; overflow: hidden; }
  figure.room img { width: 100%; height: auto; margin: 0 0 8px; border-bottom: 1px solid #3a3348; }
  figure.room figcaption span { color: #9a8fb0; font-size: 11px; }
</style>
<h1>IMAJU · arte isométrico pixel — set completo</h1>
<p class="note">Grilla nativa, sin anti-aliasing, escalado nearest-neighbor · misma técnica que el prototipo aprobado. Standalone, sin integrar al motor.</p>

<h2>7 salas de departamento (${rooms.length})</h2>
<div class="rooms">${roomCards || '<p class="note">— aún no generadas —</p>'}</div>

<h2>Elenco · IMAJU (azul) + The Office (${chars.length})</h2>
<div class="grid">${charCards}</div>
`;
writeFileSync(join(outDir, 'index.html'), html);
console.log('wrote', join(outDir, 'index.html'));
