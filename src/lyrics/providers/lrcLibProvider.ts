import type { LyricLine } from '@/schemas/track'
import { parseLrc } from '@/api/lyrics'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist } from '../lyricsQuery'

/**
 * LRCLIB — Free, key-less community database for line-synced LRC lyrics.
 * Ported from StreamXAndroid / BitChord LrcLibProvider.
 */

const BASE = 'https://lrclib.net/api'

interface LrcLibHit {
  syncedLyrics?: string | null
  plainLyrics?: string | null
  duration?: number | null
}

async function exactMatch(
  title: string,
  artist: string,
  seconds: number,
  signal?: AbortSignal
): Promise<string | null> {
  const url = new URL(`${BASE}/get`)
  url.searchParams.set('track_name', title)
  url.searchParams.set('artist_name', artist)
  if (seconds > 0) {
    url.searchParams.set('duration', seconds.toString())
  }

  const body = await safeFetchText(url.toString(), { signal, timeoutMs: 3500 })
  if (!body) return null

  try {
    const json: LrcLibHit = JSON.parse(body)
    return json.syncedLyrics || json.plainLyrics || null
  } catch {
    return null
  }
}

async function searchFallback(
  title: string,
  artist: string | null,
  seconds: number,
  signal?: AbortSignal
): Promise<string | null> {
  const url = new URL(`${BASE}/search`)
  url.searchParams.set('track_name', title)
  if (artist && artist.trim()) {
    url.searchParams.set('artist_name', artist.trim())
  }

  const body = await safeFetchText(url.toString(), { signal, timeoutMs: 4000 })
  if (!body) return null

  try {
    const hits: LrcLibHit[] = JSON.parse(body)
    if (!Array.isArray(hits) || hits.length === 0) return null

    const valid = hits.filter((h) => Boolean(h.syncedLyrics?.trim()))
    const candidates = valid.length > 0 ? valid : hits

    candidates.sort((a, b) => {
      const distA = seconds > 0 && typeof a.duration === 'number' ? Math.abs(a.duration - seconds) : 0
      const distB = seconds > 0 && typeof b.duration === 'number' ? Math.abs(b.duration - seconds) : 0
      return distA - distB
    })

    const best = candidates[0]
    return best?.syncedLyrics || best?.plainLyrics || null
  } catch {
    return null
  }
}

export async function fetchLrcLib(
  title: string,
  artist: string,
  durationMs: number,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)
  const primary = primaryArtist(cleanA)
  const seconds = Math.round(durationMs / 1000)

  let lrc = await exactMatch(cleanT, cleanA, seconds, signal)
  if (!lrc && primary !== cleanA) {
    lrc = await exactMatch(cleanT, primary, seconds, signal)
  }

  if (!lrc) {
    lrc = await searchFallback(cleanT, cleanA, seconds, signal)
  }
  if (!lrc && primary !== cleanA) {
    lrc = await searchFallback(cleanT, primary, seconds, signal)
  }
  if (!lrc) {
    lrc = await searchFallback(cleanT, null, seconds, signal)
  }

  if (!lrc) return null
  const lines = parseLrc(lrc)
  return lines.length > 0 ? lines : null
}

