import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage, getApiError } from '../../api/errors'
import { VISIT_OUTCOMES, type VisitOutcome } from '../../api/types'
import { CustomerPicker } from '../../components/CustomerPicker'
import { fromLocalInput, toLocalInput } from '../../lib/format'
import { uuid } from '../../platform'
import { getCurrentPosition, type LatLng } from '../../platform/location'
import { useCustomer } from '../customers/hooks'
import { useSaveVisit } from './hooks'

/** "Log a visit": works without a connection; the visit is sent when the phone is back online. */
export function VisitFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '')
  const customer = useCustomer(customerId || undefined)
  const save = useSaveVisit()

  const [visitedAt, setVisitedAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [outcome, setOutcome] = useState<VisitOutcome>('MET')
  const [notes, setNotes] = useState('')
  const [position, setPosition] = useState<LatLng | null>(null)
  const [gps, setGps] = useState<'idle' | 'locating' | 'ok' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [id] = useState(() => uuid()) // fixed, so a retried save never creates a second visit

  async function locate() {
    setGps('locating')
    try {
      setPosition(await getCurrentPosition())
      setGps('ok')
    } catch {
      setGps('failed')
    }
  }

  // Record where the visit happened as soon as the form opens.
  useEffect(() => {
    void locate()
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    if (!customerId) {
      setFieldErrors({ customerId: t('validation.required') })
      return
    }
    save.mutate(
      {
        input: {
          id,
          customerId,
          visitedAt: fromLocalInput(visitedAt),
          latitude: position ? Number(position.lat.toFixed(6)) : null,
          longitude: position ? Number(position.lng.toFixed(6)) : null,
          outcome,
          notes: notes.trim() || null,
        },
        customerName: customer.data?.name,
      },
      {
        onSuccess: (saved) => navigate(params.get('customerId') ? `/customers/${saved.customerId}` : '/visits', { replace: true }),
        onError: (err) => {
          setFieldErrors(getApiError(err)?.fieldErrors ?? {})
          setError(errorMessage(err, t))
        },
      },
    )
  }

  return (
    <section>
      <Link to={params.get('customerId') ? `/customers/${params.get('customerId')}` : '/visits'} className="back-link">
        ‹ {t('common.back')}
      </Link>
      <h1>{t('visits.log')}</h1>
      <form className="card form" onSubmit={onSubmit} noValidate>
        {error && <p className="alert">{error}</p>}
        <CustomerPicker value={customerId} onChange={setCustomerId} required error={fieldErrors.customerId} />

        <fieldset>
          <legend>{t('visits.outcome')}</legend>
          <div className="choice-grid">
            {VISIT_OUTCOMES.map((o) => (
              <label key={o} className={`choice${outcome === o ? ' selected' : ''}`}>
                <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
                {t(`visitOutcome.${o}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid">
          <label className="field">
            <span>{t('visits.when')}</span>
            <input type="datetime-local" value={visitedAt} max={toLocalInput(new Date().toISOString())} onChange={(e) => setVisitedAt(e.target.value)} required />
            {fieldErrors.visitedAt && <small className="field-error">{fieldErrors.visitedAt}</small>}
          </label>
          <div className="field">
            <span>{t('visits.gps')}</span>
            <div className="picked">
              <span className={gps === 'failed' ? 'warning' : gps === 'ok' ? 'success' : 'muted'}>
                {gps === 'locating' && t('customers.locating')}
                {gps === 'ok' && position && `📍 ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}
                {gps === 'failed' && t('visits.gpsFailed')}
                {gps === 'idle' && '—'}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => void locate()} disabled={gps === 'locating'}>
                {t('common.retry')}
              </button>
            </div>
          </div>
          <label className="field field-wide">
            <span>{t('fields.notes')}</span>
            <textarea rows={4} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('visits.notesPlaceholder')} />
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('visits.save')}
          </button>
        </div>
      </form>
    </section>
  )
}
