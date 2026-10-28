/**
 * Sanitizes track titles and artist names for lyrics provider queries.
 * Ported from StreamXAndroid / BitChord LyricsQuery engine.
 *
 * Music tracks frequently carry packaging noise like "(Official Music Video)",
 * "[MV]", "(feat. ...)", which cause exact database queries to miss.
 *
 * Crucially, recording identity indicators such as "(Remix)", "(Live)", "(Acoustic)",
 * "(Remastered)", "(Sped Up)" are preserved because stripping them would retrieve
 * lyrics for the wrong version of the song.
 */

const WHITESPACE = /\s+/g

export const ARTIST_SEPARATORS = /\s*(?:,|&|;|\/|\s+and\s+|\s+x\s+|\s+with\s+|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i

const CREDITS: RegExp[] = [
  // Bracketed credits: (feat. X), [ft. X], (with X).
  /\s*[(\[]\s*(feat|ft|featuring|with)\b[^)\]]*[)\]]/gi,
  // Unbracketed credits running to the end of the title
  /\s+(feat|ft|featuring)\.?\s+.*$/gi,
  // Upload / media packaging tags
  /\s*[(\[]\s*(official\s*)?(music\s*)?(video|audio|visuali[sz]er|lyrics?\s*video|lyrics?|m\/?v|hd|hq|4k|full\s*song)\s*[)\]]/gi,
  /\s*[(\[]\s*official\s*[)\]]/gi,
]

export function cleanTitle(title: string): string {
  if (!title) return ''
  let name = title
  for (const pattern of CREDITS) {
    name = name.replace(pattern, ' ')
  }
  const cleaned = name
    .replace(WHITESPACE, ' ')
    .trim()
    .replace(/[,–—-]$/, '')
    .trim()
  return cleaned.length > 0 ? cleaned : title.trim()
}

export function normalizeInitials(name: string): string {
  if (!name) return ''
  let n = name.replace(/\b([A-Za-z])\.([A-Za-z])\./g, '$1$2')
  n = n.replace(/\b([A-Za-z])\.\s+([A-Za-z])\./g, '$1$2')
  n = n.replace(/\b([A-Za-z])\.(?=\s|$)/g, '$1')
  return n.trim()
}

export function cleanArtist(artist: string): string {
  if (!artist) return ''
  const withoutTopic = artist.endsWith(' - Topic') ? artist.slice(0, -' - Topic'.length) : artist
  const normalized = normalizeInitials(withoutTopic).replace(WHITESPACE, ' ').trim()
  return normalized.length > 0 ? normalized : artist.trim()
}

export function primaryArtist(artist: string): string {
  const cleaned = cleanArtist(artist)
  const parts = cleaned.split(ARTIST_SEPARATORS).map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts[0] : cleaned
}

export function splitArtists(artist: string): string[] {
  const cleaned = cleanArtist(artist)
  return cleaned
    .split(ARTIST_SEPARATORS)
    .map((p) => p.trim())
    .filter(Boolean)
}
