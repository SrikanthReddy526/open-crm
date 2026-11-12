import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/errors'
import { Badge, PendingBadge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { formatDateTime } from '../../lib/format'
import { mapUrl } from '../../platform/location'
import { useVisits } from './hooks'

/** Visit history: everyone's (support/admin) or mine (field staff); filtered by customer when given. */
export function VisitList({ customerId, showCustomer = true }: { customerId?: string; showCustomer?: boolean }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const visits = useVisits({ customerId, page, size: 20 })

  if (visits.isPending) return <p className="muted">{t('common.loading')}</p>
  if (visits.isError) return <p className="alert">{errorMessage(visits.error, t)}</p>
  if (visits.data.content.length === 0) return <p className="empty">{t('visits.empty')}</p>

  return (
    <>
      {visits.data.offline && <p className="offline-note">{t('sync.showingSaved')}</p>}
      <ul className="timeline">
        {visits.data.content.map((v) => (
          <li key={v.id}>
            <div className="timeline-head">
              <Badge group="visitOutcome" value={v.outcome} />
              {v.pending && <PendingBadge />}
              <span className="muted">{formatDateTime(v.visitedAt)}</span>
            </div>
            <div>
              {showCustomer && (
                <Link to={`/customers/${v.customerId}`}>
                  <strong>{v.customerName ?? t('fields.customer')}</strong>
                </Link>
              )}
              {v.userName && <span className="muted"> · {v.userName}</span>}
              {v.latitude != null && v.longitude != null && (
                <>
                  {' · '}
                  <a href={mapUrl({ lat: v.latitude, lng: v.longitude })} target="_blank" rel="noopener noreferrer">
                    📍 {t('customers.viewOnMap')}
                  </a>
                </>
              )}
            </div>
            {v.notes && <p className="pre-wrap">{v.notes}</p>}
          </li>
        ))}
      </ul>
      <Pagination page={visits.data.page} totalPages={visits.data.totalPages} onChange={setPage} />
    </>
  )
}

export function VisitListPage() {
  const { t } = useTranslation()
  return (
    <section>
      <div className="page-header">
        <h1>{t('visits.title')}</h1>
        <div className="actions">
          <Link to="/visits/new" className="btn btn-primary">
            📍 {t('visits.log')}
          </Link>
        </div>
      </div>
      <VisitList />
    </section>
  )
}
