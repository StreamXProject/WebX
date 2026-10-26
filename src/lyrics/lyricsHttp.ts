/**
 * Safe fetch helper for client-side lyrics provider calls.
 * Implements fast timeouts (default 5s) and automatic AbortSignal bridging so
 * slow or hanging third-party providers never stall UI rendering or playback.
 */

export async function safeFetchText(
  url: string,
  options?: {
    method?: string
    body?: string
    headers?: Record<string, string>
    signal?: AbortSignal
    timeoutMs?: number
  }
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 5000
  const controller = new AbortController()

  const onParentAbort = () => controller.abort()
  if (options?.signal) {
    if (options.signal.aborted) return null
    options.signal.addEventListener('abort', onParentAbort)
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: options?.method || (options?.body ? 'POST' : 'GET'),
      body: options?.body,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, application/xml, */*',
        ...options?.headers,
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    if (options?.signal) {
      options.signal.removeEventListener('abort', onParentAbort)
    }
  }
}

