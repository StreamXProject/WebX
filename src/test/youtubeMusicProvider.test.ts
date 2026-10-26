import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchYouTubeMusic, fetchLyricsForVideoId } from '@/lyrics/providers/youtubeMusicProvider'
import * as lyricsHttpMod from '@/lyrics/lyricsHttp'

describe('YouTubeMusicProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('correctly parses next and browse payloads to extract lyrics lines', async () => {
    const mockNext = {
      contents: {
        singleColumnMusicWatchNextResultsRenderer: {
          tabbedRenderer: {
            watchNextTabbedResultsRenderer: {
              tabs: [
                {
                  tabRenderer: {
                    title: { runs: [{ text: 'Up next' }] },
                  },
                },
                {
                  tabRenderer: {
                    title: { runs: [{ text: 'Lyrics' }] },
                    endpoint: {
                      browseEndpoint: {
                        browseId: 'MPLYt_mock_123',
                        params: 'param_abc',
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }

    const mockBrowse = {
      contents: {
        sectionListRenderer: {
          contents: [
            {
              musicDescriptionShelfRenderer: {
                description: {
                  runs: [
                    { text: 'Line 1 of lyrics\n' },
                    { text: 'Line 2 of lyrics\nLine 3 of lyrics' },
                  ],
                },
              },
            },
          ],
        },
      },
    }

    const spyFetch = vi.spyOn(lyricsHttpMod, 'safeFetchText')
    spyFetch.mockImplementation(async (url: string) => {
      if (url.includes('/next')) return JSON.stringify(mockNext)
      if (url.includes('/browse')) return JSON.stringify(mockBrowse)
      return null
    })

    const lines = await fetchLyricsForVideoId('u8FkYqjlcLg')
    expect(lines).toBeDefined()
    expect(lines).toHaveLength(3)
    expect(lines?.[0].text).toBe('Line 1 of lyrics')
    expect(lines?.[1].text).toBe('Line 2 of lyrics')
    expect(lines?.[2].text).toBe('Line 3 of lyrics')
  })

  it('searches with query fallbacks and priority extraction of videoId', async () => {
    const mockSearch = {
      contents: {
        tabbedSearchResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        musicShelfRenderer: {
                          contents: [
                            {
                              musicResponsiveListItemRenderer: {
                                playlistItemData: {
                                  videoId: 'u8FkYqjlcLg',
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }

    const mockNext = {
      contents: {
        tabbedResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                title: { text: 'Lyrics' },
                browseEndpoint: {
                  browseId: 'MPLYt_wTIbZHLBSG4-8',
                },
              },
            },
          ],
        },
      },
    }

    const mockBrowse = {
      shelf: {
        musicDescriptionShelfRenderer: {
          description: {
            simpleText: 'আজ নয় গুন গুন গুঞ্জন প্রেমে\nচাঁদ ফুল জোছনার গান আর নয়',
          },
        },
      },
    }

    const spyFetch = vi.spyOn(lyricsHttpMod, 'safeFetchText')
    spyFetch.mockImplementation(async (url: string) => {
      if (url.includes('/search')) return JSON.stringify(mockSearch)
      if (url.includes('/next')) return JSON.stringify(mockNext)
      if (url.includes('/browse')) return JSON.stringify(mockBrowse)
      return null
    })

    const lines = await fetchYouTubeMusic('Aaj Noy Gun Gun Gunjon Preme', 'Nandita')
    expect(lines).toBeDefined()
    expect(lines).toHaveLength(2)
    expect(lines?.[0].text).toBe('আজ নয় গুন গুন গুঞ্জন প্রেমে')
    expect(lines?.[1].text).toBe('চাঁদ ফুল জোছনার গান আর নয়')
  })

  it('returns null if track has no lyrics tab in YouTube Music', async () => {
    const mockNextWithoutLyrics = {
      contents: {
        tabbedResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                title: { text: 'Up next' },
              },
            },
            {
              tabRenderer: {
                title: { text: 'Related' },
              },
            },
          ],
        },
      },
    }

    vi.spyOn(lyricsHttpMod, 'safeFetchText').mockResolvedValue(JSON.stringify(mockNextWithoutLyrics))

    const lines = await fetchLyricsForVideoId('12345678901')
    expect(lines).toBeNull()
  })
})

