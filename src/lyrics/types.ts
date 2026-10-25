import type { LyricLine, Lyrics } from '@/schemas/track'

export type LyricsSource =
  | 'lrc.red'
  | 'binilyrics'
  | 'betterlyrics'
  | 'paxsenix'
  | 'lrclib'
  | 'kugou'
  | 'ytmusic'
  | 'streamx'

export interface LyricsSourceInfo {
  id: LyricsSource
  label: string
  wordSynced: boolean
  description: string
}

export const ALL_LYRICS_SOURCES: LyricsSourceInfo[] = [
  { id: 'lrc.red', label: 'lrc.red', wordSynced: true, description: 'Apple Music TTML via ISRC' },
  { id: 'binilyrics', label: 'BiniLyrics', wordSynced: true, description: 'Apple Music TTML with recording ID' },
  { id: 'betterlyrics', label: 'BetterLyrics', wordSynced: true, description: 'Apple Music syllable sync (Boidu)' },
  { id: 'paxsenix', label: 'PaxSenix', wordSynced: true, description: 'Apple Music public TTML proxy' },
  { id: 'lrclib', label: 'LRCLIB', wordSynced: false, description: 'Open community line-synced LRC' },
  { id: 'kugou', label: 'KuGou', wordSynced: false, description: 'Global & regional line-synced LRC' },
  { id: 'ytmusic', label: 'YouTube Music', wordSynced: false, description: 'Official YouTube Music lyrics' },
  { id: 'streamx', label: 'StreamX', wordSynced: false, description: 'StreamX backend lyrics server' },
]

export interface ProviderResult {
  source: LyricsSource
  lines: LyricLine[]
  isWordSynced: boolean
}

export interface TrackMetadata {
  id: string
  title: string
  artist: string
  album?: string | null
  durationSec?: number | null
}

export type ProviderStatusMap = Partial<Record<LyricsSource, boolean>>

