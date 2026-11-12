import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCustomer, useCustomerList } from '../features/customers/hooks'

interface Props {
  value: string
  onChange: (customerId: string) => void
  required?: boolean
  error?: string
}

/** Search-as-you-type customer selector (works offline from the saved copy too). */
export function CustomerPicker({ value, onChange, required, error }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const selected = useCustomer(value || undefined)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(h)
  }, [text])

  const results = useCustomerList({ q, page: 0, size: 8 })

  if (value && selected.data) {
    return (
      <div className="field">
        <span>
          {t('fields.customer')}
          {required && ' *'}
        </span>
        <div className="picked">
          <span>
            <strong>{selected.data.name}</strong>
            {selected.data.city && <span className="muted"> · {selected.data.city}</span>}
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => onChange('')}>
            {t('common.change')}
          </button>
        </div>
        {error && <small className="field-error">{error}</small>}
      </div>
    )
  }

  return (
    <div className="field picker">
      <label htmlFor={id}>
        {t('fields.customer')}
        {required && ' *'}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder={t('customers.searchPlaceholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      {open && (
        <ul className="picker-list" id={`${id}-list`} role="listbox">
          {results.isPending ? (
            <li className="muted">{t('common.loading')}</li>
          ) : results.data?.content.length ? (
            results.data.content.map((c) => (
              <li key={c.id} role="none">
                <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(c.id)}>
                  <strong>{c.name}</strong>
                  <span className="muted"> {[c.company, c.city].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="muted">{t('common.noMatches')}</li>
          )}
        </ul>
      )}
      {error && <small className="field-error">{error}</small>}
    </div>
  )
}
