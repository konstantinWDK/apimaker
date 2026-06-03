import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  currentUsername: string
  onUpdate: (newUsername: string, newPassword: string, currentPassword: string) => Promise<void>
  onReset: () => Promise<void>
}

export function CredentialPanel({ currentUsername, onUpdate, onReset }: Props) {
  const { t } = useTranslation()
  const [username, setUsername] = useState(currentUsername)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !currentPassword.trim()) {
      setMessage({ text: t('credentials.missingFields'), type: 'error' })
      return
    }
    if (password && password !== confirm) {
      setMessage({ text: t('credentials.passwordsDontMatch'), type: 'error' })
      return
    }
    setLoading(true)
    try {
      await onUpdate(username, password, currentPassword)
      setPassword('')
      setConfirm('')
      setCurrentPassword('')
      setMessage({ text: t('credentials.updated'), type: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : t('credentials.updateFailed'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="credential-panel" onSubmit={handleSubmit}>
      <h4>{t('credentials.title')}</h4>
      <p className="muted-text">{t('credentials.defaultHint')}</p>
      <div className="form-field">
        <label className="label" htmlFor="cred-username">{t('credentials.username')}</label>
        <input id="cred-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="form-grid credential-panel__passwords">
        <div className="form-field">
          <label className="label" htmlFor="cred-current">{t('credentials.currentPassword')}</label>
          <input id="cred-current" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div className="form-field">
          <label className="label" htmlFor="cred-password">{t('credentials.newPassword')}</label>
          <input id="cred-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('credentials.newPasswordPlaceholder')} />
        </div>
        <div className="form-field">
          <label className="label" htmlFor="cred-confirm">{t('credentials.confirmPassword')}</label>
          <input id="cred-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
      </div>
      {message ? <p className={message.type === 'success' ? 'success-text' : 'error-text'}>{message.text}</p> : null}
      <div className="credential-panel__actions">
        <button type="submit" className="btn primary btn-small" disabled={loading}>
          {loading ? t('credentials.saving') : t('credentials.save')}
        </button>
        <button
          type="button"
          className="btn ghost btn-small"
          onClick={async () => {
            setLoading(true)
            await onReset()
            setLoading(false)
            setMessage({ text: t('credentials.resetDone'), type: 'success' })
          }}
        >
          {t('credentials.reset')}
        </button>
      </div>
    </form>
  )
}
