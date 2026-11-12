import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { dashboardApi, remindersApi } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { formatDateTime, formatMoney, formatNumber, formatToday } from '../../lib/format'
import { localReminders } from '../../offline/local'
import { withOfflineFallback } from '../customers/hooks'

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary })
  const today = useQuery({
    queryKey: ['reminders', 'dashboard'],
    queryFn: () =>
      withOfflineFallback(
        () => remindersApi.list({ status: 'PENDING', due: 'WEEK', size: 8 }),
        () => localReminders('WEEK', false, 0, 8),
      ),
  })

  const s = summary.data
  const maxStage = Math.max(1, ...(s?.pipeline.map((p) => p.totalAmount) ?? [1]))

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{t('dashboard.greeting', { name: user?.fullName.split(' ')[0] ?? '' })}</h1>
          <p className="muted">{formatToday()}</p>
        </div>
        <div className="actions">
          <Link to="/visits/new" className="btn btn-primary">
            📍 {t('visits.log')}
          </Link>
          <Link to="/tickets/new" className="btn">
            + {t('tickets.new')}
          </Link>
          <Link to="/leads/new" className="btn">
            + {t('leads.new')}
          </Link>
        </div>
      </div>

      {summary.isError && <p className="alert">{errorMessage(summary.error, t)}</p>}

      <div className="stats">
        <Stat to="/reminders?due=OVERDUE" label={t('dashboard.overdue')} value={s?.remindersOverdue} tone={s?.remindersOverdue ? 'danger' : undefined} />
        <Stat to="/reminders?due=TODAY" label={t('dashboard.dueToday')} value={s?.remindersToday} />
        <Stat to="/tickets" label={t('dashboard.openTickets')} value={s?.openTickets} sub={s?.urgentTickets ? t('dashboard.urgent', { count: s.urgentTickets }) : undefined} tone={s?.urgentTickets ? 'warn' : undefined} />
        <Stat to="/tickets?mine=1" label={t('dashboard.myTickets')} value={s?.myOpenTickets} />
        <Stat to="/deals" label={t('dashboard.pipeline')} value={s ? formatMoney(s.pipelineValue, 'INR', true) : undefined} sub={s ? t('dashboard.openDeals', { count: s.pipelineCount }) : undefined} />
        <Stat to="/deals?stage=WON" label={t('dashboard.wonThisMonth')} value={s ? formatMoney(s.wonThisMonth, 'INR', true) : undefined} sub={s ? t('dashboard.deals', { count: s.wonThisMonthCount }) : undefined} tone="ok" />
        <Stat to="/leads" label={t('dashboard.newLeads')} value={s?.newLeadsThisWeek} />
        <Stat to="/visits" label={t('dashboard.visitsToday')} value={s?.visitsToday} />
        <Stat to="/customers" label={t('nav.customers')} value={s?.customers} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <h2>{t('dashboard.upcoming')}</h2>
            <Link to="/reminders">{t('common.viewAll')}</Link>
          </div>
          {today.isPending ? (
            <p className="muted">{t('common.loading')}</p>
          ) : today.data?.content.length ? (
            <ul className="list">
              {today.data.content.map((r) => (
                <li key={r.id} className={new Date(r.dueAt) < new Date() ? 'overdue' : ''}>
                  <div>
                    <strong>{r.title}</strong>
                    {r.customerName && <span className="muted"> · {r.customerName}</span>}
                  </div>
                  <small className="muted">{formatDateTime(r.dueAt)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('reminders.nothingDue')}</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>{t('dashboard.pipelineByStage')}</h2>
            <Link to="/deals?view=board">{t('common.viewAll')}</Link>
          </div>
          {s ? (
            <ul className="bars">
              {s.pipeline.map((p) => (
                <li key={p.stage}>
                  <span className="bar-label">{t(`dealStage.${p.stage}`)}</span>
                  <span className="bar-track">
                    <span className={`bar-fill stage-${p.stage}`} style={{ width: `${(p.totalAmount / maxStage) * 100}%` }} />
                  </span>
                  <span className="bar-value">
                    {formatMoney(p.totalAmount, 'INR', true)} <small className="muted">({formatNumber(p.count)})</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{summary.isPending ? t('common.loading') : '—'}</p>
          )}
        </div>
      </div>
    </section>
  )
}

function Stat({ to, label, value, sub, tone }: { to: string; label: string; value?: number | string; sub?: string; tone?: string }) {
  return (
    <Link to={to} className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value === undefined ? '…' : typeof value === 'number' ? formatNumber(value) : value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </Link>
  )
}
