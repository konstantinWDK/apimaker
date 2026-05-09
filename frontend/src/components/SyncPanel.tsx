import { useState } from 'react'

export function SyncPanel() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{
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

  const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
  const backendBaseUrl = typeof window !== 'undefined'
    ? (localStorage.getItem('apimaker-backend-url') || 'http://localhost:8000')
    : 'http://localhost:8000'

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const handleSync = async () => {
    if (!confirm('¿Sincronizar todos los datos de SQLite a PostgreSQL? Los registros existentes se omitirán.')) return
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch(`${backendBaseUrl}/admin/sync`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error en la sincronización')
      setResult({
        success: data.success,
        message: data.message,
        counts: data.counts,
      })
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="sync-panel">
      <h3>Sincronizar bases de datos</h3>
      <p className="sync-panel__desc">
        Transfiere todos los datos de SQLite a PostgreSQL con un clic.
        Los registros que ya existen en PostgreSQL se omiten automáticamente.
      </p>

      <div className="sync-panel__flow">
        <div className="sync-panel__badge sqlite">SQLite</div>
        <div className="sync-panel__arrow">→</div>
        <div className="sync-panel__badge postgres">PostgreSQL</div>
      </div>

      <button
        type="button"
        className="btn primary btn-full btn-large"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar ahora'}
      </button>

      {result && (
        <div className={`sync-panel__result ${result.success ? 'success' : 'error'}`}>
          <p><strong>{result.success ? '✓' : '✗'}</strong> {result.message}</p>
          {result.success && result.counts && (
            <div className="sync-panel__details">
              {result.counts.users_synced > 0 && (
                <span className="sync-badge">👤 {result.counts.users_synced} usuarios</span>
              )}
              {result.counts.projects_synced > 0 && (
                <span className="sync-badge">📁 {result.counts.projects_synced} proyectos</span>
              )}
              {result.counts.datasets_synced > 0 && (
                <span className="sync-badge">📊 {result.counts.datasets_synced} datasets</span>
              )}
              {result.counts.fields_synced > 0 && (
                <span className="sync-badge">📝 {result.counts.fields_synced} campos</span>
              )}
              {result.counts.endpoints_synced > 0 && (
                <span className="sync-badge">🔗 {result.counts.endpoints_synced} endpoints</span>
              )}
              {result.counts.shares_synced > 0 && (
                <span className="sync-badge">🔗 {result.counts.shares_synced} shares</span>
              )}
              {result.counts.skipped > 0 && (
                <span className="sync-badge skipped">⏭️ {result.counts.skipped} omitidos</span>
              )}
            </div>
          )}
          {!result.success && result.counts?.errors && result.counts.errors.length > 0 && (
            <ul className="sync-panel__errors">
              {result.counts.errors.map((e: string, i: number) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <style>{`
        .sync-panel {
          padding: 1rem;
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .sync-panel h3 {
          margin: 0 0 0.25rem;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .sync-panel__desc {
          margin: 0 0 1rem;
          font-size: 0.82rem;
          color: #64748b;
        }
        .sync-panel__flow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .sync-panel__badge {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .sync-panel__badge.sqlite {
          background: #f0f9ff;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
        .sync-panel__badge.postgres {
          background: #eef2ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
        }
        .sync-panel__arrow {
          font-size: 1.2rem;
          color: #94a3b8;
        }
        .btn-large {
          padding: 0.65rem 1.2rem;
          font-size: 0.95rem;
        }
        .sync-panel__result {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          font-size: 0.82rem;
        }
        .sync-panel__result p {
          margin: 0 0 0.5rem;
        }
        .sync-panel__result:last-child p:last-child {
          margin-bottom: 0;
        }
        .sync-panel__result.success {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }
        .sync-panel__result.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .sync-panel__details {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.5rem;
        }
        .sync-badge {
          padding: 0.2rem 0.5rem;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 4px;
          font-size: 0.75rem;
        }
        .sync-badge.skipped {
          opacity: 0.7;
        }
        .sync-panel__errors {
          margin: 0.5rem 0 0;
          padding-left: 1.25rem;
          font-size: 0.78rem;
          list-style: disc;
        }
        .sync-panel__errors li {
          margin-bottom: 0.2rem;
        }
      `}</style>
    </div>
  )
}
