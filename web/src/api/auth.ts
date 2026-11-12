import { api } from './client'
import type { AuthResponse, Language, Session, User, UserInput, UserLookup } from './types'

export const authApi = {
  login: (email: string, password: string, deviceName: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password, deviceName }).then((r) => r.data),
  logout: (refreshToken: string) => api.post('/api/auth/logout', { refreshToken }),
  me: () => api.get<User>('/api/auth/me').then((r) => r.data),
  updateMe: (body: { fullName: string; phone: string | null; preferredLanguage: Language }) =>
    api.patch<User>('/api/auth/me', body).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/api/auth/me/password', { currentPassword, newPassword }),
  sessions: () => api.get<Session[]>('/api/auth/sessions').then((r) => r.data),
  revokeSession: (id: string) => api.delete(`/api/auth/sessions/${id}`),
}

export const usersApi = {
  lookup: () => api.get<UserLookup[]>('/api/users/lookup').then((r) => r.data),
  list: () => api.get<User[]>('/api/users').then((r) => r.data),
  create: (input: UserInput) => api.post<User>('/api/users', input).then((r) => r.data),
  update: (id: string, input: UserInput) => api.put<User>(`/api/users/${id}`, input).then((r) => r.data),
  setActive: (id: string, active: boolean) =>
    api.patch<User>(`/api/users/${id}/active`, { active }).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) => api.post(`/api/users/${id}/reset-password`, { newPassword }),
  sessions: (userId?: string) =>
    api.get<Session[]>('/api/users/sessions', { params: userId ? { userId } : {} }).then((r) => r.data),
  revokeSession: (sessionId: string) => api.delete(`/api/users/sessions/${sessionId}`),
  revokeAllSessions: (userId: string) => api.delete(`/api/users/${userId}/sessions`),
}
