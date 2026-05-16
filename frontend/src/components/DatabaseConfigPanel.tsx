import { useEffect, useState } from 'react'
import { readBackendConfig } from '../lib/backendConfig'

interface AdminConfig {
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
  const [info, setInfo] = useState<AdminConfig['current_database_info'] | null>(null)
  const [loading, setLoading] = useState(true)

  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
  const { baseUrl: backendBaseUrl } = readBackendConfig()

  useEffect(() => {
    fetch(`${backendBaseUrl}/admin/config`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((r) => r.json())
      .then((data: AdminConfig) => setInfo(data.current_database_info))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isPg = info?.type === 'postgresql'

  if (loading) {
    return <p className="muted-text" style={{ fontSize: '0.85rem' }}>Cargando información de la base de datos...</p>
  }

  return (
    <div className="db-info-panel">
      <div className="db-info-card">
        <div className="db-info-icon">
          {isPg ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5V19A9 3 0 0 0 21 19V5" />
              <path d="M3 12A9 3 0 0 0 21 12" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
          )}
        </div>
        <div className="db-info-body">
          <div className="db-info-title">
            <span className={`db-badge ${isPg ? 'pg' : 'sqlite'}`}>
              {isPg ? 'PostgreSQL' : 'SQLite'}
            </span>
            <span className="db-env">{info?.type === 'postgresql' ? 'Producción' : 'Desarrollo'}</span>
          </div>
          <table className="db-info-table">
            <tbody>
              <tr><td>Tipo</td><td>{info?.type || '—'}</td></tr>
              <tr><td>Host</td><td>{info?.host || '—'}</td></tr>
              <tr><td>Base de datos</td><td>{info?.database || '—'}</td></tr>
              <tr><td>Usuario</td><td>{info?.username || '—'}</td></tr>
              <tr><td>URL</td><td className="url">{info?.url || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted-text" style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
        Esta base de datos se configuró durante la instalación. Para cambiarla, ejecuta el instalador de nuevo o modifica el archivo <code>.env</code> manualmente.
      </p>

      <style>{`
        .db-info-panel {
          max-width: 520px;
        }
        .db-info-card {
          display: flex;
          gap: 1rem;
          padding: 1.25rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }
        .db-info-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border-radius: 8px;
        }
        .db-info-body {
          flex: 1;
          min-width: 0;
        }
        .db-info-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .db-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .db-badge.pg { background: #dbeafe; color: #1e40af; }
        .db-badge.sqlite { background: #f1f5f9; color: #475569; }
        .db-env {
          font-size: 0.72rem;
          color: #94a3b8;
        }
        .db-info-table {
          width: 100%;
          border-collapse: collapse;
        }
        .db-info-table td {
          padding: 0.25rem 0;
          font-size: 0.82rem;
          vertical-align: top;
        }
        .db-info-table td:first-child {
          color: #94a3b8;
          width: 100px;
          font-weight: 500;
        }
        .db-info-table td:last-child {
          color: #1e293b;
          font-family: monospace;
          word-break: break-all;
        }
        .db-info-table td.url {
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  )
}
