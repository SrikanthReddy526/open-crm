import { useTranslation } from 'react-i18next'
import type { Session } from '../../api/types'
import { formatDateTime, formatRelative } from '../../lib/format'

function deviceIcon(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('android') || n.includes('ios') || n.includes('iphone')) return '📱'
  if (n.includes('desktop')) return '🖥️'
  return '🌐'
}

/** Logged-in devices with a "log out" button per row. */
export function SessionsTable({
  sessions,
  showUser,
  onRevoke,
  busy,
}: {
  sessions: Session[]
  showUser?: boolean
  onRevoke: (s: Session) => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  if (sessions.length === 0) return <p className="empty">{t('devices.none')}</p>
  return (
    <table className="table responsive-table">
      <thead>
        <tr>
          {showUser && <th>{t('devices.user')}</th>}
          <th>{t('devices.device')}</th>
          <th>{t('devices.since')}</th>
          <th>{t('devices.lastActive')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id}>
            {showUser && (
              <td data-label={t('devices.user')}>
                <strong>{s.userName}</strong>
                <div className="muted small">{s.userEmail}</div>
              </td>
            )}
            <td data-label={t('devices.device')}>
              {deviceIcon(s.deviceName)} {s.deviceName}
              {s.current && <span className="badge badge-ok"> {t('devices.thisDevice')}</span>}
            </td>
            <td data-label={t('devices.since')}>{formatDateTime(s.startedAt)}</td>
            <td data-label={t('devices.lastActive')}>{formatRelative(s.lastActiveAt)}</td>
            <td>
              {!s.current && (
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => onRevoke(s)}>
                  {t('devices.logOut')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
