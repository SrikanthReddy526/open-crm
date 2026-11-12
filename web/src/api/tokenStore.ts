import type { AuthResponse, User } from './types'

// The access token lives only in memory (short-lived, 15 min).
// The refresh token and user profile are persisted so the session survives app restarts.
// Native builds can later swap localStorage for @capacitor/preferences / Electron safeStorage.
const REFRESH_KEY = 'crm.refreshToken'
const USER_KEY = 'crm.user'

let accessToken: string | null = null

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode) — session lasts until the tab closes */
  }
}

export const tokenStore = {
  getAccess: () => accessToken,
  // Always read from storage: another tab may have rotated the token.
  getRefresh: () => read(REFRESH_KEY),
  getUser(): User | null {
    const raw = read(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },
  setUser(user: User) {
    write(USER_KEY, JSON.stringify(user))
  },
  save(res: AuthResponse) {
    accessToken = res.accessToken
    write(REFRESH_KEY, res.refreshToken)
    write(USER_KEY, JSON.stringify(res.user))
  },
  clear() {
    accessToken = null
    write(REFRESH_KEY, null)
    write(USER_KEY, null)
  },
}
