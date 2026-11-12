import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usersApi } from '../../api/auth'
import { errorMessage } from '../../api/errors'
import { SessionsTable } from './SessionsTable'

/** Admin: every logged-in device of every user, with remote logout. */
export function DevicesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const sessions = useQuery({ queryKey: ['admin', 'sessions'], queryFn: () => usersApi.sessions(), refetchInterval: 60_000 })
  const revoke = useMutation({
    mutationFn: (id: string) => usersApi.revokeSession(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'sessions'] }),
  })

  const needle = filter.trim().toLowerCase()
  const list = (sessions.data ?? []).filter(
    (s) => !needle || [s.userName, s.userEmail, s.deviceName].some((v) => v.toLowerCase().includes(needle)),
  )

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{t('devices.title')}</h1>
          <p className="muted">{t('devices.help')}</p>
        </div>
      </div>
      <input type="search" className="search" placeholder={t('devices.filter')} aria-label={t('devices.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {(sessions.error || revoke.error) && <p className="alert">{errorMessage(sessions.error ?? revoke.error, t)}</p>}
      {sessions.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <>
          <p className="muted">{t('devices.count', { count: list.length })}</p>
          <SessionsTable
            sessions={list}
            showUser
            busy={revoke.isPending}
            onRevoke={(s) => window.confirm(t('devices.confirmLogout', { device: s.deviceName, name: s.userName })) && revoke.mutate(s.id)}
          />
        </>
      )}
    </section>
  )
}
