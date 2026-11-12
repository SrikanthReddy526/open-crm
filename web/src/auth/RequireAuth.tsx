import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { useAuth } from './AuthContext'

/** Redirects to /login when signed out; optionally restricts to some roles. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, hasRole } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !hasRole(...roles)) return <p className="alert">{t('common.notAllowed')}</p>
  return <>{children}</>
}
