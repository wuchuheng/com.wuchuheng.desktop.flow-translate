// Shared update state type - single source of truth
// Compatible with electron-updater's UpdateInfo

export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

export interface UpdateFileInfo {
  url: string;
  size?: number;
  sha512?: string;
  blockMapSize?: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  files?: UpdateFileInfo[];
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
}

/**
 * Converts release notes to string format.
 */
export function formatReleaseNotes(
  notes: string | Array<{ version: string; note: string }> | undefined
): string {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  return notes.map((n) => n.note).join('\n');
}

/**
 * Formats bytes to human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return 'Unknown size';
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}