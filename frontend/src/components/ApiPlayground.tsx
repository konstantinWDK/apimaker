import { useEffect, useMemo, useRef, useState } from 'react'

import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  project: ProjectDraft
}

interface ApiResponse {
  url: string
  status: number
  body: unknown
  method: string
}

// ─── Sample data store (Only for demo/real data) ────────────────
const sampleStore: Record<string, Array<Record<string, unknown>>> = {}

const initStore = (project: ProjectDraft) => {
  const actualRows = project.dataset?.sampleRows
  if (actualRows && actualRows.length > 0) {
    const fields = (project.dataset as any)?.fields ?? []
    sampleStore[project.id] = actualRows.map((row: Record<string, string>, i: number) => {
      const item: Record<string, unknown> = { id: i + 1 }
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
const buildBodyForMethod = (project: ProjectDraft, method: string, _path: string): string => {
  const fields = project.dataset ? (project.dataset as any).fields ?? [] : []
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
const buildCurl = (method: string, url: string, body: string | null) => {
  const parts = [`curl -X ${method} "${url}"`]
  if (body && body.trim().length > 0 && method !== 'GET') {
    parts.push('-H "Content-Type: application/json"')
    parts.push(`-d '${body.replace(/'/g, "\\'")}'`)
  }
  return parts.join(' \\\n  ')
}

// ─── Component ────────────────────────────────────────────────
export function ApiPlayground({ project }: Props) {
  const backendConfig = readBackendConfig()
  const backendBaseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  // Initialize sample store when project changes
  useEffect(() => {
    initStore(project)
  }, [project.id, project.dataset?.id])

  const allEndpoints = project.endpoints.length > 0 ? project.endpoints : [{ id: 'default', method: 'GET' as const, path: '/records', name: 'records', summary: '' }]
  const initialEndpoint = allEndpoints[0]

  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(initialEndpoint.id)
  const [method, setMethod] = useState<string>(initialEndpoint.method)
  const [path, setPath] = useState<string>(initialEndpoint.path)
  const [body, setBody] = useState<string>(() => buildBodyForMethod(project, initialEndpoint.method, initialEndpoint.path))
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [hint, setHint] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Reset form state when project changes
  useEffect(() => {
    const eps = project.endpoints.length > 0 ? project.endpoints : [{ id: 'default', method: 'GET' as const, path: '/records', name: 'records', summary: '' }]
    const ep = eps[0]
    if (ep) {
      setSelectedEndpointId(ep.id)
      setMethod(ep.method)
      setPath(ep.path)
      setBody(buildBodyForMethod(project, ep.method, ep.path))
      setResponse(null)
      setHint('')
    }
  }, [project.id, project.dataset?.id, project.endpoints])

  const mockUrl = useMemo(() => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const effectiveId = project.slug || project.remoteId || project.id
    return `${backendBaseUrl}/api/mock/${effectiveId}${normalized}`
  }, [backendBaseUrl, project.id, project.remoteId, project.slug, path])

  const curlSnippet = useMemo(() => buildCurl(method, mockUrl, body), [method, mockUrl, body])

  const store = sampleStore[project.id] ?? []

  // Build hint for each method
  const updateHint = (m: string, p: string) => {
    if (m === 'GET') {
      if (p.includes('{')) {
        // param needed for hint
        const param = p.split('{')[1]?.split('}')[0] || 'id'
        const sampleId = store.length > 0 ? store[0].id : '1'
        setHint(`GET devuelve un solo registro. Ejemplo: ${p.replace(`{${param}}`, String(sampleId))}`)
      } else {
        setHint(`GET devuelve lista de registros. Total en store: ${store.length} registros.`)
      }
    } else if (m === 'POST') {
      setHint('POST crea un nuevo registro. El body se añade al store con un _id automático.')
    } else if (m === 'PUT' || m === 'PATCH') {
      // param needed for hint
      setHint(`${m} actualiza un registro existente. Usa un ID del store (1–${store.length}).`)
    } else if (m === 'DELETE') {
      // param needed for hint
      setHint(`DELETE elimina un registro. ID a borrar: 1–${store.length}.`)
    }
  }

  const selectEndpoint = (id: string) => {
    setSelectedEndpointId(id)
    if (id === 'custom') {
      setMethod('GET')
      setPath('/records')
      setBody('')
      setHint('')
      setResponse(null)
      return
    }
    const ep = project.endpoints.find((e) => e.id === id)
    if (!ep) return
    setMethod(ep.method)
    setPath(ep.path)
    setBody(buildBodyForMethod(project, ep.method, ep.path))
    updateHint(ep.method, ep.path)
    setResponse(null)
  }

  // Initialize on project change
  useEffect(() => {
    const first = project.endpoints[0]
    if (!first) {
      setSelectedEndpointId('custom')
      setMethod('GET')
      setPath('/records')
      setBody('')
      return
    }
    setSelectedEndpointId(first.id)
    setMethod(first.method)
    setPath(first.path)
    setBody(buildBodyForMethod(project, first.method, first.path))
    updateHint(first.method, first.path)
    setResponse(null)
  }, [project.id])

  const runRequest = async () => {
    setIsRunning(true)
    setResponse(null)

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      }
      
      if (method !== 'GET' && body) {
        options.body = body
      }

      const res = await fetch(mockUrl, options)
      const resultBody = await res.json().catch(() => ({ error: 'Respuesta no válida' }))
      
      setResponse({
        url: mockUrl,
        status: res.status,
        body: resultBody,
        method
      })

      // If it was a POST/PUT/DELETE and successful, we should probably update our local store
      // though the backend now handles the truth. For now, let's just show the response.
      
    } catch (error) {
      console.error('Error en simulación:', error)
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
    setBody(buildBodyForMethod(project, value, path))
    updateHint(value, path)
    setResponse(null)
  }

  const handlePathChange = (val: string) => {
    setPath(val)
    updateHint(method, val)
    setResponse(null)
  }

  // Show only relevant methods based on selected endpoint, plus manual option
  const availableMethods = useMemo(() => {
    const ep = project.endpoints.find((e) => e.id === selectedEndpointId)
    if (!ep) return METHODS
    // Return all methods but highlight the endpoint's method
    return METHODS
  }, [selectedEndpointId, project.endpoints])

  return (
    <div className="api-playground">
      <div className="api-playground__summary">
        <p className="label">Base URL</p>
        <p className="api-playground__base-value">{backendBaseUrl}/api/mock/{project.slug || project.remoteId || project.id}</p>
        <span className="api-playground__mode-badge">Simulación interactiva</span>
      </div>

      <label className="form-field">
        <span className="label">Endpoint</span>
        <select className="field" value={selectedEndpointId} onChange={(e) => selectEndpoint(e.target.value)}>
          {project.endpoints.length === 0 && <option value="custom">/records (default)</option>}
          {project.endpoints.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.method} {ep.path}</option>
          ))}
        </select>
      </label>

      {/* Method selector */}
      <div className="method-pills">
        {availableMethods.map((opt) => (
          <button
            key={opt}
            type="button"
            className={opt === method ? 'pill active' : 'pill'}
            onClick={() => handleMethodChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Path input */}
      <label className="form-field">
        <span className="label">Path</span>
        <input className="field" value={path} onChange={(e) => handlePathChange(e.target.value)} placeholder="/records" />
      </label>

      {/* Hint */}
      {hint && <p className="api-playground__hint">{hint}</p>}

      {/* Request body (non-GET only) */}
      {method !== 'GET' && (
        <label className="form-field">
          <span className="label">Request body</span>
          <textarea
            ref={bodyRef}
            className="field api-playground__body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      )}

      {/* Store viewer */}
      <details className="api-playground__store-viewer">
        <summary>📋 Ver store actual ({store.length} registros)</summary>
        <pre className="preview-json">{JSON.stringify(store.slice(0, 1000), null, 2)}</pre>
        {store.length > 1000 && <p className="muted-text">... y {store.length - 1000} más</p>}
      </details>

      <button type="button" className="btn primary" onClick={runRequest} disabled={isRunning}>
        {isRunning ? 'Ejecutando…' : `Enviar ${method}`}
      </button>

      {/* Response */}
      <div className="api-playground__response">
        <p className="label">curl</p>
        <pre className="preview-json api-playground__curl">{curlSnippet}</pre>
        {response ? (
          <>
            <div className="api-playground__response-header">
              <p className="label">Response</p>
              <span className={`api-playground__status ${response.status < 400 ? 'ok' : 'err'}`}>
                {response.status} {response.status < 400 ? 'OK' : 'Error'}
              </span>
            </div>
            <p className="api-playground__response-url">{response.method} {response.url}</p>
            <pre className="preview-json">{JSON.stringify(response.body, null, 2)}</pre>
          </>
        ) : (
          <p className="muted-text">Pulsa enviar para ejecutar la petición.</p>
        )}
      </div>

      <style>{`
        .api-playground__hint {
          margin: 0.25rem 0 0.5rem;
          padding: 0.4rem 0.6rem;
          background: #f0f4ff;
          color: #1d4ed8;
          border-radius: 4px;
          font-size: 0.78rem;
          border-left: 3px solid #3b82f6;
        }
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
