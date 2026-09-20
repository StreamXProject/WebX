import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface PlayPauseIconProps {
  isPlaying: boolean
  className?: string
  /** Transition duration in ms (default: 180ms) */
  durationMs?: number
}

export const PLAY_PATH = 'M 6,20 L 12.5,16 L 12.5,8 L 6,4 Z M 12.5,16 L 19,12 L 19,12 L 12.5,8 Z'
export const PAUSE_PATH = 'M 6,20 L 10,20 L 10,4 L 6,4 Z M 15,20 L 19,20 L 19,4 L 15,4 Z'

/**
 * Returns interpolated SVG path for progress p (0 = Play, 1 = Pause).
 * Both shapes share identical 4-point sub-path structure.
 */
function interpolatePlayPausePath(p: number): string {
  if (p <= 0) return PLAY_PATH
  if (p >= 1) return PAUSE_PATH

  const p1x = (12.5 - 2.5 * p).toFixed(2)
  const p1y = (16 + 4 * p).toFixed(2)
  const p2y = (8 - 4 * p).toFixed(2)

  const r0x = (12.5 + 2.5 * p).toFixed(2)
  const r1y = (12 + 8 * p).toFixed(2)
  const r2y = (12 - 8 * p).toFixed(2)

  return `M 6,20 L ${p1x},${p1y} L ${p1x},${p2y} L 6,4 Z M ${r0x},${p1y} L 19,${r1y} L 19,${r2y} L ${r0x},${p2y} Z`
}

/** Natural ease-out curve (settles smoothly, starts immediately) */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * YouTube-style morphing Play/Pause icon.
 * Seamlessly morphs the SVG geometry between the Play triangle and Pause bars
 * over ~180ms using high-performance requestAnimationFrame interpolation.
 */
export const PlayPauseIcon: React.FC<PlayPauseIconProps> = ({
  isPlaying,
  className,
  durationMs = 180,
}) => {
  const targetProgress = isPlaying ? 1 : 0
  const progressRef = useRef(targetProgress)
  const [path, setPath] = useState(() => interpolatePlayPausePath(targetProgress))
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const startProgress = progressRef.current
    const delta = targetProgress - startProgress
    if (Math.abs(delta) < 0.001) return

    const startTime = performance.now()
    let rafId: number

    const tick = (now: number) => {
      const elapsed = now - startTime
      const rawT = Math.min(1, Math.max(0, elapsed / durationMs))
      const easedT = easeOutQuad(rawT)
      const current = startProgress + delta * easedT

      progressRef.current = current
      setPath(interpolatePlayPausePath(current))

      if (rawT < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        progressRef.current = targetProgress
        setPath(targetProgress === 1 ? PAUSE_PATH : PLAY_PATH)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, targetProgress, durationMs])

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0 pointer-events-none select-none', className)}
      aria-hidden="true"
    >
      <path
        d={path}
        className="fill-current stroke-current"
        style={{
          strokeWidth: 1,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }}
      />
    </svg>
  )
}

