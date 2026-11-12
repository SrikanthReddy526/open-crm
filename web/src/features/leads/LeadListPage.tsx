import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { leadsApi } from '../../api/crm'
import { errorMessage } from '../../api/errors'
import { LEAD_STATUSES, type LeadStatus } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Pagination } from '../../components/Pagination'
import { formatRelative, telHref } from '../../lib/format'

export function LeadListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as LeadStatus | null) ?? undefined
  const page = Number(params.get('page') ?? 0) || 0
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [q, setQ] = useState(search)

  useEffect(() => {
    const h = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(h)
  }, [search])

  const leads = useQuery({
    queryKey: ['leads', 'list', q, status, page],
    queryFn: () => leadsApi.list({ q, status, page, size: 20 }),
    placeholderData: keepPreviousData,
  })

  function set(key: string, value: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t('leads.title')}</h1>
        <div className="actions">
          <Link to="/leads/new" className="btn btn-primary">
            + {t('leads.new')}
          </Link>
        </div>
      </div>
      <div className="filters">
        <input type="search" className="search" placeholder={t('customers.searchPlaceholder')} aria-label={t('leads.title')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!status} className={!status ? 'active' : ''} onClick={() => set('status', null)}>
            {t('leads.active')}
          </button>
          {LEAD_STATUSES.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? 'active' : ''} onClick={() => set('status', s)}>
              {t(`leadStatus.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {leads.isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : leads.isError ? (
        <p className="alert">{errorMessage(leads.error, t)}</p>
      ) : leads.data.content.length === 0 ? (
        <p className="empty">{t('leads.empty')}</p>
      ) : (
        <>
          <table className="table responsive-table">
            <thead>
              <tr>
                <th>{t('fields.name')}</th>
                <th>{t('fields.phone')}</th>
                <th>{t('fields.status')}</th>
                <th>{t('leads.source')}</th>
                <th>{t('customers.owner')}</th>
                <th>{t('leads.added')}</th>
              </tr>
            </thead>
            <tbody>
              {leads.data.content.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => navigate(`/leads/${l.id}`)}>
                  <td data-label={t('fields.name')}>
                    <Link to={`/leads/${l.id}`} onClick={(e) => e.stopPropagation()}>
                      {l.name}
                    </Link>
                    {l.company && <div className="muted small">{l.company}</div>}
                  </td>
                  <td data-label={t('fields.phone')}>
                    {l.phone ? (
                      <a href={telHref(l.phone)} onClick={(e) => e.stopPropagation()}>
                        {l.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label={t('fields.status')}>
                    <Badge group="leadStatus" value={l.status} />
                  </td>
                  <td data-label={t('leads.source')}>{l.source ? t(`leadSource.${l.source}`) : '—'}</td>
                  <td data-label={t('customers.owner')}>{l.ownerName ?? '—'}</td>
                  <td data-label={t('leads.added')}>{formatRelative(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={leads.data.page} totalPages={leads.data.totalPages} onChange={(p) => set('page', String(p))} />
        </>
      )}
    </section>
  )
}
