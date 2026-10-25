import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist } from '../lyricsQuery'
import { parseTtml } from '../ttmlParser'
import { documentUrl } from './lrcRedProvider'

/**
 * BiniLyrics — Apple Music TTML with recording identification and ISRC lookup.
 * Ported from StreamXAndroid / BitChord BiniLyricsProvider.
 */

const BASE = 'https://lyrics-api.binimum.org/'

export interface BiniHit {
  isrc?: string | null
  track?: string | null
  artist?: string | null
  lyrics_url?: string | null
  ttml_url?: string | null
}

interface SearchResponse {
  results?: BiniHit[] | null
}

export interface BiniResult {
  isrc?: string | null
  lines: LyricLine[]
}

async function queryIdentify(
  params: {
    title?: string | null
    artist?: string | null
    durationMs?: number
    album?: string | null
    isrc?: string | null
  },
  signal?: AbortSignal
): Promise<BiniHit | null> {
  const url = new URL(BASE)
  if (params.isrc && params.isrc.trim()) {
    url.searchParams.set('isrc', params.isrc.trim())
  } else {
    if (params.title && params.title.trim()) url.searchParams.set('track', params.title.trim())
    if (params.artist && params.artist.trim()) url.searchParams.set('artist', params.artist.trim())
    if (params.album && params.album.trim()) url.searchParams.set('album', params.album.trim())
    const seconds = params.durationMs ? Math.round(params.durationMs / 1000) : 0
    if (seconds > 0) url.searchParams.set('duration', seconds.toString())
  }

  const body = await safeFetchText(url.toString(), { signal, timeoutMs: 3500 })
  if (!body) return null

  try {
    const parsed: SearchResponse = JSON.parse(body)
    return parsed.results?.[0] ?? null
  } catch {
    return null
  }
}

export async function identifyBini(
  title: string,
  artist: string,
  durationMs: number,
  album?: string | null,
  isrc?: string | null,
  signal?: AbortSignal
): Promise<BiniHit | null> {
  if (isrc && isrc.trim()) {
    return queryIdentify({ isrc }, signal)
  }

  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)
  const primary = primaryArtist(cleanA)

  const hit1 = await queryIdentify({ title: cleanT, artist: primary, durationMs, album }, signal)
  if (hit1) return hit1

  if (primary !== cleanA) {
    const hit2 = await queryIdentify({ title: cleanT, artist: cleanA, durationMs, album }, signal)
    if (hit2) return hit2
  }

  return queryIdentify({ title: cleanT, durationMs, album }, signal)
}

export async function fetchBiniLyrics(
  title: string,
  artist: string,
  durationMs: number,
  album?: string | null,
  isrc?: string | null,
  signal?: AbortSignal
): Promise<BiniResult | null> {
  const hit = await identifyBini(title, artist, durationMs, album, isrc, signal)
  if (!hit) return null

  const targetUrl = hit.lyrics_url || hit.ttml_url || (hit.isrc ? documentUrl(hit.isrc) : null)
  if (!targetUrl) return null

  const body = await safeFetchText(targetUrl, { signal, timeoutMs: 4500 })
  if (!body) return null

  const lines = parseTtml(body)
  if (lines.length === 0) return null

  return {
    isrc: hit.isrc,
    lines,
  }
}

