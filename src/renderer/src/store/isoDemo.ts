/**
 * Modo demo de la oficina isométrica — da VIDA al piso sin depender de la hive.
 *
 * Con la hive de Hermes deslogueada, `useHermesPoll` marca a los 17 agentes de
 * departamento como `idle`, así que TODOS se quedan sentados en la Sala de
 * Espera y los departamentos se ven vacíos. Este loop es un showcase dev-only:
 * seedea esos mismos agentes (idéntico shape que useHermesPoll — sintéticos,
 * sin `ptyId`) y cicla sus estados entre `working` e `idle`, de modo que
 * caminan a su departamento cuando se activan y vuelven a la espera al
 * terminar. Toda la lógica espera→activación→caminata ya vive en
 * OfficeFloor.tsx (`applyState`, rama iso); acá SOLO disparamos los estados.
 *
 * REEMPLAZA al poll real mientras está activo (App.tsx desactiva useHermesPoll
 * cuando este demo corre) para que el poll de 5s no le pise los estados.
 * Se activa solo con `VITE_CTH_ISO_DEMO=1` en dev — nunca en producción.
 */

import { useStore, type Agent } from './store';
import { HERMES_ROSTER, DEPARTMENT_ACCENT } from '@/data/hermesRoster';

const TICK_MS = 3500;

// Probabilidades por tick: activar un agente en espera vs. mandar a descansar a
// uno que trabaja. El desbalance (activar > desactivar) mantiene ~60% de los
// deptos poblados en régimen, con caminatas constantes en ambos sentidos.
const P_ACTIVATE = 0.28;
const P_DEACTIVATE = 0.2;

// Frases variadas para el bocadillo de "trabajando" (applyState lee agent.action
// vía liveActivity), así no todos muestran el mismo texto.
const DEMO_ACTIONS = [
  'revisando el brief',
  'escribiendo código',
  'ajustando el diseño',
  'corriendo pruebas',
  'analizando números',
  'redactando el informe',
  'auditando dependencias',
  'sincronizando con el equipo'
];

function pickAction(): string {
  return DEMO_ACTIONS[Math.floor(Math.random() * DEMO_ACTIONS.length)];
}

/** Seedea los agentes de departamento del roster (una sola vez). Mismo shape
 *  que useHermesPoll: sintéticos, sin ptyId, con `department` para que se
 *  sienten en su sala. Los asientos UI-only sin bot (sin hermesProfile) se
 *  omiten, igual que el poll real. */
function seedDeptAgents(): void {
  const { agents, addAgent } = useStore.getState();
  const existing = new Set(agents.map((a) => a.id));
  for (const entry of HERMES_ROSTER) {
    if (!entry.hermesProfile) continue;
    if (existing.has(entry.id)) continue;
    addAgent({
      id: entry.id,
      name: `${entry.name} (${entry.department})`,
      character: entry.character,
      accent: DEPARTMENT_ACCENT[entry.department],
      description: entry.role,
      project: entry.department,
      department: entry.department,
      tmuxTarget: '',
      cwd: '',
      status: 'idle',
      action: 'en espera',
      progress: 0,
      currentStation: 'desk',
      recentTextTs: Date.now()
    } as Agent);
  }
}

/** Los agentes que este demo maneja: los sintéticos de departamento del roster
 *  (id `hermes-*`, sin ptyId). Nunca toca agentes con PTY real. */
function demoAgents(): Agent[] {
  return useStore
    .getState()
    .agents.filter((a) => !a.ptyId && a.id.startsWith('hermes-') && !!a.department);
}

let interval: number | null = null;

export function startIsoDemoLoop(): void {
  if (interval !== null) return;
  seedDeptAgents();
  interval = window.setInterval(() => {
    const { updateAgent } = useStore.getState();
    for (const a of demoAgents()) {
      if (a.status === 'working' || a.status === 'thinking') {
        if (Math.random() < P_DEACTIVATE) {
          updateAgent(a.id, { status: 'idle', action: 'en espera', progress: 0, carrying: undefined });
        }
      } else if (a.status === 'idle') {
        if (Math.random() < P_ACTIVATE) {
          updateAgent(a.id, {
            status: 'working',
            action: pickAction(),
            progress: 1,
            recentTextTs: Date.now()
          });
        }
      }
    }
  }, TICK_MS) as unknown as number;
}

export function stopIsoDemoLoop(): void {
  if (interval !== null) {
    window.clearInterval(interval);
    interval = null;
  }
}
