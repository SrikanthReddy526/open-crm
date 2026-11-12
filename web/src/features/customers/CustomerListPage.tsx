import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { customersApi } from '../../api/customers'
import { errorMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { Pagination } from '../../components/Pagination'
import { saveBlob } from '../../platform/download'
import { CsvImportDialog } from './CsvImportDialog'
import { useCustomerList } from './hooks'

const PAGE_SIZE = 20

export function CustomerListPage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? '0') || 0)

  const [search, setSearch] = useState(q)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Debounce typing → update the URL (?q=...), which triggers the query.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (search.trim() === q) return
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (search.trim()) next.set('q', search.trim())
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(handle)
  }, [search, q, setParams])

  const { data, isPending, isError, error, isFetching, refetch } = useCustomerList({ q, page, size: PAGE_SIZE })

  function goToPage(p: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }

  async function onExport() {
    setActionError(null)
    setExporting(true)
    try {
      await saveBlob(await customersApi.exportCsv(q), `customers-${new Date().toLocaleDateString('sv')}.csv`) // local YYYY-MM-DD
    } catch (err) {
      setActionError(errorMessage(err, t))
    } finally {
      setExporting(false)
    }
  }

  async function onTemplate() {
    setActionError(null)
    try {
      await saveBlob(await customersApi.template(), 'customers-template.csv')
    } catch (err) {
      setActionError(errorMessage(err, t))
    }
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t('customers.title')}</h1>
        <div className="actions">
          {hasRole('ADMIN') && (
            <>
              <button type="button" className="btn" onClick={onTemplate}>
                {t('customers.template')}
              </button>
              <button type="button" className="btn" onClick={() => setImportOpen(true)}>
                {t('customers.import')}
              </button>
            </>
          )}
          {hasRole('ADMIN', 'SUPPORT_AGENT') && (
            <button type="button" className="btn" onClick={onExport} disabled={exporting}>
              {exporting ? t('customers.exporting') : t('customers.export')}
            </button>
          )}
          <Link to="/customers/new" className="btn btn-primary">
            + {t('customers.new')}
          </Link>
        </div>
      </div>

      <input
        type="search"
        className="search"
        aria-label={t('customers.searchLabel')}
        placeholder={t('customers.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {actionError && <p className="alert">{actionError}</p>}

      {isPending ? (
        <p className="muted">{t('common.loading')}</p>
      ) : isError ? (
        <div className="alert">
          {errorMessage(error, t)}{' '}
          <button type="button" className="btn" onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </div>
      ) : data.content.length === 0 ? (
        <p className="empty">{q ? t('customers.noResults', { q }) : t('customers.empty')}</p>
      ) : (
        <>
          {data.offline && <p className="offline-note">{t('sync.showingSaved')}</p>}
          <p className="muted">
            {t('customers.count', { count: data.totalElements })}
            {isFetching && ` · ${t('common.loading')}`}
          </p>
          <table className="table responsive-table">
            <thead>
              <tr>
                <th>{t('fields.name')}</th>
                <th>{t('fields.company')}</th>
                <th>{t('fields.phone')}</th>
                <th>{t('fields.city')}</th>
                <th>{t('customers.location')}</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td data-label={t('fields.name')}>
                    <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </Link>
                    {(c as { pending?: boolean }).pending && <> ⏳</>}
                  </td>
                  <td data-label={t('fields.company')}>{c.company ?? '—'}</td>
                  <td data-label={t('fields.phone')}>
                    {c.phone ? (
                      <a href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={(e) => e.stopPropagation()}>
                        {c.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label={t('fields.city')}>{c.city ?? '—'}</td>
                  <td data-label={t('customers.location')}>
                    {c.latitude != null ? `📍 ${t('customers.hasLocation')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={goToPage} />
        </>
      )}

      {importOpen && <CsvImportDialog onClose={() => setImportOpen(false)} />}
    </section>
  )
}
