import { useEffect, useState } from 'react'
import { readBackendConfig } from '../lib/backendConfig'

interface DbConfig {
  database_type: 'sqlite' | 'postgresql'
  postgres_url?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
}

interface AdminConfig {
  dev: DbConfig
  prod: DbConfig
  current_database_info: {
    type: string
    url: string
    host?: string
    database?: string
    username?: string
  }
  environment: string
}

export function DatabaseConfigPanel() {
  const [config, setConfig] = useState<DbConfig>({ database_type: 'sqlite', port: 5432 })
  const [currentInfo, setCurrentInfo] = useState<AdminConfig['current_database_info'] | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [useConnectionString, setUseConnectionString] = useState(false)

  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
  const { baseUrl: backendBaseUrl } = readBackendConfig()

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Load current DB status
  useEffect(() => {
    fetch(`${backendBaseUrl}/admin/config`, { headers: authHeaders })
      .then((r) => r.json())
      .then((data: AdminConfig) => {
        setConfig(data.dev)
        setCurrentInfo(data.current_database_info)
      })
      .catch(() => { /* ignore */ })
  }, [])

  const updateCurrentConfig = (updates: Partial<DbConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const body: any = { database_type: config.database_type }
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
    try {
      const res = await fetch(`${backendBaseUrl}/admin/config`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          environment: 'development',
          config: config
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al guardar')
      setSaveResult(data.message)
    } catch (err) {
      setSaveResult(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="db-config-panel-v2">
      {/* Current Status Header */}
      <div className="db-status-header">
        <div className="db-status-header__info">
          <div className="db-status-badge">
            <span className={`dot ${currentInfo?.type === 'postgresql' ? 'active' : 'idle'}`} />
            <span className="text">
              {currentInfo?.type === 'postgresql' ? 'PostgreSQL Activo' : 'SQLite Activo'}
            </span>
          </div>
        </div>
      </div>

      <div className="config-content">
        <p className="config-section__desc" style={{ marginBottom: '1rem' }}>
          Configura la base de datos del builder. La base de datos de las APIs desplegadas se configura desde la página de Despliegue.
        </p>

        {/* Database Type */}
        <div className="form-section">
          <label className="section-label">Motor de Base de Datos</label>
          <div className="type-toggle">
            <button 
              className={config.database_type === 'sqlite' ? 'active' : ''}
              onClick={() => updateCurrentConfig({ database_type: 'sqlite' })}
            >
              SQLite
            </button>
            <button 
              className={config.database_type === 'postgresql' ? 'active' : ''}
              onClick={() => updateCurrentConfig({ database_type: 'postgresql' })}
            >
              PostgreSQL
            </button>
          </div>
        </div>

        {/* SQLite Info */}
        {config.database_type === 'sqlite' && (
          <div className="sqlite-info">
            <div className="info-icon">📦</div>
            <div className="info-text">
              <p>Base de datos local</p>
              <span>No requiere configuración adicional. Ideal para desarrollo.</span>
            </div>
          </div>
        )}

        {/* PostgreSQL Form */}
        {config.database_type === 'postgresql' && (
          <div className="pg-form">
            <div className="connection-mode">
              <label className="checkbox-container">
                <input type="checkbox" checked={useConnectionString} onChange={e => setUseConnectionString(e.target.checked)} />
                <span className="checkmark"></span>
                Usar Connection String completa
              </label>
            </div>
            {useConnectionString ? (
              <div className="field">
                <label>URL de Conexión</label>
                <input type="text" placeholder="postgresql+psycopg2://user:pass@host:5432/db"
                  value={config.postgres_url || ''} onChange={e => updateCurrentConfig({ postgres_url: e.target.value })} />
              </div>
            ) : (
              <div className="grid-form">
                <div className="field"><label>Host</label>
                  <input type="text" placeholder="localhost" value={config.host || ''} onChange={e => updateCurrentConfig({ host: e.target.value })} /></div>
                <div className="field small"><label>Puerto</label>
                  <input type="number" value={config.port || 5432} onChange={e => updateCurrentConfig({ port: parseInt(e.target.value) || 5432 })} /></div>
                <div className="field"><label>Usuario</label>
                  <input type="text" placeholder="postgres" value={config.username || ''} onChange={e => updateCurrentConfig({ username: e.target.value })} /></div>
                <div className="field"><label>Contraseña</label>
                  <input type="password" value={config.password || ''} onChange={e => updateCurrentConfig({ password: e.target.value })} /></div>
                <div className="field full"><label>Base de Datos</label>
                  <input type="text" placeholder="apimaker" value={config.database || ''} onChange={e => updateCurrentConfig({ database: e.target.value })} /></div>
              </div>
            )}
            <div className="actions">
              <button className="btn-test" onClick={handleTest} disabled={testing}>{testing ? 'Verificando...' : 'Probar Conexión'}</button>
            </div>
          </div>
        )}

        <div className="save-section">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
          <p className="save-hint">Los cambios requieren reiniciar el backend para surtir efecto.</p>
        </div>

        {testResult && (
          <div className={`feedback ${testResult.success ? 'success' : 'error'}`}>
            <span className="icon">{testResult.success ? 'OK' : 'ERR'}</span>
            <span className="msg">{testResult.message}</span>
          </div>
        )}
        {saveResult && (
          <div className="feedback notice">
            <span className="icon">ℹ</span>
            <span className="msg">{saveResult}</span>
          </div>
        )}
      </div>

      <style>{`
        .db-config-panel-v2 {
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        }
        .db-status-header {
          padding: 1rem 1.25rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .db-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.6rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 100px;
          margin-bottom: 0.4rem;
        }
        .db-status-badge .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .db-status-badge .dot.active { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.4); }
        .db-status-badge .dot.idle { background: #3b82f6; }
        .db-status-badge .text { font-size: 0.75rem; font-weight: 600; color: #475569; }
        .db-status-detail { margin: 0; font-size: 0.8rem; color: #64748b; }
        .db-status-detail strong { color: #0f172a; }

        .env-tabs {
          display: flex;
          background: #f1f5f9;
          padding: 0.25rem;
        }
        .env-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.6rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .env-tab.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .config-content { padding: 1.25rem; }
        .env-banner {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.82rem;
          margin-bottom: 1.25rem;
        }
        .env-banner.dev { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .env-banner.prod { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
        .env-banner p { margin: 0; line-height: 1.4; }

        .form-section { margin-bottom: 1.25rem; }
        .section-label { 
          display: block; 
          font-size: 0.75rem; 
          font-weight: 700; 
          color: #94a3b8; 
          text-transform: uppercase; 
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .type-toggle { display: flex; gap: 0.5rem; }
        .type-toggle button {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
        }
        .type-toggle button.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        .sqlite-info {
          display: flex;
          gap: 0.75rem;
          padding: 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .sqlite-info .info-icon { font-size: 1.25rem; }
        .sqlite-info p { margin: 0 0 0.2rem; font-size: 0.85rem; font-weight: 600; }
        .sqlite-info span { font-size: 0.78rem; color: #64748b; }

        .pg-form { 
          display: flex; 
          flex-direction: column; 
          gap: 1rem;
          padding: 1rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .grid-form { display: grid; grid-template-columns: 1fr 100px; gap: 0.75rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        .field.full { grid-column: span 2; }
        .field label { font-size: 0.75rem; font-weight: 600; color: #475569; }
        .field input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.85rem;
        }
        .field input:focus { outline: none; border-color: #3b82f6; ring: 2px solid rgba(59, 130, 246, 0.1); }

        .btn-test {
          padding: 0.4rem 0.8rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }

        .save-section { margin-top: 1.5rem; border-top: 1px solid #f1f5f9; padding-top: 1.5rem; }
        .btn-save {
          width: 100%;
          padding: 0.75rem;
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-save:hover { background: #1d4ed8; }
        .save-hint { font-size: 0.72rem; color: #94a3b8; text-align: center; margin-top: 0.6rem; }

        .feedback {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          margin-top: 1rem;
        }
        .feedback.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .feedback.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .feedback.notice { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }

        .sync-section {
          margin-top: 2rem;
          padding: 1.25rem;
          background: #f1f5f9;
          border-radius: 10px;
          border: 1px dashed #cbd5e1;
        }
        .sync-header h3 { margin: 0; font-size: 0.95rem; }
        .sync-header p { margin: 0.25rem 0 1rem; font-size: 0.8rem; color: #64748b; }
        .sync-visual { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 1rem; }
        .sync-visual .badge { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
        .sync-visual .sqlite { background: #dbeafe; color: #1e40af; }
        .sync-visual .pg { background: #dcfce7; color: #166534; }
        .btn-sync { width: 100%; padding: 0.6rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; cursor: pointer; }
.sync-hint { font-size: 0.72rem; color: #64748b; text-align: center; margin-top: 0.6rem; }
      `}</style>
    </div>
  )
}
