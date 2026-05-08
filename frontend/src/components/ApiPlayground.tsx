import { useEffect, useMemo, useState } from 'react'

import type { ProjectDraft } from '../types/schemas'

const METHODS: Array<ProjectDraft['endpoints'][number]['method']> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface Props {
  project: ProjectDraft
}

interface ApiResponse {
  url: string
  status: number
  body: unknown
}

const buildCurlSnippet = (method: string, url: string, body: string | null) => {
  const parts = [`curl -X ${method} "${url}"`]
  if (body && body.trim().length > 0 && method !== 'GET') {
    parts.push('-H "Content-Type: application/json"')
    parts.push(`-d '${body}'`)
  }
  return parts.join(' ')
}

const initialBody = (project: ProjectDraft, method: string) => {
  if (method === 'GET') return ''
  const sample = project.dataset?.sampleRows?.[0]
  return sample ? JSON.stringify(sample, null, 2) : ''
}

export function ApiPlayground({ project }: Props) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
  const defaultEndpoint = project.endpoints[0]?.path ?? '/records'
  const [method, setMethod] = useState<ProjectDraft['endpoints'][number]['method']>(project.endpoints[0]?.method ?? 'GET')
  const [path, setPath] = useState<string>(defaultEndpoint)
  const [body, setBody] = useState(initialBody(project, method))
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>(project.endpoints[0]?.id ?? 'custom')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const resolvedUrl = useMemo(() => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${baseUrl}${normalizedPath}`
  }, [baseUrl, path])

  const curlSnippet = useMemo(() => buildCurlSnippet(method, resolvedUrl, body), [method, resolvedUrl, body])

  const onSelectEndpoint = (id: string) => {
    setSelectedEndpoint(id)
    if (id === 'custom') return
    const endpoint = project.endpoints.find((item) => item.id === id)
    if (!endpoint) return
    setMethod(endpoint.method)
    setPath(endpoint.path)
    setBody(initialBody(project, endpoint.method))
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
  }, [project.id])

  const runRequest = () => {
    setIsRunning(true)
    setTimeout(() => {
      setResponse({
        url: resolvedUrl,
        status: method === 'POST' ? 201 : 200,
        body: project.dataset?.sampleRows?.length ? project.dataset.sampleRows : [{ message: 'Define tu dataset para obtener datos.' }],
      })
      setIsRunning(false)
    }, 350)
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
        <p className="api-playground__base-value">{baseUrl}</p>
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

      {isManual && method !== 'GET' ? (
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
            <p className="label">Response</p>
            <pre className="preview-json">{JSON.stringify({ status: response.status, data: response.body }, null, 2)}</pre>
          </>
        ) : (
          <p className="muted-text">Ejecuta la petición para ver la respuesta mock.</p>
        )}
      </div>
    </div>
  )
}
