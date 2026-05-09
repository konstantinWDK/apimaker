import { useEffect, useMemo, useState } from 'react'

import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

const METHODS: Array<ProjectDraft['endpoints'][number]['method']> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface Props {
  project: ProjectDraft
}

interface ApiResponse {
  url: string
  status: number
  body: unknown
  method: string
  mode: 'mock' | 'local'
}

const buildCurlSnippet = (method: string, url: string, body: string | null) => {
  const parts = [`curl -X ${method} "${url}"`]
  if (body && body.trim().length > 0 && method !== 'GET') {
    parts.push('-H "Content-Type: application/json"')
    parts.push(`-d '${body.replace(/'/g, "\\'")}'`)
  }
  return parts.join(' ')
}

const generateLocalSample = (project: ProjectDraft): Array<Record<string, unknown>> => {
  const fields = project.dataset?.fields ?? []
  if (fields.length === 0) return [{ message: 'Define tu dataset para obtener datos de ejemplo.' }]
  const rows: Array<Record<string, unknown>> = []
  for (let i = 0; i < 5; i++) {
    const row: Record<string, unknown> = {}
    for (const f of fields) {
      if (f.type === 'string') {
        if (f.name.toLowerCase().includes('email')) row[f.name] = `user${i + 1}@example.com`
        else if (f.name.toLowerCase().includes('name')) row[f.name] = `Item ${i + 1}`
        else row[f.name] = `value-${i + 1}`
      } else if (f.type === 'integer') {
        row[f.name] = Math.floor(Math.random() * 100) + 1
      } else if (f.type === 'float') {
        row[f.name] = parseFloat((Math.random() * 100).toFixed(2))
      } else if (f.type === 'boolean') {
        row[f.name] = Math.random() > 0.5
      } else if (f.type === 'datetime') {
        row[f.name] = new Date(Date.now() - Math.random() * 86400000 * 365).toISOString()
      } else {
        row[f.name] = null
      }
    }
    rows.push(row)
  }
  return rows
}

const initialBody = (project: ProjectDraft, method: string) => {
  if (method === 'GET') return ''
  const fields = project.dataset?.fields
  if (fields?.length) {
    const body: Record<string, unknown> = {}
    for (const f of fields) {
      body[f.name] = f.type === 'boolean' ? true : f.type === 'integer' ? 1 : f.type === 'float' ? 1.0 : 'example'
    }
    return JSON.stringify(body, null, 2)
  }
  return '{ }'
}

export function ApiPlayground({ project }: Props) {
  const backendConfig = readBackendConfig()
  const backendBaseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const mockBaseUrl = `${backendBaseUrl}/api/mock/${project.id}`

  const defaultEndpoint = project.endpoints[0]?.path ?? '/records'
  const [method, setMethod] = useState<ProjectDraft['endpoints'][number]['method']>(project.endpoints[0]?.method ?? 'GET')
  const [path, setPath] = useState<string>(defaultEndpoint)
  const [body, setBody] = useState(initialBody(project, method))
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(project.endpoints[0]?.id ?? 'custom')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const resolvedUrl = useMemo(() => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${mockBaseUrl}${normalizedPath}`
  }, [mockBaseUrl, path])

  const curlSnippet = useMemo(() => buildCurlSnippet(method, resolvedUrl, body), [method, resolvedUrl, body])

  const onSelectEndpoint = (id: string) => {
    setSelectedEndpoint(id)
    if (id === 'custom') return
    const endpoint = project.endpoints.find((item) => item.id === id)
    if (!endpoint) return
    setMethod(endpoint.method)
    setPath(endpoint.path)
    setBody(initialBody(project, endpoint.method))
    setResponse(null)
  }

  const isManual = selectedEndpoint === 'custom'

  useEffect(() => {
    const first = project.endpoints[0]
    if (!first) {
      setSelectedEndpoint('custom')
      setMethod('GET')
      setPath('/records')
      setBody(initialBody(project, 'GET'))
      return
    }
    setSelectedEndpoint(first.id)
    setMethod(first.method)
    setPath(first.path)
    setBody(initialBody(project, first.method))
    setResponse(null)
  }, [project.id])

  const runRequest = async () => {
    setIsRunning(true)
    setResponse(null)

    // Always simulate locally (fast, no backend dependency)
    await new Promise((r) => setTimeout(r, 300))

    const sampleData = generateLocalSample(project)
    let resultBody: unknown = sampleData

    if (method === 'POST') {
      try {
        const parsed = JSON.parse(body)
        resultBody = { _id: crypto.randomUUID(), ...parsed, created: true }
      } catch {
        resultBody = { _id: crypto.randomUUID(), created: true }
      }
    } else if (method === 'DELETE') {
      resultBody = { deleted: true }
    } else if (method === 'PUT' || method === 'PATCH') {
      try {
        const parsed = JSON.parse(body)
        resultBody = { ...parsed, updated: true }
      } catch {
        resultBody = { updated: true }
      }
    }

    setResponse({
      url: `${backendBaseUrl}/api/mock/${project.id}${path}`,
      status: method === 'POST' ? 201 : 200,
      body: resultBody,
      method,
      mode: 'local',
    })
    setIsRunning(false)
  }

  const handleMethodChange = (value: ProjectDraft['endpoints'][number]['method']) => {
    setMethod(value)
    if (value === 'GET') {
      setBody('')
    } else if (!body) {
      setBody(initialBody(project, value))
    }
  }

  return (
    <div className="api-playground">
      <div className="api-playground__summary">
        <p className="label">Base URL</p>
        <p className="api-playground__base-value">{backendBaseUrl}</p>
        <span className="api-playground__mode-badge">Simulación local</span>
      </div>

      <label className="form-field">
        <span className="label">Endpoint guardado</span>
        <select className="field" value={selectedEndpoint} onChange={(event) => onSelectEndpoint(event.target.value)}>
          <option value="custom">Manual</option>
          {project.endpoints.map((endpoint) => (
            <option key={endpoint.id} value={endpoint.id}>
              {endpoint.method} {endpoint.path}
            </option>
          ))}
        </select>
      </label>

      {isManual ? (
        <>
          <label className="form-field">
            <span className="label">Endpoint path</span>
            <input className="field" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/records" />
          </label>
          <div className="method-pills">
            {METHODS.map((option) => (
              <button
                key={option}
                type="button"
                className={option === method ? 'pill active' : 'pill'}
                onClick={() => handleMethodChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="api-playground__chips">
          <span className="pill active">{method}</span>
          <span className="api-playground__path">{path}</span>
        </div>
      )}

      {(!isManual || method !== 'GET') ? (
        <label className="form-field">
          <span className="label">Request body</span>
          <textarea className="field api-playground__body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
      ) : null}

      <button type="button" className="btn primary" onClick={runRequest} disabled={isRunning}>
        {isRunning ? 'Probando…' : 'Probar API local'}
      </button>

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
          <p className="muted-text">Ejecuta la petición para ver la respuesta.</p>
        )}
      </div>
    </div>
  )
}
