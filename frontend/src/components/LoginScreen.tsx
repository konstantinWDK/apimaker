import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginParticles } from './LoginParticles'

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>
  error?: string | null
}

export function LoginScreen({ onLogin, error }: Props) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    const ok = await onLogin(username, password)
    if (!ok) {
      setLocalError(t('login.error'))
    } else {
      setLocalError(null)
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      }
    }
    setLoading(false)
  }

  return (
    <div className="login-shell">
      <LoginParticles />
      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="login-logo">
          <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
            <rect width="40" height="40" rx="10" fill="#6366f1" />
            <path d="M20 12v16m-6-10l6-6 6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>{t('login.title')}</h1>
        <p className="login-desc">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="label" htmlFor="login-username">
            {t('login.username')}
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t('login.usernamePlaceholder')}
          />
          <label className="label" htmlFor="login-password">
            {t('login.password')}
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('login.passwordPlaceholder')}
          />
          {error || localError ? <p className="error-text">{error ?? localError}</p> : null}
          <button type="submit" className="btn primary login-button" disabled={loading}>
            {loading ? t('login.loggingIn') : t('login.login')}
          </button>
        </form>
        <p className="muted-text login-hint">
          {t('login.defaultCredentials')}
        </p>
      </div>
    </div>
  )
}
