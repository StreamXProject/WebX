import { describe, it, expect } from 'vitest'
import { parseTtml, parseTime } from '@/lyrics/ttmlParser'

describe('TTML parser', () => {
  it('parses clock formats correctly into milliseconds', () => {
    expect(parseTime('27.395')).toBe(27395)
    expect(parseTime('1:05.20')).toBe(65200)
    expect(parseTime('1:02:03.4')).toBe(3723400)
    expect(parseTime('45s')).toBe(45000)
    expect(parseTime('450ms')).toBe(450)
  })

  it('parses TTML with word-level syllables', () => {
    const ttml = `
      <?xml version="1.0" encoding="utf-8"?>
      <tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
        <body>
          <div>
            <p begin="00:01.000" end="00:04.000">
              <span begin="00:01.000" end="00:01.500">Hel</span><span begin="00:01.500" end="00:02.000">lo</span>
              <span begin="00:02.200" end="00:03.500">world</span>
            </p>
            <p begin="00:04.500" end="00:07.000">
              <span begin="00:04.500" end="00:06.500">Second line</span>
            </p>
          </div>
        </body>
      </tt>
    `.trim()

    const lines = parseTtml(ttml)
    expect(lines).toHaveLength(2)

    const first = lines[0]
    expect(first.text).toBe('Hello world')
    expect(first.time).toBeCloseTo(1.0)
    expect(first.spans).toBeDefined()
    expect(first.spans).toHaveLength(2)

    const word1 = first.spans![0]
    expect(word1.text).toBe('Hello')
    expect(word1.time).toBeCloseTo(1.0)
    expect(word1.duration).toBeCloseTo(1.0)

    const word2 = first.spans![1]
    expect(word2.text).toBe('world')
    expect(word2.time).toBeCloseTo(2.2)
    expect(word2.duration).toBeCloseTo(1.3)

    const second = lines[1]
    expect(second.text).toBe('Second line')
    expect(second.time).toBeCloseTo(4.5)
  })

  it('parses line-synced TTML without syllable spans', () => {
    const ttml = `
      <tt xmlns="http://www.w3.org/ns/ttml">
        <body>
          <div>
            <p begin="10.5" end="14.0">Simple line-synced TTML line</p>
          </div>
        </body>
      </tt>
    `.trim()

    const lines = parseTtml(ttml)
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Simple line-synced TTML line')
    expect(lines[0].time).toBeCloseTo(10.5)
    expect(lines[0].duration).toBeCloseTo(3.5)
  })
})

