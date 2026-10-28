import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist } from '../lyricsQuery'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * YouTube Music — Plain / unsynced lyrics exposed directly by YouTube Music.
 * 1:1 port from StreamXAndroid (com.streamx.app.lyrics.providers.YouTubeMusicProvider).
 */

const WEB_REMIX_CLIENT_ID = '67'
const WEB_REMIX_VERSION = '1.20250101.01.00'
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'X-Origin': 'https://music.youtube.com',
  'X-YouTube-Client-Name': WEB_REMIX_CLIENT_ID,
  'X-YouTube-Client-Version': WEB_REMIX_VERSION,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

function getCandidateBases(): string[] {
  const bases: string[] = []
  if (typeof window !== 'undefined') {
    try {
      const apiBase = useSettingsStore.getState().apiBaseUrl
      if (apiBase) {
        bases.push(`${apiBase.replace(/\/+$/, '')}/youtubei/v1`)
      }
    } catch {
      // ignore
    }
    bases.push('/youtubei/v1')
  }
  bases.push('https://music.youtube.com/youtubei/v1')
  return Array.from(new Set(bases))
}

function objectsNamed(obj: unknown, name: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  const walk = (current: unknown) => {
    if (!current || typeof current !== 'object') return
    if (Array.isArray(current)) {
      for (const item of current) walk(item)
    } else {
      const record = current as Record<string, unknown>
      for (const [k, v] of Object.entries(record)) {
        if (k === name && v && typeof v === 'object' && !Array.isArray(v)) {
          result.push(v as Record<string, unknown>)
        }
        walk(v)
      }
    }
  }
  walk(obj)
  return result
}

function youtubeStrings(element: unknown): string[] {
  if (element == null) return []
  if (typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
    return [String(element)]
  }
  if (Array.isArray(element)) {
    return element.flatMap(youtubeStrings)
  }
  if (typeof element === 'object') {
    const record = element as Record<string, unknown>
    if (record.text != null) return [String(record.text)]
    if (record.simpleText != null) return [String(record.simpleText)]
    return Object.values(record).flatMap(youtubeStrings)
  }
  return []
}

async function postMusic(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  const bases = getCandidateBases()
  const jsonBody = JSON.stringify(body)

  for (const base of bases) {
    if (signal?.aborted) return null
    const url = `${base}/${endpoint}?alt=json`
    const raw = await safeFetchText(url, {
      method: 'POST',
      body: jsonBody,
      headers: HEADERS,
      signal,
      timeoutMs: 4000,
    })
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      // try next base
    }
  }

  return null
}

async function searchVideoId(
  title: string,
  artist: string,
  signal?: AbortSignal
): Promise<string | null> {
  const primary = primaryArtist(artist)
  const queries = [
    `${title} ${primary}`.trim(),
    `${title} ${artist}`.trim(),
    title.trim(),
  ].filter((q, idx, arr) => q.length > 0 && arr.indexOf(q) === idx)

  for (const q of queries) {
    if (signal?.aborted) return null
    const body = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: WEB_REMIX_VERSION,
          hl: 'en',
          gl: 'US',
        },
      },
      query: q,
    }

    const json = await postMusic('search', body, signal)
    if (!json) continue

    // Priority 1: Check musicResponsiveListItemRenderer playlistItemData.videoId
    const items = objectsNamed(json, 'musicResponsiveListItemRenderer')
    for (const item of items) {
      const playlistItem = item.playlistItemData as Record<string, unknown> | undefined
      const vid = playlistItem?.videoId
      if (typeof vid === 'string' && YOUTUBE_ID.test(vid)) {
        return vid
      }
    }

    // Also check musicCardShelfRenderer (top result card)
    const cardShelves = objectsNamed(json, 'musicCardShelfRenderer')
    for (const shelf of cardShelves) {
      const runs = (shelf.title as Record<string, unknown> | undefined)?.runs as Array<Record<string, unknown>> | undefined
      const runVid = (runs?.[0]?.navigationEndpoint as Record<string, unknown> | undefined)?.watchEndpoint as Record<string, unknown> | undefined
      const onTapVid = (shelf.onTap as Record<string, unknown> | undefined)?.watchEndpoint as Record<string, unknown> | undefined
      const candidateVid = runVid?.videoId || onTapVid?.videoId
      if (typeof candidateVid === 'string' && YOUTUBE_ID.test(candidateVid)) {
        return candidateVid
      }
    }

    // Priority 2: Any valid videoId in search result
    const allVids: string[] = []
    const scanVids = (o: unknown) => {
      if (!o || typeof o !== 'object') return
      if (Array.isArray(o)) {
        for (const it of o) scanVids(it)
      } else {
        const rec = o as Record<string, unknown>
        if (typeof rec.videoId === 'string' && YOUTUBE_ID.test(rec.videoId)) {
          allVids.push(rec.videoId)
        }
        for (const v of Object.values(rec)) scanVids(v)
      }
    }
    scanVids(json)
    if (allVids.length > 0) {
      return allVids[0]
    }
  }

  return null
}

export async function fetchLyricsForVideoId(
  videoId: string,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  if (!YOUTUBE_ID.test(videoId)) return null

  const nextBody = {
    context: {
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: WEB_REMIX_VERSION,
        hl: 'en',
        gl: 'US',
      },
    },
    videoId,
    isAudioOnly: true,
  }

  const nextJson = await postMusic('next', nextBody, signal)
  if (!nextJson) return null

  // Find the "Lyrics" tab's browseEndpoint
  const tabRenderers = objectsNamed(nextJson, 'tabRenderer')
  const lyricsTab = tabRenderers.find((tab) => {
    const strs = youtubeStrings(tab)
    return strs.some((s) => s.toLowerCase() === 'lyrics')
  })
  if (!lyricsTab) return null

  const browseEndpoint =
    objectsNamed(lyricsTab, 'browseEndpoint')[0] ||
    ((lyricsTab.endpoint as Record<string, unknown> | undefined)?.browseEndpoint as Record<string, unknown> | undefined)
  const browseId = browseEndpoint?.browseId
  if (typeof browseId !== 'string' || !browseId.trim()) return null

  const params = browseEndpoint?.params as string | undefined

  const browseBody: Record<string, unknown> = {
    context: {
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: WEB_REMIX_VERSION,
        hl: 'en',
        gl: 'US',
      },
    },
    browseId,
  }
  if (params && params.trim()) {
    browseBody.params = params
  }

  const browseJson = await postMusic('browse', browseBody, signal)
  if (!browseJson) return null

  const shelves = objectsNamed(browseJson, 'musicDescriptionShelfRenderer')
  if (shelves.length === 0) return null

  const rawText = youtubeStrings(shelves[0].description).join('').trim()
  if (!rawText) return null

  const lines: LyricLine[] = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ time: 0, text }))

  return lines.length > 0 ? lines : null
}

export async function fetchYouTubeMusic(
  title: string,
  artist: string,
  videoId?: string | null,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)

  const resolvedVideoId =
    (videoId && YOUTUBE_ID.test(videoId) ? videoId : null) ||
    (await searchVideoId(cleanT, cleanA, signal))

  if (!resolvedVideoId) return null

  return fetchLyricsForVideoId(resolvedVideoId, signal)
}
