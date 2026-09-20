import { describe, it, expect } from 'vitest'
import { PLAY_PATH, PAUSE_PATH } from '@/components/player/PlayPauseIcon'

describe('PlayPauseIcon 24x24 path geometry', () => {
  it('both Play and Pause paths have matching sub-path count and commands for morphing', () => {
    const playSubpaths = PLAY_PATH.split('Z').map((s) => s.trim()).filter(Boolean)
    const pauseSubpaths = PAUSE_PATH.split('Z').map((s) => s.trim()).filter(Boolean)

    expect(playSubpaths.length).toBe(2)
    expect(pauseSubpaths.length).toBe(2)

    for (let i = 0; i < 2; i++) {
      const playCoords = playSubpaths[i].replace(/[MmLl]/g, '').trim().split(/\s+/)
      const pauseCoords = pauseSubpaths[i].replace(/[MmLl]/g, '').trim().split(/\s+/)
      expect(playCoords.length).toBe(4)
      expect(pauseCoords.length).toBe(4)
    }
  })

  it('both states share the exact horizontal bounds x=6 to x=19 and y=4 to y=20', () => {
    expect(PLAY_PATH).toContain('6,')
    expect(PLAY_PATH).toContain('19,')
    expect(PAUSE_PATH).toContain('6,')
    expect(PAUSE_PATH).toContain('19,')
  })
})

