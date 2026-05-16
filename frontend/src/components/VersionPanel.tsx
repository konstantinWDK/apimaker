import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { readBackendConfig } from '../lib/backendConfig'

interface ProjectVersion {
  id: string
  version: number
  message: string
  created_at: string
}

interface Props {
  projectId: string
}

export function VersionPanel({ projectId }: Props) {
  const { t } = useTranslation()
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('doapi-jwt-token') : null
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }, [])

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const apiUrl = `${baseUrl}/projects/${projectId}/versions`

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(apiUrl, { headers: getHeaders() })
      if (res.ok) setVersions(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [apiUrl, getHeaders])

  useEffect(() => { fetchVersions() }, [fetchVersions])

  const handleCreate = async () => {
    setSaving(true); setError(null); setSuccess(null)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ message }),
      })
      if (!res.ok) { setError(t('versionPanel.createError')); return }
      setMessage('')
      setSuccess(t('versionPanel.createSuccess'))
      await fetchVersions()
    } catch { setError(t('versionPanel.connectionError')) }
    finally { setSaving(false) }
  }

  const handleRestore = async (versionId: string) => {
    if (!confirm(t('versionPanel.confirmRestore'))) return
    setRestoring(versionId); setError(null); setSuccess(null)
    try {
      const res = await fetch(`${apiUrl}/${versionId}/restore`, {
        method: 'POST', headers: getHeaders(),
      })
      if (!res.ok) { setError(t('versionPanel.restoreError')); return }
      const data = await res.json()
      setSuccess(data.message || t('versionPanel.restoreSuccess'))
      await fetchVersions()
    } catch { setError(t('versionPanel.connectionError')) }
    finally { setRestoring(null) }
  }

  if (loading) return <p className="muted-text">{t('versionPanel.loading')}</p>

  return (
    <div className="version-panel">
      <p className="version-panel__desc">
        {t('versionPanel.description')}
      </p>

      {/* Create version */}
      <div className="version-create">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={t('versionPanel.placeholder')}
          className="field"
          style={{ flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
        />
        <button type="button" className="btn primary" onClick={handleCreate} disabled={saving}>
          {saving ? t('versionPanel.saving') : t('versionPanel.saveVersion')}
        </button>
      </div>

      {error && <p className="error-text" style={{ margin: '0.5rem 0' }}>{error}</p>}
      {success && <p className="success-text" style={{ margin: '0.5rem 0' }}>{success}</p>}

      {/* Version list */}
      <div className="version-list">
        {versions.length === 0 ? (
          <p className="muted-text" style={{ textAlign: 'center', padding: '1.5rem' }}>
            {t('versionPanel.noVersions')}
          </p>
        ) : (
          versions.map((v, i) => {
            const isLatest = i === 0
            return (
              <div key={v.id} className={`version-item ${isLatest ? 'latest' : ''}`}>
                <div className="version-item__head">
                  <div className="version-item__info">
                    <span className="version-item__badge">v{v.version}</span>
                    {isLatest && <span className="version-item__latest">{t('versionPanel.current')}</span>}
                    <span className="version-item__date">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="version-item__actions">
                    {!isLatest && (
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        onClick={() => handleRestore(v.id)}
                        disabled={restoring === v.id}
                      >
                        {restoring === v.id ? t('versionPanel.restoring') : t('versionPanel.restore')}
                      </button>
                    )}
                  </div>
                </div>
                {v.message && <p className="version-item__message">{v.message}</p>}
              </div>
            )
          })
        )}
      </div>

      <style>{`
        .version-panel { padding: 0.5rem 0; }
        .version-panel__desc { color: #64748b; font-size: 0.85rem; margin: 0 0 1rem; }
        .version-create { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
        .version-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .version-item {
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;
          background: #fff; transition: border-color 0.15s;
        }
        .version-item.latest { border-color: #bbf7d0; background: #fafdfb; }
        .version-item__head { display: flex; justify-content: space-between; align-items: center; }
        .version-item__info { display: flex; align-items: center; gap: 0.5rem; }
        .version-item__badge {
          font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem;
          border-radius: 4px; background: #e0e7ff; color: #4338ca;
        }
        .version-item__latest {
          font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
          padding: 0.15rem 0.4rem; border-radius: 4px;
          background: #bbf7d0; color: #166534;
        }
        .version-item__date { font-size: 0.75rem; color: #94a3b8; }
        .version-item__message { font-size: 0.8rem; color: #475569; margin: 0.35rem 0 0; }
        .version-item__actions { display: flex; gap: 0.5rem; }
      `}</style>
    </div>
  )
}
