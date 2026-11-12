import { useTranslation } from 'react-i18next'

interface Props {
  page: number // 0-based
  totalPages: number
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, onChange }: Props) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label="pagination">
      <button type="button" className="btn" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        ‹ {t('common.previous')}
      </button>
      <span>{t('common.pageOf', { page: page + 1, total: totalPages })}</span>
      <button type="button" className="btn" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        {t('common.next')} ›
      </button>
    </nav>
  )
}
