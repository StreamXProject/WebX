import { describe, it, expect } from 'vitest'
import {
  cleanTitle,
  cleanArtist,
  normalizeInitials,
  primaryArtist,
  splitArtists,
} from '@/lyrics/lyricsQuery'

describe('LyricsQuery engine', () => {
  it('cleans packaging noise from titles while preserving version identifiers', () => {
    expect(cleanTitle('Blinding Lights (Official Music Video)')).toBe('Blinding Lights')
    expect(cleanTitle('Starboy (feat. Daft Punk)')).toBe('Starboy')
    expect(cleanTitle('Stay [ft. Justin Bieber]')).toBe('Stay')
    expect(cleanTitle('Shape of You [Official Lyric Video]')).toBe('Shape of You')

    // Version and recording identity indicators MUST be preserved
    expect(cleanTitle('Numb (Live in Texas)')).toBe('Numb (Live in Texas)')
    expect(cleanTitle('Levitating (Remix)')).toBe('Levitating (Remix)')
    expect(cleanTitle('Creep (Acoustic)')).toBe('Creep (Acoustic)')
    expect(cleanTitle('Midnight City (Sped Up)')).toBe('Midnight City (Sped Up)')
  })

  it('cleans and normalizes artist names', () => {
    expect(cleanArtist('The Weeknd - Topic')).toBe('The Weeknd')
    expect(cleanArtist('K.K.')).toBe('KK')
    expect(cleanArtist('K. K.')).toBe('KK')
    expect(cleanArtist('A.R. Rahman')).toBe('AR Rahman')
    expect(cleanArtist('A. R. Rahman')).toBe('AR Rahman')
  })

  it('extracts primary artist and splits collaborations', () => {
    const multi = 'K.K., Suzanne, Chirrantan Bhatt'
    expect(primaryArtist(multi)).toBe('KK')
    expect(splitArtists(multi)).toEqual(['KK', 'Suzanne', 'Chirrantan Bhatt'])

    const feat = 'Taylor Swift feat. Post Malone'
    expect(primaryArtist(feat)).toBe('Taylor Swift')
    expect(splitArtists(feat)).toEqual(['Taylor Swift', 'Post Malone'])
  })
})
