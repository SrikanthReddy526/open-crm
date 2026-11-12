import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import type { ReminderListParams } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import type { Reminder, ReminderDue } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { PendingBadge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { formatDateTime, formatRelative } from '../../lib/format'
import { alertsSupported } from '../../offline/alerts'
import { ReminderDialog } from './ReminderDialog'
import { useCompleteReminder, useDeleteReminder, useReminders } from './hooks'

type Tab = ReminderDue | 'DONE'
const TABS: Tab[] = ['OVERDUE', 'TODAY', 'WEEK', 'UPCOMING', 'DONE']

function snoozeTimes(): { key: string; at: Date }[] {
  const inAnHour = new Date(Date.now() + 3600_000)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const nextWeek = new Date(tomorrow.getTime() + 6 * 86400_000)
  return [
    { key: 'hour', at: inAnHour },
    { key: 'tomorrow', at: tomorrow },
    { key: 'week', at: nextWeek },
  ]
}

/** Reminder rows with Done / Snooze / Edit. Used on its own page and inside customer/lead/deal pages. */
export function ReminderList({ params, emptyText }: { params: ReminderListParams; emptyText?: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const reminders = useReminders({ ...params, page, size: 20 })
  const actions = useCompleteReminder()
  const remove = useDeleteReminder()

  if (reminders.isPending) return <p className="muted">{t('common.loading')}</p>
  if (reminders.isError) return <p className="alert">{errorMessage(reminders.error, t)}</p>

  return (
    <>
      {reminders.data.offline && <p className="offline-note">{t('sync.showingSaved')}</p>}
      {actions.isError && <p className="alert">{errorMessage(actions.error, t)}</p>}
      {reminders.data.content.length === 0 ? (
        <p className="empty">{emptyText ?? t('reminders.nothingDue')}</p>
      ) : (
        <ul className="list reminders">
          {reminders.data.content.map((r) => {
            const overdue = r.status === 'PENDING' && new Date(r.dueAt) < new Date()
            return (
              <li key={r.id} className={overdue ? 'overdue' : ''}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={r.status === 'DONE'}
                    onChange={() => void (r.status === 'DONE' ? actions.reopen(r) : actions.complete(r))}
                    aria-label={t('reminders.markDone')}
                  />
                </label>
                <div className="grow">
                  <div className={r.status === 'DONE' ? 'done-text' : ''}>
                    <strong>{r.title}</strong> {r.pending && <PendingBadge />}
                  </div>
                  <small className={overdue ? 'warning' : 'muted'}>
                    {formatDateTime(r.dueAt)} · {formatRelative(r.dueAt)}
                    {r.customerName && (
                      <>
                        {' · '}
                        <Link to={`/customers/${r.customerId}`}>{r.customerName}</Link>
                      </>
                    )}
                    {r.leadId && (
                      <>
                        {' · '}
                        <Link to={`/leads/${r.leadId}`}>{t('nav.leads')}</Link>
                      </>
                    )}
                    {r.dealId && (
                      <>
                        {' · '}
                        <Link to={`/deals/${r.dealId}`}>{t('nav.deals')}</Link>
                      </>
                    )}
                    {params.everyone && r.assignedToName && ` · ${r.assignedToName}`}
                  </small>
                  {r.description && <p className="pre-wrap small">{r.description}</p>}
                </div>
                <div className="row-actions">
                  {r.status === 'PENDING' && (
                    <select
                      aria-label={t('reminders.snooze')}
                      value=""
                      onChange={(e) => {
                        const choice = snoozeTimes().find((s) => s.key === e.target.value)
                        if (choice) void actions.snooze(r, choice.at)
                      }}
                    >
                      <option value="">⏰ {t('reminders.snooze')}</option>
                      {snoozeTimes().map((s) => (
                        <option key={s.key} value={s.key}>
                          {t(`reminders.snoozeOptions.${s.key}`)}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(r)}>
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => window.confirm(t('reminders.confirmDelete')) && remove.mutate(r.id)}
                    aria-label={t('common.delete')}
                  >
                    🗑
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Pagination page={reminders.data.page} totalPages={reminders.data.totalPages} onChange={setPage} />
      {editing && <ReminderDialog reminder={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function ReminderListPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('due') as Tab) ? params.get('due') : 'WEEK') as Tab
  const everyone = params.get('everyone') === '1'
  const [creating, setCreating] = useState(false)
  const [permission, setPermission] = useState(() => (alertsSupported ? Notification.permission : 'denied'))

  const listParams: ReminderListParams =
    tab === 'DONE' ? { status: 'DONE', due: 'ALL', everyone } : { status: 'PENDING', due: tab, everyone }

  function set(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t('reminders.title')}</h1>
        <div className="actions">
          {hasRole('ADMIN', 'SUPPORT_AGENT') && (
            <label className="toggle">
              <input type="checkbox" checked={everyone} onChange={(e) => set('everyone', e.target.checked ? '1' : null)} />
              {t('reminders.everyone')}
            </label>
          )}
          {permission === 'default' && (
            <button type="button" className="btn" onClick={() => void Notification.requestPermission().then(setPermission)}>
              🔔 {t('reminders.enableNotifications')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + {t('reminders.new')}
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'active' : ''} onClick={() => set('due', x)}>
            {t(`reminders.tabs.${x}`)}
          </button>
        ))}
      </div>
      <ReminderList key={`${tab}-${everyone}`} params={listParams} />
      {creating && <ReminderDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
