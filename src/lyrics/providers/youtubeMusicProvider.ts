import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist } from '../lyricsQuery'

/**
 * YouTube Music — Plain / unsynced lyrics exposed directly by YouTube Music.
 * Ported from StreamXAndroid / BitChord YouTubeMusicProvider.
 */

const MUSIC_BASE = 'https://music.youtube.com/youtubei/v1'
const WEB_REMIX_VERSION = '1.20250101.01.00'

function extractText(obj: unknown): string[] {
  const result: string[] = []
  if (!obj) return result

  const walk = (item: unknown) => {
    if (typeof item === 'string') {
      result.push(item)
    } else if (Array.isArray(item)) {
      item.forEach(walk)
    } else if (typeof item === 'object' && item !== null) {
      const o = item as Record<string, unknown>
      if (typeof o.text === 'string') result.push(o.text)
      for (const key of Object.keys(o)) {
        if (key !== 'text') walk(o[key])
      }
    }
  }

  walk(obj)
  return result
}

export async function fetchYouTubeMusic(
  title: string,
  artist: string,
  videoId?: string | null,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)

  // 1. Resolve videoId if needed
  let vid = videoId
  if (!vid) {
    const searchPayload = JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: WEB_REMIX_VERSION, hl: 'en', gl: 'US' } },
      query: `${cleanT} ${cleanA}`,
      params: 'Eg-KAQwIABAAGAAgACgAMABqChAMEAMQBBAFEAo%3D',
    })

    const searchRes = await safeFetchText(`${MUSIC_BASE}/search`, {
      signal,
      timeoutMs: 3500,
      headers: { 'Content-Type': 'application/json' },
    })
    if (!searchRes) return null

    const match = searchRes.match(/"videoId":"([A-Za-z0-9_-]{11})"/i)
    if (!match) return null
    vid = match[1]
  }

  if (!vid) return null

  // 2. Query next endpoint
  const nextBody = JSON.stringify({
    context: { client: { clientName: 'WEB_REMIX', clientVersion: WEB_REMIX_VERSION, hl: 'en', gl: 'US' } },
    videoId: vid,
    isAudioOnly: true,
  })

  const nextRes = await safeFetchText(`${MUSIC_BASE}/next`, {
    signal,
    timeoutMs: 3500,
    headers: { 'Content-Type': 'application/json' },
  })
  if (!nextRes) return null

  // Find browseId for Lyrics tab
  const browseMatch = nextRes.match(/"browseId":"(MPLYt_[^"]+)"/i)
  if (!browseMatch) return null
  const browseId = browseMatch[1]

  // 3. Query browse endpoint
  const browseBody = JSON.stringify({
    context: { client: { clientName: 'WEB_REMIX', clientVersion: WEB_REMIX_VERSION, hl: 'en', gl: 'US' } },
    browseId,
  })

  const browseRes = await safeFetchText(`${MUSIC_BASE}/browse`, {
    signal,
    timeoutMs: 3500,
    headers: { 'Content-Type': 'application/json' },
  })
  if (!browseRes) return null

  try {
    const parsed = JSON.parse(browseRes)
    const texts = extractText(parsed)
    const joined = texts.join('')
    if (!joined.trim()) return null

    const lines: LyricLine[] = joined
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((text) => ({ time: 0, text }))

    return lines.length > 0 ? lines : null
  } catch {
    return null
  }
}
