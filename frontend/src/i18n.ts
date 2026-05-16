import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './i18n/en.json'
import es from './i18n/es.json'

const savedLang = typeof window !== 'undefined' 
  ? window.localStorage.getItem('doapi-language') 
  : null

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: savedLang || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string) {
  i18n.changeLanguage(lang)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('doapi-language', lang)
  }
}

export default i18n
