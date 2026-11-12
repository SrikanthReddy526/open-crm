import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { dealsApi, type DealListParams } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import { DEAL_STAGES, type Deal, type DealStage } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { formatDate, formatMoney } from '../../lib/format'

/** Deal table (also shown on the customer page). */
export function DealTable({ params }: { params: DealListParams }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const deals = useQuery({
    queryKey: ['deals', 'list', params, page],
    queryFn: () => dealsApi.list({ ...params, page, size: 20 }),
    placeholderData: keepPreviousData,
  })

  if (deals.isPending) return <p className="muted">{t('common.loading')}</p>
  if (deals.isError) return <p className="alert">{errorMessage(deals.error, t)}</p>
  if (deals.data.content.length === 0) return <p className="empty">{t('deals.empty')}</p>

  return (
    <>
      <table className="table responsive-table">
        <thead>
          <tr>
            <th>{t('deals.dealTitle')}</th>
            {!params.customerId && <th>{t('fields.customer')}</th>}
            <th className="num">{t('fields.amount')}</th>
            <th>{t('deals.stage')}</th>
            <th>{t('deals.expectedClose')}</th>
            <th>{t('customers.owner')}</th>
          </tr>
        </thead>
        <tbody>
          {deals.data.content.map((d) => (
            <tr key={d.id} className="clickable" onClick={() => navigate(`/deals/${d.id}`)}>
              <td data-label={t('deals.dealTitle')}>
                <Link to={`/deals/${d.id}`} onClick={(e) => e.stopPropagation()}>
                  {d.title}
                </Link>
              </td>
              {!params.customerId && <td data-label={t('fields.customer')}>{d.customerName ?? '—'}</td>}
              <td data-label={t('fields.amount')} className="num">
                {formatMoney(d.amount, d.currency)}
              </td>
              <td data-label={t('deals.stage')}>
                <Badge group="dealStage" value={d.stage} />
              </td>
              <td data-label={t('deals.expectedClose')}>{formatDate(d.expectedCloseDate)}</td>
              <td data-label={t('customers.owner')}>{d.ownerName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={deals.data.page} totalPages={deals.data.totalPages} onChange={setPage} />
    </>
  )
}

/** Pipeline board: one column per stage. Move a deal with the arrows (works on touch screens too). */
function DealBoard({ q }: { q: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const pipeline = useQuery({ queryKey: ['deals', 'pipeline'], queryFn: dealsApi.pipeline })
  const deals = useQuery({
    queryKey: ['deals', 'board', q],
    queryFn: () => dealsApi.list({ q, size: 100, sort: 'updatedAt,desc' }),
  })
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) => dealsApi.setStage(id, stage),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  })

  if (deals.isPending) return <p className="muted">{t('common.loading')}</p>
  if (deals.isError) return <p className="alert">{errorMessage(deals.error, t)}</p>

  const byStage = new Map<DealStage, Deal[]>(DEAL_STAGES.map((s) => [s, []]))
  deals.data.content.forEach((d) => byStage.get(d.stage)!.push(d))

  return (
    <>
      {move.isError && <p className="alert">{errorMessage(move.error, t)}</p>}
      <div className="board">
        {DEAL_STAGES.map((stage, i) => {
          const sum = pipeline.data?.find((p) => p.stage === stage)
          return (
            <div key={stage} className={`board-col stage-${stage}`}>
              <div className="board-head">
                <strong>{t(`dealStage.${stage}`)}</strong>
                <small className="muted">
                  {sum ? `${sum.count} · ${formatMoney(sum.totalAmount, 'INR', true)}` : ''}
                </small>
              </div>
              {byStage.get(stage)!.map((d) => (
                <div key={d.id} className="board-card">
                  <Link to={`/deals/${d.id}`}>
                    <strong>{d.title}</strong>
                  </Link>
                  <div className="muted small">{d.customerName}</div>
                  <div className="board-card-foot">
                    <span>{formatMoney(d.amount, d.currency)}</span>
                    <span className="row-actions">
                      <button type="button" className="btn btn-ghost icon-btn" disabled={i === 0 || move.isPending} aria-label={t('deals.moveBack')} onClick={() => move.mutate({ id: d.id, stage: DEAL_STAGES[i - 1] })}>
                        ‹
                      </button>
                      <button type="button" className="btn btn-ghost icon-btn" disabled={i === DEAL_STAGES.length - 1 || move.isPending} aria-label={t('deals.moveForward')} onClick={() => move.mutate({ id: d.id, stage: DEAL_STAGES[i + 1] })}>
                        ›
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function DealListPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'board' ? 'board' : 'list'
  const stage = (params.get('stage') as DealStage | null) ?? undefined
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(h)
  }, [search])

  function set(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t('deals.title')}</h1>
        <div className="actions">
          <div className="segmented">
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => set('view', null)}>
              ☰ {t('deals.listView')}
            </button>
            <button type="button" className={view === 'board' ? 'active' : ''} onClick={() => set('view', 'board')}>
              ▦ {t('deals.boardView')}
            </button>
          </div>
          <Link to="/deals/new" className="btn btn-primary">
            + {t('deals.new')}
          </Link>
        </div>
      </div>
      <div className="filters">
        <input type="search" className="search" placeholder={t('deals.searchPlaceholder')} aria-label={t('deals.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        {view === 'list' && (
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!stage} className={!stage ? 'active' : ''} onClick={() => set('stage', null)}>
              {t('common.all')}
            </button>
            {DEAL_STAGES.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={stage === s} className={stage === s ? 'active' : ''} onClick={() => set('stage', s)}>
                {t(`dealStage.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      {view === 'board' ? <DealBoard q={q} /> : <DealTable key={`${q}|${stage ?? ''}`} params={{ q, stage }} />}
    </section>
  )
}
