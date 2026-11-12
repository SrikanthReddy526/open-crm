import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ticketsApi } from '../../api/crm'
import { errorMessage, getApiError } from '../../api/errors'
import { TICKET_PRIORITIES, type Ticket, type TicketPriority } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { CustomerPicker } from '../../components/CustomerPicker'
import { uuid } from '../../platform'
import { useUserLookup } from '../customers/hooks'

export function TicketFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const existing = useQuery({ queryKey: ['tickets', 'detail', id], queryFn: () => ticketsApi.get(id!), enabled: !!id })
  if (id && existing.isPending) return <p className="muted">{t('common.loading')}</p>
  if (id && existing.isError) return <p className="alert">{errorMessage(existing.error, t)}</p>
  return <TicketForm key={id ?? 'new'} ticket={existing.data} />
}

function TicketForm({ ticket }: { ticket?: Ticket }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const { hasRole } = useAuth()
  const isSupport = hasRole('ADMIN', 'SUPPORT_AGENT')
  const users = useUserLookup(isSupport)

  const [customerId, setCustomerId] = useState(ticket?.customerId ?? params.get('customerId') ?? '')
  const [subject, setSubject] = useState(ticket?.subject ?? '')
  const [description, setDescription] = useState(ticket?.description ?? '')
  const [priority, setPriority] = useState<TicketPriority>(ticket?.priority ?? 'MEDIUM')
  const [assignedTo, setAssignedTo] = useState(ticket?.assignedTo ?? '')
  const [id] = useState(() => ticket?.id ?? uuid())
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: () => {
      const input = {
        id,
        customerId,
        subject: subject.trim(),
        description: description.trim() || null,
        priority,
        assignedTo: isSupport ? assignedTo || null : null,
        version: ticket?.version,
      }
      return ticket ? ticketsApi.update(ticket.id, input) : ticketsApi.create(input)
    },
    onSuccess: (saved) => {
      qc.setQueryData(['tickets', 'detail', saved.id], saved)
      void qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate(`/tickets/${saved.id}`, { replace: true })
    },
    onError: (err) => {
      setFieldErrors(getApiError(err)?.fieldErrors ?? {})
      setError(errorMessage(err, t))
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const missing: Record<string, string> = {}
    if (!customerId) missing.customerId = t('validation.required')
    if (!subject.trim()) missing.subject = t('validation.required')
    setFieldErrors(missing)
    if (Object.keys(missing).length === 0) save.mutate()
  }

  return (
    <section>
      <Link to={ticket ? `/tickets/${ticket.id}` : '/tickets'} className="back-link">
        ‹ {t('common.back')}
      </Link>
      <h1>{ticket ? t('tickets.edit') : t('tickets.new')}</h1>
      <form className="card form" onSubmit={onSubmit} noValidate>
        {error && <p className="alert">{error}</p>}
        <CustomerPicker value={customerId} onChange={setCustomerId} required error={fieldErrors.customerId} />
        <label className="field">
          <span>{t('fields.subject')} *</span>
          <input maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('tickets.subjectPlaceholder')} />
          {fieldErrors.subject && <small className="field-error">{fieldErrors.subject}</small>}
        </label>
        <label className="field">
          <span>{t('fields.description')}</span>
          <textarea rows={6} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid">
          <label className="field">
            <span>{t('fields.priority')}</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </select>
          </label>
          {isSupport && !ticket && (
            <label className="field">
              <span>{t('tickets.assignedTo')}</span>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">{t('tickets.unassigned')}</option>
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
          <Link to={ticket ? `/tickets/${ticket.id}` : '/tickets'} className="btn">
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
