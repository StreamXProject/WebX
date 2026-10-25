import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist } from '../lyricsQuery'
import { unwrapPayload } from '../payloadExtractor'
import { parseTtml } from '../ttmlParser'

/**
 * PaxSenix — Public Apple Music TTML proxy using Apple Music catalog search.
 * Ported from StreamXAndroid / BitChord PaxSenixProvider.
 */

const PUBLIC_PROXY = 'https://lyrics.paxsenix.org/apple-music/lyrics'
const APPLE_SEARCH = 'https://amp-api.music.apple.com/v1/catalog/us/search'

let cachedAppleToken: string | null = null

async function getAppleToken(signal?: AbortSignal): Promise<string | null> {
  if (cachedAppleToken) return cachedAppleToken

  try {
    const html = await safeFetchText('https://music.apple.com', { signal, timeoutMs: 3500 })
    if (!html) return null

    const scriptMatch = html.match(/\/assets\/index[-~][^"]+\.js/)
    if (!scriptMatch) return null

    const scriptUrl = `https://music.apple.com${scriptMatch[0]}`
    const js = await safeFetchText(scriptUrl, { signal, timeoutMs: 3500 })
    if (!js) return null

    const tokenMatch = js.match(/ey[\w-]+\.ey[\w-]+\.[\w-]+/)
    if (tokenMatch) {
      cachedAppleToken = tokenMatch[0]
      return cachedAppleToken
    }
  } catch {
    // Token extraction failure
  }

  return null
}

export async function fetchPaxSenix(
  title: string,
  artist: string,
  durationMs: number,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const token = await getAppleToken(signal)
  if (!token) return null

  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)
  const primary = primaryArtist(cleanA)

  const terms = Array.from(new Set([`${cleanT} ${primary}`.trim(), `${cleanT} ${cleanA}`.trim(), cleanT.trim()])).filter(Boolean)
  const targetSeconds = durationMs / 1000

  for (const term of terms) {
    if (signal?.aborted) return null
    const searchUrl = `${APPLE_SEARCH}?term=${encodeURIComponent(term)}&types=songs&limit=5&l=en-US`
    const body = await safeFetchText(searchUrl, {
      signal,
      timeoutMs: 3500,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!body) continue

    try {
      const root = JSON.parse(body)
      const songs = root?.results?.songs?.data
      if (!Array.isArray(songs) || songs.length === 0) continue

      songs.sort((a, b) => {
        const durA = (Number(a?.attributes?.durationInMillis) || 0) / 1000
        const durB = (Number(b?.attributes?.durationInMillis) || 0) / 1000
        const distA = targetSeconds > 0 ? Math.abs(durA - targetSeconds) : 0
        const distB = targetSeconds > 0 ? Math.abs(durB - targetSeconds) : 0
        return distA - distB
      })

      const bestId = songs[0]?.id
      if (!bestId) continue

      const proxyUrl = `${PUBLIC_PROXY}?id=${encodeURIComponent(bestId)}&ttml=true`
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

