import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { syncNow, syncStatusStore } from '../offline/sync'

export function useSyncStatus() {
  return useSyncExternalStore(syncStatusStore.subscribe, syncStatusStore.get)
}

/** Small header chip: offline / syncing / N changes waiting / problems. Tapping it syncs now. */
export function SyncIndicator() {
  const { t } = useTranslation()
  const s = useSyncStatus()

  let label: string
  let tone: string
  if (!s.online) {
    label = s.pending ? t('sync.offlinePending', { count: s.pending }) : t('sync.offline')
    tone = 'warn'
  } else if (s.syncing) {
    label = t('sync.syncing')
    tone = 'info'
  } else if (s.pending) {
    label = t('sync.pending', { count: s.pending })
    tone = 'warn'
  } else {
    label = t('sync.synced')
    tone = 'ok'
  }

  return (
    <span className="sync-indicator">
      <button
        type="button"
        className={`badge badge-${tone} sync-chip`}
        onClick={() => void syncNow()}
        title={s.lastSyncAt ? t('sync.lastSync', { time: new Date(s.lastSyncAt).toLocaleTimeString() }) : t('sync.never')}
      >
        {!s.online ? '⚡' : s.syncing ? '⟳' : s.pending ? '⏳' : '✓'} <span className="sync-label">{label}</span>
      </button>
      {s.notices > 0 && (
        <Link to="/sync" className="badge badge-danger" title={t('sync.problemsHelp')}>
          ⚠ {s.notices}
        </Link>
      )}
    </span>
  )
}
