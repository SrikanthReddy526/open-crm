import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { PendingBadge } from '../../components/Badge'
import { telHref, whatsappHref } from '../../lib/format'
import { mapUrl, openDirections } from '../../platform/location'
import { DealTable } from '../deals/DealListPage'
import { ReminderDialog } from '../reminders/ReminderDialog'
import { ReminderList } from '../reminders/ReminderList'
import { TicketTable } from '../tickets/TicketListPage'
import { VisitList } from '../visits/VisitList'
import { useCustomer, useDeleteCustomer } from './hooks'

type Tab = 'visits' | 'reminders' | 'tickets' | 'deals'

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const { data: c, isPending, isError, error } = useCustomer(id)
  const deleteMutation = useDeleteCustomer()
  const [tab, setTab] = useState<Tab>('visits')
  const [addingReminder, setAddingReminder] = useState(false)

  if (isPending) return <p className="muted">{t('common.loading')}</p>
  if (isError) return <p className="alert">{errorMessage(error, t)}</p>

  const hasLocation = c.latitude != null && c.longitude != null
  const address = [c.addressLine, c.city, c.state, c.postalCode, c.country].filter(Boolean).join(', ')
  const locale = i18n.resolvedLanguage === 'te' ? 'te-IN' : 'en-IN'

  function onDelete() {
    if (!c || !window.confirm(t('customers.confirmDelete', { name: c.name }))) return
    deleteMutation.mutate(c.id, { onSuccess: () => navigate('/customers', { replace: true }) })
  }

  return (
    <section>
      <Link to="/customers" className="back-link">
        ‹ {t('common.back')}
      </Link>
      <div className="page-header">
        <div>
          <h1>
            {c.name} {(c as { pending?: boolean }).pending && <PendingBadge />}
          </h1>
          {c.company && <p className="muted">{c.company}</p>}
        </div>
        <div className="actions">
          <Link to={`/customers/${c.id}/edit`} className="btn">
            {t('common.edit')}
          </Link>
          {hasRole('ADMIN') && (
            <button type="button" className="btn btn-danger" onClick={onDelete} disabled={deleteMutation.isPending}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>

      {deleteMutation.isError && <p className="alert">{errorMessage(deleteMutation.error, t)}</p>}

      {/* Big touch-friendly actions for field staff */}
      <div className="quick-actions">
        <Link className="btn btn-primary" to={`/visits/new?customerId=${c.id}`}>
          📍 {t('visits.log')}
        </Link>
        {hasLocation && (
          <button
            type="button"
            className="btn"
            onClick={() => openDirections({ lat: c.latitude!, lng: c.longitude! })}
          >
            🧭 {t('customers.navigate')}
          </button>
        )}
        {c.phone && (
          <>
            <a className="btn" href={telHref(c.phone)}>
              📞 {t('customers.call')}
            </a>
            <a className="btn" href={whatsappHref(c.phone)} target="_blank" rel="noopener noreferrer">
              💬 WhatsApp
            </a>
          </>
        )}
        {c.email && (
          <a className="btn" href={`mailto:${c.email}`}>
            ✉️ {t('customers.sendEmail')}
          </a>
        )}
      </div>

      <div className="card">
        <dl className="details">
          <dt>{t('fields.phone')}</dt>
          <dd>{c.phone ?? '—'}</dd>
          <dt>{t('fields.email')}</dt>
          <dd>{c.email ?? '—'}</dd>
          <dt>{t('fields.addressLine')}</dt>
          <dd>{address || '—'}</dd>
          <dt>{t('customers.location')}</dt>
          <dd>
            {hasLocation ? (
              <>
                {c.latitude}, {c.longitude} ·{' '}
                <a href={mapUrl({ lat: c.latitude!, lng: c.longitude! })} target="_blank" rel="noopener noreferrer">
                  {t('customers.viewOnMap')}
                </a>
              </>
            ) : (
              t('customers.noLocation')
            )}
          </dd>
          <dt>{t('fields.notes')}</dt>
          <dd className="pre-wrap">{c.notes ?? '—'}</dd>
          <dt>{t('customers.updatedAt')}</dt>
          <dd>{new Date(c.updatedAt).toLocaleString(locale)}</dd>
        </dl>
      </div>

      <div className="tabs related-tabs" role="tablist">
        {(['visits', 'reminders', 'tickets', 'deals'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>
            {t(`nav.${x}`)}
          </button>
        ))}
      </div>
      <div className="related">
        {tab === 'visits' && <VisitList customerId={c.id} showCustomer={false} />}
        {tab === 'reminders' && (
          <>
            <div className="section-header">
              <span />
              <button type="button" className="btn" onClick={() => setAddingReminder(true)}>
                + {t('reminders.new')}
              </button>
            </div>
            <ReminderList params={{ customerId: c.id, status: 'ALL', due: 'ALL', everyone: true }} emptyText={t('reminders.noneLinked')} />
          </>
        )}
        {tab === 'tickets' && (
          <>
            <div className="section-header">
              <span />
              <Link className="btn" to={`/tickets/new?customerId=${c.id}`}>
                + {t('tickets.new')}
              </Link>
            </div>
            <TicketTable params={{ customerId: c.id }} />
          </>
        )}
        {tab === 'deals' && (
          <>
            <div className="section-header">
              <span />
              <Link className="btn" to={`/deals/new?customerId=${c.id}`}>
                + {t('deals.new')}
              </Link>
            </div>
            <DealTable params={{ customerId: c.id }} />
          </>
        )}
      </div>
      {addingReminder && <ReminderDialog link={{ customerId: c.id }} onClose={() => setAddingReminder(false)} />}
    </section>
  )
}
