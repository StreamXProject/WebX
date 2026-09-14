import { describe, it, expect } from 'vitest'
import { parseLrc, stripLrcTags } from '@/api/lyrics'

describe('LRC parser', () => {
  it('parses timestamps with 2- and 3-digit fractions', () => {
    const lines = parseLrc('[00:12.50]Hello\n[00:15.125]World\n[ti:Song]')
    expect(lines.map((l) => ({ time: l.time, text: l.text }))).toEqual([
      { time: 12.5, text: 'Hello' },
      { time: 15.125, text: 'World' },
    ])
    expect(lines[0].spans).toBeDefined()
    expect(lines[0].duration).toBeCloseTo(2.625)
  })

  it('parses enhanced LRC word tags for syllable sync', () => {
    const lines = parseLrc('[00:10.00]<00:10.00>Never <00:10.50>gonna <00:11.20>give')
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Never gonna give')
    expect(lines[0].spans).toHaveLength(3)
    expect(lines[0].spans![0]).toMatchObject({ time: 10, text: 'Never' })
    expect(lines[0].spans![1]).toMatchObject({ time: 10.5, text: 'gonna' })
    expect(lines[0].spans![2]).toMatchObject({ time: 11.2, text: 'give' })
  })

  it('expands multiple stamps on one line and sorts', () => {
    const lines = parseLrc('[00:20.00][00:10.00]Chorus')
    expect(lines.map((l) => l.time)).toEqual([10, 20])
  })

  it('returns empty for plain lyrics and strips tags', () => {
    expect(parseLrc('just words')).toEqual([])
    expect(stripLrcTags('[00:01.00]<00:01.00>a <00:01.50>b\n[00:02.00]c')).toBe('a b\nc')
  })
})

