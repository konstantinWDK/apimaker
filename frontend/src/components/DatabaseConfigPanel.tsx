import { useEffect, useState } from 'react'

interface DbConfig {
  database_type: 'sqlite' | 'postgresql'
  postgres_url?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
}

export function DatabaseConfigPanel() {
  const [config, setConfig] = useState<DbConfig>({
    database_type: 'postgresql',
    postgres_url: '',
    host: '',
    port: 5432,
    username: '',
    password: '',
    database: '',
  })
  const [currentDb, setCurrentDb] = useState<{
    type: string
    postgres_configured: boolean
  } | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
    counts?: {
      users_synced: number
      projects_synced: number
      datasets_synced: number
      fields_synced: number
      endpoints_synced: number
      shares_synced: number
      skipped: number
      errors: string[]
    }
  } | null>(null)
  const [useConnectionString, setUseConnectionString] = useState(false)

  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
  const backendBaseUrl = typeof window !== 'undefined'
    ? (localStorage.getItem('apimaker-backend-url') || 'http://localhost:8000')
    : 'http://localhost:8000'

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Load current DB status
  useEffect(() => {
    fetch(`${backendBaseUrl}/admin/config`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data) => {
        setCurrentDb({
          type: data.current_database_info?.type || 'sqlite',
          postgres_configured: data.postgres_configured || false,
        })
        if (data.postgres_configured) {
          setConfig((prev) => ({ ...prev, database_type: 'postgresql' }))
        }
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const body: DbConfig = { database_type: 'postgresql' }
      if (useConnectionString) {
        body.postgres_url = config.postgres_url
      } else {
        body.host = config.host
        body.port = config.port
        body.username = config.username
        body.password = config.password
        body.database = config.database
      }

      const res = await fetch(`${backendBaseUrl}/admin/config/test-db`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setTestResult({ success: data.success, message: data.message })
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Error de conexión' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveResult(null)
    setSyncResult(null)
    try {
      const body: DbConfig = { database_type: config.database_type }
      if (config.database_type === 'postgresql') {
        if (useConnectionString) {
          body.postgres_url = config.postgres_url
        } else {
          body.host = config.host
          body.port = config.port
          body.username = config.username
          body.password = config.password
          body.database = config.database
        }
      }

      const res = await fetch(`${backendBaseUrl}/admin/config`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar')
      setSaveResult(data.message)
      setCurrentDb({ type: 'postgresql', postgres_configured: true })
    } catch (err) {
      setSaveResult(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    if (!confirm('¿Sincronizar todos los datos de SQLite a PostgreSQL? Los registros existentes se omitirán.')) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${backendBaseUrl}/admin/sync`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error en la sincronización')
      setSyncResult({
        success: data.success,
        message: data.message,
        counts: data.counts,
      })
    } catch (err) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="db-config-panel">
      {/* Connection status bar */}
      <div className="db-config-panel__status-bar">
        <span className={`db-config-panel__status-dot ${currentDb?.type === 'postgresql' ? 'pg' : 'sqlite'}`} />
        <span className="db-config-panel__status-text">
          {currentDb?.type === 'postgresql'
            ? `Conectado a PostgreSQL`
            : `SQLite (desarrollo)`}
        </span>
      </div>

      {/* Database type selector */}
      <div className="db-config-panel__type-selector">
        <button
          type="button"
          className={config.database_type === 'sqlite' ? 'db-type-btn active' : 'db-type-btn'}
          onClick={() => setConfig({ ...config, database_type: 'sqlite' })}
        >
          SQLite (desarrollo)
        </button>
        <button
          type="button"
          className={config.database_type === 'postgresql' ? 'db-type-btn active' : 'db-type-btn'}
          onClick={() => setConfig({ ...config, database_type: 'postgresql' })}
        >
          PostgreSQL (producción)
        </button>
      </div>

      {/* SQLite info */}
      {config.database_type === 'sqlite' && (
        <div className="db-config-panel__section">
          <p className="db-config-panel__muted">
            Base de datos por defecto. Ideal para desarrollo y pruebas locales.
          </p>
          <p className="db-config-panel__path">
            📄 <code>backend/app/data/apimaker.db</code>
          </p>
        </div>
      )}

      {/* PostgreSQL config */}
      {config.database_type === 'postgresql' && (
        <div className="db-config-panel__section">
          <div className="db-config-panel__input-mode">
            <label>
              <input
                type="checkbox"
                checked={useConnectionString}
                onChange={(e) => setUseConnectionString(e.target.checked)}
              />
              Connection string completa
            </label>
          </div>

          {useConnectionString ? (
            <div className="db-config-panel__field">
              <label>Connection String</label>
              <input
                type="text"
                placeholder="postgresql+psycopg2://user:pass@host:5432/apimaker"
                value={config.postgres_url || ''}
                onChange={(e) => setConfig({ ...config, postgres_url: e.target.value })}
              />
            </div>
          ) : (
            <>
              <div className="db-config-panel__row">
                <div className="db-config-panel__field">
                  <label>Host</label>
                  <input
                    type="text"
                    placeholder="localhost"
                    value={config.host || ''}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  />
                </div>
                <div className="db-config-panel__field db-config-panel__field--small">
                  <label>Puerto</label>
                  <input
                    type="number"
                    placeholder="5432"
                    value={config.port || 5432}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 5432 })}
                  />
                </div>
              </div>
              <div className="db-config-panel__row">
                <div className="db-config-panel__field">
                  <label>Usuario</label>
                  <input
                    type="text"
                    placeholder="postgres"
                    value={config.username || ''}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  />
                </div>
                <div className="db-config-panel__field">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={config.password || ''}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="db-config-panel__field">
                <label>Base de datos</label>
                <input
                  type="text"
                  placeholder="apimaker"
                  value={config.database || ''}
                  onChange={(e) => setConfig({ ...config, database: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Test & Save buttons */}
          <div className="db-config-panel__actions">
            <button
              type="button"
              className="btn ghost btn-small"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? 'Probando...' : 'Probar conexión'}
            </button>
            <button
              type="button"
              className="btn primary btn-small"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar y reiniciar backend'}
            </button>
          </div>

          {/* Sync section (only shown if postgres is configured) */}
          {currentDb?.postgres_configured && (
            <>
              <div className="db-config-panel__divider">
                <span>Sincronización</span>
              </div>
              <p className="db-config-panel__muted">
                Transfiere datos de SQLite a PostgreSQL con un clic.
              </p>
              <div className="db-config-panel__sync-flow">
                <span className="db-config-panel__sync-badge sqlite">SQLite</span>
                <span className="db-config-panel__sync-arrow">→</span>
                <span className="db-config-panel__sync-badge pg">PostgreSQL</span>
              </div>
              <button
                type="button"
                className="btn primary btn-full"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar bases de datos'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {testResult && (
        <div className={`db-config-panel__result ${testResult.success ? 'success' : 'error'}`}>
          {testResult.success ? '✓' : '✗'} {testResult.message}
        </div>
      )}
      {saveResult && (
        <div className="db-config-panel__result save">
          ⚠️ {saveResult}
        </div>
      )}
      {syncResult && (
        <div className={`db-config-panel__result ${syncResult.success ? 'success' : 'error'}`}>
          <p><strong>{syncResult.success ? '✓' : '✗'}</strong> {syncResult.message}</p>
          {syncResult.success && syncResult.counts && (
            <div className="db-config-panel__sync-details">
              {syncResult.counts.users_synced > 0 && <span>👤 {syncResult.counts.users_synced}</span>}
              {syncResult.counts.projects_synced > 0 && <span>📁 {syncResult.counts.projects_synced}</span>}
              {syncResult.counts.datasets_synced > 0 && <span>📊 {syncResult.counts.datasets_synced}</span>}
              {syncResult.counts.endpoints_synced > 0 && <span>🔗 {syncResult.counts.endpoints_synced}</span>}
              {syncResult.counts.skipped > 0 && <span className="muted">⏭ {syncResult.counts.skipped}</span>}
            </div>
          )}
        </div>
      )}

      <style>{`
        .db-config-panel {
          padding: 1.25rem;
          background: #ffffff;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        .db-config-panel__status-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border-radius: 6px;
          margin-bottom: 1rem;
          border: 1px solid #e2e8f0;
        }
        .db-config-panel__status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #94a3b8;
        }
        .db-config-panel__status-dot.sqlite {
          background: #3b82f6;
        }
        .db-config-panel__status-dot.pg {
          background: #22c55e;
        }
        .db-config-panel__status-text {
          font-size: 0.82rem;
          color: #475569;
          font-weight: 500;
        }
        .db-config-panel__type-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .db-type-btn {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .db-type-btn:hover {
          border-color: #94a3b8;
        }
        .db-type-btn.active {
          background: #4f8cff;
          border-color: #4f8cff;
          color: #ffffff;
        }
        .db-config-panel__section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .db-config-panel__muted {
          margin: 0;
          font-size: 0.8rem;
          color: #94a3b8;
        }
        .db-config-panel__path {
          margin: 0;
          font-size: 0.72rem;
          color: #cbd5e1;
        }
        .db-config-panel__path code {
          background: #f1f5f9;
          padding: 0.15rem 0.35rem;
          border-radius: 3px;
          font-size: 0.72rem;
          color: #64748b;
        }
        .db-config-panel__row {
          display: flex;
          gap: 0.5rem;
        }
        .db-config-panel__field {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }
        .db-config-panel__field--small {
          flex: 0 0 100px;
        }
        .db-config-panel__field label {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .db-config-panel__field input {
          padding: 0.4rem 0.6rem;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.85rem;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .db-config-panel__field input:focus {
          outline: none;
          border-color: #4f8cff;
          box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.12);
        }
        .db-config-panel__field input::placeholder {
          color: #cbd5e1;
        }
        .db-config-panel__input-mode label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: #64748b;
          cursor: pointer;
        }
        .db-config-panel__actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }
        .db-config-panel__divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .db-config-panel__divider::before,
        .db-config-panel__divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }
        .db-config-panel__divider span {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .db-config-panel__sync-flow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .db-config-panel__sync-badge {
          padding: 0.3rem 0.7rem;
          border-radius: 5px;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .db-config-panel__sync-badge.sqlite {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }
        .db-config-panel__sync-badge.pg {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }
        .db-config-panel__sync-arrow {
          font-size: 1rem;
          color: #94a3b8;
        }
        .db-config-panel__result {
          padding: 0.6rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }
        .db-config-panel__result p {
          margin: 0 0 0.3rem;
        }
        .db-config-panel__result.success {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .db-config-panel__result.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .db-config-panel__result.save {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }
        .db-config-panel__sync-details {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.3rem;
          font-size: 0.78rem;
        }
        .db-config-panel__sync-details span {
          padding: 0.15rem 0.4rem;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 3px;
        }
        .db-config-panel__sync-details .muted {
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}
