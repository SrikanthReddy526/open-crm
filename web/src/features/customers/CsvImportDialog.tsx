import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../../api/errors'
import { useImportCustomers } from './hooks'

export function CsvImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const importMutation = useImportCustomers()

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (file) importMutation.mutate(file)
  }

  const result = importMutation.data

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <h2>{t('import.title')}</h2>
        <p className="muted">{t('import.help')}</p>

        <label className="field">
          <span>{t('import.chooseFile')}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              importMutation.reset()
            }}
          />
        </label>

        {importMutation.isError && <p className="alert">{errorMessage(importMutation.error, t)}</p>}

        {result && (
          <div className="import-result">
            <p className={result.failed > 0 ? 'warning' : 'success'}>
              {t('import.result', { imported: result.imported, failed: result.failed })}
            </p>
            {result.errors.length > 0 && (
              <div className="scroll-box">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('import.row')}</th>
                      <th>{t('import.problem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err) => (
                      <tr key={err.row}>
                        <td>{err.row}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            {t('common.close')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!file || importMutation.isPending}>
            {importMutation.isPending ? t('import.uploading') : t('import.upload')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
