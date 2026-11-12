import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi } from '../../api/crm'
import { errorMessage, getApiError } from '../../api/errors'
import { LEAD_SOURCES, type Lead, type LeadSource } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { uuid } from '../../platform'
import { useUserLookup } from '../customers/hooks'

export function LeadFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const existing = useQuery({ queryKey: ['leads', 'detail', id], queryFn: () => leadsApi.get(id!), enabled: !!id })
  if (id && existing.isPending) return <p className="muted">{t('common.loading')}</p>
  if (id && existing.isError) return <p className="alert">{errorMessage(existing.error, t)}</p>
  return <LeadForm key={id ?? 'new'} lead={existing.data} />
}

function LeadForm({ lead }: { lead?: Lead }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasRole } = useAuth()
  const canAssign = hasRole('ADMIN', 'SUPPORT_AGENT')
  const users = useUserLookup(canAssign)
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    company: lead?.company ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    source: (lead?.source ?? '') as LeadSource | '',
    ownerId: lead?.ownerId ?? '',
    notes: lead?.notes ?? '',
  })
  const [id] = useState(() => lead?.id ?? uuid())
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const input = {
        id,
        name: form.name.trim(),
        company: form.company.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        source: form.source || null,
        ownerId: canAssign ? form.ownerId || null : undefined,
        notes: form.notes.trim() || null,
        version: lead?.version,
      }
      return lead ? leadsApi.update(lead.id, input) : leadsApi.create(input)
    },
    onSuccess: (saved) => {
      qc.setQueryData(['leads', 'detail', saved.id], saved)
      void qc.invalidateQueries({ queryKey: ['leads', 'list'] })
      navigate(`/leads/${saved.id}`, { replace: true })
    },
    onError: (err) => {
      setFieldErrors(getApiError(err)?.fieldErrors ?? {})
      setError(errorMessage(err, t))
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setFieldErrors({ name: t('validation.required') })
      return
    }
    save.mutate()
  }

  const err = (k: string) => fieldErrors[k] && <small className="field-error">{fieldErrors[k]}</small>

  return (
    <section>
      <Link to={lead ? `/leads/${lead.id}` : '/leads'} className="back-link">
        ‹ {t('common.back')}
      </Link>
      <h1>{lead ? t('leads.edit') : t('leads.new')}</h1>
      <form className="card form" onSubmit={onSubmit} noValidate>
        {error && <p className="alert">{error}</p>}
        <div className="grid">
          <label className="field">
            <span>{t('fields.name')} *</span>
            <input maxLength={150} value={form.name} onChange={set('name')} />
            {err('name')}
          </label>
          <label className="field">
            <span>{t('fields.company')}</span>
            <input maxLength={150} value={form.company} onChange={set('company')} />
          </label>
          <label className="field">
            <span>{t('fields.phone')}</span>
            <input type="tel" inputMode="tel" maxLength={30} value={form.phone} onChange={set('phone')} />
            {err('phone')}
          </label>
          <label className="field">
            <span>{t('fields.email')}</span>
            <input type="email" maxLength={255} value={form.email} onChange={set('email')} />
            {err('email')}
          </label>
          <label className="field">
            <span>{t('leads.source')}</span>
            <select value={form.source} onChange={set('source')}>
              <option value="">—</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`leadSource.${s}`)}
                </option>
              ))}
            </select>
          </label>
          {canAssign && (
            <label className="field">
              <span>{t('customers.owner')}</span>
              <select value={form.ownerId} onChange={set('ownerId')}>
                <option value="">{t('customers.ownerMe')}</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({t(`roles.${u.role}`)})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field field-wide">
            <span>{t('fields.notes')}</span>
            <textarea rows={4} maxLength={5000} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
        <div className="form-actions">
          <Link to={lead ? `/leads/${lead.id}` : '/leads'} className="btn">
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
