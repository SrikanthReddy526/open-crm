import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ticketsApi } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/Badge'
import { formatDateTime, formatRelative } from '../../lib/format'
import { useUserLookup } from '../customers/hooks'
import { AiAssistPanel } from './AiAssistPanel'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, hasRole } = useAuth()
  const isSupport = hasRole('ADMIN', 'SUPPORT_AGENT')
  const users = useUserLookup(isSupport)

  const ticket = useQuery({ queryKey: ['tickets', 'detail', id], queryFn: () => ticketsApi.get(id!) })
  const comments = useQuery({ queryKey: ['tickets', 'comments', id], queryFn: () => ticketsApi.comments(id!) })
  const history = useQuery({ queryKey: ['tickets', 'history', id], queryFn: () => ticketsApi.history(id!) })

  const onSaved = (saved: Ticket) => {
    qc.setQueryData(['tickets', 'detail', id], saved)
    void qc.invalidateQueries({ queryKey: ['tickets', 'list'] })
    void qc.invalidateQueries({ queryKey: ['tickets', 'history', id] })
    void qc.invalidateQueries({ queryKey: ['tickets', 'stats'] })
  }
  const setStatus = useMutation({ mutationFn: (s: TicketStatus) => ticketsApi.setStatus(id!, s), onSuccess: onSaved })
  const assign = useMutation({ mutationFn: (u: string | null) => ticketsApi.assign(id!, u), onSuccess: onSaved })
  const remove = useMutation({
    mutationFn: () => ticketsApi.remove(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate('/tickets', { replace: true })
    },
  })

  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const addComment = useMutation({
    mutationFn: () => ticketsApi.addComment(id!, body.trim(), internal),
    onSuccess: () => {
      setBody('')
      void qc.invalidateQueries({ queryKey: ['tickets', 'comments', id] })
    },
  })

  if (ticket.isPending) return <p className="muted">{t('common.loading')}</p>
  if (ticket.isError) return <p className="alert">{errorMessage(ticket.error, t)}</p>
  const tk = ticket.data
  const canChangeStatus = isSupport || tk.assignedTo === user?.id
  const canEdit = isSupport || tk.createdBy === user?.id
  const actionError = setStatus.error ?? assign.error ?? remove.error

  function onComment(e: FormEvent) {
    e.preventDefault()
    if (body.trim()) addComment.mutate()
  }

  return (
    <section>
      <Link to="/tickets" className="back-link">
        ‹ {t('common.back')}
      </Link>
      <div className="page-header">
        <div>
          <h1>
            <span className="muted">#{tk.ticketNumber}</span> {tk.subject}
          </h1>
          <p className="muted">
            <Link to={`/customers/${tk.customerId}`}>{tk.customerName}</Link> · {t('tickets.openedBy', { name: tk.createdByName ?? '—', time: formatRelative(tk.createdAt) })}
          </p>
        </div>
        <div className="actions">
          {canEdit && (
            <Link to={`/tickets/${tk.id}/edit`} className="btn">
              {t('common.edit')}
            </Link>
          )}
          {hasRole('ADMIN') && (
            <button type="button" className="btn btn-danger" onClick={() => window.confirm(t('tickets.confirmDelete')) && remove.mutate()}>
              {t('common.delete')}
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="alert">{errorMessage(actionError, t)}</p>}

      <div className="two-col wide-left">
        <div>
          <div className="card">
            <p className="pre-wrap">{tk.description || <span className="muted">{t('tickets.noDescription')}</span>}</p>
          </div>

          <h2 className="section-title">{t('tickets.conversation')}</h2>
          {comments.isPending ? (
            <p className="muted">{t('common.loading')}</p>
          ) : comments.data?.length ? (
            <ul className="comments">
              {comments.data.map((c) => (
                <li key={c.id} className={c.internal ? 'internal' : ''}>
                  <div className="comment-head">
                    <strong>{c.authorName ?? '—'}</strong>
                    {c.internal && <span className="badge badge-warn">🔒 {t('tickets.internal')}</span>}
                    <span className="muted" title={formatDateTime(c.createdAt)}>
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('tickets.noComments')}</p>
          )}

          <form className="card form" onSubmit={onComment}>
            {addComment.isError && <p className="alert">{errorMessage(addComment.error, t)}</p>}
            <label className="field">
              <span>{t('tickets.addComment')}</span>
              <textarea id="ticket-comment-box" rows={3} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <div className="form-actions space-between">
              {isSupport ? (
                <label className="toggle">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  🔒 {t('tickets.internalNote')}
                </label>
              ) : (
                <span />
              )}
              <button type="submit" className="btn btn-primary" disabled={addComment.isPending || !body.trim()}>
                {addComment.isPending ? t('common.saving') : t('tickets.send')}
              </button>
            </div>
          </form>
        </div>

        <aside>
          {isSupport && (
            <AiAssistPanel
              ticketId={tk.id}
              onUseReply={(text) => {
                setBody(text)
                setInternal(false)
                document.getElementById('ticket-comment-box')?.focus()
              }}
            />
          )}
          <div className="card">
            <dl className="details stacked">
              <dt>{t('fields.status')}</dt>
              <dd>
                {canChangeStatus ? (
                  <select value={tk.status} onChange={(e) => setStatus.mutate(e.target.value as TicketStatus)} disabled={setStatus.isPending} aria-label={t('fields.status')}>
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`ticketStatus.${s}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge group="ticketStatus" value={tk.status} />
                )}
              </dd>
              <dt>{t('fields.priority')}</dt>
              <dd>
                <Badge group="priority" value={tk.priority} />
              </dd>
              <dt>{t('tickets.assignedTo')}</dt>
              <dd>
                {isSupport ? (
                  <select value={tk.assignedTo ?? ''} onChange={(e) => assign.mutate(e.target.value || null)} disabled={assign.isPending} aria-label={t('tickets.assignedTo')}>
                    <option value="">{t('tickets.unassigned')}</option>
                    {users.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  (tk.assignedToName ?? t('tickets.unassigned'))
                )}
              </dd>
              {isSupport && user && tk.assignedTo !== user.id && (
                <dd>
                  <button type="button" className="btn btn-block" onClick={() => assign.mutate(user.id)}>
                    {t('tickets.takeIt')}
                  </button>
                </dd>
              )}
              {tk.resolvedAt && (
                <>
                  <dt>{t('tickets.resolvedAt')}</dt>
                  <dd>{formatDateTime(tk.resolvedAt)}</dd>
                </>
              )}
            </dl>
          </div>

          <h2 className="section-title">{t('tickets.history')}</h2>
          <ul className="timeline compact">
            {history.data?.map((h, i) => (
              <li key={i}>
                <div className="timeline-head">
                  {h.fromStatus && (
                    <>
                      <Badge group="ticketStatus" value={h.fromStatus} /> →
                    </>
                  )}
                  <Badge group="ticketStatus" value={h.toStatus} />
                </div>
                <small className="muted">
                  {h.changedByName ?? '—'} · {formatDateTime(h.changedAt)}
                </small>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}
