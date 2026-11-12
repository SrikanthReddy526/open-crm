import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ticketsApi, type TicketListParams } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import { OPEN_TICKET_STATUSES, TICKET_PRIORITIES, type TicketPriority } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { formatRelative } from '../../lib/format'

type View = 'open' | 'resolved' | 'all'

/** Ticket table, also embedded on the customer page (customerId given). */
export function TicketTable({ params }: { params: TicketListParams }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const tickets = useQuery({
    queryKey: ['tickets', 'list', params, page],
    queryFn: () => ticketsApi.list({ ...params, page, size: 20 }),
    placeholderData: keepPreviousData,
  })

  if (tickets.isPending) return <p className="muted">{t('common.loading')}</p>
  if (tickets.isError) return <p className="alert">{errorMessage(tickets.error, t)}</p>
  if (tickets.data.content.length === 0) return <p className="empty">{t('tickets.empty')}</p>

  return (
    <>
      <table className="table responsive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('fields.subject')}</th>
            {!params.customerId && <th>{t('fields.customer')}</th>}
            <th>{t('fields.status')}</th>
            <th>{t('fields.priority')}</th>
            <th>{t('tickets.assignedTo')}</th>
            <th>{t('tickets.opened')}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.data.content.map((tk) => (
            <tr key={tk.id} className="clickable" onClick={() => navigate(`/tickets/${tk.id}`)}>
              <td data-label="#">{tk.ticketNumber}</td>
              <td data-label={t('fields.subject')}>
                <Link to={`/tickets/${tk.id}`} onClick={(e) => e.stopPropagation()}>
                  {tk.subject}
                </Link>
              </td>
              {!params.customerId && <td data-label={t('fields.customer')}>{tk.customerName ?? '—'}</td>}
              <td data-label={t('fields.status')}>
                <Badge group="ticketStatus" value={tk.status} />
              </td>
              <td data-label={t('fields.priority')}>
                <Badge group="priority" value={tk.priority} />
              </td>
              <td data-label={t('tickets.assignedTo')}>{tk.assignedToName ?? <span className="muted">{t('tickets.unassigned')}</span>}</td>
              <td data-label={t('tickets.opened')}>{formatRelative(tk.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={tickets.data.page} totalPages={tickets.data.totalPages} onChange={setPage} />
    </>
  )
}

export function TicketListPage() {
  const { t } = useTranslation()
  const { user, hasRole } = useAuth()
  const isSupport = hasRole('ADMIN', 'SUPPORT_AGENT')
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'open'
  const priority = params.get('priority') as TicketPriority | null
  const mine = params.get('mine') === '1'
  const unassigned = params.get('unassigned') === '1'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [q, setQ] = useState(search)

  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(h)
  }, [search])

  const stats = useQuery({ queryKey: ['tickets', 'stats'], queryFn: ticketsApi.stats })

  function set(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  const listParams: TicketListParams = {
    q,
    status: view === 'open' ? OPEN_TICKET_STATUSES : view === 'resolved' ? ['RESOLVED', 'CLOSED'] : undefined,
    priority: priority ? [priority] : undefined,
    assignedTo: mine ? user?.id : undefined,
    unassigned: unassigned || undefined,
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t('tickets.title')}</h1>
        <div className="actions">
          <Link to="/tickets/new" className="btn btn-primary">
            + {t('tickets.new')}
          </Link>
        </div>
      </div>

      {stats.data && (
        <div className="chips">
          <span className="chip">{t('dashboard.openTickets')}: <strong>{stats.data.open}</strong></span>
          {TICKET_PRIORITIES.slice().reverse().map((p) => (
            <button
              key={p}
              type="button"
              className={`chip${priority === p ? ' active' : ''}`}
              onClick={() => set('priority', priority === p ? null : p)}
            >
              <Badge group="priority" value={p} /> {stats.data.openByPriority[p]}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <input type="search" className="search" placeholder={t('tickets.searchPlaceholder')} aria-label={t('tickets.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tabs" role="tablist">
          {(['open', 'resolved', 'all'] as View[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => set('view', v === 'open' ? null : v)}>
              {t(`tickets.views.${v}`)}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={mine} onChange={(e) => set('mine', e.target.checked ? '1' : null)} />
          {t('tickets.assignedToMe')}
        </label>
        {isSupport && (
          <label className="toggle">
            <input type="checkbox" checked={unassigned} onChange={(e) => set('unassigned', e.target.checked ? '1' : null)} />
            {t('tickets.unassigned')}
          </label>
        )}
      </div>

      {/* key: a new filter starts again at page 1 */}
      <TicketTable key={JSON.stringify(listParams)} params={listParams} />
    </section>
  )
}
