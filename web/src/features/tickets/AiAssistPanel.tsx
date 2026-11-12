import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi, type AiText } from '../../api/crm'
import { errorMessage } from '../../api/errors'

/**
 * Agent assistant on a ticket (admins and support agents only): summarise the ticket and draft a reply.
 * The AI never sends anything; "Use this reply" only copies the draft into the comment box for review.
 */
export function AiAssistPanel({ ticketId, onUseReply }: { ticketId: string; onUseReply: (text: string) => void }) {
  const { t, i18n } = useTranslation()
  const status = useQuery({ queryKey: ['ai', 'status'], queryFn: aiApi.status, staleTime: 5 * 60_000 })
  const [language, setLanguage] = useState<'en' | 'te'>(i18n.language.startsWith('te') ? 'te' : 'en')
  const [instructions, setInstructions] = useState('')
  const [result, setResult] = useState<{ kind: 'summary' | 'reply'; data: AiText } | null>(null)

  const summary = useMutation({
    mutationFn: () => aiApi.summary(ticketId),
    onSuccess: (data) => setResult({ kind: 'summary', data }),
  })
  const reply = useMutation({
    mutationFn: () => aiApi.reply(ticketId, language, instructions),
    onSuccess: (data) => setResult({ kind: 'reply', data }),
  })

  if (status.isPending || status.isError) return null
  const busy = summary.isPending || reply.isPending
  const error = summary.error ?? reply.error

  return (
    <div className="card ai-panel">
      <h2 className="section-title">✨ {t('ai.title')}</h2>
      {!status.data.enabled ? (
        <p className="muted">{t('ai.disabled')}</p>
      ) : (
        <>
          <div className="ai-actions">
            <button type="button" className="btn" onClick={() => summary.mutate()} disabled={busy}>
              {summary.isPending ? t('ai.thinking') : t('ai.summarize')}
            </button>
          </div>
          <label className="field">
            <span>{t('ai.guidance')}</span>
            <input value={instructions} maxLength={1000} placeholder={t('ai.guidancePlaceholder')} onChange={(e) => setInstructions(e.target.value)} />
          </label>
          <div className="ai-actions">
            <select value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'te')} aria-label={t('ai.language')}>
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={() => reply.mutate()} disabled={busy}>
              {reply.isPending ? t('ai.thinking') : t('ai.suggestReply')}
            </button>
          </div>
          {busy && <p className="muted small">{t('ai.wait')}</p>}
          {error && <p className="alert">{errorMessage(error, t)}</p>}
          {result && !busy && (
            <div className="ai-result">
              <strong>{result.kind === 'summary' ? t('ai.summaryTitle') : t('ai.replyTitle')}</strong>
              <p className="pre-wrap">{result.data.text}</p>
              {result.kind === 'reply' && (
                <button type="button" className="btn btn-block" onClick={() => onUseReply(result.data.text)}>
                  {t('ai.useReply')}
                </button>
              )}
              <small className="muted">
                {t('ai.generatedBy', { provider: result.data.provider })} · {t('ai.check')}
              </small>
            </div>
          )}
        </>
      )}
    </div>
  )
}
