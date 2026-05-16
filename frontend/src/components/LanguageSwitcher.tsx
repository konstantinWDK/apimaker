import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.language

  const toggle = () => {
    const next = current === 'en' ? 'es' : 'en'
    setLanguage(next)
  }

  return (
    <button
      type="button"
      className="language-switcher"
      onClick={toggle}
      title={current === 'en' ? t('app.spanish') : t('app.english')}
    >
      <Globe size={14} />
      <span>{current === 'en' ? 'ES' : 'EN'}</span>
    </button>
  )
}
