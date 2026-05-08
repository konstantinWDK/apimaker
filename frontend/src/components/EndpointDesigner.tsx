import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { clsx } from 'clsx'

import { useBackendConfig } from '../lib/backendConfig'
import type { ApiEndpoint, ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  endpoints: ApiEndpoint[]
  onAdd: (endpoint: ApiEndpoint) => void
  onRemove: (id: string) => void
  previewBase: string
  warningMessage: string | null
  clearWarning: () => void
}

const emptyEndpoint = (): ApiEndpoint => ({
  id: crypto.randomUUID(),
  name: 'Nuevo recurso',
  method: 'GET',
  path: '/items',
  summary: '',
})

const METHOD_OPTIONS: ApiEndpoint['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const METHOD_DESCRIPTIONS: Record<ApiEndpoint['method'], string> = {
  GET: 'Lee recursos existentes',
  POST: 'Crea un nuevo recurso',
  PUT: 'Reemplaza un recurso',
  PATCH: 'Actualiza parcialmente',
  DELETE: 'Elimina un recurso',
}

const METHOD_CLASS: Record<ApiEndpoint['method'], string> = {
  GET: 'endpoint-item__method--get',
  POST: 'endpoint-item__method--post',
  PUT: 'endpoint-item__method--put',
  PATCH: 'endpoint-item__method--patch',
  DELETE: 'endpoint-item__method--delete',
}

export function EndpointDesigner({ project, endpoints, onAdd, onRemove, previewBase, warningMessage, clearWarning }: Props) {
  const [draft, setDraft] = useState<ApiEndpoint>(emptyEndpoint())
  const [error, setError] = useState<string | null>(null)
  const { config } = useBackendConfig()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim()) {
      setError('El endpoint necesita un nombre')
      return
    }
    if (!draft.path.trim()) {
      setError('Indica un path para el endpoint')
      return
    }
    onAdd(draft)
    setDraft(emptyEndpoint())
    setError(null)
    clearWarning()
  }

  const rowsCount = project.dataset?.sampleRows?.length ?? 0
  const datasetName = project.dataset?.name ?? 'Sin dataset'
  const previewPath = endpoints[0]?.path ?? '/records'
  const resolvedBase = useMemo(() => {
    if (config.baseUrl?.trim()) return config.baseUrl.replace(/\/$/, '')
    if (previewBase) return previewBase.replace(/\/$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return 'http://localhost:8000'
  }, [config.baseUrl, previewBase])
  const previewProjectId = project.remoteId ?? project.id
  const previewUrl = useMemo(() => `${resolvedBase}/api/${previewProjectId}${previewPath}`, [resolvedBase, previewPath, previewProjectId])
  const sizeKb = project.dataset?.sampleRows?.length
    ? `${Math.max(1, Math.round(JSON.stringify(project.dataset.sampleRows).length / 1024))} KB`
    : '1 KB'

  return (
    <div className="endpoint-designer">
      <div className="endpoint-summary">
        <div className="endpoint-summary__item">
          <p className="label">API Name</p>
          <p>{project.name}</p>
        </div>
        <div className="endpoint-summary__item">
          <p className="label">Dataset</p>
          <p>{datasetName}</p>
        </div>
        <div className="endpoint-summary__item">
          <p className="label"># Rows</p>
          <p>{rowsCount}</p>
        </div>
        <div className="endpoint-summary__item">
          <p className="label">Size</p>
          <p>{sizeKb}</p>
        </div>
        <div className="endpoint-summary__preview">
          <p className="label">Preview</p>
          <a className="endpoint-preview__link" href={previewUrl} target="_blank" rel="noreferrer">
            {previewUrl}
          </a>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <form onSubmit={handleSubmit} className="endpoint-form">
        <p className="eyebrow">Endpoint blueprint</p>
        <p className="method-hint method-hint--standalone" aria-live="polite">
          <span className="method-hint__icon">i</span>
          {METHOD_DESCRIPTIONS[draft.method]}
        </p>
        <div className="endpoint-form__row">
          <select
            value={draft.method}
            className="field endpoint-form__method-select"
            onChange={(event) => setDraft({ ...draft, method: event.target.value as ApiEndpoint['method'] })}
          >
            {METHOD_OPTIONS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
          <input
            value={draft.path}
            className="field"
            onChange={(event) => setDraft({ ...draft, path: event.target.value })}
            placeholder="/resource"
          />
          <input
            value={draft.name}
            className="field"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Nombre corto"
          />
        </div>
        <input
          value={draft.summary}
          className="field"
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          placeholder="Descripción"
        />
        <button type="submit" className="btn primary">
          Añadir endpoint
        </button>
      </form>

      <div className="endpoint-list">
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className="endpoint-item">
            <div className="endpoint-item__header">
              <span className={clsx('endpoint-item__method', METHOD_CLASS[endpoint.method])}>{endpoint.method}</span>
              <code className="endpoint-item__route">{endpoint.path}</code>
            </div>
            <div className="endpoint-item__body">
              <p className="endpoint-item__title">{endpoint.name}</p>
              {endpoint.summary ? <p className="endpoint-item__summary">{endpoint.summary}</p> : null}
            </div>
            <button type="button" className="endpoint-item__remove" onClick={() => onRemove(endpoint.id)} aria-label={`Eliminar ${endpoint.name}`}>
              ×
            </button>
          </div>
        ))}
        {endpoints.length === 0 ? <p className="endpoint-empty">Añade al menos un endpoint para generar la API.</p> : null}
      </div>

      {warningMessage ? <p className="error-text">{warningMessage}</p> : null}
    </div>
  )
}
