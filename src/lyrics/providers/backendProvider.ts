import type { LyricLine } from '@/schemas/track'
import { fetchTrackLyrics } from '@/api/lyrics'

/**
 * StreamX Backend provider — Queries the configured StreamX backend server
 * (/tracks/{id}/lyrics) which has access to Musixmatch, backend KuGou, and LRCLIB.
 */
export async function fetchBackendLyrics(
  trackId: string,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  if (!trackId || !trackId.trim()) return null

  try {
    const res = await fetchTrackLyrics(trackId, signal)
    if (res && res.lines && res.lines.length > 0) {
      return res.lines
    }
  } catch {
    // Backend fetch failed or unauthorized
  }

  return null
}

