import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '../config'
import i18n from '../i18n'
import { tokenStore } from './tokenStore'
import type { AuthResponse } from './types'

/** Authenticated client used by the whole app. */
export const api = axios.create({ baseURL: API_URL, timeout: 30_000 })

/** Bare client for the refresh call (must not trigger the interceptors below). */
const bare = axios.create({ baseURL: API_URL, timeout: 30_000 })

const expiredListeners = new Set<() => void>()

/** Called when the session can no longer be refreshed (user must log in again). */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

let refreshing: Promise<string | null> | null = null

/** Gets a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= doRefresh(0).finally(() => {
    refreshing = null
  })
  return refreshing
}

async function doRefresh(attempt: number): Promise<string | null> {
  const used = tokenStore.getRefresh()
  if (!used) return null
  try {
    const { data } = await bare.post<AuthResponse>('/api/auth/refresh', { refreshToken: used })
    tokenStore.save(data)
    return data.accessToken
  } catch (err) {
    // Offline / server unreachable: keep the session, the caller will see a network error.
    if (axios.isAxiosError(err) && !err.response) throw err
    // Another tab may have rotated the refresh token in the meantime: retry with the newest one.
    const latest = tokenStore.getRefresh()
    if (latest && latest !== used && attempt < 2) return doRefresh(attempt + 1)
    tokenStore.clear()
    expiredListeners.forEach((l) => l())
    return null
  }
}

api.interceptors.request.use(async (config) => {
  let token = tokenStore.getAccess()
  if (!token && tokenStore.getRefresh()) {
    token = await refreshAccessToken().catch(() => null)
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['Accept-Language'] = i18n.resolvedLanguage ?? 'en'
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    if (error.response?.status === 401 && original && !original._retried && tokenStore.getRefresh()) {
      original._retried = true
      const token = await refreshAccessToken().catch(() => null)
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)
