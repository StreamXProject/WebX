import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LyricsRepository } from '@/lyrics/lyricsRepository'
import type { TrackMetadata } from '@/lyrics/types'
import * as lrcRedMod from '@/lyrics/providers/lrcRedProvider'
import * as lrcLibMod from '@/lyrics/providers/lrcLibProvider'
import * as biniMod from '@/lyrics/providers/biniLyricsProvider'

describe('LyricsRepository', () => {
  const dummyTrack: TrackMetadata = {
    id: 'track-123',
    title: 'Yellow',
    artist: 'Coldplay',
    durationSec: 269,
  }

  beforeEach(() => {
    LyricsRepository.clearCache()
    vi.restoreAllMocks()
  })

  it('prioritizes word-synced TTML provider over line-synced LRC provider', async () => {
    vi.spyOn(biniMod, 'identifyBini').mockResolvedValue(null)
    vi.spyOn(lrcRedMod, 'fetchLrcRed').mockResolvedValue([
      {
        time: 1.0,
        text: 'Look at the stars',
        spans: [
          { time: 1.0, duration: 0.5, text: 'Look' },
          { time: 1.5, duration: 0.5, text: 'at' },
        ],
      },
    ])
    vi.spyOn(lrcLibMod, 'fetchLrcLib').mockResolvedValue([
      { time: 1.0, text: 'Look at the stars' },
    ])

    const lyrics = await LyricsRepository.fetchLyrics(dummyTrack)
    expect(lyrics).toBeDefined()
    expect(lyrics?.source).toBe('lrc.red')
    expect(lyrics?.kind).toBe('syllable')
    expect(lyrics?.lines[0].spans).toBeDefined()

    // Statuses should reflect lrc.red availability
    const statuses = LyricsRepository.getProviderStatuses('track-123')
    expect(statuses['lrc.red']).toBe(true)
  })

  it('falls back to line-synced provider when no syllable sync is available', async () => {
    vi.spyOn(biniMod, 'identifyBini').mockResolvedValue(null)
    vi.spyOn(lrcRedMod, 'fetchLrcRed').mockResolvedValue(null)
    vi.spyOn(lrcLibMod, 'fetchLrcLib').mockResolvedValue([
      { time: 2.0, text: 'Line synced line' },
    ])

    const lyrics = await LyricsRepository.fetchLyrics(dummyTrack)
    expect(lyrics).toBeDefined()
    expect(lyrics?.source).toBe('lrclib')
    expect(lyrics?.kind).toBe('line')

    const statuses = LyricsRepository.getProviderStatuses('track-123')
    expect(statuses['lrclib']).toBe(true)
    expect(statuses['lrc.red']).toBe(false)
  })

  it('returns cached lyrics immediately without re-fetching', async () => {
    vi.spyOn(biniMod, 'identifyBini').mockResolvedValue(null)
    const spyLrcLib = vi.spyOn(lrcLibMod, 'fetchLrcLib').mockResolvedValue([
      { time: 2.0, text: 'Cached line' },
    ])

    const first = await LyricsRepository.fetchLyrics(dummyTrack)
    expect(first).toBeDefined()
    expect(spyLrcLib).toHaveBeenCalledTimes(1)

    const second = await LyricsRepository.fetchLyrics(dummyTrack)
    expect(second).toBe(first)
    expect(spyLrcLib).toHaveBeenCalledTimes(1) // Still 1!
  })
})

