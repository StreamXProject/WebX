import { describe, it, expect, beforeEach } from 'vitest'
import { QueueManager } from '@/audio/QueueManager'
import type { Track } from '@/schemas/track'

const sampleTracks: Track[] = [
  { id: '1', title: 'Song One', artist: 'Artist A', album: 'Album 1', duration_sec: 180, liked: false },
  { id: '2', title: 'Song Two', artist: 'Artist B', album: 'Album 2', duration_sec: 210, liked: true },
  { id: '3', title: 'Song Three', artist: 'Artist C', album: 'Album 3', duration_sec: 240, liked: false },
]

describe('QueueManager', () => {
  let qm: QueueManager

  beforeEach(() => {
    qm = new QueueManager()
  })

  it('initializes empty', () => {
    expect(qm.getQueue()).toEqual([])
    expect(qm.getCurrentIndex()).toBe(-1)
    expect(qm.getCurrentTrack()).toBeNull()
  })

  it('sets queue and selects startIndex', () => {
    qm.setQueue(sampleTracks, 1)
    expect(qm.getQueue().length).toBe(3)
    expect(qm.getCurrentIndex()).toBe(1)
    expect(qm.getCurrentTrack()?.id).toBe('2')
  })

  it('advances on next() and stops at end when repeat is off', () => {
    qm.setQueue(sampleTracks, 1)
    const next1 = qm.next()
    expect(next1?.id).toBe('3')
    expect(qm.getCurrentIndex()).toBe(2)

    const next2 = qm.next()
    expect(next2).toBeNull()
  })

  it('loops back to beginning when repeat mode is "all"', () => {
    qm.setQueue(sampleTracks, 2)
    qm.setRepeatMode('all')

    const next = qm.next()
    expect(next?.id).toBe('1')
    expect(qm.getCurrentIndex()).toBe(0)
  })

  it('repeats current song when repeat mode is "one"', () => {
    qm.setQueue(sampleTracks, 1)
    qm.setRepeatMode('one')

    const next = qm.next()
    expect(next?.id).toBe('2')
    expect(qm.getCurrentIndex()).toBe(1)
  })

  it('preserves all items when shuffling', () => {
    qm.setQueue(sampleTracks, 0)
    qm.toggleShuffle()

    expect(qm.getIsShuffle()).toBe(true)
    const shuffled = qm.getQueue()
    expect(shuffled.length).toBe(3)
    expect(shuffled.map((t) => t.id).sort()).toEqual(['1', '2', '3'])
  })

  it('reorders track positions correctly', () => {
    qm.setQueue(sampleTracks, 0)
    qm.reorder(0, 2)
    const queue = qm.getQueue()
    expect(queue[0].id).toBe('2')
    expect(queue[2].id).toBe('1')
  })
})
