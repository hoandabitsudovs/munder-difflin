/**
 * Media generation shared types (Fase 4 — Creativo). Dependency-free so main,
 * preload and renderer share one `MediaItem` shape without a cross-project import.
 */
export interface MediaItem {
  id: string;
  prompt: string;
  model: string;
  size: string;
  createdAt: number;
  /** file name of the PNG, relative to the media dir. */
  file: string;
}
