import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { dealsApi } from '../../api/crm'
import { errorMessage, getApiError } from '../../api/errors'
import { DEAL_STAGES, type Deal, type DealStage } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { CustomerPicker } from '../../components/CustomerPicker'
import { formatDateTime, formatMoney } from '../../lib/format'
import { uuid } from '../../platform'
import { useUserLookup } from '../customers/hooks'
import { ReminderDialog } from '../reminders/ReminderDialog'
import { ReminderList } from '../reminders/ReminderList'

/** /deals/new and /deals/:id (the deal page is its edit form plus its reminders). */
export function DealFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const existing = useQuery({ queryKey: ['deals', 'detail', id], queryFn: () => dealsApi.get(id!), enabled: !!id })
  if (id && existing.isPending) return <p className="muted">{t('common.loading')}</p>
  if (id && existing.isError) return <p className="alert">{errorMessage(existing.error, t)}</p>
  return <DealForm key={id ?? 'new'} deal={existing.data} />
}

function DealForm({ deal }: { deal?: Deal }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const { hasRole } = useAuth()
  const canAssign = hasRole('ADMIN', 'SUPPORT_AGENT')
  const users = useUserLookup(canAssign)

  const [customerId, setCustomerId] = useState(deal?.customerId ?? params.get('customerId') ?? '')
  const [title, setTitle] = useState(deal?.title ?? '')
  const [amount, setAmount] = useState(deal ? String(deal.amount) : '')
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? 'PROSPECTING')
  const [expectedCloseDate, setExpectedCloseDate] = useState(deal?.expectedCloseDate ?? '')
  const [ownerId, setOwnerId] = useState(deal?.ownerId ?? '')
  const [id] = useState(() => deal?.id ?? uuid())
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [addingReminder, setAddingReminder] = useState(false)

  const save = useMutation({
    mutationFn: () => {
      const input = {
        id,
        customerId,
        title: title.trim(),
        amount: Number(amount || 0),
        currency: 'INR',
        stage,
        expectedCloseDate: expectedCloseDate || null,
        ownerId: canAssign ? ownerId || null : undefined,
        version: deal?.version,
      }
      return deal ? dealsApi.update(deal.id, input) : dealsApi.create(input)
    },
    onSuccess: (saved) => {
      qc.setQueryData(['deals', 'detail', saved.id], saved)
      void qc.invalidateQueries({ queryKey: ['deals'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(deal ? '/deals' : `/deals/${saved.id}`, { replace: true })
    },
    onError: (err) => {
      setFieldErrors(getApiError(err)?.fieldErrors ?? {})
      setError(errorMessage(err, t))
    },
  })

  const remove = useMutation({
    mutationFn: () => dealsApi.remove(deal!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals'] })
      navigate('/deals', { replace: true })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const missing: Record<string, string> = {}
    if (!customerId) missing.customerId = t('validation.required')
    if (!title.trim()) missing.title = t('validation.required')
    if (amount && (Number.isNaN(Number(amount)) || Number(amount) < 0)) missing.amount = t('validation.amount')
    setFieldErrors(missing)
    if (Object.keys(missing).length === 0) save.mutate()
  }

  return (
    <section>
      <Link to="/deals" className="back-link">
        ‹ {t('common.back')}
      </Link>
      <div className="page-header">
        <div>
          <h1>{deal ? deal.title : t('deals.new')}</h1>
          {deal && (
            <p className="muted">
              {formatMoney(deal.amount, deal.currency)} · {deal.customerName}
              {deal.closedAt && ` · ${t('deals.closedAt', { time: formatDateTime(deal.closedAt) })}`}
            </p>
          )}
        </div>
        {deal && (
          <div className="actions">
            <Link to={`/customers/${deal.customerId}`} className="btn">
              {t('deals.openCustomer')}
            </Link>
            <button type="button" className="btn btn-danger" onClick={() => window.confirm(t('deals.confirmDelete')) && remove.mutate()}>
              {t('common.delete')}
            </button>
          </div>
        )}
      </div>

      <form className="card form" onSubmit={onSubmit} noValidate>
        {(error || remove.error) && <p className="alert">{error ?? errorMessage(remove.error, t)}</p>}
        <CustomerPicker value={customerId} onChange={setCustomerId} required error={fieldErrors.customerId} />
        <div className="grid">
          <label className="field field-wide">
            <span>{t('deals.dealTitle')} *</span>
            <input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
          </label>
          <label className="field">
            <span>{t('fields.amount')} (₹)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {amount && !Number.isNaN(Number(amount)) && <small className="muted">{formatMoney(Number(amount))}</small>}
            {fieldErrors.amount && <small className="field-error">{fieldErrors.amount}</small>}
          </label>
          <label className="field">
            <span>{t('deals.expectedClose')}</span>
            <input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
          </label>
          <div className="field field-wide">
            <span>{t('deals.stage')}</span>
            <div className="segmented">
              {DEAL_STAGES.map((s) => (
                <button key={s} type="button" className={stage === s ? `active stage-${s}` : ''} onClick={() => setStage(s)}>
                  {t(`dealStage.${s}`)}
                </button>
              ))}
            </div>
          </div>
          {canAssign && (
            <label className="field">
              <span>{t('customers.owner')}</span>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">{t('customers.ownerMe')}</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({t(`roles.${u.role}`)})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="form-actions">
          <Link to="/deals" className="btn">
            {t('common.cancel')}
          </Link>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {deal && (
        <>
          <div className="section-header">
            <h2>{t('reminders.title')}</h2>
            <button type="button" className="btn" onClick={() => setAddingReminder(true)}>
              + {t('reminders.new')}
            </button>
          </div>
          <ReminderList params={{ dealId: deal.id, status: 'ALL', due: 'ALL', everyone: true }} emptyText={t('reminders.noneLinked')} />
          {addingReminder && <ReminderDialog link={{ dealId: deal.id }} onClose={() => setAddingReminder(false)} />}
        </>
      )}
    </section>
  )
}
