import { describe, it, expect } from 'vitest'
import { buildRecapStory } from '@/features/recap/story/buildRecapStory'
import type { RecapSnapshot } from '@/features/recap/types'

const track = (id: string, title: string) => ({ id, title, artist: 'Artist', album: 'Album', album_id: null, artist_id: null, duration_sec: 200, cover_url: null, type: 'FLAC', sampling_rate_hz: null, spotify_url: null, topic_name: null, liked: false }) as never

function snap(over: Partial<RecapSnapshot['stats']> = {}, extra: Partial<RecapSnapshot> = {}): RecapSnapshot {
  return {
    schemaVersion: 1, type: 'monthly', period: '2026-08', label: 'August 2026', start: 0, end: 1, ongoing: false, generatedAt: 0, eventCount: 10, legacyData: false,
    personality: [{ id: 'night_owl', name: 'Night Owl', detail: '60% after 9 PM' }],
    comparison: { period: '2026-07', totalMinutes: 100, totalPlays: 40, uniqueArtists: 5, uniqueTracks: 20, minutesDeltaPct: 25, playsDeltaPct: 10, artistsDelta: 3, nightShareDelta: 4, topArtistPrev: 'Old' },
    stats: {
      totalMinutes: 125, totalPlays: 50, completedPlays: 40, skippedPlays: 5, uniqueTracks: 20, uniqueArtists: 8, uniqueAlbums: 4,
      topTracks: [{ track: track('a', 'A'), plays: 9, minutes: 30 }, { track: track('b', 'B'), plays: 4, minutes: 12 }],
      topArtists: [{ name: 'Artist', plays: 30, minutes: 90 }],
      topAlbums: [{ album: 'Album', artist: 'Artist', plays: 12, minutes: 40 }],
      topGenres: [], listeningByHour: new Array(24).fill(1), listeningByWeekday: new Array(7).fill(1), listeningByDay: [], listeningByMonth: [],
      discoveryCount: 12, discoveryTracks: [track('a', 'A')], repeatCount: 30, mostActiveHour: 22, mostActiveWeekday: 5, mostActiveDate: '2026-08-10', mostActiveDateMinutes: 30,
      longestSessionMinutes: 60, sessionCount: 5, nightShare: 0.6, earlyShare: 0.1, weekendShare: 0.3, losslessShare: 1, topArtistShare: 0.6,
      ...over,
    },
    ...extra,
  }
}

describe('buildRecapStory', () => {
  it('builds a conditional, ordered story with intro and outro', () => {
    const { scenes, soundtrack } = buildRecapStory(snap())
    const types = scenes.map((s) => s.type)
    expect(types[0]).toBe('intro')
    expect(types[types.length - 1]).toBe('outro')
    expect(types).toContain('minutes')
    expect(types).toContain('top_artist')
    expect(types).toContain('discovery')
    expect(types).toContain('replayer')
    expect(types).toContain('personality')
    expect(types).toContain('comparison')
    expect(soundtrack.tracks.length).toBe(2)
    expect(scenes.every((s) => s.durationMs > 0)).toBe(true)
  })
  it('collapses to intro + outro when nothing was played', () => {
    const { scenes } = buildRecapStory(snap({ totalPlays: 0, totalMinutes: 0, topTracks: [], topArtists: [] }))
    expect(scenes.map((s) => s.type)).toEqual(['intro', 'outro'])
  })
  it('adds a trend scene for yearly recaps with monthly data', () => {
    const { scenes } = buildRecapStory(snap({ listeningByMonth: [{ month: '2026-01', minutes: 10 }, { month: '2026-02', minutes: 50 }, { month: '2026-03', minutes: 20 }] }, { type: 'yearly', period: '2026', label: '2026' }))
    const trend = scenes.find((s) => s.type === 'trend')
    expect(trend && trend.type === 'trend' && trend.peakMonth).toBe('Feb')
  })
})
