import type { LyricLine } from '@/schemas/track'
import { parseLrc } from '@/api/lyrics'
import { safeFetchText } from '../lyricsHttp'

/**
 * KuGou — Line-synced lyrics with extensive coverage across global and Asian catalogs.
 * Ported from StreamXAndroid / BitChord KuGouProvider.
 */

const DURATION_TOLERANCE_SECONDS = 8
const CREDIT_LINE = /.+\][^[]+[:：].+/

function stripCredits(raw: string): string {
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (CREDIT_LINE.test(trimmed)) {
      const idx = trimmed.indexOf(']')
      if (idx >= 0) {
        out.push(trimmed.slice(0, idx + 1))
        continue
      }
    }
    out.push(trimmed)
  }
  return out.join('\n')
}

export async function fetchKuGou(
  title: string,
  artist: string,
  durationMs: number,
  album?: string | null,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanTitle = title.replace(/[(（].*?[)）]/g, '').trim() || title
  const cleanArtist = artist.replace(/[(（].*?[)）]/g, '').trim()
  const query = `${cleanTitle} ${cleanArtist}`.trim()
  const seconds = Math.round(durationMs / 1000)

  // 1. Search song hash
  const songUrl = `https://mobileservice.kugou.com/api/v3/search/song?version=9108&plat=0&pagesize=8&showtype=0&keyword=${encodeURIComponent(query)}`
  const songBody = await safeFetchText(songUrl, { signal, timeoutMs: 3500 })
  let hash: string | null = null

  if (songBody) {
    try {
      const parsed = JSON.parse(songBody)
      const list: Array<{ hash: string; duration: number }> = parsed?.data?.info || []
      const filtered = list.filter((it) => seconds <= 0 || Math.abs(it.duration - seconds) <= DURATION_TOLERANCE_SECONDS)
      filtered.sort((a, b) => Math.abs(a.duration - seconds) - Math.abs(b.duration - seconds))
      if (filtered.length > 0) hash = filtered[0].hash
    } catch {
      // Continue without hash
    }
  }

  // 2. Search lyrics candidate
  const lyricsUrl = new URL('https://lyrics.kugou.com/search')
  lyricsUrl.searchParams.set('ver', '1')
  lyricsUrl.searchParams.set('man', 'yes')
  lyricsUrl.searchParams.set('client', 'pc')

  if (hash) {
    lyricsUrl.searchParams.set('hash', hash)
  } else {
    lyricsUrl.searchParams.set('keyword', query)
    if (seconds > 0) lyricsUrl.searchParams.set('duration', (seconds * 1000).toString())
  }

  const searchBody = await safeFetchText(lyricsUrl.toString(), { signal, timeoutMs: 3500 })
  if (!searchBody) return null

  let candidate: { id: string; accesskey: string } | null = null
  try {
    const parsed = JSON.parse(searchBody)
    const candidates = parsed?.candidates
    if (Array.isArray(candidates) && candidates.length > 0) {
      candidate = { id: String(candidates[0].id), accesskey: String(candidates[0].accesskey) }
    }
  } catch {
    return null
  }

  if (!candidate || !candidate.id || !candidate.accesskey) return null

  // 3. Download lyric
  const downloadUrl = `https://lyrics.kugou.com/download?fmt=lrc&charset=utf8&client=pc&ver=1&id=${encodeURIComponent(candidate.id)}&accesskey=${encodeURIComponent(candidate.accesskey)}`
  const downloadBody = await safeFetchText(downloadUrl, { signal, timeoutMs: 3500 })
  if (!downloadBody) return null

  try {
    const parsed = JSON.parse(downloadBody)
    const b64 = parsed?.content
    if (!b64) return null
    const decoded = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8')
    const cleaned = stripCredits(decoded)
    const lines = parseLrc(cleaned)
    return lines.length > 0 ? lines : null
  } catch {
    return null
  }
}

