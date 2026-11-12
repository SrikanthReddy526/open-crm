import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { usersApi } from '../../api/auth'
import { errorMessage, getApiError } from '../../api/errors'
import type { Language, Role, User } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Dialog } from '../../components/Dialog'

const ROLES: Role[] = ['ADMIN', 'SUPPORT_AGENT', 'FIELD_STAFF']

export function UsersPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: usersApi.list })
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [filter, setFilter] = useState('')

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['users', 'lookup'] })
  }
  const toggle = useMutation({
    mutationFn: (u: User) => usersApi.setActive(u.id, !u.active),
    onSuccess: refresh,
  })

  const needle = filter.trim().toLowerCase()
  const list = (users.data ?? []).filter((u) => !needle || [u.fullName, u.email, u.phone ?? ''].some((v) => v.toLowerCase().includes(needle)))

  return (
    <section>
      <div className="page-header">
        <h1>{t('users.title')}</h1>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            + {t('users.new')}
          </button>
        </div>
      </div>
      <input type="search" className="search" placeholder={t('users.filter')} aria-label={t('users.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {(users.error || toggle.error) && <p className="alert">{errorMessage(users.error ?? toggle.error, t)}</p>}
      {users.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <table className="table responsive-table">
          <thead>
            <tr>
              <th>{t('fields.name')}</th>
              <th>{t('fields.email')}</th>
              <th>{t('users.role')}</th>
              <th>{t('language')}</th>
              <th>{t('fields.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'inactive'}>
                <td data-label={t('fields.name')}>
                  <strong>{u.fullName}</strong>
                  {u.phone && <div className="muted small">{u.phone}</div>}
                </td>
                <td data-label={t('fields.email')}>{u.email}</td>
                <td data-label={t('users.role')}>{t(`roles.${u.role}`)}</td>
                <td data-label={t('language')}>{u.preferredLanguage === 'te' ? 'తెలుగు' : 'English'}</td>
                <td data-label={t('fields.status')}>
                  <span className={`badge badge-${u.active ? 'ok' : 'muted'}`}>{u.active ? t('users.active') : t('users.inactive')}</span>
                </td>
                <td className="row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(u)}>
                    {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setResetting(u)}>
                    {t('users.resetPassword')}
                  </button>
                  {u.id !== me?.id && (
                    <button
                      type="button"
                      className={`btn ${u.active ? 'btn-danger' : ''}`}
                      disabled={toggle.isPending}
                      onClick={() => (!u.active || window.confirm(t('users.confirmDeactivate', { name: u.fullName }))) && toggle.mutate(u)}
                    >
                      {u.active ? t('users.deactivate') : t('users.activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <UserDialog user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </section>
  )
}

function UserDialog({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: (user?.role ?? 'FIELD_STAFF') as Role,
    preferredLanguage: (user?.preferredLanguage ?? 'te') as Language,
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const input = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        preferredLanguage: form.preferredLanguage,
      }
      return user ? usersApi.update(user.id, input) : usersApi.create({ ...input, password: form.password })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (err) => setFieldErrors(getApiError(err)?.fieldErrors ?? {}),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }
  const err = (k: string) => fieldErrors[k] && <small className="field-error">{fieldErrors[k]}</small>

  return (
    <Dialog title={user ? t('users.edit') : t('users.new')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {save.isError && <p className="alert">{errorMessage(save.error, t)}</p>}
        <label className="field">
          <span>{t('fields.fullName')} *</span>
          <input autoFocus maxLength={150} value={form.fullName} onChange={set('fullName')} />
          {err('fullName')}
        </label>
        <label className="field">
          <span>{t('fields.email')} *</span>
          <input type="email" maxLength={255} value={form.email} onChange={set('email')} />
          {err('email')}
        </label>
        {!user && (
          <label className="field">
            <span>{t('login.password')} *</span>
            <input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set('password')} />
            <small className="muted">{t('profile.passwordRule')}</small>
            {err('password')}
          </label>
        )}
        <div className="grid">
          <label className="field">
            <span>{t('fields.phone')}</span>
            <input type="tel" maxLength={30} value={form.phone} onChange={set('phone')} />
            {err('phone')}
          </label>
          <label className="field">
            <span>{t('users.role')}</span>
            <select value={form.role} onChange={set('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('language')}</span>
            <select value={form.preferredLanguage} onChange={set('preferredLanguage')}>
              <option value="te">తెలుగు</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <p className="muted small">{t(`users.roleHelp.${form.role}`)}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const reset = useMutation({ mutationFn: () => usersApi.resetPassword(user.id, password) })

  return (
    <Dialog title={t('users.resetPasswordFor', { name: user.fullName })} onClose={onClose}>
      {reset.isSuccess ? (
        <>
          <p className="success">{t('users.passwordReset')}</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            reset.mutate()
          }}
        >
          <p className="muted">{t('users.resetHelp')}</p>
          {reset.isError && <p className="alert">{errorMessage(reset.error, t)}</p>}
          <label className="field">
            <span>{t('fields.newPassword')}</span>
            <input type="text" autoComplete="off" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <small className="muted">{t('profile.passwordRule')}</small>
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={reset.isPending || password.length < 8}>
              {t('users.resetPassword')}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
