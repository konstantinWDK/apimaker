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
  name: '',
  method: 'GET',
  path: '',
  summary: '',
  operationType: 'custom',
})

const OPERATION_OPTIONS: Array<{ value: ApiEndpoint['operationType']; label: string }> = [
  { value: 'list', label: 'Listar (GET)' },
  { value: 'get', label: 'Obtener uno (GET)' },
  { value: 'create', label: 'Crear (POST)' },
  { value: 'update', label: 'Actualizar (PUT)' },
  { value: 'delete', label: 'Eliminar (DELETE)' },
  { value: 'custom', label: 'Personalizado' },
]

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
  const [editDraft, setEditDraft] = useState<ApiEndpoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { config } = useBackendConfig()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAdd(draft)
    setDraft(emptyEndpoint())
    setError(null)
    clearWarning()
  }

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editDraft) return
    if (!editDraft.name.trim() || !editDraft.path.trim()) {
      setError('Nombre y path son obligatorios')
      return
    }
    onAdd(editDraft)
    setEditDraft(null)
    setEditingId(null)
    setError(null)
  }

  const handleEdit = (endpoint: ApiEndpoint) => {
    setEditDraft({ ...endpoint })
    setEditingId(endpoint.id)
  }

  const cancelEdit = () => {
    setEditDraft(null)
    setEditingId(null)
  }

  const handleOperationChange = (opType: ApiEndpoint['operationType']) => {
    const datasetName = project.dataset?.name || 'items'
    const updates = getOperationUpdates(opType, datasetName)
    setDraft(prev => ({ ...prev, ...updates, operationType: opType }))
  }

  const handleEditOperationChange = (opType: ApiEndpoint['operationType']) => {
    if (!editDraft) return
    const datasetName = project.dataset?.name || 'items'
    const updates = getOperationUpdates(opType, datasetName)
    setEditDraft(prev => prev ? ({ ...prev, ...updates, operationType: opType }) : null)
  }

  const getOperationUpdates = (opType: ApiEndpoint['operationType'], datasetName: string): Partial<ApiEndpoint> => {
    const resourcePath = `/${datasetName.toLowerCase().replace(/\s+/g, '-')}`
    switch (opType) {
      case 'list':
        return { method: 'GET', path: resourcePath, name: `Listar ${datasetName}`, summary: `Obtiene la lista de ${datasetName}` }
      case 'get':
        return { method: 'GET', path: `${resourcePath}/{id}`, name: `Detalle ${datasetName}`, summary: `Obtiene un ${datasetName} por su ID` }
      case 'create':
        return { method: 'POST', path: resourcePath, name: `Crear ${datasetName}`, summary: `Registra un nuevo ${datasetName}` }
      case 'update':
        return { method: 'PUT', path: `${resourcePath}/{id}`, name: `Actualizar ${datasetName}`, summary: `Modifica un ${datasetName} existente` }
      case 'delete':
        return { method: 'DELETE', path: `${resourcePath}/{id}`, name: `Borrar ${datasetName}`, summary: `Elimina un ${datasetName}` }
      default:
        return {}
    }
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
  const previewProjectId = project.slug || project.remoteId || project.id
  const previewUrl = useMemo(() => `${resolvedBase}/api/mock/${previewProjectId}${previewPath}`, [resolvedBase, previewPath, previewProjectId])
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
            value={draft.operationType}
            className="field endpoint-form__operation-select"
            onChange={(event) => handleOperationChange(event.target.value as ApiEndpoint['operationType'])}
          >
            {OPERATION_OPTIONS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>

          {draft.operationType === 'custom' && (
            <select
              value={draft.method}
              className="field endpoint-form__method-select"
              onChange={(event) => setDraft({ ...draft, method: event.target.value as ApiEndpoint['method'] })}
            >
              {METHOD_OPTIONS.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          )}
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
        <div className="endpoint-form__row">
          <input
            value={draft.summary}
            className="field endpoint-form__summary-field"
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            placeholder="Descripción del endpoint (opcional)"
          />
        </div>
        <div className="endpoint-form__actions">
          <button type="submit" className="btn primary">
            Añadir endpoint
          </button>
        </div>
      </form>

      <div className="endpoint-list">
        {endpoints.map((endpoint) => (
          <div key={endpoint.id} className={clsx('endpoint-item', editingId === endpoint.id && 'endpoint-item--editing')}>
            {editingId === endpoint.id && editDraft ? (
              <form onSubmit={handleEditSubmit} className="endpoint-form endpoint-form--inline">
                <div className="endpoint-form__row">
                  <select
                    value={editDraft.operationType}
                    className="field"
                    onChange={(event) => handleEditOperationChange(event.target.value as ApiEndpoint['operationType'])}
                  >
                    {OPERATION_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {editDraft.operationType === 'custom' && (
                    <select
                      value={editDraft.method}
                      className="field"
                      onChange={(event) => setEditDraft({ ...editDraft, method: event.target.value as ApiEndpoint['method'] })}
                    >
                      {METHOD_OPTIONS.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  )}
                  <input
                    value={editDraft.path}
                    className="field"
                    onChange={(event) => setEditDraft({ ...editDraft, path: event.target.value })}
                    placeholder="/resource"
                  />
                  <input
                    value={editDraft.name}
                    className="field"
                    onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                    placeholder="Nombre"
                  />
                </div>
                <div className="endpoint-form__row">
                  <input
                    value={editDraft.summary}
                    className="field endpoint-form__summary-field"
                    onChange={(event) => setEditDraft({ ...editDraft, summary: event.target.value })}
                    placeholder="Descripción"
                  />
                </div>
                <div className="endpoint-form__actions">
                  <button type="submit" className="btn primary btn-small">Guardar</button>
                  <button type="button" className="btn subtle btn-small" onClick={cancelEdit}>Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div className="endpoint-item__header">
                  <span className={clsx('endpoint-item__method', METHOD_CLASS[endpoint.method])}>{endpoint.method}</span>
                  <code className="endpoint-item__route">{endpoint.path}</code>
                  {endpoint.operationType && endpoint.operationType !== 'custom' && (
                    <span className="endpoint-item__type-badge">{endpoint.operationType}</span>
                  )}
                </div>
                <div className="endpoint-item__body">
                  <p className="endpoint-item__title">{endpoint.name}</p>
                  {endpoint.summary ? <p className="endpoint-item__summary">{endpoint.summary}</p> : null}
                </div>
                <div className="endpoint-item__actions">
                  <button type="button" className="endpoint-item__edit" onClick={() => handleEdit(endpoint)}>
                    Editar
                  </button>
                  <button type="button" className="endpoint-item__remove" onClick={() => onRemove(endpoint.id)} aria-label={`Eliminar ${endpoint.name}`}>
                    ×
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {endpoints.length === 0 ? <p className="endpoint-empty">Añade al menos un endpoint para generar la API.</p> : null}
      </div>

      {warningMessage ? <p className="error-text">{warningMessage}</p> : null}
    </div>
  )
}
