import axios from 'axios'
import type { TFunction } from 'i18next'

/** Error body sent by the Spring Boot API (message is already in the user's language). */
export interface ApiError {
  status: number
  code: string
  message: string
  fieldErrors: Record<string, string>
}

export function getApiError(err: unknown): ApiError | null {
  if (!axios.isAxiosError(err)) return null
  const data: unknown = err.response?.data
  if (data && typeof data === 'object' && 'message' in data && 'code' in data) {
    return data as ApiError
  }
  return null
}

export function errorMessage(err: unknown, t: TFunction): string {
  const apiError = getApiError(err)
  if (apiError) return apiError.message
  // No response (offline) or a gateway error (proxy/nginx up, API down) → "cannot reach the server"
  if (axios.isAxiosError(err) && (!err.response || [502, 503, 504].includes(err.response.status))) {
    return t('errors.network')
  }
  return t('errors.generic')
}
