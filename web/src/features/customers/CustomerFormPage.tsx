import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage, getApiError } from '../../api/errors'
import type { Customer, CustomerInput } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { uuid } from '../../platform'
import { getCurrentPosition } from '../../platform/location'
import { useCustomer, useSaveCustomer, useUserLookup } from './hooks'

/** Loads the customer (when editing), then renders the form with its initial values. */
export function CustomerFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const existing = useCustomer(id)

  if (id && existing.isPending) return <p className="muted">{t('common.loading')}</p>
  if (id && existing.isError) return <p className="alert">{errorMessage(existing.error, t)}</p>
  return <CustomerForm key={id ?? 'new'} customer={existing.data} />
}

type FormState = Record<
  'name' | 'company' | 'email' | 'phone' | 'addressLine' | 'city' | 'state' | 'postalCode' | 'country' | 'latitude' | 'longitude' | 'notes' | 'ownerId',
  string
>

function toForm(c?: Customer): FormState {
  return {
    name: c?.name ?? '',
    company: c?.company ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    addressLine: c?.addressLine ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    postalCode: c?.postalCode ?? '',
    country: c?.country ?? 'India',
    latitude: c?.latitude?.toString() ?? '',
    longitude: c?.longitude?.toString() ?? '',
    notes: c?.notes ?? '',
    ownerId: c?.ownerId ?? '',
  }
}

const toNumber = (s: string) => (s.trim() === '' ? null : Number(s))
const toText = (s: string) => (s.trim() === '' ? null : s.trim())

function CustomerForm({ customer }: { customer?: Customer }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canAssign = hasRole('ADMIN', 'SUPPORT_AGENT')
  const owners = useUserLookup(canAssign)
  const save = useSaveCustomer()

  const [form, setForm] = useState<FormState>(() => toForm(customer))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  // Generated once so a retried create (e.g. after a timeout) never makes a duplicate.
  const [newId] = useState(() => uuid())

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function fillMyLocation() {
    setLocating(true)
    setFormError(null)
    try {
      const pos = await getCurrentPosition()
      setForm((f) => ({ ...f, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }))
    } catch {
      setFormError(t('customers.locationError'))
    } finally {
      setLocating(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const latitude = toNumber(form.latitude)
    const longitude = toNumber(form.longitude)
    if ((latitude === null) !== (longitude === null)) {
      setFormError(t('customers.coordinatesPair'))
      return
    }

    const input: CustomerInput = {
      id: customer ? undefined : newId,
      name: form.name.trim(),
      company: toText(form.company),
      email: toText(form.email),
      phone: toText(form.phone),
      addressLine: toText(form.addressLine),
      city: toText(form.city),
      state: toText(form.state),
      postalCode: toText(form.postalCode),
      country: toText(form.country),
      latitude,
      longitude,
      notes: toText(form.notes),
      ownerId: canAssign ? toText(form.ownerId) : undefined,
      version: customer?.version,
    }

    save.mutate(
      { id: customer?.id, input },
      {
        onSuccess: (saved) => navigate(`/customers/${saved.id}`, { replace: true }),
        onError: (err) => {
          setFieldErrors(getApiError(err)?.fieldErrors ?? {})
          setFormError(errorMessage(err, t))
        },
      },
    )
  }

  const field = (key: keyof FormState, input: ReactNode, wide = false) => (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span>
        {t(`fields.${key}`)}
        {key === 'name' && ' *'}
      </span>
      {input}
      {fieldErrors[key] && <small className="field-error">{fieldErrors[key]}</small>}
    </label>
  )

  return (
    <section>
      <Link to={customer ? `/customers/${customer.id}` : '/customers'} className="back-link">
        ‹ {t('common.back')}
      </Link>
      <h1>{customer ? t('customers.edit') : t('customers.new')}</h1>

      <form className="card form" onSubmit={onSubmit} noValidate>
        {formError && (
          <p className="alert" role="alert">
            {formError}
          </p>
        )}

        <fieldset>
          <legend>{t('customers.sections.contact')}</legend>
          <div className="grid">
            {field('name', <input required maxLength={150} value={form.name} onChange={set('name')} />)}
            {field('company', <input maxLength={150} value={form.company} onChange={set('company')} />)}
            {field('phone', <input type="tel" inputMode="tel" maxLength={30} value={form.phone} onChange={set('phone')} />)}
            {field('email', <input type="email" maxLength={255} value={form.email} onChange={set('email')} />)}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('customers.sections.address')}</legend>
          <div className="grid">
            {field('addressLine', <input maxLength={255} value={form.addressLine} onChange={set('addressLine')} />, true)}
            {field('city', <input maxLength={100} value={form.city} onChange={set('city')} />)}
            {field('state', <input maxLength={100} value={form.state} onChange={set('state')} />)}
            {field('postalCode', <input inputMode="numeric" maxLength={20} value={form.postalCode} onChange={set('postalCode')} />)}
            {field('country', <input maxLength={100} value={form.country} onChange={set('country')} />)}
            {field('latitude', <input inputMode="decimal" value={form.latitude} onChange={set('latitude')} placeholder="16.506174" />)}
            {field('longitude', <input inputMode="decimal" value={form.longitude} onChange={set('longitude')} placeholder="80.648015" />)}
          </div>
          <button type="button" className="btn" onClick={fillMyLocation} disabled={locating}>
            📍 {locating ? t('customers.locating') : t('customers.useMyLocation')}
          </button>
        </fieldset>

        <fieldset>
          <legend>{t('customers.sections.other')}</legend>
          <div className="grid">
            {canAssign && (
              <label className="field">
                <span>{t('customers.owner')}</span>
                <select value={form.ownerId} onChange={set('ownerId')}>
                  <option value="">{t('customers.ownerMe')}</option>
                  {owners.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({t(`roles.${u.role}`)})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {field('notes', <textarea rows={4} maxLength={5000} value={form.notes} onChange={set('notes')} />, true)}
          </div>
        </fieldset>

        <div className="form-actions">
          <Link to={customer ? `/customers/${customer.id}` : '/customers'} className="btn">
            {t('common.cancel')}
          </Link>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </section>
  )
}
