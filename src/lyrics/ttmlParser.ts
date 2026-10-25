import type { LyricLine, LyricWordSpan } from '@/schemas/track'

/**
 * Robust parser for Apple Music TTML (Timed Text Markup Language) format.
 * Ported from StreamXAndroid / BitChord TtmlLyricsParser engine.
 *
 * TTML documents contain `<p>` elements per sung line, each holding one or more `<span>`
 * elements per syllable with `begin` and `end` clock values. Adjacent spans without whitespace
 * comprise a single word, while whitespace separates words.
 */

const SKIPPED_ROLES = new Set(['x-translation', 'x-roman'])
const BACKGROUND_ROLE = 'x-bg'

interface ParsedWord {
  startMs: number
  endMs: number
  text: string
}

type Piece =
  | { type: 'text'; text: string }
  | { type: 'timed'; text: string; startMs: number; endMs: number }

export function parseTime(value?: string | null): number | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  if (raw.toLowerCase().endsWith('ms')) {
    const ms = parseFloat(raw.slice(0, -2))
    return Number.isFinite(ms) ? ms : null
  }

  const stripped = raw.replace(/s$/i, '')
  const parts = stripped.split(':')
  let seconds: number | null = null

  if (parts.length === 1) {
    const s = parseFloat(parts[0])
    if (Number.isFinite(s)) seconds = s
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0])
    const s = parseFloat(parts[1])
    if (Number.isFinite(m) && Number.isFinite(s)) seconds = m * 60 + s
  } else if (parts.length === 3) {
    const h = parseFloat(parts[0])
    const m = parseFloat(parts[1])
    const s = parseFloat(parts[2])
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
      seconds = h * 3600 + m * 60 + s
    }
  }

  return seconds !== null ? Math.round(seconds * 1000) : null
}

function mergeIntoWords(pieces: Piece[]): ParsedWord[] {
  const words: ParsedWord[] = []
  let current = ''
  let start = 0
  let end = 0
  let timed = false

  const flush = () => {
    const text = current.trim()
    current = ''
    if (text.length > 0 && timed) {
      words.push({ startMs: start, endMs: end, text })
    }
    timed = false
  }

  for (const piece of pieces) {
    if (piece.type === 'text') {
      if (!piece.text.trim()) {
        flush()
      } else if (timed) {
        current += piece.text
      }
    } else {
      if (!piece.text.trim()) continue
      if (/^\s/.test(piece.text)) flush()
      if (current.length === 0) start = piece.startMs
      current += piece.text.trim()
      end = piece.endMs
      timed = true
      if (/\s$/.test(piece.text)) flush()
    }
  }
  flush()
  return words
}

function parseParagraphDom(p: Element): LyricLine | null {
  const pieces: Piece[] = []
  const backingPieces: Piece[] = []

  const collect = (node: Node, out: Piece[], backing: Piece[]) => {
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 1 /* ELEMENT_NODE */) {
        const el = child as Element
        const role = el.getAttribute('ttm:role') || el.getAttribute('role')
        if (role && SKIPPED_ROLES.has(role)) continue

        const sink = role === BACKGROUND_ROLE ? backing : out
        const begin = parseTime(el.getAttribute('begin'))
        const end = parseTime(el.getAttribute('end'))

        const hasTimedChild = Array.from(el.childNodes).some(
          (c) => c.nodeType === 1 && ((c as Element).getAttribute('begin') || (c as Element).getAttribute('end'))
        )

        if (begin !== null && end !== null && !hasTimedChild) {
          sink.push({
            type: 'timed',
            text: el.textContent || '',
            startMs: begin,
            endMs: end,
          })
        } else {
          collect(el, sink, backing)
        }
      } else if (child.nodeType === 3 /* TEXT_NODE */) {
        const text = child.textContent || ''
        if (text) out.push({ type: 'text', text })
      }
    }
  }

  collect(p, pieces, backingPieces)

  const words = mergeIntoWords(pieces)
  const pBeginMs = parseTime(p.getAttribute('begin'))
  const pEndMs = parseTime(p.getAttribute('end'))

  if (words.length === 0) {
    const text = (p.textContent || '').trim()
    if (!text || pBeginMs === null) return null
    const timeSec = pBeginMs / 1000
    const durSec = pEndMs !== null && pEndMs > pBeginMs ? (pEndMs - pBeginMs) / 1000 : 0
    return { time: timeSec, duration: durSec, text, spans: undefined }
  }

  const firstWordStartMs = words[0].startMs
  const lastWordEndMs = words[words.length - 1].endMs
  const lineStartMs = pBeginMs !== null ? Math.min(pBeginMs, firstWordStartMs) : firstWordStartMs
  const lineEndMs = pEndMs !== null && pEndMs > lineStartMs ? Math.max(pEndMs, lastWordEndMs) : lastWordEndMs

  const spans: LyricWordSpan[] = words.map((w) => ({
    time: w.startMs / 1000,
    duration: Math.max(0.05, (w.endMs - w.startMs) / 1000),
    text: w.text,
  }))

  const fullText = words.map((w) => w.text).join(' ')
  const timeSec = lineStartMs / 1000
  const durSec = Math.max(0.2, (lineEndMs - lineStartMs) / 1000)

  return {
    time: timeSec,
    duration: durSec,
    text: fullText,
    spans: spans.length > 0 ? spans : undefined,
  }
}

/**
 * Regex-based fallback parser for environments where DOMParser is unavailable (such as Node.js test runners).
 */
function parseParagraphRegex(pAttrs: string, pBody: string): LyricLine | null {
  const beginMatch = pAttrs.match(/\bbegin=["']([^"']+)["']/i)
  const endMatch = pAttrs.match(/\bend=["']([^"']+)["']/i)
  const pBeginMs = parseTime(beginMatch ? beginMatch[1] : null)
  const pEndMs = parseTime(endMatch ? endMatch[1] : null)

  const pieces: Piece[] = []
  const spanRegex = /<span\b([^>]*)>([\s\S]*?)<\/span>|([^<]+)/gi
  let match: RegExpExecArray | null

  while ((match = spanRegex.exec(pBody)) !== null) {
    if (match[1] !== undefined) {
      const spanAttrs = match[1]
      const spanText = match[2].replace(/<[^>]+>/g, '')
      const sBegin = parseTime(spanAttrs.match(/\bbegin=["']([^"']+)["']/i)?.[1])
      const sEnd = parseTime(spanAttrs.match(/\bend=["']([^"']+)["']/i)?.[1])
      const role = spanAttrs.match(/\b(?:ttm:)?role=["']([^"']+)["']/i)?.[1]

      if (role && SKIPPED_ROLES.has(role)) continue

      if (sBegin !== null && sEnd !== null) {
        pieces.push({
          type: 'timed',
          text: spanText,
          startMs: sBegin,
          endMs: sEnd,
        })
      } else if (spanText) {
        pieces.push({ type: 'text', text: spanText })
      }
    } else if (match[3]) {
      pieces.push({ type: 'text', text: match[3] })
    }
  }

  const words = mergeIntoWords(pieces)

  if (words.length === 0) {
    const text = pBody.replace(/<[^>]+>/g, '').trim()
    if (!text || pBeginMs === null) return null
    const timeSec = pBeginMs / 1000
    const durSec = pEndMs !== null && pEndMs > pBeginMs ? (pEndMs - pBeginMs) / 1000 : 0
    return { time: timeSec, duration: durSec, text, spans: undefined }
  }

  const firstWordStartMs = words[0].startMs
  const lastWordEndMs = words[words.length - 1].endMs
  const lineStartMs = pBeginMs !== null ? Math.min(pBeginMs, firstWordStartMs) : firstWordStartMs
  const lineEndMs = pEndMs !== null && pEndMs > lineStartMs ? Math.max(pEndMs, lastWordEndMs) : lastWordEndMs

  const spans: LyricWordSpan[] = words.map((w) => ({
    time: w.startMs / 1000,
    duration: Math.max(0.05, (w.endMs - w.startMs) / 1000),
    text: w.text,
  }))

  const fullText = words.map((w) => w.text).join(' ')
  const timeSec = lineStartMs / 1000
  const durSec = Math.max(0.2, (lineEndMs - lineStartMs) / 1000)

  return {
    time: timeSec,
    duration: durSec,
    text: fullText,
    spans: spans.length > 0 ? spans : undefined,
  }
}

export function parseTtml(ttml: string): LyricLine[] {
  if (!ttml || !ttml.trim()) return []

  const lines: LyricLine[] = []

  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(ttml, 'application/xml')
      const paragraphs = doc.getElementsByTagName('p')
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i]
        const line = parseParagraphDom(p)
        if (line) lines.push(line)
      }
    } else {
      const pRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
      let match: RegExpExecArray | null
      while ((match = pRegex.exec(ttml)) !== null) {
        const line = parseParagraphRegex(match[1], match[2])
        if (line) lines.push(line)
      }
    }
  } catch {
    return []
  }

  lines.sort((a, b) => a.time - b.time)

  // Ensure sensible line durations
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    if (!cur.duration || cur.duration <= 0) {
      const nextTime = i + 1 < lines.length ? lines[i + 1].time : cur.time + 4.5
      cur.duration = Math.max(0.5, Math.min(nextTime - cur.time, 7.0))
    }
  }

  return lines
}
