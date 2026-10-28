import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist } from '../lyricsQuery'
import { unwrapPayload } from '../payloadExtractor'
import { parseTtml } from '../ttmlParser'

/**
 * PaxSenix — Public Apple Music TTML proxy using Apple Music catalog search.
 * Uses official iTunes Search API (CORS-friendly across all browsers) to resolve
 * Apple Music track IDs, then fetches word-synced TTML from PaxSenix.
 */

const PUBLIC_PROXY = 'https://lyrics.paxsenix.org/apple-music/lyrics'
const ITUNES_SEARCH = 'https://itunes.apple.com/search'

export async function fetchPaxSenix(
  title: string,
  artist: string,
  durationMs: number,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)
  const primary = primaryArtist(cleanA)

  const terms = Array.from(
    new Set([`${cleanT} ${primary}`.trim(), `${cleanT} ${cleanA}`.trim(), cleanT.trim()])
  ).filter(Boolean)
  const targetSeconds = durationMs / 1000

  for (const term of terms) {
    if (signal?.aborted) return null
    const searchUrl = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=song&limit=5`
    const body = await safeFetchText(searchUrl, {
      signal,
      timeoutMs: 3500,
    })
    if (!body) continue

    try {
      const root = JSON.parse(body)
      const songs = root?.results
      if (!Array.isArray(songs) || songs.length === 0) continue

      songs.sort((a, b) => {
        const durA = (Number(a?.trackTimeMillis) || 0) / 1000
        const durB = (Number(b?.trackTimeMillis) || 0) / 1000
        const distA = targetSeconds > 0 ? Math.abs(durA - targetSeconds) : 0
        const distB = targetSeconds > 0 ? Math.abs(durB - targetSeconds) : 0
        return distA - distB
      })

      const bestId = songs[0]?.trackId
      if (!bestId) continue

      const proxyUrl = `${PUBLIC_PROXY}?id=${encodeURIComponent(String(bestId))}&ttml=true`
      const raw = await safeFetchText(proxyUrl, { signal, timeoutMs: 4000 })
      if (!raw) continue

      const payload = unwrapPayload(raw)
      if (payload && (payload.includes('<tt') || payload.toLowerCase().includes('http://www.w3.org/ns/ttml'))) {
        const lines = parseTtml(payload)
        if (lines.length > 0) return lines
      }
    } catch {
      // Continue to next term
    }
  }

  return null
}
