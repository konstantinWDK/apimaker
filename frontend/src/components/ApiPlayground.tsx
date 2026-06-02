import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectDraft, ApiEndpoint } from '../types/schemas'

interface Props {
  project: ProjectDraft
  mockBaseUrl: string
  deployUrl?: string | null
}

export function ApiPlayground({ project, mockBaseUrl, deployUrl }: Props) {
  const { t } = useTranslation()
  const [selectedEp, setSelectedEp] = useState<ApiEndpoint | null>(null)
  const [targetUrl, setTargetUrl] = useState<'mock' | 'deploy'>(deployUrl ? 'deploy' : 'mock')
  const [headersText, setHeadersText] = useState('{}')
  const [bodyText, setBodyText] = useState('')
  const [response, setResponse] = useState<{ status: number; statusText: string; body: string; duration: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = targetUrl === 'deploy' && deployUrl ? deployUrl : mockBaseUrl

  const handleSend = useCallback(async () => {
    if (!selectedEp) return
    setLoading(true)
    setError(null)
    setResponse(null)
    const start = performance.now()
    try {
      let headers: Record<string, string> = {}
      try { headers = JSON.parse(headersText || '{}') } catch { throw new Error(t('apiPlayground.invalidHeaders')) }
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'

      let body: BodyInit | undefined
      if (['POST', 'PUT', 'PATCH'].includes(selectedEp.method) && bodyText.trim()) {
        try { JSON.parse(bodyText); body = bodyText } catch { throw new Error(t('apiPlayground.invalidBody')) }
      }

      const res = await fetch(`${baseUrl}${selectedEp.path}`, { method: selectedEp.method, headers, body })
      const duration = ((performance.now() - start) / 1000).toFixed(2)
      const rawBody = await res.text()
      let prettyBody = rawBody
      try { prettyBody = JSON.stringify(JSON.parse(rawBody), null, 2) } catch { /* raw */ }
      setResponse({ status: res.status, statusText: res.statusText, body: prettyBody, duration: `${duration}s` })
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    }
    setLoading(false)
  }, [selectedEp, baseUrl, headersText, bodyText, t])

  return (
    <div className="api-playground">
      <div className="api-playground__toolbar">
        <h3 className="api-playground__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.4rem' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {t('apiPlayground.title')}
        </h3>
        {deployUrl && (
          <div className="api-playground__target-toggle">
            <button
              type="button"
              className={`btn btn-small ${targetUrl === 'mock' ? 'primary' : 'ghost'}`}
              onClick={() => setTargetUrl('mock')}
            >{t('apiPlayground.mockServer')}</button>
            <button
              type="button"
              className={`btn btn-small ${targetUrl === 'deploy' ? 'primary' : 'ghost'}`}
              onClick={() => setTargetUrl('deploy')}
            >{t('apiPlayground.deployedApi')}</button>
          </div>
        )}
      </div>

      <div className="api-playground__layout">
        <div className="api-playground__endpoints">
          <div className="api-playground__endpoints-header">{t('apiPlayground.endpoints')}</div>
          {project.endpoints.length === 0 ? (
            <p className="muted-text" style={{ fontSize: '0.8rem', padding: '0.5rem' }}>{t('apiPlayground.noEndpoints')}</p>
          ) : (
            <div className="api-playground__endpoints-list">
              {project.endpoints.map(ep => (
                <div
                  key={ep.id}
                  className={`api-playground__endpoint ${selectedEp?.id === ep.id ? 'active' : ''}`}
                  onClick={() => { setSelectedEp(ep); setResponse(null); setError(null) }}
                >
                  <span className={`api-playground__method api-playground__method--${ep.method.toLowerCase()}`}>{ep.method}</span>
                  <span className="api-playground__path">{ep.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="api-playground__editor">
          {!selectedEp ? (
            <div className="api-playground__placeholder">{t('apiPlayground.selectEndpoint')}</div>
          ) : (
            <div className="api-playground__request">
              <div className="api-playground__request-url">
                <span className={`api-playground__method api-playground__method--${selectedEp.method.toLowerCase()}`}>{selectedEp.method}</span>
                <code className="api-playground__url">{baseUrl}{selectedEp.path}</code>
              </div>

              <div className="api-playground__section">
                <label className="api-playground__label">{t('apiPlayground.headers')}</label>
                <textarea
                  className="api-playground__textarea"
                  rows={3}
                  value={headersText}
                  onChange={e => setHeadersText(e.target.value)}
                  placeholder='{"Authorization": "Bearer ..."}'
                />
              </div>

              {['POST', 'PUT', 'PATCH'].includes(selectedEp.method) && (
                <div className="api-playground__section">
                  <label className="api-playground__label">{t('apiPlayground.body')}</label>
                  <textarea
                    className="api-playground__textarea"
                    rows={6}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}

              <button
                type="button"
                className="btn primary"
                onClick={handleSend}
                disabled={loading}
                style={{ marginTop: '0.5rem' }}
              >
                {loading ? t('apiPlayground.sending') : t('apiPlayground.send')}
              </button>

              {error && (
                <div className="api-playground__error">{error}</div>
              )}

              {response && (
                <div className="api-playground__response">
                  <div className="api-playground__response-header">
                    <span className="api-playground__response-status" style={{ color: response.status < 400 ? '#22c55e' : '#ef4444' }}>
                      {response.status} {response.statusText}
                    </span>
                    <span className="api-playground__response-duration">{response.duration}</span>
                  </div>
                  <pre className="api-playground__response-body">{response.body}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .api-playground { border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; background: var(--bg-secondary); }
        .api-playground__toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); }
        .api-playground__title { margin: 0; font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
        .api-playground__target-toggle { display: flex; gap: 0.3rem; }
        .api-playground__layout { display: flex; min-height: 300px; }
        .api-playground__endpoints { width: 200px; flex-shrink: 0; border-right: 1px solid var(--border-color); }
        .api-playground__endpoints-header { padding: 0.5rem 0.75rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border-color); }
        .api-playground__endpoints-list { overflow-y: auto; max-height: 350px; }
        .api-playground__endpoint { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.1s; }
        .api-playground__endpoint:hover { background: var(--bg-hover); }
        .api-playground__endpoint.active { background: rgba(99, 102, 241, 0.08); }
        .api-playground__method { font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.3rem; border-radius: 3px; flex-shrink: 0; min-width: 3.2em; text-align: center; }
        .api-playground__method--get { color: #22c55e; background: rgba(34, 197, 94, 0.12); }
        .api-playground__method--post { color: #3b82f6; background: rgba(59, 130, 246, 0.12); }
        .api-playground__method--put { color: #f59e0b; background: rgba(245, 158, 11, 0.12); }
        .api-playground__method--patch { color: #f59e0b; background: rgba(245, 158, 11, 0.12); }
        .api-playground__method--delete { color: #ef4444; background: rgba(239, 68, 68, 0.12); }
        .api-playground__path { font-size: 0.78rem; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .api-playground__editor { flex: 1; padding: 1rem; overflow-y: auto; max-height: 500px; }
        .api-playground__placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.85rem; }
        .api-playground__request-url { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 6px; }
        .api-playground__url { font-size: 0.82rem; color: var(--accent-blue); word-break: break-all; }
        .api-playground__section { margin-bottom: 0.75rem; }
        .api-playground__label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.03em; }
        .api-playground__textarea { width: 100%; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem; font-size: 0.8rem; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--text-primary); resize: vertical; }
        .api-playground__textarea:focus { outline: none; border-color: var(--accent-blue); }
        .api-playground__error { margin-top: 0.5rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; color: #ef4444; font-size: 0.8rem; }
        .api-playground__response { margin-top: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
        .api-playground__response-header { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.75rem; background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); font-size: 0.8rem; font-weight: 600; }
        .api-playground__response-duration { font-size: 0.72rem; color: var(--text-muted); font-weight: 400; }
        .api-playground__response-body { margin: 0; padding: 0.75rem; font-size: 0.78rem; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--text-primary); background: var(--bg-secondary); max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
        [data-theme="dark"] .api-playground { background: var(--bg-secondary); }
        [data-theme="dark"] .api-playground__request-url { background: var(--bg-tertiary); }
        [data-theme="dark"] .api-playground__textarea { background: #0a0f1c; }
        [data-theme="dark"] .api-playground__response-body { background: #0a0f1c; }
      `}</style>
    </div>
  )
}
