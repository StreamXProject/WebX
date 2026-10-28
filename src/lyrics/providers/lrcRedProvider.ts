import type { LyricLine } from '@/schemas/track'
import { safeFetchText } from '../lyricsHttp'
import { cleanTitle, cleanArtist, primaryArtist, normalizeInitials, ARTIST_SEPARATORS } from '../lyricsQuery'
import { parseTtml } from '../ttmlParser'

/**
 * lrc.red — Apple Music TTML with syllable-level timing filed by ISRC.
 * Ported from StreamXAndroid / BitChord LrcRedProvider.
 */

const BASE = 'https://lrc.red/'
const DURATION_TOLERANCE_SECONDS = 3.0
const ISRC_REGEX = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i
const BRACKETED = /[([][^)\]]*[)\]]/g
const COMBINING_MARKS = /[\u0300-\u036f]/g
const WHITESPACE = /\s+/g

const VERSION_WORDS = new Set([
  'live',
  'remix',
  'remixed',
  'mix',
  'acoustic',
  'unplugged',
  'instrumental',
  'karaoke',
  'cappella',
  'acapella',
  'demo',
  'edit',
  'version',
  'cover',
  'sped',
  'slowed',
  'reverb',
  'nightcore',
  'lofi',
  'orchestral',
  'extended',
])

interface Hit {
  isrc?: string | null
  title?: string | null
  artist?: string | null
  album?: string | null
  year?: number | null
  duration?: number | null
}

interface SearchResponse {
  hits?: Hit[] | null
}

export function documentUrl(isrc: string): string | null {
  const clean = isrc.trim().toUpperCase()
  return ISRC_REGEX.test(clean) ? `${BASE}s/${clean}.ttml` : null
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(WHITESPACE, ' ')
    .trim()
}

function coreOf(title: string): string {
  const withoutBracketed = title.replace(BRACKETED, ' ')
  const beforeDash = withoutBracketed.split(' - ')[0]
  const norm = normalized(beforeDash)
  return norm.length > 0 ? norm : normalized(title)
}

function versionOf(title: string): Set<string> {
  const bracketMatches = Array.from(title.matchAll(BRACKETED), (m) => m[0]).join(' ')
  const dashParts = title.split(' - ')
  const afterDash = dashParts.length > 1 ? dashParts.slice(1).join(' - ') : ''
  const extras = `${bracketMatches} ${afterDash}`
  const words = normalized(extras).split(' ')
  return new Set(words.filter((w) => VERSION_WORDS.has(w)))
}

function artistsOf(artist: string): Set<string> {
  const parts = artist.split(ARTIST_SEPARATORS)
  const set = new Set<string>()
  for (const raw of parts) {
    const norm = normalized(raw)
    const initials = normalized(normalizeInitials(raw))
    if (norm) set.add(norm)
    if (initials) set.add(initials)
  }
  return set
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

function bestHit(hits: Hit[], title: string, artist: string, durationMs: number): Hit | null {
  const wantedTitle = coreOf(title)
  const wantedVersion = versionOf(title)
  const wantedArtists = artistsOf(artist)
  const seconds = durationMs / 1000

  const distance = (hit: Hit): number => {
    return durationMs > 0 && typeof hit.duration === 'number' ? Math.abs(hit.duration - seconds) : 0
  }

  const matches = hits.filter((hit) => {
    const name = hit.title
    if (!name || !hit.isrc || !documentUrl(hit.isrc)) return false
    if (coreOf(name) !== wantedTitle) return false
    if (!setsEqual(versionOf(name), wantedVersion)) return false

    if (wantedArtists.size > 0) {
      const hitArtists = artistsOf(hit.artist || '')
      let hasOverlap = false
      for (const a of hitArtists) {
        if (wantedArtists.has(a)) {
          hasOverlap = true
          break
        }
      }
      if (!hasOverlap) return false
    }

    return distance(hit) <= DURATION_TOLERANCE_SECONDS
  })

  if (matches.length === 0) return null
  matches.sort((a, b) => distance(a) - distance(b))
  return matches[0]
}

async function fetchDocument(url: string, signal?: AbortSignal): Promise<LyricLine[] | null> {
  const body = await safeFetchText(url, { signal, timeoutMs: 5000 })
  if (!body) return null
  const lines = parseTtml(body)
  return lines.length > 0 ? lines : null
}

export async function search(
  title: string,
  artist: string,
  durationMs: number,
  signal?: AbortSignal
): Promise<Hit | null> {
  const primary = primaryArtist(artist)
  const queries: string[] = []
  const q1 = `${title} ${primary}`.trim()
  if (q1) queries.push(q1)

  const q2 = `${title} ${artist}`.trim()
  if (q2 && q2 !== q1) queries.push(q2)

  const q3 = title.trim()
  if (q3 && !queries.includes(q3)) queries.push(q3)

  for (const q of queries) {
    if (signal?.aborted) return null
    const url = `${BASE}search.json?q=${encodeURIComponent(q)}`
    const body = await safeFetchText(url, { signal, timeoutMs: 4000 })
    if (!body) continue

    try {
      const parsed: SearchResponse = JSON.parse(body)
      const hits = parsed.hits
      if (hits && hits.length > 0) {
        const hit = bestHit(hits, title, artist, durationMs)
        if (hit) return hit
      }
    } catch {
      // Continue to next query
    }
  }

  return null
}

export async function fetchLrcRed(
  title: string,
  artist: string,
  durationMs: number,
  isrc?: string | null,
  signal?: AbortSignal
): Promise<LyricLine[] | null> {
  const cleanT = cleanTitle(title)
  const cleanA = cleanArtist(artist)

  const knownUrl = isrc ? documentUrl(isrc) : null
  if (knownUrl) {
    const lines = await fetchDocument(knownUrl, signal)
    if (lines && lines.length > 0) return lines
  }

  const hit = await search(cleanT, cleanA, durationMs, signal)
  if (!hit || !hit.isrc) return null
  const foundUrl = documentUrl(hit.isrc)
  if (!foundUrl || foundUrl === knownUrl) return null

  return fetchDocument(foundUrl, signal)
}

