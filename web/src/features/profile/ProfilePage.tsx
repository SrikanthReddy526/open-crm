import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { errorMessage, getApiError } from '../../api/errors'
import type { Language, User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { SessionsTable } from '../admin/SessionsTable'

export function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null
  return (
    <section>
      <h1>{t('profile.title')}</h1>
      <div className="two-col">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
      <MyDevices />
    </section>
  )
}

function ProfileForm({ user }: { user: User }) {
  const { t, i18n } = useTranslation()
  const { updateUser } = useAuth()
  const [fullName, setFullName] = useState(user.fullName)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [language, setLanguage] = useState<Language>(user.preferredLanguage)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => authApi.updateMe({ fullName: fullName.trim(), phone: phone.trim() || null, preferredLanguage: language }),
    onSuccess: (u) => {
      updateUser(u)
      void i18n.changeLanguage(u.preferredLanguage)
    },
    onError: (err) => setFieldErrors(getApiError(err)?.fieldErrors ?? {}),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    save.mutate()
  }

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2>{t('profile.details')}</h2>
      {save.isError && <p className="alert">{errorMessage(save.error, t)}</p>}
      {save.isSuccess && <p className="success">{t('profile.saved')}</p>}
      <p className="muted">
        {user.email} · {t(`roles.${user.role}`)}
      </p>
      <label className="field">
        <span>{t('fields.fullName')}</span>
        <input maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        {fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}
      </label>
      <label className="field">
        <span>{t('fields.phone')}</span>
        <input type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        {fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}
      </label>
      <label className="field">
        <span>{t('language')}</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          <option value="te">తెలుగు</option>
          <option value="en">English</option>
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setRepeat('')
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (next.length < 8) return setLocalError(t('profile.passwordRule'))
    if (next !== repeat) return setLocalError(t('profile.passwordMismatch'))
    change.mutate()
  }

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2>{t('profile.changePassword')}</h2>
      {(localError || change.isError) && <p className="alert">{localError ?? errorMessage(change.error, t)}</p>}
      {change.isSuccess && <p className="success">{t('profile.passwordChanged')}</p>}
      <label className="field">
        <span>{t('profile.currentPassword')}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('fields.newPassword')}</span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <small className="muted">{t('profile.passwordRule')}</small>
      </label>
      <label className="field">
        <span>{t('profile.repeatPassword')}</span>
        <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={change.isPending || !current || !next}>
          {t('profile.changePassword')}
        </button>
      </div>
    </form>
  )
}

function MyDevices() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: authApi.sessions })
  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  })
  return (
    <div className="card">
      <h2>{t('profile.myDevices')}</h2>
      <p className="muted">{t('profile.devicesHelp')}</p>
      {(sessions.error || revoke.error) && <p className="alert">{errorMessage(sessions.error ?? revoke.error, t)}</p>}
      {sessions.data && (
        <SessionsTable sessions={sessions.data} busy={revoke.isPending} onRevoke={(s) => window.confirm(t('devices.confirmLogoutMine', { device: s.deviceName })) && revoke.mutate(s.id)} />
      )}
    </div>
  )
}
