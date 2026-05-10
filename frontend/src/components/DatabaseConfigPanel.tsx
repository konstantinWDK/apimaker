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
  const [activeEnv, setActiveEnv] = useState<'dev' | 'prod'>('dev')
  const [config, setConfig] = useState<{ dev: DbConfig; prod: DbConfig }>({
    dev: { database_type: 'sqlite', port: 5432 },
    prod: { database_type: 'postgresql', port: 5432 },
  })
  const [currentInfo, setCurrentInfo] = useState<AdminConfig['current_database_info'] | null>(null)
  const [systemEnv, setSystemEnv] = useState<string>('development')
  
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
    counts?: any
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
      .then((data: AdminConfig) => {
        setConfig({
          dev: data.dev,
          prod: data.prod
        })
        setCurrentInfo(data.current_database_info)
        setSystemEnv(data.environment)
        if (data.environment === 'production') {
          setActiveEnv('prod')
        }
      })
      .catch(() => {
        /* ignore */
      })
  }, [])

  const currentConfig = config[activeEnv]

  const updateCurrentConfig = (updates: Partial<DbConfig>) => {
    setConfig(prev => ({
      ...prev,
      [activeEnv]: { ...prev[activeEnv], ...updates }
    }))
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const body: any = { database_type: currentConfig.database_type }
      if (useConnectionString) {
        body.postgres_url = currentConfig.postgres_url
      } else {
        body.host = currentConfig.host
        body.port = currentConfig.port
        body.username = currentConfig.username
        body.password = currentConfig.password
        body.database = currentConfig.database
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
          environment: activeEnv,
          config: currentConfig
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

  const handleSync = async () => {
    const targetLabel = activeEnv === 'dev' ? 'Desarrollo' : 'Producción'
    if (!confirm(`¿Sincronizar todos los datos de SQLite a PostgreSQL (${targetLabel})? Los registros existentes se omitirán.`)) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${backendBaseUrl}/admin/sync?target_env=${activeEnv}`, {
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
          <p className="db-status-detail">
            Entorno actual detectado: <strong>{systemEnv === 'production' ? 'PRODUCCIÓN' : 'DESARROLLO'}</strong>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="env-tabs">
        <button 
          className={`env-tab ${activeEnv === 'dev' ? 'active' : ''}`}
          onClick={() => setActiveEnv('dev')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          Desarrollo
        </button>
        <button 
          className={`env-tab ${activeEnv === 'prod' ? 'active' : ''}`}
          onClick={() => setActiveEnv('prod')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Producción
        </button>
      </div>

      <div className="config-content">
        {/* Environment Banner */}
        <div className={`env-banner ${activeEnv}`}>
          {activeEnv === 'dev' ? (
            <p>Configura la base de datos para pruebas locales. Puedes usar SQLite para rapidez o PostgreSQL para simular producción.</p>
          ) : (
            <p><strong>Configuración Crítica:</strong> En producción solo se permite PostgreSQL. Asegúrate de que las credenciales sean correctas y seguras.</p>
          )}
        </div>

        {/* Database Type (only for dev) */}
        {activeEnv === 'dev' && (
          <div className="form-section">
            <label className="section-label">Motor de Base de Datos</label>
            <div className="type-toggle">
              <button 
                className={currentConfig.database_type === 'sqlite' ? 'active' : ''}
                onClick={() => updateCurrentConfig({ database_type: 'sqlite' })}
              >
                SQLite
              </button>
              <button 
                className={currentConfig.database_type === 'postgresql' ? 'active' : ''}
                onClick={() => updateCurrentConfig({ database_type: 'postgresql' })}
              >
                PostgreSQL
              </button>
            </div>
          </div>
        )}

        {/* SQLite Info */}
        {activeEnv === 'dev' && currentConfig.database_type === 'sqlite' && (
          <div className="sqlite-info">
            <div className="info-icon">📦</div>
            <div className="info-text">
              <p>Usando base de datos local en <code>backend/app/data/apimaker.db</code></p>
              <span>No requiere configuración adicional. Ideal para arrancar rápido.</span>
            </div>
          </div>
        )}

        {/* PostgreSQL Form */}
        {(activeEnv === 'prod' || currentConfig.database_type === 'postgresql') && (
          <div className="pg-form">
            <div className="connection-mode">
              <label className="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={useConnectionString} 
                  onChange={e => setUseConnectionString(e.target.checked)}
                />
                <span className="checkmark"></span>
                Usar Connection String completa
              </label>
            </div>

            {useConnectionString ? (
              <div className="field">
                <label>URL de Conexión</label>
                <input 
                  type="text" 
                  placeholder="postgresql+psycopg2://user:pass@host:5432/db"
                  value={currentConfig.postgres_url || ''}
                  onChange={e => updateCurrentConfig({ postgres_url: e.target.value })}
                />
              </div>
            ) : (
              <div className="grid-form">
                <div className="field">
                  <label>Host</label>
                  <input 
                    type="text" 
                    placeholder="localhost"
                    value={currentConfig.host || ''}
                    onChange={e => updateCurrentConfig({ host: e.target.value })}
                  />
                </div>
                <div className="field small">
                  <label>Puerto</label>
                  <input 
                    type="number" 
                    value={currentConfig.port || 5432}
                    onChange={e => updateCurrentConfig({ port: parseInt(e.target.value) || 5432 })}
                  />
                </div>
                <div className="field">
                  <label>Usuario</label>
                  <input 
                    type="text" 
                    placeholder="postgres"
                    value={currentConfig.username || ''}
                    onChange={e => updateCurrentConfig({ username: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Contraseña</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={currentConfig.password || ''}
                    onChange={e => updateCurrentConfig({ password: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <label>Nombre de la Base de Datos</label>
                  <input 
                    type="text" 
                    placeholder="apimaker"
                    value={currentConfig.database || ''}
                    onChange={e => updateCurrentConfig({ database: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="actions">
              <button className="btn-test" onClick={handleTest} disabled={testing}>
                {testing ? 'Verificando...' : 'Probar Conexión'}
              </button>
            </div>
          </div>
        )}

        <div className="save-section">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : `Guardar Configuración para ${activeEnv === 'dev' ? 'Desarrollo' : 'Producción'}`}
          </button>
          <p className="save-hint">Los cambios requieren reiniciar el backend para surtir efecto.</p>
        </div>

        {/* Results Feedback */}
        {testResult && (
          <div className={`feedback ${testResult.success ? 'success' : 'error'}`}>
            <span className="icon">{testResult.success ? '✓' : '✗'}</span>
            <span className="msg">{testResult.message}</span>
          </div>
        )}
        {saveResult && (
          <div className="feedback notice">
            <span className="icon">ℹ</span>
            <span className="msg">{saveResult}</span>
          </div>
        )}

        {/* Sync Section - Show if current target is PG and not the active one */}
        {currentConfig.database_type === 'postgresql' && (currentInfo?.type === 'sqlite' || activeEnv !== (systemEnv === 'production' ? 'prod' : 'dev')) && (
          <div className="sync-section">
            <div className="sync-header">
              <h3>Migración de Datos</h3>
              <p>Transfiere los datos de la base de datos activa ({currentInfo?.type === 'sqlite' ? 'SQLite' : 'PostgreSQL'}) al entorno de {activeEnv === 'dev' ? 'Desarrollo' : 'Producción'}.</p>
            </div>
            <div className="sync-visual">
              <div className="badge sqlite">{currentInfo?.type === 'sqlite' ? 'SQLite Actual' : 'Postgres Actual'}</div>
              <div className="arrow">→</div>
              <div className="badge pg">PostgreSQL {activeEnv === 'dev' ? 'Dev' : 'Prod'}</div>
            </div>
            <button className="btn-sync" onClick={handleSync} disabled={syncing}>
              {syncing ? '⏳ Sincronizando...' : `🔄 Sincronizar desde ${currentInfo?.type === 'sqlite' ? 'SQLite' : 'Postgres'} a ${activeEnv === 'dev' ? 'Desarrollo' : 'Producción'}`}
            </button>
            <p className="sync-hint">Útil para desplegar cambios o migrar de motor sin perder tus proyectos.</p>
          </div>
        )}
            {syncResult && (
              <div className={`sync-result ${syncResult.success ? 'success' : 'error'}`}>
                {syncResult.message}
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
