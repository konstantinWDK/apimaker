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
}

interface ApiResponse {
  url: string
  status: number
  body: unknown
  method: string
}

// ─── Sample data store (Only for demo/real data) ────────────────
const sampleStore: Record<string, Array<Record<string, unknown>>> = {}

const initStore = (project: ProjectDraft, datasetId?: string) => {
  const defaultDataset = datasetId ? project.datasets.find(d => d.id === datasetId) ?? project.datasets[0] : project.datasets[0]
  const actualRows = defaultDataset?.sampleRows
  if (actualRows && actualRows.length > 0) {
    const fields = defaultDataset?.fields ?? []
    sampleStore[project.id] = actualRows.map((row: Record<string, string>, i: number) => {
      const item: Record<string, unknown> = { _id: `local-${i + 1}`, id: i + 1 }
      for (const f of fields) {
        const val = row[f.name]
        if (val !== undefined) {
          if (f.type === 'integer') item[f.name] = parseInt(val, 10) || 0
          else if (f.type === 'float') item[f.name] = parseFloat(val) || 0
          else if (f.type === 'boolean') item[f.name] = String(val).toLowerCase() === 'true'
          else item[f.name] = val
        }
      }
      return item
    })
  } else {
    sampleStore[project.id] = []
  }
}

// ─── Body generators ──────────────────────────────────────────
const buildBodyForMethod = (project: ProjectDraft, method: string, _path: string, datasetId?: string): string => {
  const ds = datasetId ? project.datasets.find(d => d.id === datasetId) ?? project.datasets[0] : project.datasets[0]
  const fields = ds?.fields ?? []
  if (method === 'GET') return ''

  const base: Record<string, unknown> = {}
  for (const f of fields) {
    const n = f.name.toLowerCase()
    if (f.type === 'string') {
      if (n.includes('email')) base[f.name] = 'nuevo@email.com'
      else if (n.includes('name')) base[f.name] = 'Nuevo Registro'
      else base[f.name] = 'valor de ejemplo'
    } else if (f.type === 'integer') base[f.name] = 42
    else if (f.type === 'float') base[f.name] = 19.99
    else if (f.type === 'boolean') base[f.name] = true
    else if (f.type === 'datetime') base[f.name] = new Date().toISOString()
    else base[f.name] = null
  }

  if (method === 'POST') return JSON.stringify(base, null, 2)
  if (method === 'PUT' || method === 'PATCH') return JSON.stringify(base, null, 2)
  return '{\n}'
}

// ─── Curl snippet builder ─────────────────────────────────────
const buildCurl = (method: string, url: string, body: string | null, project: ProjectDraft) => {
  const parts = [`curl -X ${method} "${url}"`]
  
  if (project.authMethod === 'apikey' && project.apiKey) {
    parts.push(`-H "X-API-Key: ${project.apiKey}"`)
  } else if (project.authMethod === 'jwt') {
    parts.push(`-H "Authorization: Bearer <TOKEN>"`)
  }

  if (body && body.trim().length > 0 && method !== 'GET') {
    parts.push('-H "Content-Type: application/json"')
    parts.push(`-d '${body.replace(/'/g, "\\'")}'`)
  }
  return parts.join(' \\\n  ')
}

// ─── Component ────────────────────────────────────────────────
export function ApiPlayground({ project, mockRunning, onStartMock, mockLoading, selectedDatasetId }: Props) {
  const endpoints = selectedDatasetId
    ? project.endpoints.filter((ep) => !ep.targetDatasetId || ep.targetDatasetId === selectedDatasetId)
    : project.endpoints
  const backendConfig = readBackendConfig()
  const backendBaseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  // Initialize sample store when project changes
  useEffect(() => {
    initStore(project, selectedDatasetId)
  }, [project.id, project.datasets.length])

  const initialEndpoint = endpoints.length > 0 ? endpoints[0] : { id: 'default', method: 'GET' as const, path: '/records', name: 'records', summary: '' }

  const [method, setMethod] = useState<string>(initialEndpoint.method)
  const [path, setPath] = useState<string>(initialEndpoint.path)
  const [body, setBody] = useState<string>(() => buildBodyForMethod(project, initialEndpoint.method, initialEndpoint.path))
  const [queryParams, setQueryParams] = useState<Array<{ key: string, value: string }>>([{ key: '', value: '' }])
  const [headers, setHeaders] = useState<Array<{ key: string, value: string }>>([{ key: '', value: '' }])
  const [history, setHistory] = useState<ApiResponse[]>([])
  const [activeConfigTab, setActiveConfigTab] = useState<'params' | 'headers' | 'body' | 'curl'>('params')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Reset form when project changes
  useEffect(() => {
    if (endpoints.length > 0) {
      const ep = endpoints[0]
      setMethod(ep.method)
      setPath(ep.path)
      setBody(buildBodyForMethod(project, ep.method, ep.path, selectedDatasetId))
      setResponse(null)
    }
  }, [project.id, project.datasets.length, endpoints.length])

  // Resolve path params with values from queryParams
  const resolvedPath = useMemo(() => {
    let resolved = path
    queryParams.filter(q => q.key.trim() !== '').forEach(q => {
      resolved = resolved.replace(`{${q.key}}`, q.value || `{${q.key}}`)
    })
    // Auto-replace {id} with 1 if still unresolved
    resolved = resolved.replace('{id}', '1')
    return resolved
  }, [path, queryParams])

  const mockUrl = useMemo(() => {
    let finalPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
    
    const effectiveId = project.slug || project.remoteId || project.id
    let url = `${backendBaseUrl}/api/mock/${effectiveId}${finalPath}`

    // Add query params
    const activeQueryParams = queryParams.filter(q => q.key.trim() !== '')
    if (activeQueryParams.length > 0) {
      const searchParams = new URLSearchParams()
      activeQueryParams.forEach(q => searchParams.append(q.key, q.value))
      url += `?${searchParams.toString()}`
    }

    return url
  }, [backendBaseUrl, project.id, project.remoteId, project.slug, resolvedPath])

  const curlSnippet = useMemo(() => buildCurl(method, mockUrl, body, project), [method, mockUrl, body, project])

  const store = sampleStore[project.id] ?? []

  const runRequest = async () => {
    setIsRunning(true)
    setResponse(null)
    setBodyError(null)
    setResponseTime(null)

    // Validate body if present
    if (body.trim() && method !== 'GET') {
      try {
        JSON.parse(body)
        setBodyError(null)
      } catch {
        setBodyError('JSON inválido')
        setIsRunning(false)
        return
      }
    }

    const startTime = performance.now()

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (project.authMethod === 'apikey' && project.apiKey) {
        headers['X-API-Key'] = project.apiKey
      } else if (project.authMethod === 'jwt') {
        // For testing in sandbox, we send a dummy bearer token 
        // as the backend verify_mock_auth just checks for presence
        headers['Authorization'] = 'Bearer sim-token-123'
      }

      const options: RequestInit = {
        method,
        headers,
      }
      
      if (method !== 'GET' && body) {
        options.body = body
      }

      const res = await fetch(mockUrl, options)
      const resultBody = await res.json().catch(() => ({ error: 'Respuesta no válida' }))
      
      const elapsed = Math.round(performance.now() - startTime)
      setResponseTime(elapsed)

      const newResponse: ApiResponse = {
        url: mockUrl,
        status: res.status,
        body: resultBody,
        method
      }
      
      setResponse(newResponse)
      setHistory(prev => [newResponse, ...prev].slice(0, 10))

    } catch (error) {
      console.error('Error en simulación:', error)
      const elapsed = Math.round(performance.now() - startTime)
      setResponseTime(elapsed)
      setResponse({
        url: mockUrl,
        status: 500,
        body: { error: 'Error de conexión con el servidor de simulación' },
        method
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleMethodChange = (value: string) => {
    setMethod(value)
    setBody(buildBodyForMethod(project, value, path, selectedDatasetId))
    
    setResponse(null)
  }

  const handlePathChange = (val: string) => {
    setPath(val)
    setResponse(null)
  }

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '' }])
  const updateQueryParam = (index: number, k: string, v: string) => {
    const next = [...queryParams]
    next[index] = { key: k, value: v }
    setQueryParams(next)
    setResponse(null)
  }

  const addHeader = () => setHeaders([...headers, { key: '', value: '' }])
  const updateHeader = (index: number, k: string, v: string) => {
    const next = [...headers]
    next[index] = { key: k, value: v }
    setHeaders(next)
    setResponse(null)
  }

  // Show only relevant methods based on selected endpoint, plus manual option
  const availableMethods = useMemo(() => METHODS, [])

  return (
    <div className="api-playground">
      {/* Floating Status Indicator */}
      <div className="api-playground__status-chip corner">
        <span className={`status-dot ${mockRunning ? 'active' : ''}`} />
        <span className="status-text">{mockRunning ? 'Online' : 'Offline'}</span>
        {!mockRunning && (
          <button type="button" className="btn primary btn-xs" onClick={onStartMock} disabled={mockLoading}>
            {mockLoading ? '...' : 'Activar'}
          </button>
        )}
      </div>

      <div className="playground-grid">
        {/* Left Column: Configuration (now top-oriented) */}
        <div className="playground-column full-width">
          <div className="playground-card config-row-card">
            <div className="playground-card__body">
              {/* Address bar: Method + Path + Send */}
              <div className="address-bar-row">
                <div className="method-selector">
                  <select className="field method-select" value={method} onChange={(e) => handleMethodChange(e.target.value)}>
                    {availableMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="path-input">
                  <input 
                    className="field" 
                    value={path} 
                    onChange={(e) => handlePathChange(e.target.value)} 
                    placeholder="/records" 
                  />
                </div>
                {path.includes('{') && (
                  <span className="path-resolved">
                    → <code>{resolvedPath}</code>
                  </span>
                )}
                <button type="button" className="btn primary playground-run" onClick={runRequest} disabled={isRunning || !mockRunning}>
                  {isRunning ? '...' : 'Send'}
                </button>
              </div>

              {/* Tabs for Params, Headers, Body, cURL */}
              <div className="playground-tabs">
                <button 
                  className={`playground-tab-btn ${activeConfigTab === 'params' ? 'active' : ''}`}
                  onClick={() => setActiveConfigTab('params')}
                >
                  Params {queryParams.filter(q => q.key).length > 0 && <span className="count-dot" />}
                </button>
                <button 
                  className={`playground-tab-btn ${activeConfigTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setActiveConfigTab('headers')}
                >
                  Headers {headers.filter(h => h.key).length > 0 && <span className="count-dot" />}
                </button>
                <button 
                  className={`playground-tab-btn ${activeConfigTab === 'body' ? 'active' : ''}`}
                  onClick={() => setActiveConfigTab('body')}
                  disabled={method === 'GET'}
                >
                  Body
                </button>
                <button 
                  className={`playground-tab-btn ${activeConfigTab === 'curl' ? 'active' : ''}`}
                  onClick={() => setActiveConfigTab('curl')}
                >
                  cURL
                </button>
              </div>

              <div className="tab-content-area">
                {activeConfigTab === 'params' && (
                  <div className="kv-editor">
                    {queryParams.map((q, i) => (
                      <div key={i} className="kv-row">
                        <input className="field field-small" placeholder="Key" value={q.key} onChange={(e) => updateQueryParam(i, e.target.value, q.value)} />
                        <input className="field field-small" placeholder="Value" value={q.value} onChange={(e) => updateQueryParam(i, q.key, e.target.value)} />
                      </div>
                    ))}
                    <button className="btn ghost btn-xs" onClick={addQueryParam}>+ Add param</button>
                  </div>
                )}

                {activeConfigTab === 'headers' && (
                  <div className="kv-editor">
                    {headers.map((h, i) => (
                      <div key={i} className="kv-row">
                        <input className="field field-small" placeholder="Header" value={h.key} onChange={(e) => updateHeader(i, e.target.value, h.value)} />
                        <input className="field field-small" placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, h.key, e.target.value)} />
                      </div>
                    ))}
                    <button className="btn ghost btn-xs" onClick={addHeader}>+ Add header</button>
                  </div>
                )}

                {activeConfigTab === 'curl' && (
                  <pre className="curl-tab-content">{curlSnippet}</pre>
                )}

                {activeConfigTab === 'body' && method !== 'GET' && (
                  <div>
                    <textarea
                      ref={bodyRef}
                      className={`field api-playground__body ${bodyError ? 'api-playground__body--error' : ''}`}
                      rows={4}
                      value={body}
                      onChange={(e) => { setBody(e.target.value); setBodyError(null) }}
                      placeholder="{}"
                    />
                    {bodyError && <p className="api-playground__body-error">{bodyError}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
          <details className="api-playground__store-viewer">
            <summary>📋 Ver datos en memoria ({store.length})</summary>
            <pre className="preview-json">{JSON.stringify(store.slice(0, 100), null, 2)}</pre>
          </details>
        </div>

        {/* Bottom Row - History */}
        <div className="playground-column">
          <div className="playground-card history-card">
            <div className="playground-card__header">
              <h4>Historial reciente</h4>
            </div>
            <div className="playground-card__body">
              {history.length === 0 ? (
                <p className="muted-text-small">No hay peticiones recientes.</p>
              ) : (
                <div className="history-list">
                  {history.map((h, i) => (
                    <div key={i} className="history-item" onClick={() => { setResponse(h); setMethod(h.method); }}>
                      <span className={`history-method ${h.method.toLowerCase()}`}>{h.method}</span>
                      <span className="history-path">{h.url.split('/mock/')[1]?.split('?')[0]}</span>
                      <span className={`history-status ${h.status < 400 ? 'ok' : 'err'}`}>{h.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row - Results */}
        <div className="playground-column">
          <div className="playground-card response-card">
            <div className="playground-card__header">
              <span className="playground-card__number">2</span>
              <h4>Resultado</h4>
              {response && (
                <span className={`status-badge ${response.status < 400 ? 'ok' : 'err'}`}>
                  {response.status}
                </span>
              )}
            </div>
            
            <div className="playground-card__body">
              {response ? (
                <div className="response-content">
                   <div className="response-meta">
                     <span className="method-badge">{response.method}</span>
                     <span className="url-text">{response.url.replace(backendBaseUrl, '')}</span>
                     {responseTime !== null && <span className="response-time">{responseTime}ms</span>}
                   </div>
                   <div className="response-scroll">
                     <pre className="preview-json">{response.body ? JSON.stringify(response.body, null, 2) : '(sin cuerpo de respuesta)'}</pre>
                   </div>
                </div>
              ) : (
                <div className="response-empty">
                  <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" fill="none" strokeWidth="1" className="muted-icon">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  <p>Configura la petición y pulsa enviar para ver la respuesta aquí.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .api-playground { position: relative; }
        .api-playground__status-chip.corner {
          position: absolute;
          top: -38px;
          right: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.6rem;
          background: #f8fafc;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          z-index: 10;
        }
        .api-playground__status-chip.corner .status-text {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        
        .playground-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: flex-start;
        }
        .playground-column.full-width { grid-column: 1 / -1; }

        .address-bar-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          align-items: center;
        }
        .address-bar-row .method-selector { width: 90px; }
        .address-bar-row .path-input { flex: 1; }
        .address-bar-row .path-input input {
          font-family: monospace;
          font-size: 0.8rem;
        }
        .path-resolved {
          font-size: 0.72rem;
          color: #3b82f6;
          white-space: nowrap;
          font-family: monospace;
          flex-shrink: 0;
        }
        .path-resolved code {
          background: #eff6ff;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .address-bar-row .playground-run { padding-left: 1.5rem; padding-right: 1.5rem; flex-shrink: 0; }

        .label-tiny { font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; display: block; }
        .field-tiny { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; height: 28px; }

        .path-vars-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }



        .curl-tab-content {
          margin: 0;
          padding: 0.75rem;
          background: #1e293b;
          color: #e2e8f0;
          font-family: monospace;
          font-size: 0.75rem;
          border-radius: 6px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 200px;
          overflow: auto;
        }

        .params-section {
          margin-bottom: 1.25rem;
          padding: 0.75rem;
          background: #f1f5f9;
          border-radius: 8px;
        }
        .params-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .param-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .param-key {
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 600;
          color: #2563eb;
          min-width: 60px;
        }
        .field-small { padding: 0.35rem 0.6rem; font-size: 0.8rem; }

        .response-card { min-height: 400px; display: flex; flex-direction: column; }
        .response-card .playground-card__body { flex: 1; display: flex; flex-direction: column; padding: 0; }
        
        .status-badge {
          margin-left: auto;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .status-badge.ok { background: #dcfce7; color: #166534; }
        .status-badge.err { background: #fef2f2; color: #991b1b; }

        .response-content { display: flex; flex-direction: column; height: 100%; }
        .response-meta {
          padding: 0.5rem 1rem;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .method-badge { font-weight: 700; color: #475569; font-size: 0.75rem; }
        .url-text { font-size: 0.75rem; color: #64748b; font-family: monospace; }
        .response-scroll { flex: 1; padding: 1rem; overflow: auto; max-height: 400px; }
        
        .response-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
        }
        .muted-icon { margin-bottom: 1rem; opacity: 0.4; }

        .curl-card .playground-card__body { padding: 0; }
        .api-playground__curl { margin: 0; border: none; border-radius: 0; font-size: 0.7rem; }
        
        .btn-xs { padding: 0.2rem 0.4rem; font-size: 0.7rem; }
        .warning-text-small { font-size: 0.72rem; color: #b45309; margin-top: 0.5rem; text-align: center; }

        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; }
        .status-dot.active { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.5); }

        .playground-tabs {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 1rem;
          gap: 1rem;
        }
        .playground-tab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          padding: 0.5rem 0.25rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          position: relative;
        }
        .playground-tab-btn.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        .playground-tab-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .count-dot {
          position: absolute;
          top: 4px;
          right: -6px;
          width: 5px;
          height: 5px;
          background: #3b82f6;
          border-radius: 50%;
        }

        .kv-editor { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .kv-row { display: flex; gap: 0.5rem; }
        .kv-row .field { flex: 1; }

        .history-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .history-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.4rem 0.6rem;
          border-radius: 6px;
          background: #f8fafc;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .history-item:hover { background: #f1f5f9; border-color: #e2e8f0; }
        .history-method { font-size: 0.65rem; font-weight: 800; width: 45px; }
        .history-method.get { color: #0ea5e9; }
        .history-method.post { color: #10b981; }
        .history-method.put { color: #f59e0b; }
        .history-method.delete { color: #ef4444; }
        .history-path { font-size: 0.75rem; color: #475569; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
        .history-status { font-size: 0.7rem; font-weight: 700; }
        .history-status.ok { color: #166534; }
        .history-status.err { color: #991b1b; }

        .response-time {
          font-size: 0.7rem;
          font-weight: 700;
          color: #3b82f6;
          margin-left: auto;
          font-family: monospace;
        }
        .api-playground__body--error {
          border-color: #ef4444 !important;
        }
        .api-playground__body-error {
          font-size: 0.7rem;
          color: #dc2626;
          margin-top: 0.25rem;
          font-weight: 600;
        }
        .preview-json {
          margin: 0;
          padding: 1rem;
          font-family: monospace;
          font-size: 0.78rem;
          color: #334155;
          white-space: pre-wrap;
          word-break: break-all;
          line-height: 1.5;
        }
        .muted-text-small { font-size: 0.75rem; color: #94a3b8; text-align: center; }
        .api-playground__store-viewer {
          margin-bottom: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 0.5rem;
          background: #f8fafc;
        }
        .api-playground__store-viewer summary {
          cursor: pointer;
          font-size: 0.82rem;
          color: #475569;
          font-weight: 500;
          user-select: none;
        }
        .api-playground__store-viewer pre {
          max-height: 200px;
          overflow-y: auto;
          font-size: 0.75rem;
          margin: 0.3rem 0 0;
        }
      `}</style>
    </div>
  )
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
