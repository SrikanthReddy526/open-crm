import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Modal dialog using the native <dialog> element (Esc and the ✕ button close it). */
export function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
    return () => el?.close()
  }, [])

  return (
    <dialog ref={ref} className="dialog" onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label={t('common.close')}>
          ✕
        </button>
      </div>
      {children}
    </dialog>
  )
}
