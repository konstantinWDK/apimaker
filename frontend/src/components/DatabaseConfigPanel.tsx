import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [info, setInfo] = useState<AdminConfig['current_database_info'] | null>(null)
  const [loading, setLoading] = useState(true)

  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null
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

  const dbType = info?.type || ''
  const isPg = dbType === 'postgresql'
  const isMySql = dbType === 'mysql'
  const dbLabel = isPg ? 'PostgreSQL' : isMySql ? 'MySQL' : 'SQLite'

  if (loading) {
    return <p className="muted-text" style={{ fontSize: '0.85rem' }}>{t('dbConfig.loading')}</p>
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
          ) : isMySql ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
              <path d="M9 3v18" />
              <path d="M3 9h18" />
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
            <span className={`db-badge ${isPg ? 'pg' : isMySql ? 'mysql' : 'sqlite'}`}>
              {dbLabel}
            </span>
            <span className="db-env">{isPg || isMySql ? t('dbConfig.production') : t('dbConfig.development')}</span>
          </div>
          <table className="db-info-table">
            <tbody>
              <tr><td>{t('dbConfig.type')}</td><td>{dbLabel}</td></tr>
              <tr><td>{t('dbConfig.host')}</td><td>{info?.host || '—'}</td></tr>
              <tr><td>{t('dbConfig.database')}</td><td>{info?.database || '—'}</td></tr>
              <tr><td>{t('dbConfig.username')}</td><td>{info?.username || '—'}</td></tr>
              <tr><td>{t('dbConfig.url')}</td><td className="url">{info?.url || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted-text" style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
        {t('dbConfig.note')}
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
        .db-badge.mysql { background: #fef3c7; color: #92400e; }
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
