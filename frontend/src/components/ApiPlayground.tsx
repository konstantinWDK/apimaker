import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  project: ProjectDraft
  mockRunning: boolean
  onStartMock: () => Promise<void>
  mockLoading?: boolean
  mockError?: string | null
  selectedDatasetId?: string
  deploymentBaseUrl?: string | null
}

interface ApiResponse {
  url: string
  status: number
  body: unknown
  method: string
  time: number
  size: number
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const METHOD_COLORS: Record<string, string> = {
  GET: '#0ea5e9',
  POST: '#10b981',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#f43f5e',
}

function buildDefaultBody(project: ProjectDraft, method: string, datasetId?: string): string {
  if (method === 'GET' || method === 'DELETE') return ''
  const ds = datasetId ? project.datasets.find(d => d.id === datasetId) : project.datasets[0]
  const fields = ds?.fields ?? []
  if (fields.length === 0) return '{\n  \n}'
  const obj: Record<string, unknown> = {}
  for (const f of fields.slice(0, 6)) {
    if (f.type === 'string') obj[f.name] = f.name.includes('email') ? 'demo@email.com' : 'valor'
    else if (f.type === 'integer') obj[f.name] = 1
    else if (f.type === 'float') obj[f.name] = 1.0
    else if (f.type === 'boolean') obj[f.name] = true
    else obj[f.name] = 'valor'
  }
  return JSON.stringify(obj, null, 2)
}

export function ApiPlayground({ project, mockRunning, onStartMock, mockLoading, selectedDatasetId, deploymentBaseUrl }: Props) {
  const backendConfig = readBackendConfig()
  const backendBaseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const effectiveId = project.slug || project.remoteId || project.id
  const mockBase = deploymentBaseUrl || `${backendBaseUrl}/api/mock/${effectiveId}`

  const endpoints = useMemo(() =>
    selectedDatasetId
      ? project.endpoints.filter(ep => !ep.targetDatasetId || ep.targetDatasetId === selectedDatasetId)
      : project.endpoints,
    [project.endpoints, selectedDatasetId]
  )

  const [method, setMethod] = useState<string>('GET')
  const [url, setUrl] = useState<string>('')
  const [body, setBody] = useState<string>('')
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string; enabled: boolean }>>([])
  const [headers, setHeaders] = useState<Array<{ key: string; value: string; enabled: boolean }>>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ])
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [history, setHistory] = useState<ApiResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params')
  const [bodyError, setBodyError] = useState<string | null>(null)

  const urlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (endpoints.length > 0) {
      const ep = endpoints[0]
      const newUrl = mockBase + (ep.path.startsWith('/') ? ep.path : `/${ep.path}`)
      const newBody = buildDefaultBody(project, ep.method, selectedDatasetId)
      setMethod(ep.method)
      setUrl(newUrl)
      setBody(newBody)
      setResponse(null)
      executeRequest(newUrl, ep.method, newBody)
    }
  }, [mockBase, selectedDatasetId])

  const fullUrl = useMemo(() => {
    const enabledParams = queryParams.filter(p => p.enabled && p.key.trim())
    if (enabledParams.length === 0) return url
    const sep = url.includes('?') ? '&' : '?'
    return url + sep + enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  }, [url, queryParams])

  const executeRequest = async (targetUrl: string, targetMethod: string, targetBody: string) => {
    setLoading(true)
    setBodyError(null)

    if (targetBody.trim() && targetMethod !== 'GET' && targetMethod !== 'DELETE') {
      try { JSON.parse(targetBody) } catch {
        setBodyError('JSON invalido')
        setLoading(false)
        return
      }
    }

    const start = performance.now()
    try {
      const requestHeaders: Record<string, string> = {}
      headers.filter(h => h.enabled && h.key.trim()).forEach(h => { requestHeaders[h.key] = h.value })

      if (project.authMethod === 'apikey' && project.apiKey) {
        requestHeaders['X-API-Key'] = project.apiKey
      } else if (project.authMethod === 'jwt') {
        requestHeaders['Authorization'] = 'Bearer sim-token'
      }

      const opts: RequestInit = { method: targetMethod, headers: requestHeaders }
      if (targetMethod !== 'GET' && targetMethod !== 'DELETE' && targetBody) opts.body = targetBody

      const res = await fetch(targetUrl, opts)
      const text = await res.text()
      let parsed: unknown = text
      try { parsed = JSON.parse(text) } catch { /* keep as text */ }

      const elapsed = Math.round(performance.now() - start)
      const size = new Blob([text]).size

      const entry: ApiResponse = { url: targetUrl, status: res.status, body: parsed, method: targetMethod, time: elapsed, size }
      setResponse(entry)
      setHistory(prev => [entry, ...prev].slice(0, 20))
    } catch {
      setResponse({ url: targetUrl, status: 0, body: { error: 'Error de conexion' }, method: targetMethod, time: 0, size: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!url.trim()) return
    await executeRequest(fullUrl, method, body)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  const selectEndpoint = (ep: typeof endpoints[0]) => {
    const newUrl = mockBase + (ep.path.startsWith('/') ? ep.path : `/${ep.path}`)
    const newBody = buildDefaultBody(project, ep.method, selectedDatasetId)
    setMethod(ep.method)
    setUrl(newUrl)
    setBody(newBody)
    setResponse(null)
    executeRequest(newUrl, ep.method, newBody)
  }

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '', enabled: true }])
  const updateQueryParam = (i: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    setQueryParams(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  }
  const removeQueryParam = (i: number) => setQueryParams(prev => prev.filter((_, idx) => idx !== i))

  const addHeader = () => setHeaders([...headers, { key: '', value: '', enabled: true }])
  const updateHeader = (i: number, field: 'key' | 'value' | 'enabled', val: string | boolean) => {
    setHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h))
  }
  const removeHeader = (i: number) => setHeaders(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="pg">
      {deploymentBaseUrl ? (
        <div className="pg__banner pg__banner--deploy">
          <span>Probando contra <strong>{deploymentBaseUrl}</strong></span>
        </div>
      ) : !mockRunning ? (
        <div className="pg__banner">
          <span>El mock server esta detenido. Inicialo para probar endpoints.</span>
          <button className="btn primary btn-small" onClick={onStartMock} disabled={mockLoading}>
            {mockLoading ? 'Iniciando...' : 'Iniciar Mock Server'}
          </button>
        </div>
      ) : null}

      {/* Main layout */}
      <div className="pg__layout">
        {/* Main content */}
        <div className="pg__main">
          {/* URL Bar */}
          <div className="pg__urlbar">
            <select
              className="pg__method-select"
              value={method}
              onChange={e => {
                setMethod(e.target.value)
                setBody(buildDefaultBody(project, e.target.value, selectedDatasetId))
              }}
              style={{ color: METHOD_COLORS[method] || '#64748b' }}
            >
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              ref={urlInputRef}
              className="pg__url-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mockBase + '/records'}
              spellCheck={false}
            />
            <button
              className="pg__send-btn"
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Send'}
            </button>
          </div>

          {/* Tabs: Params | Headers | Body */}
          <div className="pg__tabs">
            <button className={`pg__tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>
              Params {queryParams.filter(p => p.key).length > 0 && <span className="pg__tab-count">{queryParams.filter(p => p.key).length}</span>}
            </button>
            <button className={`pg__tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
              Headers {headers.filter(h => h.key).length > 0 && <span className="pg__tab-count">{headers.filter(h => h.key).length}</span>}
            </button>
            <button className={`pg__tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
              Body
            </button>
          </div>

          {/* Tab content */}
          <div className="pg__tab-content">
            {activeTab === 'params' && (
              <div className="pg__kv-editor">
                {queryParams.map((p, i) => (
                  <div key={i} className="pg__kv-row">
                    <input
                      className="pg__kv-check"
                      type="checkbox"
                      checked={p.enabled}
                      onChange={e => updateQueryParam(i, 'enabled', e.target.checked)}
                    />
                    <input
                      className="pg__kv-input"
                      placeholder="Key"
                      value={p.key}
                      onChange={e => updateQueryParam(i, 'key', e.target.value)}
                    />
                    <input
                      className="pg__kv-input"
                      placeholder="Value"
                      value={p.value}
                      onChange={e => updateQueryParam(i, 'value', e.target.value)}
                    />
                    <button className="pg__kv-remove" onClick={() => removeQueryParam(i)}>&times;</button>
                  </div>
                ))}
                <button className="pg__kv-add" onClick={addQueryParam}>+ Add param</button>
              </div>
            )}

            {activeTab === 'headers' && (
              <div className="pg__kv-editor">
                {headers.map((h, i) => (
                  <div key={i} className="pg__kv-row">
                    <input
                      className="pg__kv-check"
                      type="checkbox"
                      checked={h.enabled}
                      onChange={e => updateHeader(i, 'enabled', e.target.checked)}
                    />
                    <input
                      className="pg__kv-input"
                      placeholder="Header name"
                      value={h.key}
                      onChange={e => updateHeader(i, 'key', e.target.value)}
                    />
                    <input
                      className="pg__kv-input"
                      placeholder="Header value"
                      value={h.value}
                      onChange={e => updateHeader(i, 'value', e.target.value)}
                    />
                    <button className="pg__kv-remove" onClick={() => removeHeader(i)}>&times;</button>
                  </div>
                ))}
                <button className="pg__kv-add" onClick={addHeader}>+ Add header</button>
              </div>
            )}

            {activeTab === 'body' && (
              <div className="pg__body-editor">
                <textarea
                  className={`pg__body-textarea ${bodyError ? 'pg__body-textarea--err' : ''}`}
                  value={body}
                  onChange={e => { setBody(e.target.value); setBodyError(null) }}
                  placeholder={method === 'GET' || method === 'DELETE' ? 'Body not available for ' + method : '{\n  \n}'}
                  disabled={method === 'GET' || method === 'DELETE'}
                  spellCheck={false}
                />
                {bodyError && <p className="pg__body-error">{bodyError}</p>}
              </div>
            )}
          </div>

          {/* Response */}
          <div className="pg__response">
            {response ? (
              <>
                <div className="pg__response-bar">
                  <span className={`pg__response-status ${response.status < 400 ? 'ok' : 'err'}`}>
                    {response.status || 'ERR'}
                  </span>
                  <span className="pg__response-time">{response.time}ms</span>
                  <span className="pg__response-size">{response.size < 1024 ? `${response.size}B` : `${(response.size / 1024).toFixed(1)}KB`}</span>
                </div>
                <pre className="pg__response-body">
                  {typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}
                </pre>
              </>
            ) : (
              <div className="pg__response-empty">
                Pulsa <strong>Send</strong> o <strong>Cmd+Enter</strong> para ejecutar la peticion
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: endpoints + history */}
        <div className="pg__sidebar">
          <div className="pg__sidebar-section">
            <div className="pg__sidebar-label">Endpoints</div>
            {endpoints.length === 0 ? (
              <p className="pg__empty">Sin endpoints</p>
            ) : (
              endpoints.map(ep => (
                <button
                  key={ep.id}
                  className="pg__ep-item"
                  onClick={() => selectEndpoint(ep)}
                >
                  <span className="pg__ep-method" style={{ color: METHOD_COLORS[ep.method] || '#64748b' }}>{ep.method}</span>
                  <span className="pg__ep-path">{ep.path}</span>
                </button>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="pg__sidebar-section">
              <div className="pg__sidebar-label">Historial</div>
              {history.slice(0, 10).map((h, i) => (
                <button
                  key={i}
                  className="pg__history-item"
                  onClick={() => { setMethod(h.method); setUrl(h.url); setResponse(h) }}
                >
                  <span className={`pg__history-status ${h.status < 400 ? 'ok' : 'err'}`}>{h.status || 'ERR'}</span>
                  <span className="pg__ep-method" style={{ color: METHOD_COLORS[h.method] || '#64748b' }}>{h.method}</span>
                  <span className="pg__history-url">{h.url.replace(mockBase, '')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .pg { font-size: 14px; }
        .pg__banner {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          padding: 0.65rem 1rem; margin-bottom: 0.75rem;
          background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;
          font-size: 0.82rem; color: #92400e;
        }
        .pg__banner--deploy {
          background: #e0f2fe; border-color: #7dd3fc; color: #0369a1;
        }
        .pg__layout { display: flex; gap: 1rem; min-height: 500px; }
        .pg__sidebar { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1rem; }
        .pg__sidebar-section { display: flex; flex-direction: column; }
        .pg__sidebar-label {
          font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
          color: #94a3b8; padding: 0.25rem 0; margin-bottom: 0.25rem;
        }
        .pg__ep-item {
          display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.4rem;
          border: none; background: none; cursor: pointer; border-radius: 4px;
          font-size: 0.78rem; text-align: left; transition: background 0.1s;
        }
        .pg__ep-item:hover { background: #f1f5f9; }
        .pg__ep-method { font-weight: 700; font-size: 0.65rem; min-width: 42px; text-transform: uppercase; }
        .pg__ep-path { color: #475569; font-family: monospace; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pg__history-item {
          display: flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.4rem;
          border: none; background: none; cursor: pointer; border-radius: 4px;
          font-size: 0.72rem; text-align: left; transition: background 0.1s;
        }
        .pg__history-item:hover { background: #f1f5f9; }
        .pg__history-status { font-weight: 700; font-size: 0.65rem; min-width: 28px; }
        .pg__history-status.ok { color: #166534; } .pg__history-status.err { color: #991b1b; }
        .pg__history-url { color: #64748b; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7rem; }
        .pg__empty { font-size: 0.75rem; color: #94a3b8; padding: 0.5rem; margin: 0; }

        .pg__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }

        .pg__urlbar { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .pg__urlbar:focus-within { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
        .pg__method-select {
          width: 90px; border: none; border-right: 1px solid #e2e8f0; padding: 0.5rem 0.6rem;
          font-size: 0.8rem; font-weight: 700; background: #f8fafc; cursor: pointer; outline: none;
          font-family: monospace;
        }
        .pg__url-input {
          flex: 1; border: none; padding: 0.5rem 0.75rem; font-size: 0.8rem; font-family: monospace;
          outline: none; background: #fff;
        }
        .pg__send-btn {
          padding: 0.5rem 1.25rem; border: none; background: #6366f1; color: #fff;
          font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: background 0.15s;
        }
        .pg__send-btn:hover { background: #4f46e5; }
        .pg__send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .pg__tabs { display: flex; gap: 0; border-bottom: 1px solid #e2e8f0; }
        .pg__tab {
          padding: 0.4rem 0.75rem; border: none; background: none; cursor: pointer;
          font-size: 0.78rem; font-weight: 600; color: #64748b;
          border-bottom: 2px solid transparent; transition: all 0.1s;
          display: flex; align-items: center; gap: 0.35rem;
        }
        .pg__tab.active { color: #6366f1; border-bottom-color: #6366f1; }
        .pg__tab-count {
          background: #e0e7ff; color: #4f46e5; font-size: 0.6rem; padding: 0.05rem 0.35rem;
          border-radius: 999px; font-weight: 700;
        }

        .pg__tab-content { min-height: 100px; }

        .pg__kv-editor { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.5rem 0; }
        .pg__kv-row { display: flex; gap: 0.35rem; align-items: center; }
        .pg__kv-check { width: 16px; height: 16px; accent-color: #6366f1; cursor: pointer; flex-shrink: 0; }
        .pg__kv-input {
          flex: 1; padding: 0.3rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px;
          font-size: 0.78rem; font-family: monospace; outline: none; min-width: 0;
        }
        .pg__kv-input:focus { border-color: #6366f1; }
        .pg__kv-remove {
          border: none; background: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer;
          padding: 0 0.25rem; border-radius: 4px; line-height: 1;
        }
        .pg__kv-remove:hover { color: #ef4444; background: #fef2f2; }
        .pg__kv-add {
          border: none; background: none; color: #6366f1; font-size: 0.75rem; font-weight: 600;
          cursor: pointer; padding: 0.2rem 0; text-align: left; align-self: flex-start;
        }

        .pg__body-editor { padding: 0.5rem 0; }
        .pg__body-textarea {
          width: 100%; min-height: 120px; padding: 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
          font-family: monospace; font-size: 0.78rem; resize: vertical; outline: none; background: #fafafa;
        }
        .pg__body-textarea:focus { border-color: #6366f1; background: #fff; }
        .pg__body-textarea--err { border-color: #ef4444; }
        .pg__body-textarea:disabled { opacity: 0.5; background: #f1f5f9; cursor: not-allowed; }
        .pg__body-error { font-size: 0.72rem; color: #dc2626; margin-top: 0.25rem; }

        .pg__response { flex: 1; display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; min-height: 200px; }
        .pg__response-bar {
          display: flex; align-items: center; gap: 1rem; padding: 0.4rem 0.75rem;
          background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem;
        }
        .pg__response-status { font-weight: 700; font-size: 0.8rem; }
        .pg__response-status.ok { color: #166534; } .pg__response-status.err { color: #991b1b; }
        .pg__response-time, .pg__response-size { color: #64748b; font-family: monospace; font-size: 0.72rem; }
        .pg__response-body {
          flex: 1; margin: 0; padding: 0.75rem; font-family: monospace; font-size: 0.75rem;
          line-height: 1.5; overflow: auto; white-space: pre-wrap; word-break: break-all;
          color: #334155; background: #fff;
        }
        .pg__response-empty {
          flex: 1; display: flex; align-items: center; justify-content: center;
          color: #94a3b8; font-size: 0.82rem;
        }
      `}</style>
    </div>
  )
}
