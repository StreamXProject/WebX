import React from 'react'
import { Check, X, Sparkles, AudioLines } from 'lucide-react'
import { ALL_LYRICS_SOURCES, type LyricsSource, type ProviderStatusMap } from '@/lyrics/types'
import { cn } from '@/lib/cn'

interface LyricsProviderDialogProps {
  isOpen: boolean
  currentSource: string | null
  providerStatuses: ProviderStatusMap
  onSelectProvider: (source: LyricsSource) => void
  onClose: () => void
}

export const LyricsProviderDialog: React.FC<LyricsProviderDialogProps> = ({
  isOpen,
  currentSource,
  providerStatuses,
  onSelectProvider,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#18161E] border border-outline-variant/20 rounded-3xl p-6 shadow-2xl text-on-surface overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
          <div>
            <h2 className="type-title-md font-bold text-on-surface">Lyrics Provider</h2>
            <p className="type-body-sm text-on-surface-variant/80 mt-0.5">
              Select dynamic provider for current track
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-container-highest/50 text-on-surface-variant transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5 mt-4 max-h-[60vh] overflow-y-auto pr-1">
          {ALL_LYRICS_SOURCES.map((source) => {
            const isAvailable = providerStatuses[source.id]
            const isSelected =
              currentSource === source.id ||
              currentSource?.toLowerCase() === source.label.toLowerCase()

            const isDisabled = isAvailable === false

            return (
              <button
                key={source.id}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onSelectProvider(source.id)
                    onClose()
                  }
                }}
                className={cn(
                  'w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left',
                  isSelected
                    ? 'bg-primary/10 border-primary/40 text-on-surface'
                    : isDisabled
                      ? 'bg-surface-container-low/20 border-outline-variant/5 text-on-surface-variant/40 opacity-50 cursor-not-allowed'
                      : 'bg-[#1E1C24]/80 border-outline-variant/15 hover:border-primary/30 hover:bg-surface-container-high/60 cursor-pointer'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-semibold type-title-sm', isSelected && 'text-primary')}>
                      {source.label}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase',
                        source.wordSynced
                          ? 'bg-primary/15 text-primary border border-primary/25'
                          : 'bg-surface-container-highest text-on-surface-variant/80'
                      )}
                    >
                      {source.wordSynced ? (
                        <>
                          <Sparkles className="size-2.5" />
                          Syllable
                        </>
                      ) : (
                        <>
                          <AudioLines className="size-2.5" />
                          Line
                        </>
                      )}
                    </span>
                  </div>
                  <span className="type-body-xs text-on-surface-variant/70">
                    {source.description}
                  </span>
                </div>

                <div className="flex items-center pl-3">
                  {isAvailable === true ? (
                    <div className="size-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <Check className="size-3.5 stroke-[2.5]" />
                    </div>
                  ) : isAvailable === false ? (
                    <div className="size-6 rounded-full bg-rose-500/10 text-rose-400/50 flex items-center justify-center">
                      <X className="size-3.5 stroke-[2.5]" />
                    </div>
                  ) : (
                    <span className="type-label-sm text-on-surface-variant/40">...</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
