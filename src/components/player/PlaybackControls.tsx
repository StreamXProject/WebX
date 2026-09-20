import React, { useEffect, useState } from 'react'
import { SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react'
import { PlayPauseIcon } from './PlayPauseIcon'
import { usePlayerStore } from '@/stores/playerStore'
import { useQueueStore } from '@/stores/queueStore'
import { IconButton } from '@/components/md3'
import { cn } from '@/lib/cn'


function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) {
      setShown(false)
      return
    }
    const t = window.setTimeout(() => setShown(true), delayMs)
    return () => window.clearTimeout(t)
  }, [flag, delayMs])
  return shown
}

/** Shuffle / prev / play / next / repeat — shared by the bar and the full player */
export const PlaybackControls: React.FC<{ size?: 'sm' | 'lg'; className?: string }> = ({ size = 'sm', className }) => {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const hasTrack = usePlayerStore((s) => Boolean(s.currentTrack))
  const isShuffle = useQueueStore((s) => s.isShuffle)
  const repeatMode = useQueueStore((s) => s.repeatMode)
  const nextTrack = useQueueStore((s) => s.nextTrack)
  const previousTrack = useQueueStore((s) => s.previousTrack)
  const toggleShuffle = useQueueStore((s) => s.toggleShuffle)
  const cycleRepeatMode = useQueueStore((s) => s.cycleRepeatMode)
  const lg = size === 'lg'
  const showSpinner = useDelayedFlag(isBuffering, 350)

  return (
    <div className={cn('flex items-center justify-center', lg ? 'gap-3 sm:gap-5' : 'gap-1.5', className)}>
      <IconButton label="Shuffle" selected={isShuffle} size={lg ? 'lg' : 'md'} onClick={toggleShuffle}>
        <Shuffle />
      </IconButton>
      <IconButton label="Previous" size={lg ? 'lg' : 'md'} onClick={() => void previousTrack()} disabled={!hasTrack} className="text-on-surface">
        <SkipBack className="fill-current" />
      </IconButton>
      <button
        onClick={togglePlay}
        disabled={!hasTrack}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        data-playing={isPlaying}
        className={cn(
          'play-toggle state-layer relative inline-flex items-center justify-center rounded-lg bg-primary text-on-primary shadow-md3-1 disabled:opacity-40',
          lg ? 'size-16 sm:size-[72px]' : 'size-12'
        )}
      >
        <PlayPauseIcon isPlaying={isPlaying} className={lg ? 'size-8' : 'size-6'} />
        {showSpinner && (
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-[inherit] border-2 border-on-primary/25 border-t-on-primary animate-spin pointer-events-none',
              lg ? 'border-[3px]' : 'border-2'
            )}
          />
        )}
      </button>
      <IconButton label="Next" size={lg ? 'lg' : 'md'} onClick={() => void nextTrack()} disabled={!hasTrack} className="text-on-surface">
        <SkipForward className="fill-current" />
      </IconButton>
      <IconButton label={`Repeat: ${repeatMode}`} selected={repeatMode !== 'off'} size={lg ? 'lg' : 'md'} onClick={cycleRepeatMode}>
        {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
      </IconButton>
    </div>
  )
}
