import { useState } from 'react'

interface Props {
  onLogin: (username: string, password: string) => Promise<boolean>
  error?: string | null
}

export function LoginScreen({ onLogin, error }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    const ok = await onLogin(username, password)
    if (!ok) {
      setLocalError('Credenciales incorrectas')
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
      <div className="login-card">
        <h1>API Maker</h1>
        <p>Inicia sesión para acceder al builder. Usuario y contraseña por defecto: <code>admin/admin</code>.</p>
        <p className="muted-text">Por seguridad, cambia estas credenciales en cuanto ingreses (pestaña Información &gt; Credenciales del builder).</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="label" htmlFor="login-username">
            Usuario
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
          />
          <label className="label" htmlFor="login-password">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="admin"
          />
          {error || localError ? <p className="error-text">{error ?? localError}</p> : null}
          <button type="submit" className="btn primary login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
