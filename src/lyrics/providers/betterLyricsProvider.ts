import type { LyricLine } from '@/schemas/track'
import { parseLrc } from '@/api/lyrics'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist } from '../lyricsQuery'
import { unwrapPayload } from '../payloadExtractor'
import { parseTtml } from '../ttmlParser'

/**
 * BetterLyrics — Apple Music TTML with per-syllable timing from the Boidu backend.
 * Ported from StreamXAndroid / BitChord BetterLyricsProvider.
 */

const BASE = 'https://lyrics-api.boidu.dev/getLyrics'

export async function fetchBetterLyrics(
  title: string,
  artist: string,
  durationMs: number,
  album?: string | null,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)
  const seconds = Math.round(durationMs / 1000)

  const url = new URL(BASE)
  url.searchParams.set('s', cleanT)
  url.searchParams.set('a', cleanA)
  if (seconds > 0) url.searchParams.set('d', seconds.toString())
  if (album && album.trim()) url.searchParams.set('al', album.trim())

  const raw = await safeFetchText(url.toString(), { signal, timeoutMs: 4000 })
  if (!raw) return null

  const payload = unwrapPayload(raw)
  if (!payload) return null

  if (payload.includes('<tt') || payload.toLowerCase().includes('http://www.w3.org/ns/ttml')) {
    const lines = parseTtml(payload)
    return lines.length > 0 ? lines : null
  }

  const lines = parseLrc(payload)
  return lines.length > 0 ? lines : null
}

