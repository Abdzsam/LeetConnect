import { useState, useEffect, useCallback, useRef } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: AuthUser }

type ServiceWorkerResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string }

async function send(message: object): Promise<ServiceWorkerResponse> {
  try {
    return (await chrome.runtime.sendMessage(message)) as ServiceWorkerResponse
  } catch {
    return { ok: false, error: 'Service worker unavailable' }
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const checkAuth = useCallback(async () => {
    stopPoll()
    const statusRes = await send({ type: 'GET_AUTH_STATUS' })
    if (!statusRes.ok) {
      setState({ status: 'unauthenticated' })
      return
    }
    const statusData = statusRes.data as { authenticated: boolean } | undefined
    if (!statusData?.authenticated) {
      setState({ status: 'unauthenticated' })
      return
    }
    const userRes = await send({ type: 'GET_USER' })
    if (userRes.ok && userRes.data) {
      setState({ status: 'authenticated', user: userRes.data as AuthUser })
    } else {
      setState({ status: 'unauthenticated' })
    }
  }, [stopPoll])

  // Initial auth check
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Reactively sync when another context (e.g. the popup) signs in or out
  useEffect(() => {
    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('accessToken' in changes) {
        checkAuth()
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [checkAuth])

  const signIn = useCallback(async () => {
    setState({ status: 'loading' })
    const res = await send({ type: 'INITIATE_GOOGLE_AUTH' })

    if (!res.ok) {
      setState({ status: 'unauthenticated' })
      return
    }

    const data = res.data as { pending?: boolean } | undefined
    if (!data?.pending) {
      // Popup flow: OAuth completed synchronously
      await checkAuth()
      return
    }

    // Tab-based flow: a real browser tab opened; poll until storage is updated
    const start = Date.now()
    const MAX_WAIT = 10 * 60 * 1000 // 10 minutes
    pollRef.current = setInterval(async () => {
      if (Date.now() - start > MAX_WAIT) {
        stopPoll()
        setState({ status: 'unauthenticated' })
        return
      }
      const statusRes = await send({ type: 'GET_AUTH_STATUS' })
      if (statusRes.ok && (statusRes.data as { authenticated?: boolean } | undefined)?.authenticated) {
        stopPoll()
        await checkAuth()
      }
    }, 1500)
  }, [checkAuth, stopPoll])

  const signOut = useCallback(async () => {
    stopPoll()
    setState({ status: 'loading' })
    await send({ type: 'LOGOUT' })
    setState({ status: 'unauthenticated' })
  }, [stopPoll])

  return { state, signIn, signOut, refresh: checkAuth }
}
