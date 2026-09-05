/**
 * The 17-agent / 7-department roster of Juan's real Hermes bots (~/.hermes/profiles/),
 * ported from AgentOS's nucleus seed data (server/src/nucleus/seed.ts,
 * ~/.agent-os/agent-os.db). Static for now — no local persistence yet, see
 * the migration plan's "explicitly out of scope" section.
 *
 * `hermesProfile` is the exact Hermes CLI profile name (`hermes -p <name>`)
 * used to cross-reference kanban `assignee` against this roster. Recepcionista
 * has no backing Hermes profile (AgentOS models her as UI-only) — she is
 * never marked as working.
 */
import type { AccentColorName } from '@/design/tokens';
import type { OfficeCharacterName } from '@/scene/office/cast';

export type Department =
  | 'Dirección' | 'Desarrollo' | 'Creativo' | 'Marketing' | 'Finanzas' | 'Redacción' | 'Ciberseguridad';

export const DEPARTMENT_ACCENT: Record<Department, AccentColorName> = {
  'Dirección': 'coral',
  'Desarrollo': 'sky',
  'Creativo': 'lilac',
  'Marketing': 'peach',
  'Finanzas': 'mint',
  'Redacción': 'lemon',
  'Ciberseguridad': 'coral'
};

export interface HermesRosterEntry {
  id: string;
  name: string;
  role: string;
  department: Department;
  /** Hermes CLI profile name, or undefined for UI-only seats with no bot behind them. */
  hermesProfile?: string;
  character: OfficeCharacterName;
}

// Each Hermes bot gets its own IMAJU character (cast.ts) — 20 available,
// 17 needed, no repeats. 'michael' and the rest of the original Office cast
// stay reserved for munder-difflin's own GOD agent / manually-hired agents.
export const ROSTER: HermesRosterEntry[] = [
  { id: 'hermes-recepcionista', name: 'Recepcionista', role: 'Recepción', department: 'Dirección', character: 'paula' },
  { id: 'hermes-orquestador', name: 'Orquestador', role: 'CEO', department: 'Dirección', hermesProfile: 'orquestador', character: 'javier' },

  { id: 'hermes-arquitecto', name: 'Arquitecto', role: 'Arquitectura de software', department: 'Desarrollo', hermesProfile: 'arquitecto', character: 'mateo' },
  { id: 'hermes-implementador', name: 'Implementador', role: 'Ingeniería', department: 'Desarrollo', hermesProfile: 'implementador', character: 'diego' },
  { id: 'hermes-revisor-desarrollo', name: 'Revisor Desarrollo', role: 'QA / testing', department: 'Desarrollo', hermesProfile: 'revisor-desarrollo', character: 'andres' },

  { id: 'hermes-director-de-arte', name: 'Director de Arte', role: 'Dirección creativa', department: 'Creativo', hermesProfile: 'director-de-arte', character: 'valentina' },
  { id: 'hermes-productor', name: 'Productor', role: 'Imagen y vídeo', department: 'Creativo', hermesProfile: 'productor', character: 'isabella' },
  { id: 'hermes-revisor-creativo', name: 'Revisor Creativo', role: 'Revisión creativa', department: 'Creativo', hermesProfile: 'revisor-creativo', character: 'gabriela' },

  { id: 'hermes-estratega', name: 'Estratega', role: 'Estrategia de crecimiento', department: 'Marketing', hermesProfile: 'estratega', character: 'sofia' },
  { id: 'hermes-seo', name: 'SEO', role: 'SEO técnico', department: 'Marketing', hermesProfile: 'seo', character: 'camila' },
  { id: 'hermes-revisor-marketing', name: 'Revisor Marketing', role: 'Revisión de marketing', department: 'Marketing', hermesProfile: 'revisor-marketing', character: 'rafael' },

  { id: 'hermes-analista-financiero', name: 'Analista Financiero', role: 'Presupuestos y costos', department: 'Finanzas', hermesProfile: 'analista-financiero', character: 'carlos' },
  { id: 'hermes-contralor', name: 'Contralor', role: 'Auditoría financiera', department: 'Finanzas', hermesProfile: 'contralor', character: 'daniela' },

  { id: 'hermes-redactor', name: 'Redactor', role: 'Redacción', department: 'Redacción', hermesProfile: 'redactor', character: 'lucas' },
  { id: 'hermes-editor', name: 'Editor', role: 'Edición y tono', department: 'Redacción', hermesProfile: 'editor', character: 'mariana' },
  { id: 'hermes-revisor-redaccion', name: 'Revisor Redacción', role: 'Revisión de estilo', department: 'Redacción', hermesProfile: 'revisor-redaccion', character: 'tomas' },

  { id: 'hermes-auditor-de-seguridad', name: 'Auditor de Seguridad', role: 'Ciberseguridad', department: 'Ciberseguridad', hermesProfile: 'auditor-de-seguridad', character: 'elena' }
];

export const HERMES_ROSTER: HermesRosterEntry[] = ROSTER;
