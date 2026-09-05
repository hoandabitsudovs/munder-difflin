# Plan de retrofit del motor de render a isométrico

**Fecha:** 5 de septiembre de 2026
**Estado del arte:** el set completo (35 personajes + 7 salas) ya está construido y
verificado visualmente en `prototypes/isometric/` (scripts standalone, sin integrar).
Este documento es el paso 3 del HANDOFF ("Retrofit del motor de renderizado real"),
planeado como su propia unidad de trabajo con exploración dedicada — como recomendaba
el HANDOFF. **Nada de esto está implementado todavía**; es el mapa para hacerlo.

> Regla que se mantiene: el motor (`TiledMapRenderer` / BFS / `Camera` / animación de
> sprites) hoy funciona en producción. El retrofit lo toca en su núcleo — hacerlo por
> partes, cada una verificable, y detrás de un flag hasta que el modo iso esté completo.

---

## 0 · Qué se verificó del motor actual (esta sesión, con file:line)

| Hecho | Dónde | Implicancia para el retrofit |
|---|---|---|
| `tileToPixel` es ortogonal puro (`x=tx*ts, y=ty*ts`) | [TiledMapRenderer.ts:91](../../src/renderer/src/scene/office/TiledMapRenderer.ts) | Punto central a migrar a proyección iso. |
| La conversión tile→pixel con anclaje de pies (`+ts/2` en x, `+ts` en y) está **triplicada** a mano, no duplicada | [Character.ts:140-142](../../src/renderer/src/scene/office/Character.ts) (spawn), [:337-339](../../src/renderer/src/scene/office/Character.ts) (teleport/sit), [:795-796](../../src/renderer/src/scene/office/Character.ts) (`updateWalk`) | Refactor previo: un solo helper `tileToFoot(tx,ty)`. Ver §2. |
| El orden de dibujado es una **pila fija** de 4 contenedores (`floor < walls < furniture-below < furniture-above`) y luego `characterContainer` **encima de todo** | [TiledMapRenderer.ts:50](../../src/renderer/src/scene/office/TiledMapRenderer.ts), [:188-256](../../src/renderer/src/scene/office/TiledMapRenderer.ts) | Un personaje **nunca** puede quedar detrás de una pared/mueble. Éste es el cambio de fondo. Ver §3. |
| Los personajes **sí** se ordenan entre sí: `characterContainer.sortableChildren=true` y `sprite.container.zIndex = this.py` por frame | [TiledMapRenderer.ts:74](../../src/renderer/src/scene/office/TiledMapRenderer.ts), [Character.ts:563](../../src/renderer/src/scene/office/Character.ts) | El mecanismo de z-sort ya existe; hay que **extenderlo a los tiles**, no inventarlo. |
| **El BFS de pathfinding opera solo sobre coordenadas lógicas de tile** (grilla de walkability), sin ninguna noción de píxeles/proyección | [pathfinding.ts:22](../../src/renderer/src/scene/office/pathfinding.ts) | **VERIFICADO** (el HANDOFF pedía no asumirlo): el pathfinding **sobrevive el retrofit sin cambios**. La proyección solo cambia el dibujo, no la grilla lógica. |
| `Camera` es pan/zoom puro (scale+translate), agnóstico de proyección | [Camera.ts](../../src/renderer/src/scene/office/Camera.ts) | No se toca (confirma HANDOFF decisión). |
| `SPEED = 48 px/s` tuneado a `tileSize=16` ortogonal | [Character.ts:32](../../src/renderer/src/scene/office/Character.ts) | La velocidad se mide en el mismo espacio px/py que `tileToPixel` produce; al volverse iso, un paso de tile diagonal mapea a otra distancia de pantalla → recalibrar la constante (cosmético). |
| `office.tmj`: 34×22, tiles 16×16; capas `floor/walls/furniture-below/furniture-above/collision/spawn-points/zones`; tilesets incluyen LimeZu (no-comercial) | `src/renderer/src/assets/maps/office.tmj` | Migrar el mapa es la pieza más grande y se cruza con la licencia de LimeZu (ver §4 y decisión abierta). |

---

## 1 · Decisión de fondo: cómo hacer el depth-sort

El prototipo validó **painter's algorithm por `tx+ty`** (mezclando piso, paredes,
muebles y personajes en UN contenedor ordenado). Pixi ya nos da `sortableChildren` +
`zIndex`, así que **no hace falta ordenar a mano** — hace falta darle a cada cosa un
`zIndex` de profundidad coherente y meter todo en un mismo contenedor sortable.

**Estrategia recomendada:** un único `worldContainer` con `sortableChildren=true`.
- Cada tile de piso/pared/mueble entra como sprite con `zIndex = depth(tx,ty)`.
- Cada personaje sigue seteando su `zIndex` por frame, pero con la **misma fórmula de
  profundidad** que los tiles (hoy usa `this.py` crudo — hay que unificar).
- `depth(tx,ty)` = `(tx+ty)` con desempates: piso `-0.1`, muebles/paredes en su tile,
  personaje `+0.05` (igual que el prototipo, [combined-scene-pixelart.mjs](combined-scene-pixelart.mjs) líneas del `drawables.push`).

Esto reemplaza la pila fija de `TILE_LAYERS`. **La capa lógica (`floor/walls/...`) del
`.tmj` deja de mapear 1:1 a contenedores de Pixi** — pasa a ser solo metadata de qué
sprite es y a qué altura se dibuja.

---

## 2 · Paso preparatorio (bajo riesgo, hacer primero, sin cambiar nada visual)

Refactor de la conversión tile→pixel para que haya **una sola fuente**:

1. En `TiledMapRenderer`, agregar `tileToFoot(tx,ty): Point` que devuelva el punto de
   apoyo del personaje (hoy: `{x: tx*ts + ts/2, y: ty*ts + ts}`). Dejar `tileToPixel`
   como está (esquina del tile, lo usan los sprites de tile).
2. Rutear los **tres** call-sites de Character.ts (140-142, 337-339, 795-796) por
   `tileToFoot`. Resultado idéntico en ortogonal → es un refactor puro, testeable con
   la app actual antes de tocar la proyección.

Con esto, migrar a iso pasa a ser: cambiar la implementación de `tileToPixel` +
`tileToFoot` a la fórmula iso, en un solo lugar cada una.

---

## 3 · El retrofit en sí, en orden de riesgo creciente (todo detrás de un flag)

**Flag:** `office.projection: 'ortho' | 'iso'` (settings o constante de build). Mientras
esté en `'ortho'`, el código nuevo no cambia nada. Permite mergear incremental.

1. **Proyección** — implementar la fórmula iso en `tileToPixel`/`tileToFoot`:
   `x = originX + (tx-ty)*TILE_W/2`, `y = originY + (tx+ty)*TILE_H/2`
   (validada en [room-and-depth-sort.html](room-and-depth-sort.html) y los `.mjs`).
   Con la pila fija todavía en pie, esto ya dibuja tiles en rombo pero con orden malo —
   sirve para verificar la proyección aislada.

2. **Contenedor unificado + depth-sort** (§1) — reemplazar el loop de `buildTileLayers`
   ([TiledMapRenderer.ts:188](../../src/renderer/src/scene/office/TiledMapRenderer.ts))
   por un solo `worldContainer` sortable; cada tile con su `zIndex=depth`. Unificar la
   fórmula de `zIndex` del personaje ([Character.ts:563](../../src/renderer/src/scene/office/Character.ts))
   con la de los tiles. **Éste es el cambio central** y el que hay que probar más:
   personaje detrás/delante de pared, muebles altos, dos personajes cruzándose.

3. **Arte del mapa iso** — hoy `office.tmj` es cenital 34×22 con tiles LimeZu. Opciones:
   - (a) Generar un `.tmj` iso nuevo con tiles propios (los del prototipo de salas), o
   - (b) mantener el `.tmj` como **grilla lógica** (colisión/zonas/spawns) y dibujar el
     arte iso proceduralmente (como hacen los scripts del prototipo) en vez de por tiles.
   Recomendado empezar por (b): desacopla el arte del formato Tiled y evita reautorar
   34×22 tiles a mano. La grilla lógica (colisión, BFS, asientos) queda intacta.

4. **Integrar los sprites de personaje iso** — reemplazar los frames top-down por los
   generados en [lib/char.mjs](lib/char.mjs). Ojo con `direction` (up/down/left/right)
   que hoy se deriva de `dx/dy` de pantalla ([Character.ts:811](../../src/renderer/src/scene/office/Character.ts)):
   en iso conviene mapear las 4 direcciones lógicas de tile, no las de pantalla, o el
   sprite "mira" raro al caminar en diagonal. (El set actual es un solo frame frontal —
   generar los 4 ángulos es trabajo adicional, ver §5.)

5. **Recalibrar cosméticos** — `SPEED`, offsets de `workGlow`/`thoughtBubble`/`deskCup`
   ([Character.ts:568-570](../../src/renderer/src/scene/office/Character.ts), [:418](../../src/renderer/src/scene/office/Character.ts))
   que asumen espacio ortogonal.

6. **Decidir convivencia** — ¿el modo iso reemplaza al cenital o convive tras el flag?
   (Ver decisiones abiertas.)

---

## 4 · Lo que el retrofit NO cambia (confirmado)

- **Pathfinding / BFS** ([pathfinding.ts](../../src/renderer/src/scene/office/pathfinding.ts)) — grilla lógica pura.
- **Colisión, spawn-points, zonas** — se parsean en coordenadas de tile ([TiledMapRenderer.ts:132-177](../../src/renderer/src/scene/office/TiledMapRenderer.ts)); la proyección no las toca.
- **Lógica de asientos/departamentos** — `claimSeat`/`seatZones` operan sobre tiles.
- **`Camera`** — pan/zoom agnóstico.
- **El puente de datos de Hermes** — nada que ver con el render.

---

## 5 · Explícitamente fuera de este plan (trabajo adicional a estimar aparte)

- **Sprites de personaje en 4 direcciones + frames de caminata.** Hoy el set iso es un
  frame frontal por personaje. Un piso vivo necesita al menos front/back (y ojalá
  left/right) + 2 frames de paso. Es multiplicar el generador de [lib/char.mjs](lib/char.mjs)
  por ángulos — factible con la misma técnica, pero es su propio bloque.
- **Tileset de entorno comercializable.** Si se va a iso propio, se resuelve de paso la
  restricción no-comercial de LimeZu (decisión abierta #3 del HANDOFF) — pero hay que
  diseñar el layout real de cada depto (escritorios, decoración), no solo el placeholder
  del prototipo.
- **Sombras/oclusión finas** (personaje parcialmente detrás de una pared alta) — el
  depth-sort por tile las resuelve a nivel tile; si se quiere recorte sub-tile, es más.

---

## 6 · Orden sugerido para la próxima sesión

1. §2 (refactor `tileToFoot`) — mergeable solo, sin cambio visual. Bajo riesgo.
2. §3.1 + §3.2 detrás del flag `iso`, con una escena de prueba mínima (2 personajes +
   1 pared) para validar el depth-sort en la app real antes de migrar el mapa entero.
3. §3.3(b) — arte iso procedural sobre la grilla lógica existente.
4. Recién entonces §3.4/§3.5 y la decisión de convivencia.

Cada uno es verificable en aislamiento; ninguno obliga a los siguientes hasta que el
anterior esté sólido.
