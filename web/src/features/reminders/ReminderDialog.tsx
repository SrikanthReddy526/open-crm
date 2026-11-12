import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage, getApiError } from '../../api/errors'
import type { Reminder } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { CustomerPicker } from '../../components/CustomerPicker'
import { Dialog } from '../../components/Dialog'
import { fromLocalInput, toLocalInput } from '../../lib/format'
import { uuid } from '../../platform'
import { useUserLookup } from '../customers/hooks'
import { useSaveReminder } from './hooks'

interface Props {
  reminder?: Reminder
  /** Pre-link a new reminder to one record. */
  link?: { customerId?: string; leadId?: string; dealId?: string }
  onClose: () => void
}

function tomorrowAt9(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export function ReminderDialog({ reminder, link, onClose }: Props) {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const canAssign = hasRole('ADMIN', 'SUPPORT_AGENT')
  const users = useUserLookup(canAssign)
  const save = useSaveReminder()

  const [title, setTitle] = useState(reminder?.title ?? '')
  const [description, setDescription] = useState(reminder?.description ?? '')
  const [dueAt, setDueAt] = useState(toLocalInput(reminder?.dueAt ?? tomorrowAt9()))
  const [assignedTo, setAssignedTo] = useState(reminder?.assignedTo ?? '')
  const [customerId, setCustomerId] = useState(reminder?.customerId ?? link?.customerId ?? '')
  const [id] = useState(() => reminder?.id ?? uuid())
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const leadId = reminder?.leadId ?? link?.leadId ?? null
  const dealId = reminder?.dealId ?? link?.dealId ?? null
  const linkedElsewhere = !!(leadId || dealId)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !dueAt) {
      setFieldErrors({ ...(title.trim() ? {} : { title: t('validation.required') }), ...(dueAt ? {} : { dueAt: t('validation.required') }) })
      return
    }
    save.mutate(
      {
        existing: reminder,
        input: {
          id,
          title: title.trim(),
          description: description.trim() || null,
          dueAt: fromLocalInput(dueAt),
          status: reminder?.status,
          assignedTo: canAssign ? assignedTo || null : undefined,
          customerId: linkedElsewhere ? null : customerId || null,
          leadId,
          dealId,
          version: reminder?.version,
        },
      },
      {
        onSuccess: onClose,
        onError: (err) => {
          setFieldErrors(getApiError(err)?.fieldErrors ?? {})
          setError(errorMessage(err, t))
        },
      },
    )
  }

  return (
    <Dialog title={reminder ? t('reminders.edit') : t('reminders.new')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {error && <p className="alert">{error}</p>}
        <label className="field">
          <span>{t('fields.title')} *</span>
          <input autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('reminders.titlePlaceholder')} />
          {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
        </label>
        <label className="field">
          <span>{t('reminders.due')} *</span>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          {fieldErrors.dueAt && <small className="field-error">{fieldErrors.dueAt}</small>}
        </label>
        {!linkedElsewhere && <CustomerPicker value={customerId} onChange={setCustomerId} />}
        {canAssign && (
          <label className="field">
            <span>{t('reminders.assignedTo')}</span>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">{t('customers.ownerMe')}</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({t(`roles.${u.role}`)})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{t('fields.description')}</span>
          <textarea rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
