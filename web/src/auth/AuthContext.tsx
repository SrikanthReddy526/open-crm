import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/auth'
import { onSessionExpired } from '../api/client'
import { tokenStore } from '../api/tokenStore'
import type { Role, User } from '../api/types'
import i18n from '../i18n'
import { deleteLocalData } from '../offline/db'
import { attachQueryClient, startSync, stopSync } from '../offline/sync'
import { deviceName } from '../platform'

interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  /** Logs out this device and deletes its offline copy of the data. */
  logout: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
  /** Call after the profile was changed on the server. */
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // Restore the session instantly from storage; the access token is fetched on the first API call.
  const [user, setUser] = useState<User | null>(() => (tokenStore.getRefresh() ? tokenStore.getUser() : null))

  useEffect(() => attachQueryClient(queryClient), [queryClient])

  useEffect(
    () =>
      onSessionExpired(() => {
        // Keep the offline data: unsent changes are sent after the next login.
        stopSync()
        setUser(null)
        queryClient.clear()
      }),
    [queryClient],
  )

  // Refresh the profile (role or name may have changed). Ignore network errors (offline start).
  useEffect(() => {
    if (!tokenStore.getRefresh()) return
    startSync()
    authApi
      .me()
      .then((u) => {
        tokenStore.setUser(u)
        setUser(u)
      })
      .catch(() => {})
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password, deviceName())
    tokenStore.save(res)
    setUser(res.user)
    if (res.user.preferredLanguage && res.user.preferredLanguage !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(res.user.preferredLanguage)
    }
    startSync()
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.getRefresh()
    const userId = tokenStore.getUser()?.id
    stopSync()
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
    if (refreshToken) authApi.logout(refreshToken).catch(() => {})
    if (userId) await deleteLocalData(userId).catch(() => {})
  }, [queryClient])

  const updateUser = useCallback((u: User) => {
    tokenStore.setUser(u)
    setUser(u)
  }, [])

  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user])

  const value = useMemo(
    () => ({ user, login, logout, hasRole, updateUser }),
    [user, login, logout, hasRole, updateUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
