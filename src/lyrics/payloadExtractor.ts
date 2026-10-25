/**
 * Extracts lyric text/TTML payloads from raw HTTP responses or JSON wrappers.
 * Ported from StreamXAndroid / BitChord LyricsPayloadExtractor engine.
 */

const CONTENT_KEYS = [
  'ttml',
  'ttmlContent',
  'lyrics',
  'lrc',
  'content',
  'text',
  'syncedLyrics',
  'plainLyrics',
  'line',
  'lines',
  'lyric',
  'data',
  'result',
  'response',
]

export function unwrapPayload(raw: string): string | null {
  if (!raw) return null
  let value = raw.replace(/\ufeff/g, '').trim()

  if (value.startsWith('```')) {
    const lines = value.split(/\r?\n/)
    if (lines.length > 1) {
      const dropped = lines.slice(1)
      if (dropped[dropped.length - 1]?.trim() === '```') {
        dropped.pop()
      }
      value = dropped.join('\n').trim()
    }
  }

  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    const extracted = extractJson(parsed)
    return extracted ? extracted.trim() : value
  } catch {
    return value
  }
}

function extractJson(val: unknown): string | null {
  if (val === null || val === undefined) return null

  if (typeof val === 'string') {
    const text = val.trim()
    try {
      const nested = JSON.parse(text)
      if (nested && typeof nested === 'object') {
        return extractJson(nested)
      }
    } catch {
      // Not JSON, return raw string
    }
    return text
  }

  if (Array.isArray(val)) {
    const mapped = val.map(extractJson).filter((v): v is string => Boolean(v))
    return mapped.length > 0 ? mapped.join('\n') : null
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if (obj.isError === true || obj.ok === false) {
      return null
    }

    for (const key of CONTENT_KEYS) {
      if (obj[key] !== undefined) {
        const res = extractJson(obj[key])
        if (res) return res
      }
    }

    if (obj.metadata && typeof obj.metadata === 'object') {
      return extractJson(obj.metadata)
    }
  }

  return null
}
