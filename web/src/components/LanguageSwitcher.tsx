import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <label className="lang-switcher">
      <span className="visually-hidden">{t('language')}</span>
      <select value={i18n.resolvedLanguage} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
