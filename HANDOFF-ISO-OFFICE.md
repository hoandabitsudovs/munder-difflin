# Traspaso — Oficina isométrica (munder-difflin)

**Fecha:** 9 de septiembre de 2026
**Para:** una nueva sesión de Claude Code que continúa este trabajo sin memoria de la conversación.
**Leé esto entero antes de tocar nada.** Complementa a `HANDOFF.md` (el traspaso original del proyecto). Este documento cubre SOLO el trabajo de la **oficina isométrica** hecho después de aquél.

---

## 0 · Estado exacto (verificado 9 sept)

- Rama **`main`** en `~/Dashboard/munder-difflin`, árbol limpio, typecheck 0 errores.
- Todo pusheado a **`origin`** = tu fork `hoandabitsudovs/munder-difflin` (`main` + rama `iso-art-and-retrofit-plan`). `upstream` = `chaitanyagiri/munder-difflin` (no tocado).
- Último commit relevante: `2cb6504a` (iluminación ambiental). ~26 commits de esta línea de trabajo sobre `f4c6bd74`.

---

## 1 · Qué se construyó

La oficina de la app ahora se renderiza **isométrica** (antes era cenital/top-down). Es una **planta de oficina cerrada** (edificio con pared perimetral) de **salas de departamento alrededor de una Sala de Espera central**, conectadas por pasillos. Los agentes de Hermes **esperan sentados en sillas** en el centro y **caminan a su departamento cuando se activan**.

**La oficina iso es la vista por defecto y única** (`isoMode` es una const `true` en `OfficeFloor.tsx`; no hay toggle). El código cenital ortogonal sigue existiendo pero no se usa en la oficina.

### Cómo funciona / archivos clave (todos en `src/renderer/src/scene/office/`)

- **`projection.ts`** (nuevo) — geometría tile↔pantalla aislada: `Projection` con variantes `ortho` (idéntica a la de antes) e `iso` (rombos 2:1, origen configurable), y `depthKey` (clave única de profundidad = baseline-Y, compartida por tiles y personajes → oclusión correcta con un solo contenedor sortable).
- **`isoRoomsScene.ts`** (nuevo) — **EL corazón del layout iso.** Genera:
  - **Layout de salas de tamaño variable** según nº de agentes por depto (`DEPT_N`): 3 agentes → sala grande, 2 → media, 1 → chica; **Sala de Espera** central grande; **Lounge**. Dos filas de deptos alrededor del centro.
  - **Pasillos** (`CORR=2`) entre salas + **pared perimetral exterior** (encierra todo = edificio).
  - **Paredes finas de oficina clara** con espesor 3D (tapa superior) + zócalo; las 2 traseras altas + 2 delanteras bajas (murito), estilo caja abierta; **postes de esquina** que garantizan que las 4 esquinas cierren.
  - **Puertas** (aberturas en las paredes hacia los pasillos).
  - **Colisión**: `isoWalkable(x,y)` = corredores + interiores + puertas, MENOS paredes y muebles. La grilla lógica es la física.
  - **Asientos por departamento** (`seatsByDept`), **spots de espera** en grilla (`waitingSpots`) con una **silla** por spot, y `godSeat`.
  - **Muebles**: escritorios (monitor+teclado), estantería, archivador, dispenser de agua, plantas; en el Lounge: pool, sofá, arcade, vending. Decoración de pared (cuadros, reloj). Etiquetas de sala.
  - **Pisos con textura** (vetas/baldosa) + **iluminación ambiental** (luz cálida en centro de salas vs pasillos fríos, + sombra/AO contra paredes).
  - Devuelve `{ floor, depthItems, labels, seatsByDept, godSeat, worldW, worldH }`. `depthItems` (paredes+muebles) se agregan a la MISMA capa sortable que los agentes → **oclusión por profundidad**.
  - Grilla propia grande vía **`isoSyntheticMap()`** (para no toparse con los límites 34×22 de `office.tmj`).
- **`OfficeFloor.tsx`** — wiring iso (buscar `isoRooms` / `isoMode`):
  - En iso construye `TiledMapRenderer` con un **mapa sintético** + `isoRoomsProjection()` + `drawOwnIsoFloor=false`; agrega `isoRooms.floor` (atrás), los `depthItems` a la capa de personajes, y `labels` arriba; `mapRenderer.setWalkable(isoWalkable)`.
  - **Asientos**: sobrescribe `seatTiles/seatZones` con los de `isoRooms` (seat 0 = god).
  - **Spawn**: cada agente aparece **sentado en su silla de espera** (`home = waitingSpot`); `rt.departmentSeat` = su escritorio.
  - **`applyState` (branch iso)**: activo (working/thinking/…) → `setHome(departmentSeat)` + `sitAtDesk` (camina al depto por pathfinding y se sienta); inactivo → `setHome(waitingSpot)` + `sitAtDesk` (silla de espera). **Solo muestra bocadillo si trabaja de verdad** (mató la muralla de "reconnecting…").
  - Desactiva café/cafetería/errands en iso; **oculta decoraciones ortogonales** (calendario, tablero de tareas, cartel "?", reloj, notas) que flotaban.
  - **Cámara libre**: arrastrar para panear, rueda para zoom (`Camera.panByScreen/zoomByFactor`); `setFitBoost(1.1)` muestra el edificio completo.
- **`Camera.ts`** — agregados `panByScreen`, `zoomByFactor`, `setFitBoost`.
- **`TiledMapRenderer.ts`** — soporta `Projection`, flag `drawOwnIsoFloor`, `setWalkable(fn)`, `depthKey`, `tileToFoot`.
- **`prototypes/isometric/`** — mocks de diseño offline (`office-iso-rich.mjs`, etc.) + `RETROFIT_PLAN.md`. Generan PNGs con la misma técnica; útiles para iterar arte sin la app.

### Comportamiento espera→activación (verificado en vivo)
Un agente se activa creando una tarea running en Hermes:
```bash
hermes kanban create "prueba" --assignee implementador --initial-status running
hermes kanban claim <id>     # queda status=running → el poll lo marca activo
# ... el agente (diego) camina de la espera a DESARROLLO y se sienta ...
hermes kanban reclaim <id> --reason prueba && hermes kanban archive <id>
```
La hive está **"Login expired / Not logged in"**, así que en condiciones normales **todos los agentes están idle → todos en la Sala de Espera** y los departamentos se ven vacíos. Poblar los deptos requiere la hive logueada/activa.

---

## 2 · Decisiones / hechos para NO relitigar

1. **La referencia estética es Agent-Pixels** (github.com/gcampton/Agent-Pixels) — **SIN licencia declarada: no se copia ni un pixel.** Todo el arte es original.
2. **El arte procedural (formas por código) NO va a igualar la fidelidad de la referencia.** Se pulió al máximo del enfoque (paredes, esquinas, pisos, luz, muebles). El salto real a ese look es **arte pixel con licencia o a medida** enchufado a este motor (que ya está sólido). No seguir puliendo procedural esperando que "se vea como la foto".
3. **Las 2 paredes traseras (+ murito delantero) son diseño iso correcto** (la propia referencia lo usa). No dibujar 4 paredes altas: taparían el interior.
4. **`office.tmj` no se migró**; iso usa una grilla sintética propia. El cenital ortogonal queda como código muerto en la oficina.
5. **Node del sistema (v26) rompe el build — usar SIEMPRE nvm 24**: `export PATH="/Users/juan/.nvm/versions/node/v24.18.0/bin:$PATH"`.

---

## 3 · Cómo correr y verificar la app (importante — costó encontrarlo)

- **Correr la app bajo el harness**: `npm run dev` (electron-vite) se cae sin TTY. Lanzarlo desdoblado con PTY:
  ```python
  python3 -c "import os,subprocess;\
  pid=os.fork();\
  (os.setsid(),subprocess.Popen(['/usr/bin/script','-q','/dev/null','/bin/zsh','-lc','cd ~/Dashboard/munder-difflin && exec npm run dev']),os._exit(0)) if pid==0 else None"
  ```
  (con el PATH de nvm 24). Deja Vite en `localhost:5173` + Electron vivos.
- **El renderer NO corre en browser puro** (depende del preload de Electron: `window.cth.*`). Verificar solo dentro de Electron.
- **Ver/screenshot**: acceso de pantalla concedido a `com.github.Electron` (tier full). Se captura con `app_screenshot` (bundle `com.github.Electron`). La ventana suele estar en un Space de pantalla completa → **no se puede clickear** (bring-to-space falla). Por eso:
- **Loop de verificación sin clicks**: (1) agregar temporalmente `if (import.meta.env.DEV) return true;` como primera línea del inicializador de `useState(hiveOpened)` en `App.tsx` (saltea el selector de hive), (2) **View → Force Reload** (vía `app_menu`), (3) esperar ~12s, (4) `app_screenshot`. **Revertir ese `if` antes de comitear.**

---

## 4 · EMPEZÁ POR ACÁ (lo que sigue, concreto)

La estructura y composición del iso office están **sólidas y cerradas**. Lo que queda es **fidelidad de arte + vida**. Hay una decisión del usuario y hay trabajo autónomo. Arrancá así:

### Paso 1 (DECISIÓN del usuario — planteásela primero, no la adivines)
**¿Cómo cerramos la brecha con la referencia (Agent-Pixels)?** El usuario quiso repetidamente ese look; con procedural NO se llega. Presentale opciones concretas y que elija:
- **(A) Pack de arte iso con licencia comercial.** Investigá con WebSearch 2–3 packs de "isometric office / interior" pixel-art en itch.io u otros, con **licencia usable comercialmente** (LimeZu del entorno es NO comercial — evitarlo o comprar su licencia paga). Pasale: nombre, precio, licencia, captura/URL. Una vez elegido, integralo al motor (`isoRoomsScene.ts` dibuja todo por código; se reemplazan los `drawPiece`/paredes/piso por sprites del pack, o se migra a tiles). **Este es el único camino real al look de la referencia.**
- **(B) Arte pixel a medida** (un artista, o vos MUY lento a mano): máxima fidelidad y original, pero es semanas de trabajo de arte.
- **(C) Quedarse en procedural** y seguir puliendo la estética propia (no igualará la foto).

### Paso 2 (AUTÓNOMO — se puede hacer ya, sin decisión de arte)
1. **Modo demo / vida en la oficina**: hoy, con la hive sin loguear, TODOS esperan y los deptos se ven vacíos. Agregá un modo dev que cicle algunos agentes a "working" (via store) para que **caminen a sus deptos y los pueblen** — así la oficina se ve viva sin depender de la hive. (La lógica espera→activación→camina ya está; solo falta disparar estados de prueba.)
2. **Identidad temática por sala**: hoy los deptos son casi idénticos. Diferenciá: Desarrollo con más monitores, Dirección/Reuniones con mesa grande + sillas, Finanzas con pizarra/archivadores, etc. (editar `isoRoomsScene.ts` → bloque de muebles por `RoomName`).
3. **Colisión entre agentes** (hoy pueden solaparse al caminar) + pulir el reparto.
4. **Iluminación**: hoy es un wash cálido con diamantes low-alpha; se puede mejorar (más contraste interior/exterior, sombras de muebles proyectadas).

### Recomendación del diseñador
Planteá el **Paso 1** al usuario de entrada (es su decisión y define todo). Si quiere avanzar mientras decide, hacé el **Paso 2.1 (modo demo)** — es lo que más "da vida" y no depende de nada externo.

### No relitigar
- No seguir puliendo procedural esperando que "se vea como la foto" (no va a pasar — ver §2).
- No dibujar las 4 paredes altas (taparían el interior — el diseño de 2 traseras altas + murito es correcto).
- El cenital ortogonal queda como código muerto en la oficina; decidir más adelante si se borra.

---

## 5 · Referencias rápidas
- Roster de agentes/departamentos: `src/renderer/src/data/hermesRoster.ts`.
- Recetas de personajes (top-down): `src/renderer/src/scene/office/portraitArt.ts`.
- Memoria de Claude sobre cómo correr en vivo: `/Users/juan/.claude/projects/-Users-juan-AOS/memory/munder-difflin-run-live.md`.
