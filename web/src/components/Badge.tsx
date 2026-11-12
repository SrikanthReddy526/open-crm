import { useTranslation } from 'react-i18next'

const TONES: Record<string, string> = {
  // tickets
  OPEN: 'info',
  IN_PROGRESS: 'warn',
  ON_HOLD: 'muted',
  RESOLVED: 'ok',
  CLOSED: 'muted',
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warn',
  URGENT: 'danger',
  // leads
  NEW: 'info',
  CONTACTED: 'warn',
  QUALIFIED: 'ok',
  UNQUALIFIED: 'muted',
  CONVERTED: 'ok',
  // deals
  PROSPECTING: 'info',
  PROPOSAL: 'info',
  NEGOTIATION: 'warn',
  WON: 'ok',
  LOST: 'danger',
  // reminders / visits
  PENDING: 'warn',
  DONE: 'ok',
  CANCELLED: 'muted',
  MET: 'ok',
  NOT_AVAILABLE: 'muted',
  RESCHEDULED: 'warn',
  ORDER_TAKEN: 'ok',
  ISSUE_REPORTED: 'danger',
}

/** Coloured label for a status/priority/stage value; the text comes from `${group}.${value}` in the translations. */
export function Badge({ group, value }: { group: string; value: string | null | undefined }) {
  const { t } = useTranslation()
  if (!value) return <span className="muted">—</span>
  return <span className={`badge badge-${TONES[value] ?? 'muted'}`}>{t(`${group}.${value}`)}</span>
}

/** "Not synced yet" label for records saved offline. */
export function PendingBadge() {
  const { t } = useTranslation()
  return (
    <span className="badge badge-warn" title={t('sync.pendingHelp')}>
      ⏳ {t('sync.notSynced')}
    </span>
  )
}
