# AOS/IMAJU sobre munder-difflin — documento de traspaso

**Fecha:** 5 de septiembre de 2026
**Para:** una nueva sesión de Claude Code que continúa este trabajo sin memoria de la conversación anterior.
**Cómo usar este documento:** leelo entero antes de tocar código. Está escrito para que no haga falta re-explorar ni re-descubrir nada de lo que ya se investigó, decidió o verificó — incluyendo varios callejones sin salida que costó tiempo encontrar.

---

## 0 · Estado del repo (verificado 5 sept, 19:05)

```bash
cd ~/Dashboard/munder-difflin && git status --short
```
Working tree limpio. 5 commits propios encima de un rebase sobre `upstream/main` (ver sección 3). Push hecho a `origin` (el fork). `prototypes/isometric/` tiene 3 archivos **sin trackear** — son el prototipo de motor isométrico, deliberadamente no integrados aún (ver sección 6).

---

## 1 · Qué es esto y de dónde viene

Juan (IMAJU) le pidió a un Orquestador de Hermes que scaffoldeara un proyecto nuevo llamado "AOS" — un sistema operativo de agentes con dashboard visual, voz, y orquestación paralela. El Orquestador creó `/Users/juan/AOS/` con una plantilla genérica (`hermes_tools.delegate_tool`, que no existe como paquete real — nunca funcionó).

**Descubrimiento clave del inicio de esta sesión:** Juan ya tenía, en producción, un framework de agentes real llamado **Hermes** (`~/.hermes/`) con 23 profiles/bots por departamento, un kanban real (`~/.hermes/kanban.db`), gateway de mensajería, y modo voz nativo. Y además ya tenía **AgentOS** (`~/Documents/Proyectos/AgentOS`, fork de `pixel-agents-hq/pixel-agents`) — semanas de trabajo real modelando 7 departamentos/17 agentes en SQLite, con un puente a Hermes ya funcionando.

Primera fase de esta sesión: reescribir `/Users/juan/AOS/` como una "capa fina" sobre Hermes (documentado ahí, no acá — ver `/Users/juan/AOS/CLAUDE.md`). Commit único: `2c84d41` en un repo git separado, sin remote.

**Luego Juan decidió algo más grande:** en vez de seguir con AgentOS, migrar a **`munder-difflin`** (`chaitanyagiri/munder-difflin`, un harness de agentes open-source más maduro — GOD orchestrator, hive de memoria/mailbox, oficina Pixi.js) como "el repositorio principal", portando de AgentOS solo lo que sirve, y con el estilo visual de `Agent-Pixels` (github.com/gcampton/Agent-Pixels) como referencia estética — pero **Agent-Pixels no tiene licencia declarada, así que no se puede copiar ni una línea de su código ni un pixel de su arte**. Todo lo construido acá es original.

**Este documento es sobre el trabajo en `~/Dashboard/munder-difflin`** (fork de Juan: `hoandabitsudovs/munder-difflin`), que es donde vive el proyecto real ahora. `/Users/juan/AOS/` y `~/Documents/Proyectos/AgentOS/` quedan archivados — no se tocan más.

### Dónde vive todo

| Qué | Ruta |
|---|---|
| Proyecto activo | `~/Dashboard/munder-difflin` (fork `hoandabitsudovs/munder-difflin`) |
| Remotes | `origin` = el fork de Juan · `upstream` = `chaitanyagiri/munder-difflin` |
| Hermes (el framework real, no tocado por nosotros) | `~/.hermes/` — kanban en `~/.hermes/kanban.db` |
| AgentOS (archivado, ya no se toca) | `~/Documents/Proyectos/AgentOS` |
| Scaffold original de AOS (archivado, capa fina sobre Hermes) | `/Users/juan/AOS/` |
| Prototipo de motor isométrico (sin integrar, ver sección 6) | `~/Dashboard/munder-difflin/prototypes/isometric/` |
| Este documento | `~/Dashboard/munder-difflin/HANDOFF.md` |

---

## 2 · Decisiones de arquitectura (y por qué — para no relitigarlas)

1. **Hermes manda los datos, munder-difflin solo lee.** Todo el puente (`src/main/hermesKanban.ts`) abre `~/.hermes/kanban.db` con `readonly: true`, re-abierta en cada poll, nunca mantenida abierta — el dueño real es el gateway de Hermes. **Nunca se escribe en `kanban.db`** salvo una tarea de prueba puntual (creada y archivada en el momento, ver sección 4).

2. **Node del sistema por defecto rompe el build — usar siempre nvm 24.** `~/.local/bin/node` (parte del bundle de Hermes) resuelve a Node v26.7.0, que rompe `electron-rebuild` (`yargs` tira `ReferenceError: require is not defined in ES module scope`). **Siempre** anteponer esto a cualquier `npm`/`node` en este repo:
   ```bash
   export PATH="/Users/juan/.nvm/versions/node/v24.18.0/bin:$PATH"
   ```

3. **Los agentes de Hermes son sintéticos, sin PTY, sin hive.** Se agregan al store (`useStore.getState().addAgent(...)`) sin `ptyId` — confirmado que `reconcileWithLivePtys` los preserva ("Keep agents with no PTY (synthetic)..."), y que no requieren registro en `HiveManager` (eso solo pasa en el path de spawn real, main process). Nunca usar el provider `custom` (bare terminal, sin hook bridge) — el camino correcto es el patrón de `mockEvents.ts`: escribir directo al store.

4. **Los personajes YA eran 100% originales antes de que tocáramos nada.** `portraitArt.ts` dibuja tanto los retratos como los sprites de cuerpo completo pixel por pixel en código (`Uint8ClampedArray`) — su propio comentario de cabecera dice "The LimeZu base sheets are no longer used for the cast." La restricción no-comercial de LimeZu solo aplica al tileset del **entorno** (`office.tmj` + sus PNGs), no a los personajes.

5. **No copiar nada de Agent-Pixels.** Sin licencia declarada (verificado con `gh api repos/gcampton/Agent-Pixels`). Se puede tomar la idea estructural (zonas temáticas, cámaras) pero no su código ni sus sprites — ni aunque se pida explícitamente. Munder-difflin en sí es MIT para el código, pero su tileset de entorno hereda la restricción no-comercial de LimeZu (documentado en su propio `LICENSE`/README): **para vender esto hay que reemplazar el tileset de entorno o pagar la licencia comercial de LimeZu.**

6. **El mapa de la oficina (`office.tmj`) es chico — 34×22 tiles — y ya está casi lleno.** 4 salas con paredes ya ocupan la fila superior (Michael/CEO, boardroom, warroom, arquitecto-UX). No hay espacio para 7 salas nuevas con paredes sin expandir el mapa. Antes de tocar nada ahí, **leer la grilla de colisión real** (no asumir espacio libre):
   ```python
   import json
   d = json.load(open('src/renderer/src/assets/maps/office.tmj'))
   coll = next(L for L in d['layers'] if L['name']=='collision')
   # coll['data'] es un array plano W*H; 0 = caminable, no-0 = bloqueado
   ```

7. **`OFFICE_CAST`/`RECIPES` es el picker existente — extenderlo, no reemplazarlo.** `AddAgentModal.tsx` ya itera `OFFICE_CAST` genéricamente (`OFFICE_CAST.map(...)`) — agregar entradas nuevas ahí las hace seleccionables sin tocar ningún código de UI.

8. **`munder-difflin` tiene su PROPIO sistema de tareas (`TasksKanban.tsx`/`HiveTask`), distinto del de Hermes.** No mezclarlos — un botón de borrar/mover en la UI equivocada podría tocar el kanban real de producción de Hermes. Por eso el panel de Hermes es un componente aparte, de solo lectura.

9. **No hay verificación visual mía disponible por defecto.** El usuario negó acceso de pantalla al proceso Electron una vez (`request_access` sobre `com.github.Electron` → `denied`). Para verificar cambios de rendering sin pedirlo de nuevo: **usar el Browser pane** (`mcp__Claude_Browser__navigate` a un `file://` DENTRO de `/Users/juan/AOS` o del proyecto — fuera de ahí renderiza como snapshot estático sin JS vivo) + `computer` screenshot. Así se validó el prototipo isométrico completo sin pedirle nada a Juan.

---

## 3 · Estado exacto del código — commits en orden, qué hace cada uno

Todo en `~/Dashboard/munder-difflin`, rama `main`, pusheado a `origin`.

```
11e48ee3  Add read-only Hermes kanban bridge driving the 17-agent department roster
0b49b0af  Add a 20-character original cast, generated via a parametrized recipe builder
15f1f38f  Add 7 department zones so Hermes agents seat by department, not just color
e9bfeff6  Add a read-only Hermes tasks panel (new Command Center tab)
f4c6bd74  Keep Hermes department agents seated instead of wandering off their zone
```

**`11e48ee3` — el puente de datos.**
- `src/main/hermesKanban.ts` (nuevo) — `pollHermesRunningProfiles()`: `SELECT DISTINCT assignee FROM tasks WHERE status='running'`.
- IPC `hermes:pollRunningProfiles` en `src/main/index.ts` + preload.
- `src/renderer/src/data/hermesRoster.ts` (nuevo) — los 17 agentes reales de Hermes (nombre, rol, departamento, `hermesProfile`, `character`). **`hermesProfile` es el nombre exacto del profile de Hermes** (`hermes -p <name>`), usado para cruzar contra `assignee` del kanban.
- `src/renderer/src/hooks/useHermesPoll.ts` (nuevo) — poll cada 5s, `addAgent`/`updateAgent` del store, sin `ptyId`.
- `mockEvents.ts` — `isMockable()` excluye ids `hermes-*` para que el paseo aleatorio de agentes demo no le pise el estado real a los de Hermes.
- Requirió rebasear sobre 352 commits de `upstream/main` (el clon local estaba viejo) — hubo un conflicto real en `App.tsx` (imports de i18n/RTL agregados upstream), resuelto a mano.
- **Verificado en vivo de verdad**, no solo tipeado: se creó una tarea real (`hermes kanban create ... --assignee implementador --initial-status running`), se confirmó `[hermes-poll] ['implementador']` en el log, y se liberó/archivó la tarea (`hermes kanban reclaim` + `archive`) apenas se confirmó que un worker real la había tomado, para no gastar cómputo de mentira.

**`0b49b0af` — 20 personajes originales ("elenco IMAJU").**
- `portraitArt.ts` — `buildParamRecipe({gender, skin, hairColor, hair, hairargs, cloth, c1, c2, tie, pants, facial, glasses})` construye un `Recipe` completo desde parámetros simples. `IMAJU_RECIPES` (20 entradas) construidas así, spreadeadas en `RECIPES`.
- `cast.ts` — `OfficeCharacterName` extendido con 20 nombres nuevos (sofia, mateo, valentina, diego, camila, lucas, elena, andres, mariana, javier, isabella, carlos, gabriela, rafael, daniela, tomas, paula, nicolas, renata, emilio), agregados a `OFFICE_CAST`.
- `hermesRoster.ts` — cada uno de los 17 bots de Hermes mapeado 1:1 a uno de estos 20 (quedan 3 libres: nicolas, renata, emilio).
- Nota: `renata` tuvo un primer intento con pelo largo plateado que se veía como peluca — se cambió a `styleBun` gris, mejor resultado.

**`15f1f38f` — 7 zonas de departamento.**
- `office.tmj` — 7 objetos nuevos en la capa `zones` (Desarrollo, Marketing, Creativo, Redacción, Finanzas, Ciberseguridad, Dirección), en dos filas (**y14 y x1-24**, **y19 y x1-24**) confirmadas 100% caminables leyendo la capa `collision` cruda — cero superposición con escritorios o paredes existentes.
- `store.ts` — `Agent.department?: string` (opcional, nuevo).
- `useHermesPoll.ts` — setea `department: entry.department` al crear el agente.
- `OfficeFloor.tsx` — `addZoneSeats(zone, tagDepartment)` ahora tagea cada asiento con su zona (`seatZones` array paralelo a `seatTiles`); `claimSeat` prefiere un asiento de la zona del `agent.department` antes de caer al comportamiento de "primer asiento libre" (sin cambios para cualquier agente sin `department`). Carteles de piso (Graphics + Text) por zona, mismo patrón que el calendario de pared ya existente.
- **Importante:** esto NO son salas con paredes — son zonas lógicas invisibles + cartel. El mapa no tiene espacio para paredes nuevas sin expandirlo (ver decisión 6 arriba).

**`e9bfeff6` — panel de Hermes en el Command Center.**
- `hermesKanban.ts` — `listHermesTasks(limit=100)`, `SELECT id,title,assignee,status,priority,created_at FROM tasks WHERE status!='archived' ORDER BY created_at DESC LIMIT ?`.
- IPC `hermes:listTasks` + preload.
- `HermesTasksPanel.tsx` (nuevo) — 4 columnas (Por hacer/En curso/Bloqueado/Hecho), poll 5s, **solo lectura, sin mover/borrar nada** (ver decisión 8).
- `CommandCenterPanel.tsx` — nuevo tab `'hermes'` junto a `'tasks'` (el propio de munder-difflin).
- `i18n/locales/en.json` — clave `commandCenter.tabs.hermes` agregada (la app solo tiene locales en/ar/zh-CN, no hay español — si se quiere UI en español hay que crear `es.json`, no se hizo).

**`f4c6bd74` — fix de un bug real que Juan encontró corriendo la app.**
- Juan reportó: "salen todos los agentes a caminar sin orden". Causa real (no un bug mío): `applyState()` en `OfficeFloor.tsx` tiene el comentario literal *"everyone else wanders when idle"* — cualquier agente no-dios idle se manda a caminar por todo el piso, sin importar zona. Como los agentes de Hermes están idle la mayoría del tiempo, todos deambulaban.
- Fix: en los casos `'idle'` y `'success'` de `applyState`, si `agent.department` está seteado → `c.sitAtDesk(true)` en vez de `c.startWandering()`. Mismo patrón que ya usan los estados `'waiting'`/`'compacting'`.

### Bug reportado sin resolver (probablemente no relacionado con nuestros cambios)

Juan reportó una vez: al abrir la app, el piso se veía negro y la app se cerraba sola a los pocos segundos. **No se pudo reproducir** corriendo `npm run dev` desde esta sesión (2 intentos, 60s+ monitoreados cada uno, sin crash). Hallazgo relevante: la app usa `app.requestSingleInstanceLock()` (`src/main/index.ts` línea ~2162) — si hay dos instancias corriendo, la segunda se cierra sola casi inmediatamente. El síntoma de Juan no calza perfecto con ese timing (mostró contenido por "unos segundos" antes de cerrar), así que **queda sin explicación certera** — si vuelve a pasar, preguntar cómo se lanzó exactamente la app y si había otra instancia abierta.

---

## 4 · Cómo verificar que todo lo de arriba sigue andando

```bash
export PATH="/Users/juan/.nvm/versions/node/v24.18.0/bin:$PATH"
cd ~/Dashboard/munder-difflin
git status --short              # debería estar limpio
npm run typecheck               # typecheck:node && typecheck:web, debe pasar sin errores
npm run dev                     # levanta Electron; mirar la consola por errores de boot
```

Prueba end-to-end del puente (con cuidado, ver decisión 1):
```bash
hermes kanban create "prueba" --assignee implementador --initial-status running
# confirmar en la app que el personaje de "Arquitecto"... no, "Implementador" (mateo) aparece trabajando
hermes kanban reclaim <task_id> --reason "prueba"
hermes kanban archive <task_id>
```

---

## 5 · Preguntas abiertas para Juan (nadie las respondió todavía)

1. **¿La app se sigue cerrando sola?** (ver bug sin resolver arriba) — si pasa de nuevo, capturar cómo se lanzó la app.
2. **Idioma de la UI de munder-difflin**: no hay `es.json`. ¿Vale la pena crear un locale español, o el inglés (fallback actual) está bien por ahora?
3. **Licencia comercial de LimeZu**: si IMAJU va a vender esto, en algún momento hay que decidir si se compra la licencia paga de LimeZu para el tileset de entorno, o se reemplaza por arte propio (el prototipo isométrico de la sección 6 apunta a lo segundo).

---

## 6 · Fase en curso: prototipo del motor isométrico (SIN INTEGRAR TODAVÍA)

Juan pidió que las 7 zonas de departamento se vean isométricas de verdad (paredes con altura, cámara en ángulo) — inspirado en la imagen "hero" de marketing de Agent-Pixels (que sí es isométrica de verdad; su captura de juego real, en cambio, es cenital plana como munder-difflin — dos estilos distintos, confirmado bajando y mirando las imágenes). Y pidió que sea "estilo Pokémon GBA": pixel art de verdad (grilla nativa chica, sin antialiasing, escalado con nearest-neighbor), no formas vectoriales suaves.

**Esto es, con honestidad, la pieza más grande de todo el proyecto — semanas de trabajo para terminarla.** Lo que se hizo esta sesión fue validar la técnica antes de invertir en la app real.

### Investigación del motor de renderizado actual (antes de tocar nada)

- `TiledMapRenderer.tileToPixel(tx,ty)` hoy es ortogonal puro (`x=tx*16, y=ty*16`) — tanto tiles como personajes lo usan (`Character.ts` llama a la misma función), **salvo** `Character.updateWalk()` que duplica la fórmula a mano (línea ~795) — cualquier retrofit tiene que actualizar los dos lugares o refactorizar para que solo haya uno.
- `Camera.ts` es pan/zoom puro (scale + translate), agnóstico de la proyección — no hay que tocarlo para ir isométrico.
- **El problema de verdad:** el orden de dibujado hoy es una pila FIJA de contenedores (floor < walls < furniture-below < charLayer < furniture-above) — NO hay ordenamiento real por profundidad entre capas. Isométrico de verdad necesita piso + paredes + muebles + personajes en un solo contenedor ordenado por pintor's algorithm (por `tx+ty`), o un personaje nunca podría aparecer "detrás" de una pared correctamente.
- Cero código isométrico existe hoy en el repo (`grep -rniE "isometric|dimetric|diamond"` → 0 resultados).

### Qué se validó (prototipos en `prototypes/isometric/`, SIN TRACKEAR EN GIT, no integrados a la app)

Todo construido y verificado visualmente vía el Browser pane (`mcp__Claude_Browser__navigate` a un `file://` dentro de `/Users/juan/AOS`, luego `computer` screenshot — los archivos fuera de esa carpeta renderizan como snapshot estático sin JS).

1. **`room-and-depth-sort.html`** — widget interactivo (viewable standalone en un browser): proyección isométrica `screenX=(tx-ty)*TILE_W/2, screenY=(tx+ty)*TILE_H/2`, un pilar con altura, y un personaje movible con flechas. **Confirmado**: el ordenamiento por `tx+ty` hace que el personaje se oculte detrás del pilar y lo tape por delante, correctamente, en ambos sentidos.

2. **`character-pixelart.mjs`** — genera (vía Node, sin dependencias — un rasterizador de polígonos hecho a mano, ver el propio archivo) 2 personajes de prueba (Mateo, Sofía) en pixel art de verdad: grilla nativa 20×32px, sin antialiasing, escalado nearest-neighbor, proporciones chibi estilo Pokémon GBA (cabeza ~45% de la altura total), sombreado plano de 2 tonos (cara frontal clara / cara lateral oscura — misma gramática que el pilar), contorno automático (mismo algoritmo `outlinePass` que ya usa `portraitArt.ts`, adaptado).
   - **Iteración importante:** el primer intento (formas suaves tipo vector, proporciones de adulto) fue rechazado por Juan explícitamente — no se veía "pixelado" ni "estilo Pokémon". La versión que sí aprobó es la de grilla nativa + proporciones chibi exageradas.

3. **`combined-scene-pixelart.mjs`** — la sala completa (piso + pilar) rehecha con la MISMA técnica de grilla nativa (nada de polígonos suaves), con Mateo parado adentro. Reconfirma el ordenamiento por profundidad con el estilo pixel art definitivo. **Esta es la referencia visual aprobada por Juan** ("mejor").

### Explícitamente fuera de esta fase (lo que falta, en orden sugerido)

1. **Redibujar los 35 personajes completos** en este ángulo isométrico (hoy: 2 de prueba). Cada uno necesita su propia combinación de piel/pelo/ropa/peinado, igual que ya se hizo para el elenco top-down.
2. **Arte isométrico real de piso/pared para las 7 salas** — el prototipo tiene un piso genérico y un pilar de un solo color; hace falta diseñar el layout real de cada departamento (escritorios, decoración) en este estilo.
3. **Retrofit del motor de renderizado real de la app** — esto es lo más grande y riesgoso:
   - Reemplazar la pila fija de 4 contenedores en `TiledMapRenderer.buildTileLayers()` por un ordenamiento unificado por profundidad que incluya personajes.
   - Migrar `tileToPixel` (y arreglar el duplicado en `updateWalk`) a la proyección isométrica.
   - Migrar `office.tmj` completo (hoy es un mapa cenital de 34×22 tiles) a tiles/arte isométrico.
   - Migrar la lógica de asientos/zonas/pathfinding (BFS actual asume grilla ortogonal — probablemente sigue sirviendo igual sobre coordenadas de tile, ya que la proyección solo cambia cómo se dibuja, no la grilla lógica subyacente, pero **verificar esto, no asumirlo**).
4. Recién ahí decidir si esto reemplaza el modo cenital actual o convive como un modo alternativo.

**Recomendación de por dónde seguir:** no arrancar directo por el retrofit del motor (paso 3) — es grande y toca código que ya funciona en producción. Antes, escalar el arte (pasos 1-2) usando los mismos scripts standalone del prototipo (sin tocar la app), y recién con el set completo de arte aprobado, planear el retrofit como su propia sesión de trabajo con exploración dedicada.
