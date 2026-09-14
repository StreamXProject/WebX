import { describe, it, expect } from 'vitest'
import { AudioEngine } from '@/audio/AudioEngine'

describe('AudioEngine', () => {
  it('returns singleton instance', () => {
    const inst1 = AudioEngine.getInstance()
    const inst2 = AudioEngine.getInstance()
    expect(inst1).toBe(inst2)
  })

  it('initializes with default audio state', () => {
    const engine = AudioEngine.getInstance()
    const state = engine.getState()

    expect(state.status).toBe('idle')
    expect(state.isPlaying).toBe(false)
    expect(state.volume).toBeGreaterThan(0)
    expect(state.isMuted).toBe(false)
  })

  it('updates volume correctly and clamps between 0 and 1', () => {
    const engine = AudioEngine.getInstance()
    engine.setVolume(0.5)
    expect(engine.getState().volume).toBe(0.5)

    engine.setVolume(1.5)
    expect(engine.getState().volume).toBe(1)

    engine.setVolume(-0.2)
    expect(engine.getState().volume).toBe(0)
  })

  it('reports progress correctly', () => {
    const engine = AudioEngine.getInstance()
    const progress = engine.getProgress()

    expect(progress).toHaveProperty('currentTime')
    expect(progress).toHaveProperty('duration')
    expect(progress).toHaveProperty('progressPercent')
  })
})
