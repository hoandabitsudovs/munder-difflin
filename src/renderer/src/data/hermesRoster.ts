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

// Cycled across the roster — 'michael' is reserved for munder-difflin's own
// GOD agent (Michael), never assigned to a Hermes-driven synthetic agent.
const CAST: OfficeCharacterName[] = [
  'jim', 'pam', 'dwight', 'kevin', 'angela', 'oscar', 'stanley',
  'phyllis', 'andy', 'kelly', 'ryan', 'toby', 'creed', 'meredith'
];

const ROSTER_SOURCE: Array<Omit<HermesRosterEntry, 'character'>> = [
  { id: 'hermes-recepcionista', name: 'Recepcionista', role: 'Recepción', department: 'Dirección' },
  { id: 'hermes-orquestador', name: 'Orquestador', role: 'CEO', department: 'Dirección', hermesProfile: 'orquestador' },

  { id: 'hermes-arquitecto', name: 'Arquitecto', role: 'Arquitectura de software', department: 'Desarrollo', hermesProfile: 'arquitecto' },
  { id: 'hermes-implementador', name: 'Implementador', role: 'Ingeniería', department: 'Desarrollo', hermesProfile: 'implementador' },
  { id: 'hermes-revisor-desarrollo', name: 'Revisor Desarrollo', role: 'QA / testing', department: 'Desarrollo', hermesProfile: 'revisor-desarrollo' },

  { id: 'hermes-director-de-arte', name: 'Director de Arte', role: 'Dirección creativa', department: 'Creativo', hermesProfile: 'director-de-arte' },
  { id: 'hermes-productor', name: 'Productor', role: 'Imagen y vídeo', department: 'Creativo', hermesProfile: 'productor' },
  { id: 'hermes-revisor-creativo', name: 'Revisor Creativo', role: 'Revisión creativa', department: 'Creativo', hermesProfile: 'revisor-creativo' },

  { id: 'hermes-estratega', name: 'Estratega', role: 'Estrategia de crecimiento', department: 'Marketing', hermesProfile: 'estratega' },
  { id: 'hermes-seo', name: 'SEO', role: 'SEO técnico', department: 'Marketing', hermesProfile: 'seo' },
  { id: 'hermes-revisor-marketing', name: 'Revisor Marketing', role: 'Revisión de marketing', department: 'Marketing', hermesProfile: 'revisor-marketing' },

  { id: 'hermes-analista-financiero', name: 'Analista Financiero', role: 'Presupuestos y costos', department: 'Finanzas', hermesProfile: 'analista-financiero' },
  { id: 'hermes-contralor', name: 'Contralor', role: 'Auditoría financiera', department: 'Finanzas', hermesProfile: 'contralor' },

  { id: 'hermes-redactor', name: 'Redactor', role: 'Redacción', department: 'Redacción', hermesProfile: 'redactor' },
  { id: 'hermes-editor', name: 'Editor', role: 'Edición y tono', department: 'Redacción', hermesProfile: 'editor' },
  { id: 'hermes-revisor-redaccion', name: 'Revisor Redacción', role: 'Revisión de estilo', department: 'Redacción', hermesProfile: 'revisor-redaccion' },

  { id: 'hermes-auditor-de-seguridad', name: 'Auditor de Seguridad', role: 'Ciberseguridad', department: 'Ciberseguridad', hermesProfile: 'auditor-de-seguridad' }
];

export const HERMES_ROSTER: HermesRosterEntry[] = ROSTER_SOURCE.map((entry, i) => ({
  ...entry,
  character: CAST[i % CAST.length]
}));
