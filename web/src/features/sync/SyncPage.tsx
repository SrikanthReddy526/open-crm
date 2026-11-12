import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { OutboxEntry, SyncNotice } from '../../offline/db'
import { currentDb, syncNow } from '../../offline/sync'
import { useSyncStatus } from '../../components/SyncIndicator'
import { formatDateTime } from '../../lib/format'

const LINKS: Record<string, string> = { customer: '/customers/', visit: '/visits', reminder: '/reminders' }

/** Offline status: changes still waiting to be sent, and changes the server did not accept. */
export function SyncPage() {
  const { t } = useTranslation()
  const status = useSyncStatus()
  const [outbox, setOutbox] = useState<OutboxEntry[]>([])
  const [notices, setNotices] = useState<SyncNotice[]>([])

  useEffect(() => {
    const db = currentDb()
    if (!db) return
    void db.outbox.orderBy('seq').toArray().then(setOutbox)
    void db.notices.orderBy('seq').reverse().toArray().then(setNotices)
  }, [status.pending, status.notices, status.lastSyncAt])

  async function dismiss(seq?: number) {
    const db = currentDb()
    if (!db) return
    if (seq === undefined) await db.notices.clear()
    else await db.notices.delete(seq)
    setNotices(await db.notices.orderBy('seq').reverse().toArray())
    void syncNow()
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{t('sync.title')}</h1>
          <p className="muted">
            {status.online ? t('sync.online') : t('sync.offline')} ·{' '}
            {status.lastSyncAt ? t('sync.lastSync', { time: formatDateTime(status.lastSyncAt) }) : t('sync.never')}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => void syncNow()} disabled={status.syncing || !status.online}>
            ⟳ {status.syncing ? t('sync.syncing') : t('sync.syncNow')}
          </button>
        </div>
      </div>
      {status.lastError && <p className="alert">{status.lastError}</p>}

      <div className="card">
        <h2>{t('sync.waiting', { count: outbox.length })}</h2>
        {outbox.length === 0 ? (
          <p className="muted">{t('sync.allSent')}</p>
        ) : (
          <ul className="list">
            {outbox.map((e) => (
              <li key={e.seq}>
                <span className="grow">
                  {t(`sync.ops.${e.op}`)} {t(`sync.entities.${e.entity}`)}: <strong>{String(e.data?.name ?? e.data?.title ?? e.data?.customerName ?? '')}</strong>
                </span>
                <small className="muted">{formatDateTime(e.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{t('sync.problems')}</h2>
          {notices.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => void dismiss()}>
              {t('sync.dismissAll')}
            </button>
          )}
        </div>
        {notices.length === 0 ? (
          <p className="muted">{t('sync.noProblems')}</p>
        ) : (
          <ul className="list">
            {notices.map((n) => (
              <li key={n.seq}>
                <div className="grow">
                  <strong>{n.label}</strong>{' '}
                  <span className={`badge badge-${n.status === 'CONFLICT' ? 'warn' : 'danger'}`}>{t(`sync.status.${n.status}`)}</span>
                  <div className="small">{n.message}</div>
                  <small className="muted">
                    {formatDateTime(n.at)}
                    {n.entity === 'customer' && (
                      <>
                        {' · '}
                        <Link to={LINKS.customer + n.recordId}>{t('map.open')}</Link>
                      </>
                    )}
                  </small>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => void dismiss(n.seq)}>
                  {t('sync.dismiss')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{t('sync.conflictHelp')}</p>
      </div>
    </section>
  )
}
