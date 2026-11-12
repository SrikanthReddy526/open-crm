import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import type { Lead, LeadStatus } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Dialog } from '../../components/Dialog'
import { formatDateTime, telHref, whatsappHref } from '../../lib/format'
import { ReminderDialog } from '../reminders/ReminderDialog'
import { ReminderList } from '../reminders/ReminderList'

const NEXT: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED']

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const lead = useQuery({ queryKey: ['leads', 'detail', id], queryFn: () => leadsApi.get(id!) })
  const [converting, setConverting] = useState(false)
  const [addingReminder, setAddingReminder] = useState(false)

  const onSaved = (saved: Lead) => {
    qc.setQueryData(['leads', 'detail', id], saved)
    void qc.invalidateQueries({ queryKey: ['leads', 'list'] })
  }
  const setStatus = useMutation({ mutationFn: (s: LeadStatus) => leadsApi.setStatus(id!, s), onSuccess: onSaved })
  const remove = useMutation({
    mutationFn: () => leadsApi.remove(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
      navigate('/leads', { replace: true })
    },
  })

  if (lead.isPending) return <p className="muted">{t('common.loading')}</p>
  if (lead.isError) return <p className="alert">{errorMessage(lead.error, t)}</p>
  const l = lead.data
  const converted = l.status === 'CONVERTED'

  return (
    <section>
      <Link to="/leads" className="back-link">
        ‹ {t('common.back')}
      </Link>
      <div className="page-header">
        <div>
          <h1>{l.name}</h1>
          <p className="muted">
            {l.company && `${l.company} · `}
            <Badge group="leadStatus" value={l.status} />
          </p>
        </div>
        <div className="actions">
          {!converted && (
            <button type="button" className="btn btn-primary" onClick={() => setConverting(true)}>
              ✓ {t('leads.convert')}
            </button>
          )}
          <Link to={`/leads/${l.id}/edit`} className="btn">
            {t('common.edit')}
          </Link>
          <button type="button" className="btn btn-danger" onClick={() => window.confirm(t('leads.confirmDelete', { name: l.name })) && remove.mutate()}>
            {t('common.delete')}
          </button>
        </div>
      </div>

      {(setStatus.error || remove.error) && <p className="alert">{errorMessage(setStatus.error ?? remove.error, t)}</p>}

      {converted && l.convertedCustomerId && (
        <p className="notice">
          {t('leads.convertedNote')} <Link to={`/customers/${l.convertedCustomerId}`}>{t('leads.openCustomer')} ›</Link>
        </p>
      )}

      <div className="quick-actions">
        {l.phone && (
          <>
            <a className="btn" href={telHref(l.phone)}>
              📞 {t('customers.call')}
            </a>
            <a className="btn" href={whatsappHref(l.phone)} target="_blank" rel="noopener noreferrer">
              💬 WhatsApp
            </a>
          </>
        )}
        {l.email && (
          <a className="btn" href={`mailto:${l.email}`}>
            ✉️ {t('customers.sendEmail')}
          </a>
        )}
      </div>

      {!converted && (
        <div className="card">
          <h2>{t('leads.moveTo')}</h2>
          <div className="segmented">
            {NEXT.map((s) => (
              <button key={s} type="button" className={l.status === s ? 'active' : ''} disabled={setStatus.isPending} onClick={() => setStatus.mutate(s)}>
                {t(`leadStatus.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <dl className="details">
          <dt>{t('fields.phone')}</dt>
          <dd>{l.phone ?? '—'}</dd>
          <dt>{t('fields.email')}</dt>
          <dd>{l.email ?? '—'}</dd>
          <dt>{t('leads.source')}</dt>
          <dd>{l.source ? t(`leadSource.${l.source}`) : '—'}</dd>
          <dt>{t('customers.owner')}</dt>
          <dd>{l.ownerName ?? '—'}</dd>
          <dt>{t('fields.notes')}</dt>
          <dd className="pre-wrap">{l.notes ?? '—'}</dd>
          <dt>{t('leads.added')}</dt>
          <dd>{formatDateTime(l.createdAt)}</dd>
        </dl>
      </div>

      <div className="section-header">
        <h2>{t('reminders.title')}</h2>
        <button type="button" className="btn" onClick={() => setAddingReminder(true)}>
          + {t('reminders.new')}
        </button>
      </div>
      <ReminderList params={{ leadId: l.id, status: 'ALL', due: 'ALL', everyone: true }} emptyText={t('reminders.noneLinked')} />

      {converting && <ConvertDialog lead={l} onClose={() => setConverting(false)} />}
      {addingReminder && <ReminderDialog link={{ leadId: l.id }} onClose={() => setAddingReminder(false)} />}
    </section>
  )
}

function ConvertDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [createDeal, setCreateDeal] = useState(true)
  const [dealTitle, setDealTitle] = useState(lead.company ?? lead.name)
  const [amount, setAmount] = useState('')

  const convert = useMutation({
    mutationFn: () =>
      leadsApi.convert(lead.id, { createDeal, dealTitle: dealTitle.trim() || undefined, amount: amount ? Number(amount) : undefined }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['deals'] })
      navigate(`/customers/${res.customerId}`)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    convert.mutate()
  }

  return (
    <Dialog title={t('leads.convertTitle', { name: lead.name })} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <p className="muted">{t('leads.convertHelp')}</p>
        {convert.isError && <p className="alert">{errorMessage(convert.error, t)}</p>}
        <label className="toggle">
          <input type="checkbox" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} />
          {t('leads.alsoCreateDeal')}
        </label>
        {createDeal && (
          <div className="grid">
            <label className="field">
              <span>{t('deals.dealTitle')}</span>
              <input maxLength={200} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('fields.amount')} (₹)</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={convert.isPending}>
            {convert.isPending ? t('common.saving') : t('leads.convert')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
