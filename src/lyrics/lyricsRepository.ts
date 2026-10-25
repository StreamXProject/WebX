import type { LyricLine, Lyrics } from '@/schemas/track'
import type { LyricsSource, ProviderResult, TrackMetadata } from './types'
import { fetchLrcRed } from './providers/lrcRedProvider'
import { fetchBiniLyrics, identifyBini } from './providers/biniLyricsProvider'
import { fetchBetterLyrics } from './providers/betterLyricsProvider'
import { fetchPaxSenix } from './providers/paxSenixProvider'
import { fetchLrcLib } from './providers/lrcLibProvider'
import { fetchKuGou } from './providers/kuGouProvider'
import { fetchYouTubeMusic } from './providers/youtubeMusicProvider'
import { fetchBackendLyrics } from './providers/backendProvider'

/**
 * Priority-based concurrent lyrics racing repository.
 * Ported from StreamXAndroid / BitChord LyricsRepository engine.
 *
 * Runs all enabled providers concurrently in parallel to avoid round-trip waterfall delays,
 * prioritizes word-synced Apple Music TTML over line-synced LRC, and tracks availability
 * per provider so users can manually inspect and switch providers.
 */

const cache = new Map<string, Lyrics>()
const trackProviderResults = new Map<string, Map<LyricsSource, ProviderResult>>()
const trackProviderStatus = new Map<string, Map<LyricsSource, boolean>>()
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // Ignore listener error
    }
  }
}

function toLyrics(trackId: string, result: ProviderResult): Lyrics {
  const hasTimestamps = result.lines.some((l) => l.time > 0 || (l.spans && l.spans.length > 0))
  return {
    lines: result.lines,
    plain: result.lines.map((l) => l.text).join('\n'),
    synced: hasTimestamps,
    source: result.source,
    kind: result.isWordSynced ? 'syllable' : hasTimestamps ? 'line' : 'plain',
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const LyricsRepository = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getCached(trackId: string): Lyrics | null {
    return cache.get(trackId) ?? null
  },

  getProviderStatuses(trackId: string): Record<LyricsSource, boolean> {
    const statuses = trackProviderStatus.get(trackId)
    if (!statuses) return {} as Record<LyricsSource, boolean>
    const obj: Partial<Record<LyricsSource, boolean>> = {}
    for (const [source, ok] of statuses.entries()) {
      obj[source] = ok
    }
    return obj as Record<LyricsSource, boolean>
  },

  clearCache(): void {
    cache.clear()
    trackProviderResults.clear()
    trackProviderStatus.clear()
    notifyListeners()
  },

  async fetchLyrics(track: TrackMetadata, signal?: AbortSignal): Promise<Lyrics | null> {
    const trackId = track.id
    if (!trackId || !trackId.trim()) return null

    const cached = cache.get(trackId)
    if (cached) return cached

    let trackResults = trackProviderResults.get(trackId)
    if (!trackResults) {
      trackResults = new Map()
      trackProviderResults.set(trackId, trackResults)
    }

    let trackStatuses = trackProviderStatus.get(trackId)
    if (!trackStatuses) {
      trackStatuses = new Map()
      trackProviderStatus.set(trackId, trackStatuses)
    }

    const title = track.title || ''
    const artist = track.artist || ''
    const album = track.album || undefined
    const durationMs = Math.round((track.durationSec || 0) * 1000)

    // Optional fast recording ISRC resolution via BiniLyrics (2500ms timeout)
    const identifiedIsrc = await withTimeout(
      identifyBini(title, artist, durationMs, album, undefined, signal)
        .then((h) => h?.isrc ?? null)
        .catch(() => null),
      2500
    )

    // Launch all provider jobs concurrently
    const lrcRedPromise = fetchLrcRed(title, artist, durationMs, identifiedIsrc, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'lrc.red',
            lines,
            isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('lrc.red', res)
          trackStatuses!.set('lrc.red', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('lrc.red', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('lrc.red', false)
        notifyListeners()
        return null
      })

    const biniPromise = fetchBiniLyrics(title, artist, durationMs, album, identifiedIsrc, signal)
      .then((result) => {
        if (result && result.lines && result.lines.length > 0) {
          const res: ProviderResult = {
            source: 'binilyrics',
            lines: result.lines,
            isWordSynced: result.lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('binilyrics', res)
          trackStatuses!.set('binilyrics', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('binilyrics', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('binilyrics', false)
        notifyListeners()
        return null
      })

    const betterLyricsPromise = fetchBetterLyrics(title, artist, durationMs, album, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'betterlyrics',
            lines,
            isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('betterlyrics', res)
          trackStatuses!.set('betterlyrics', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('betterlyrics', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('betterlyrics', false)
        notifyListeners()
        return null
      })

    const paxSenixPromise = fetchPaxSenix(title, artist, durationMs, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'paxsenix',
            lines,
            isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('paxsenix', res)
          trackStatuses!.set('paxsenix', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('paxsenix', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('paxsenix', false)
        notifyListeners()
        return null
      })

    const lrcLibPromise = fetchLrcLib(title, artist, durationMs, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'lrclib',
            lines,
            isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('lrclib', res)
          trackStatuses!.set('lrclib', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('lrclib', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('lrclib', false)
        notifyListeners()
        return null
      })

    const kuGouPromise = fetchKuGou(title, artist, durationMs, album, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'kugou',
            lines,
            isWordSynced: false,
          }
          trackResults!.set('kugou', res)
          trackStatuses!.set('kugou', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('kugou', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('kugou', false)
        notifyListeners()
        return null
      })

    const ytMusicPromise = fetchYouTubeMusic(title, artist, undefined, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'ytmusic',
            lines,
            isWordSynced: false,
          }
          trackResults!.set('ytmusic', res)
          trackStatuses!.set('ytmusic', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('ytmusic', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('ytmusic', false)
        notifyListeners()
        return null
      })

    const backendPromise = fetchBackendLyrics(trackId, signal)
      .then((lines) => {
        if (lines && lines.length > 0) {
          const res: ProviderResult = {
            source: 'streamx',
            lines,
            isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
          }
          trackResults!.set('streamx', res)
          trackStatuses!.set('streamx', true)
          notifyListeners()
          return res
        }
        trackStatuses!.set('streamx', false)
        notifyListeners()
        return null
      })
      .catch(() => {
        trackStatuses!.set('streamx', false)
        notifyListeners()
        return null
      })

    // Priority ordering
    const jobsInPriority: Array<{ source: LyricsSource; promise: Promise<ProviderResult | null> }> = [
      { source: 'lrc.red', promise: lrcRedPromise },
      { source: 'binilyrics', promise: biniPromise },
      { source: 'betterlyrics', promise: betterLyricsPromise },
      { source: 'paxsenix', promise: paxSenixPromise },
      { source: 'lrclib', promise: lrcLibPromise },
      { source: 'kugou', promise: kuGouPromise },
      { source: 'ytmusic', promise: ytMusicPromise },
      { source: 'streamx', promise: backendPromise },
    ]

    let bestLineSynced: ProviderResult | null = null
    let winner: ProviderResult | null = null

    // Wait up to 4500ms for priority resolution
    for (const job of jobsInPriority) {
      if (signal?.aborted) return null
      const res = await withTimeout(job.promise, 4500)
      if (!res) continue

      if (res.isWordSynced) {
        winner = res
        break
      } else if (!bestLineSynced) {
        bestLineSynced = res
      }
    }

    const result = winner || bestLineSynced
    if (result && result.lines.length > 0) {
      const lyrics = toLyrics(trackId, result)
      cache.set(trackId, lyrics)
      notifyListeners()
      return lyrics
    }

    return null
  },

  async selectProvider(
    track: TrackMetadata,
    source: LyricsSource,
    signal?: AbortSignal
  ): Promise<Lyrics | null> {
    const trackId = track.id
    if (!trackId || !trackId.trim()) return null

    let trackResults = trackProviderResults.get(trackId)
    if (!trackResults) {
      trackResults = new Map()
      trackProviderResults.set(trackId, trackResults)
    }

    let trackStatuses = trackProviderStatus.get(trackId)
    if (!trackStatuses) {
      trackStatuses = new Map()
      trackProviderStatus.set(trackId, trackStatuses)
    }

    const cachedResult = trackResults.get(source)
    if (cachedResult && cachedResult.lines.length > 0) {
      const lyrics = toLyrics(trackId, cachedResult)
      cache.set(trackId, lyrics)
      notifyListeners()
      return lyrics
    }

    const title = track.title || ''
    const artist = track.artist || ''
    const album = track.album || undefined
    const durationMs = Math.round((track.durationSec || 0) * 1000)

    let fetchedResult: ProviderResult | null = null

    try {
      switch (source) {
        case 'lrc.red': {
          const isrc = await identifyBini(title, artist, durationMs, album, undefined, signal).then((h) => h?.isrc)
          const lines = await fetchLrcRed(title, artist, durationMs, isrc, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'lrc.red',
              lines,
              isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
        case 'binilyrics': {
          const res = await fetchBiniLyrics(title, artist, durationMs, album, undefined, signal)
          if (res && res.lines && res.lines.length > 0) {
            fetchedResult = {
              source: 'binilyrics',
              lines: res.lines,
              isWordSynced: res.lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
        case 'betterlyrics': {
          const lines = await fetchBetterLyrics(title, artist, durationMs, album, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'betterlyrics',
              lines,
              isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
        case 'paxsenix': {
          const lines = await fetchPaxSenix(title, artist, durationMs, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'paxsenix',
              lines,
              isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
        case 'lrclib': {
          const lines = await fetchLrcLib(title, artist, durationMs, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'lrclib',
              lines,
              isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
        case 'kugou': {
          const lines = await fetchKuGou(title, artist, durationMs, album, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'kugou',
              lines,
              isWordSynced: false,
            }
          }
          break
        }
        case 'ytmusic': {
          const lines = await fetchYouTubeMusic(title, artist, undefined, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'ytmusic',
              lines,
              isWordSynced: false,
            }
          }
          break
        }
        case 'streamx': {
          const lines = await fetchBackendLyrics(trackId, signal)
          if (lines && lines.length > 0) {
            fetchedResult = {
              source: 'streamx',
              lines,
              isWordSynced: lines.some((l) => Boolean(l.spans && l.spans.length > 0)),
            }
          }
          break
        }
      }
    } catch {
      // Failed to fetch specific provider
    }

    if (fetchedResult && fetchedResult.lines.length > 0) {
      trackResults.set(source, fetchedResult)
      trackStatuses.set(source, true)
      const lyrics = toLyrics(trackId, fetchedResult)
      cache.set(trackId, lyrics)
      notifyListeners()
      return lyrics
    } else {
      trackStatuses.set(source, false)
      notifyListeners()
    }

    return null
  },
}
