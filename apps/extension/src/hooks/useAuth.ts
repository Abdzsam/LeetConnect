import { useState, useEffect, useCallback } from 'react'

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
  return chrome.runtime.sendMessage(message) as Promise<ServiceWorkerResponse>
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const checkAuth = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const signIn = useCallback(async () => {
    setState({ status: 'loading' })
    const res = await send({ type: 'INITIATE_GOOGLE_AUTH' })
    if (res.ok) {
      await checkAuth()
    } else {
      setState({ status: 'unauthenticated' })
    }
  }, [checkAuth])

  const signOut = useCallback(async () => {
    setState({ status: 'loading' })
    await send({ type: 'LOGOUT' })
    setState({ status: 'unauthenticated' })
  }, [])

  return { state, signIn, signOut, refresh: checkAuth }
}
