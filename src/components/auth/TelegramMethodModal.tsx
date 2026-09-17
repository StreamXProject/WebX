import React from 'react'
import { AppWindow, ShieldCheck, Zap, MessageSquare } from 'lucide-react'
import { Dialog, Button } from '@/components/md3'
import { TelegramIcon } from '@/components/common/TelegramIcon'

export interface TelegramMethodModalProps {
  open: boolean
  onClose: () => void
  onSelectPopup: () => void
  onSelectRedirect: () => void
  onSelectBotApp?: () => void
  botUsername?: string
  waitingForBot?: boolean
  botDeepLink?: string
  onCancelWaiting?: () => void
}

export const TelegramMethodModal: React.FC<TelegramMethodModalProps> = ({
  open,
  onClose,
  onSelectPopup,
  onSelectRedirect,
  onSelectBotApp,
  botUsername,
  waitingForBot,
  botDeepLink,
  onCancelWaiting,
}) => {
  return (
    <Dialog
      open={open}
      onClose={waitingForBot && onCancelWaiting ? onCancelWaiting : onClose}
      size="md"
      icon={
        <div className="size-12 rounded-full bg-surface-container-high flex items-center justify-center text-[#2AABEE]">
          <TelegramIcon className="size-6" />
        </div>
      }
      title={waitingForBot ? 'Authorizing with Telegram' : 'Sign in with Telegram'}
      actions={
        <Button variant="text" size="md" onClick={waitingForBot && onCancelWaiting ? onCancelWaiting : onClose}>
          {waitingForBot ? 'Back' : 'Cancel'}
        </Button>
      }
    >
      {waitingForBot ? (
        <div className="flex flex-col items-center text-center py-3 space-y-4">
          <div className="size-16 rounded-full bg-[#2AABEE]/15 flex items-center justify-center text-[#2AABEE] animate-pulse">
            <TelegramIcon className="size-8" />
          </div>
          <div>
            <h3 className="type-title-md font-semibold text-on-surface">Waiting for confirmation</h3>
            <p className="type-body-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">
              Open the bot in Telegram and tap <strong className="text-on-surface font-semibold">Start</strong> to authorize this device.
            </p>
          </div>
          {botDeepLink && (
            <a
              href={botDeepLink}
              className="state-layer inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-on-primary type-label-md font-semibold shadow-md3-1 hover:shadow-md3-2 transition-all mt-1"
            >
              <TelegramIcon className="size-4" />
              Open Telegram App
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <p className="text-center type-body-md text-on-surface-variant pt-0.5 pb-4 px-2 leading-relaxed">
            {botUsername ? `Connect via @${botUsername}` : 'Choose how you would like to sign in'}
          </p>

          <div className="flex flex-col gap-3">
            {/* Option 1: Open Telegram App (Direct Bot Login, No Phone Number) */}
            {onSelectBotApp && (
              <div
                role="button"
                tabIndex={0}
                onClick={onSelectBotApp}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectBotApp()
                  }
                }}
                className="group relative w-full text-left p-4 rounded-2xl state-layer transition-all duration-200 cursor-pointer bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-md3-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-[#2AABEE]/15 text-[#2AABEE] flex items-center justify-center shrink-0">
                      <TelegramIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="type-title-md text-on-surface font-semibold">Open Telegram App</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full type-label-sm font-semibold bg-[#2AABEE]/20 text-[#2AABEE] shrink-0">
                    1-Tap App
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-outline-variant/30">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container text-primary type-label-sm font-medium">
                    <Zap className="size-3.5" /> Direct in-app
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant type-label-sm font-medium">
                    <MessageSquare className="size-3.5" /> Bot confirmation
                  </span>
                </div>
              </div>
            )}

            {/* Option 2: Instant Popup (Recommended Web) */}
            <div
              role="button"
              tabIndex={0}
              onClick={onSelectPopup}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPopup()
                }
              }}
              className="group relative w-full text-left p-4 rounded-2xl state-layer transition-all duration-200 cursor-pointer bg-surface-container-high hover:bg-surface-container-highest border border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-md3-1"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <AppWindow className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="type-title-md text-on-surface font-semibold">Telegram OAuth</h3>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full type-label-sm font-semibold bg-primary text-on-primary shrink-0">
                  Recommended
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-outline-variant/30">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container text-primary type-label-sm font-medium">
                  <Zap className="size-3.5" /> Instant session
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant type-label-sm font-medium">
                  <ShieldCheck className="size-3.5" /> Official Telegram SDK
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

