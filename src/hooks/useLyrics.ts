import { useEffect, useState, useCallback, useMemo } from 'react'
import { LyricsRepository } from '@/lyrics/lyricsRepository'
import type { LyricsSource, ProviderStatusMap, TrackMetadata } from '@/lyrics/types'
import type { Lyrics } from '@/schemas/track'
import { usePlayerStore } from '@/stores/playerStore'

export interface UseLyricsResult {
  lyrics: Lyrics | null
  isLoading: boolean
  isError: boolean
  currentSource: string | null
  providerStatuses: ProviderStatusMap
  selectProvider: (source: LyricsSource) => Promise<void>
}

export function useLyrics(trackId?: string | null): UseLyricsResult {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const activeTrackId = trackId || currentTrack?.id || ''

  const trackMetadata: TrackMetadata | null = useMemo(() => {
    if (!activeTrackId) return null
    if (currentTrack && currentTrack.id === activeTrackId) {
      return {
        id: currentTrack.id,
        title: currentTrack.title || '',
        artist: currentTrack.artist || '',
        album: currentTrack.album || null,
        durationSec: currentTrack.duration_sec || null,
      }
    }
    return {
      id: activeTrackId,
      title: '',
      artist: '',
    }
  }, [activeTrackId, currentTrack])

  const [lyrics, setLyrics] = useState<Lyrics | null>(() =>
    activeTrackId ? LyricsRepository.getCached(activeTrackId) : null
  )
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(activeTrackId && !LyricsRepository.getCached(activeTrackId))
  )
  const [isError, setIsError] = useState<boolean>(false)
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatusMap>(() =>
    activeTrackId ? LyricsRepository.getProviderStatuses(activeTrackId) : {}
  )

  useEffect(() => {
    if (!activeTrackId || !trackMetadata) {
      setLyrics(null)
      setIsLoading(false)
      setIsError(false)
      setProviderStatuses({})
      return
    }

    const cached = LyricsRepository.getCached(activeTrackId)
    if (cached) {
      setLyrics(cached)
      setIsLoading(false)
      setIsError(false)
      setProviderStatuses(LyricsRepository.getProviderStatuses(activeTrackId))
    } else {
      setIsLoading(true)
      setIsError(false)
    }

    const abortController = new AbortController()

    LyricsRepository.fetchLyrics(trackMetadata, abortController.signal)
      .then((res) => {
        if (abortController.signal.aborted) return
        setLyrics(res)
        setIsLoading(false)
        setIsError(!res)
        setProviderStatuses(LyricsRepository.getProviderStatuses(activeTrackId))
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setIsLoading(false)
        setIsError(true)
      })

    // Subscribe to live status updates (as slower background providers finish)
    const unsubscribe = LyricsRepository.subscribe(() => {
      setProviderStatuses(LyricsRepository.getProviderStatuses(activeTrackId))
      const latest = LyricsRepository.getCached(activeTrackId)
      if (latest) {
        setLyrics(latest)
      }
    })

    return () => {
      abortController.abort()
      unsubscribe()
    }
  }, [activeTrackId, trackMetadata])

  const selectProvider = useCallback(
    async (source: LyricsSource) => {
      if (!trackMetadata) return
      setIsLoading(true)
      try {
        const switched = await LyricsRepository.selectProvider(trackMetadata, source)
        if (switched) {
          setLyrics(switched)
          setIsError(false)
        }
      } catch {
        // Switch failed
      } finally {
        setIsLoading(false)
        setProviderStatuses(LyricsRepository.getProviderStatuses(trackMetadata.id))
      }
    },
    [trackMetadata]
  )

  return {
    lyrics,
    isLoading,
    isError,
    currentSource: lyrics?.source || null,
    providerStatuses,
    selectProvider,
  }
}
