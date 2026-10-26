import type { LyricLine } from '@/schemas/track'
import { parseLrc } from '@/api/lyrics'
import { safeFetchText } from '../lyricsHttp'
import { useSettingsStore } from '@/stores/settingsStore'

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

function getKuGouSearchBases(): string[] {
  const bases: string[] = []
  if (typeof window !== 'undefined') {
    try {
      const apiBase = useSettingsStore.getState().apiBaseUrl
      if (apiBase) {
        bases.push(`${apiBase.replace(/\/+$/, '')}/kugou/search`)
      }
    } catch {
      // ignore
    }
    bases.push('/kugou/search')
  }
  bases.push('https://mobileservice.kugou.com')
  return Array.from(new Set(bases))
}

function getKuGouLyricsBases(): string[] {
  const bases: string[] = []
  if (typeof window !== 'undefined') {
    try {
      const apiBase = useSettingsStore.getState().apiBaseUrl
      if (apiBase) {
        bases.push(`${apiBase.replace(/\/+$/, '')}/kugou/lyrics`)
      }
    } catch {
      // ignore
    }
    bases.push('/kugou/lyrics')
  }
  bases.push('http://lyrics.kugou.com')
  return Array.from(new Set(bases))
}

async function fetchFromBases(
  bases: string[],
  pathWithQuery: string,
  signal?: AbortSignal
): Promise<string | null> {
  for (const base of bases) {
    if (signal?.aborted) return null
    const url = `${base}${pathWithQuery}`
    const res = await safeFetchText(url, { signal, timeoutMs: 3500 })
    if (res) return res
  }
  return null
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
  const searchBases = getKuGouSearchBases()
  const songPath = `/api/v3/search/song?version=9108&plat=0&pagesize=8&showtype=0&keyword=${encodeURIComponent(query)}`
  const songBody = await fetchFromBases(searchBases, songPath, signal)
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
  const lyricsBases = getKuGouLyricsBases()
  const queryParams = new URLSearchParams({
    ver: '1',
    man: 'yes',
    client: 'pc',
  })
  if (hash) {
    queryParams.set('hash', hash)
  } else {
    queryParams.set('keyword', query)
    if (seconds > 0) queryParams.set('duration', (seconds * 1000).toString())
  }

  const searchPath = `/search?${queryParams.toString()}`
  const searchBody = await fetchFromBases(lyricsBases, searchPath, signal)
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
  const downloadPath = `/download?fmt=lrc&charset=utf8&client=pc&ver=1&id=${encodeURIComponent(candidate.id)}&accesskey=${encodeURIComponent(candidate.accesskey)}`
  const downloadBody = await fetchFromBases(lyricsBases, downloadPath, signal)
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
