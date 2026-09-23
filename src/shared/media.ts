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
  /** file name of the saved media (PNG for images, MP4 for videos), relative to the
   *  media dir. Empty until a video job completes. */
  file: string;
  /** 'image' (default, synchronous) or 'video' (async job — see status). */
  kind?: 'image' | 'video';
  /** Video jobs only: provider job lifecycle. */
  status?: 'queued' | 'in_progress' | 'completed' | 'failed';
  /** Video jobs only: the provider job id to poll. */
  jobId?: string;
  /** Set when status === 'failed'. */
  error?: string;
}
