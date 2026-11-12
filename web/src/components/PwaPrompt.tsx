import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registers the service worker (website only) and offers to reload when a new version was deployed.
 * Render it only on the website: Capacitor/Electron already package the app files.
 */
export function PwaPrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) setInterval(() => void registration.update(), 3600_000)
    },
  })

  if (!needRefresh && !offlineReady) return null
  return (
    <div className="pwa-banner" role="status">
      <span>{needRefresh ? t('pwa.updateReady') : t('pwa.offlineReady')}</span>
      {needRefresh && (
        <button type="button" className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
          {t('pwa.reload')}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost icon-btn"
        aria-label={t('common.close')}
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
      >
        ✕
      </button>
    </div>
  )
}
