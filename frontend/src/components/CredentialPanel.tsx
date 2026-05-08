import { useEffect, useState } from 'react'

interface Props {
  currentUsername: string
  onUpdate: (username: string, newPassword: string, currentPassword: string) => Promise<void>
  onReset: () => Promise<void>
}

export function CredentialPanel({ currentUsername, onUpdate, onReset }: Props) {
  const [username, setUsername] = useState(currentUsername)
  useEffect(() => {
    setUsername(currentUsername)
  }, [currentUsername])
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password.trim() || !currentPassword.trim()) {
      setMessage('Indica usuario y las contraseñas solicitadas')
      return
    }
    if (password !== confirm) {
      setMessage('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await onUpdate(username, password, currentPassword)
      setPassword('')
      setConfirm('')
      setCurrentPassword('')
      setMessage('Credenciales actualizadas. Vuelve a iniciar sesión para aplicar cambios.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="credential-panel" onSubmit={handleSubmit}>
      <h4>Credenciales del builder</h4>
      <p className="muted-text">Por defecto: admin / admin. Cámbialos después de instalar la herramienta.</p>
      <div className="form-field">
        <label className="label" htmlFor="cred-username">
          Usuario
        </label>
        <input id="cred-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} />
      </div>
      <div className="form-grid credential-panel__passwords">
        <div className="form-field">
          <label className="label" htmlFor="cred-current">
            Contraseña actual
          </label>
          <input id="cred-current" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div className="form-field">
          <label className="label" htmlFor="cred-password">
            Nueva contraseña
          </label>
          <input id="cred-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div className="form-field">
          <label className="label" htmlFor="cred-confirm">
            Confirmar contraseña
          </label>
          <input id="cred-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
      </div>
      {message ? <p className={message.startsWith('Credenciales') ? 'success-text' : 'error-text'}>{message}</p> : null}
      <div className="credential-panel__actions">
        <button type="submit" className="btn primary btn-small" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar credenciales'}
        </button>
        <button
          type="button"
          className="btn ghost btn-small"
          onClick={async () => {
            setLoading(true)
            await onReset()
            setLoading(false)
            setMessage('Credenciales restablecidas. Inicia sesión con admin/admin.')
          }}
        >
          Restablecer a admin/admin
        </button>
      </div>
    </form>
  )
}
