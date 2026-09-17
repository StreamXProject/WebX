export interface TelegramLoginUser {
  id: number
  name?: string
  first_name?: string
  last_name?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  username?: string
  picture?: string
  photo_url?: string
}

export interface TelegramLoginResult {
  id_token?: string
  user?: TelegramLoginUser
  error?: string
}

export interface TelegramLoginInitOptions {
  client_id: number
  scope?: string[]
  lang?: string
  nonce?: string
  request_access?: string[]
}

export interface TelegramWebUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    query_id?: string
    user?: TelegramWebUser
    auth_date?: number
    hash?: string
    start_param?: string
  }
  version?: string
  platform?: string
  colorScheme?: 'light' | 'dark'
  themeParams?: Record<string, string>
  isExpanded?: boolean
  viewportHeight?: number
  viewportStableHeight?: number
  headerColor?: string
  backgroundColor?: string
  ready: () => void
  expand: () => void
  close: () => void
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
}

declare global {
  interface Window {
    __tg_open_patched?: boolean
    Telegram?: {
      Login?: {
        init: (
          options: TelegramLoginInitOptions,
          callback: (data: TelegramLoginResult) => void
        ) => void
        open: () => void
        auth?: (options: TelegramLoginInitOptions, callback: (data: TelegramLoginResult) => void) => void
        close?: () => void
      }
      WebApp?: TelegramWebApp
    }
  }
}

export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.Telegram?.WebApp && window.Telegram.WebApp.initData && window.Telegram.WebApp.initData.length > 0)
}

export function getTelegramMiniAppUser(): TelegramWebUser | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null
}

export function patchTelegramLoginPopup(): void {
  if (typeof window === 'undefined') return
  if (window.__tg_open_patched) return
  window.__tg_open_patched = true

  const originalOpen = window.open
  window.open = function (url?: string | URL, target?: string, features?: string) {
    if (url) {
      try {
        const rawUrl = typeof url === 'string' ? url : url.toString()
        if (rawUrl.includes('oauth.telegram.org/auth') && !rawUrl.includes('origin=')) {
          const originParam = `origin=${encodeURIComponent(window.location.origin)}`
          const separator = rawUrl.includes('?') ? '&' : '?'
          url = `${rawUrl}${separator}${originParam}`
        }
      } catch {
        // Fall through to original
      }
    }
    return originalOpen.call(window, url, target, features)
  }
}

let loadPromise: Promise<void> | null = null

export function loadTelegramLoginScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  patchTelegramLoginPopup()
  if (window.Telegram?.Login) return Promise.resolve()

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="telegram-login.js"]')
    if (existing) {
      if (window.Telegram?.Login) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Telegram login library')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-login.js?6'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Telegram login library from telegram.org'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

