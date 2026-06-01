import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

const emptyEndpoint = (datasetId?: string): ApiEndpoint => ({
  id: crypto.randomUUID(),
  name: '',
  method: 'GET',
  path: '',
  summary: '',
  operationType: 'custom',
  targetDatasetId: datasetId,
})

const METHOD_OPTIONS: ApiEndpoint['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_COLORS: Record<ApiEndpoint['method'], string> = {
  GET: '#0ea5e9',
  POST: '#10b981',
  PUT: '#f97316',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
}

export function EndpointDesigner({ project, endpoints, onAdd, onRemove, previewBase, warningMessage, clearWarning }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ApiEndpoint>(emptyEndpoint(project.datasets[0]?.id))
  const [editDraft, setEditDraft] = useState<ApiEndpoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { config } = useBackendConfig()

  const OPERATION_OPTIONS: Array<{ value: ApiEndpoint['operationType']; label: string; method: string; desc: string }> = useMemo(
    () => [
      { value: 'list', label: t('endpoint.list'), method: 'GET', desc: t('endpoint.listDesc') },
      { value: 'get', label: t('endpoint.detail'), method: 'GET', desc: t('endpoint.detailDesc') },
      { value: 'create', label: t('endpoint.create'), method: 'POST', desc: t('endpoint.createDesc') },
      { value: 'update', label: t('endpoint.update'), method: 'PUT', desc: t('endpoint.updateDesc') },
      { value: 'delete', label: t('endpoint.delete'), method: 'DELETE', desc: t('endpoint.deleteDesc') },
      { value: 'custom', label: t('endpoint.custom'), method: '', desc: t('endpoint.customDesc') },
    ],
    [t],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.name.trim() || !draft.path.trim()) {
      setError(t('endpoint.completeFields'))
      return
    }
    onAdd(draft)
    setDraft(emptyEndpoint(draft.targetDatasetId))
    setError(null)
    clearWarning()
  }

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editDraft) return
    if (!editDraft.name.trim() || !editDraft.path.trim()) {
      setError(t('endpoint.namePathRequired'))
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
    const ds = project.datasets.find(d => d.id === draft.targetDatasetId) || project.datasets[0]
    const datasetName = ds?.name || 'items'
    const updates = getOperationUpdates(opType, datasetName)
    setDraft(prev => ({ ...prev, ...updates, operationType: opType }))
  }

  const handleEditOperationChange = (opType: ApiEndpoint['operationType']) => {
    if (!editDraft) return
    const ds = project.datasets.find(d => d.id === editDraft.targetDatasetId) || project.datasets[0]
    const datasetName = ds?.name || 'items'
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

  const previewPath = endpoints[0]?.path ?? '/records'
  const resolvedBase = useMemo(() => {
    if (config.baseUrl?.trim()) return config.baseUrl.replace(/\/$/, '')
    if (previewBase) return previewBase.replace(/\/$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return 'http://localhost:8000'
  }, [config.baseUrl, previewBase])
  const previewProjectId = project.slug || project.remoteId || project.id
  const previewUrl = useMemo(() => `${resolvedBase}/api/mock/${previewProjectId}${previewPath}`, [resolvedBase, previewPath, previewProjectId])

  const selectedDs = project.datasets.find(d => d.id === draft.targetDatasetId)
  const selectedDsName = selectedDs?.name || 'items'
  const cleanOperationLabel = (label: string) => label.replace(/^.*·\s*/, '')

  return (
    <div className="endpoint-designer">
      {/* Preview URL */}
      <div className="endpoint-summary endpoint-summary--compact" style={{ padding: '0.5rem', background: 'transparent', border: 'none' }}>
        {project.remoteId ? (
          <a className="endpoint-preview__link" href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
            <span className="icon"></span> {previewUrl}
          </a>
        ) : (
          <p className="muted-text" style={{ fontSize: '0.8rem', margin: 0 }}>{t('builder.saveFirst')}</p>
        )}
      </div>

      {error ? <p className="error-text" style={{ margin: '0.5rem 0' }}>{error}</p> : null}

      {/* ─── Nuevo Endpoint ─── */}
      <form onSubmit={handleSubmit} className="endpoint-blueprint">
        <p className="endpoint-blueprint__title">{t('endpoint.newTitle')}</p>
        <p className="endpoint-blueprint__desc">
          {t('endpoint.newDesc')}
        </p>

        {/* Fields */}
        <div className="endpoint-blueprint__fields">
          <div className="endpoint-blueprint__field">
            <label>{t('endpoint.operationType')}</label>
            <select
              value={draft.operationType}
              onChange={(e) => handleOperationChange(e.target.value as ApiEndpoint['operationType'])}
            >
              {OPERATION_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>{cleanOperationLabel(op.label)}</option>
              ))}
            </select>
            <span className="endpoint-blueprint__hint">{OPERATION_OPTIONS.find(o => o.value === draft.operationType)?.desc}</span>
          </div>
          <div className="endpoint-blueprint__field">
            <label>{t('endpoint.dataset')}</label>
            <select
              value={draft.targetDatasetId}
              onChange={(e) => {
                const newDsId = e.target.value
                setDraft({ ...draft, targetDatasetId: newDsId })
                const ds = project.datasets.find(d => d.id === newDsId)
                if (ds && draft.operationType !== 'custom') {
                  const updates = getOperationUpdates(draft.operationType, ds.name)
                  setDraft(prev => ({ ...prev, ...updates, targetDatasetId: newDsId }))
                }
              }}
            >
              {project.datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </select>
          </div>

          {draft.operationType === 'custom' && (
            <div className="endpoint-blueprint__field">
              <label>{t('endpoint.method')}</label>
              <select
                value={draft.method}
                onChange={(e) => setDraft({ ...draft, method: e.target.value as ApiEndpoint['method'] })}
              >
                {METHOD_OPTIONS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          )}

          <div className="endpoint-blueprint__field">
            <label>{t('endpoint.path')}</label>
            <input
              value={draft.path}
              onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              placeholder={`/${selectedDsName.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </div>

          <div className="endpoint-blueprint__field">
            <label>{t('endpoint.name')}</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t('endpoint.namePlaceholder')}
            />
          </div>
        </div>

        <div className="endpoint-blueprint__field endpoint-blueprint__field--wide">
          <label>{t('endpoint.description')}</label>
          <input
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            placeholder={t('endpoint.descPlaceholder')}
          />
        </div>

        <div className="endpoint-blueprint__actions">
          <button type="submit" className="btn primary">
            {t('endpoint.add')}
          </button>
        </div>
      </form>

      {/* ─── Lista de endpoints ─── */}
      <div className="endpoint-list" style={{ marginTop: '1.5rem' }}>
        <p className="endpoint-list__title">
          {t('endpoint.defined', { count: endpoints.length })}
        </p>
        {endpoints.length === 0 ? (
          <p className="endpoint-empty">
            {t('endpoint.noEndpoints')}
          </p>
        ) : (
          endpoints.map((endpoint) => (
            <div key={endpoint.id} className={clsx('endpoint-item', editingId === endpoint.id && 'endpoint-item--editing')}>
              {editingId === endpoint.id && editDraft ? (
                <form onSubmit={handleEditSubmit} className="endpoint-edit-form">
                  <div className="endpoint-blueprint__fields">
                    <div className="endpoint-blueprint__field">
                      <label>Tipo</label>
                      <select value={editDraft.operationType} onChange={(e) => handleEditOperationChange(e.target.value as ApiEndpoint['operationType'])}>
                        {OPERATION_OPTIONS.map((op) => (
                          <option key={op.value} value={op.value}>{cleanOperationLabel(op.label)}</option>
                        ))}
                      </select>
                    </div>
                    {editDraft.operationType === 'custom' && (
                      <div className="endpoint-blueprint__field">
                        <label>{t('endpoint.method')}</label>
                        <select value={editDraft.method} onChange={(e) => setEditDraft({ ...editDraft, method: e.target.value as ApiEndpoint['method'] })}>
                          {METHOD_OPTIONS.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      </div>
                    )}
                    <div className="endpoint-blueprint__field">
                      <label>{t('endpoint.path')}</label>
                      <input value={editDraft.path} onChange={(e) => setEditDraft({ ...editDraft, path: e.target.value })} />
                    </div>
                    <div className="endpoint-blueprint__field">
                      <label>{t('endpoint.name')}</label>
                      <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    </div>
                  </div>
                  <div className="endpoint-blueprint__field endpoint-blueprint__field--wide">
                    <label>{t('endpoint.description')}</label>
                    <input value={editDraft.summary} onChange={(e) => setEditDraft({ ...editDraft, summary: e.target.value })} placeholder={t('endpoint.optional')} />
                  </div>
                  <div className="endpoint-blueprint__actions" style={{ marginTop: '0.5rem' }}>
                    <button type="submit" className="btn primary btn-small">{t('endpoint.save')}</button>
                    <button type="button" className="btn subtle btn-small" onClick={cancelEdit}>{t('endpoint.cancel')}</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="endpoint-item__header">
                    <span className="endpoint-item__method" style={{ backgroundColor: `${METHOD_COLORS[endpoint.method]}1a`, color: METHOD_COLORS[endpoint.method] }}>
                      {endpoint.method}
                    </span>
                    <code className="endpoint-item__route">{endpoint.path}</code>
                    {endpoint.operationType && endpoint.operationType !== 'custom' && (
                      <span className="endpoint-item__type-badge">{endpoint.operationType}</span>
                    )}
                    <span className="endpoint-item__dataset">
                      {project.datasets.find(d => d.id === endpoint.targetDatasetId)?.name || t('endpoint.noDataset')}
                    </span>
                  </div>
                  <div className="endpoint-item__body">
                    <p className="endpoint-item__title">{endpoint.name}</p>
                    {endpoint.summary ? <p className="endpoint-item__summary">{endpoint.summary}</p> : null}
                  </div>
                  <div className="endpoint-item__actions">
                    <button type="button" className="endpoint-item__edit" onClick={() => handleEdit(endpoint)}>{t('endpoint.edit')}</button>
                    <button type="button" className="endpoint-item__remove" onClick={() => onRemove(endpoint.id)} aria-label={t('endpoint.delete')}>&times;</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {warningMessage ? <p className="error-text" style={{ marginTop: '0.5rem' }}>{warningMessage}</p> : null}

      <style>{`
        .endpoint-blueprint {
          border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem;
          background: #fafbfc; margin-top: 0.75rem;
        }
        .endpoint-blueprint__title {
          margin: 0 0 0.25rem; font-weight: 600; font-size: 1rem; color: #1e293b;
        }
        .endpoint-blueprint__desc {
          margin: 0 0 1rem; font-size: 0.8rem; color: #64748b;
        }
        .endpoint-blueprint__hint {
          font-size: 0.75rem; color: #64748b; margin: 0.1rem 0 0; padding-left: 0.15rem;
        }
        .endpoint-blueprint__fields {
          display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;
        }
        .endpoint-blueprint__field { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 140px; }
        .endpoint-blueprint__field--wide { min-width: 100%; }
        .endpoint-blueprint__field label {
          font-size: 0.75rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.03em;
        }
        .endpoint-blueprint__field input, .endpoint-blueprint__field select {
          padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
          font-size: 0.85rem; background: #fff; outline: none;
        }
        .endpoint-blueprint__field input:focus, .endpoint-blueprint__field select:focus {
          border-color: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe;
        }
        .endpoint-blueprint__actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .endpoint-list__title {
          margin: 0 0 0.75rem; font-weight: 600; font-size: 0.95rem; color: #1e293b;
        }

        .endpoint-item__dataset {
          margin-left: auto; font-size: 0.7rem; color: #94a3b8;
          background: #f1f5f9; padding: 0.15rem 0.45rem; border-radius: 4px;
        }
        .endpoint-item__type-badge {
          font-size: 0.65rem; background: #e0e7ff; color: #4338ca;
          padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600;
          text-transform: uppercase; margin-left: 0.35rem;
        }
        .endpoint-edit-form {
          border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.75rem;
          background: #f8faff;
        }
        .endpoint-empty {
          text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.85rem;
        }

        [data-theme="dark"] .endpoint-blueprint {
          background: var(--bg-tertiary); border-color: var(--border-color);
        }
        [data-theme="dark"] .endpoint-blueprint__title,
        [data-theme="dark"] .endpoint-list__title {
          color: var(--text-primary);
        }
        [data-theme="dark"] .endpoint-blueprint__desc,
        [data-theme="dark"] .endpoint-blueprint__hint,
        [data-theme="dark"] .endpoint-empty {
          color: var(--text-muted);
        }
        [data-theme="dark"] .endpoint-blueprint__field label {
          color: var(--text-secondary);
        }
        [data-theme="dark"] .endpoint-blueprint__field input,
        [data-theme="dark"] .endpoint-blueprint__field select {
          background: var(--bg-secondary); border-color: var(--border-color); color: var(--text-primary);
        }
        [data-theme="dark"] .endpoint-blueprint__field input:focus,
        [data-theme="dark"] .endpoint-blueprint__field select:focus {
          border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        [data-theme="dark"] .endpoint-item__dataset {
          background: var(--bg-tertiary); color: var(--text-secondary);
        }
        [data-theme="dark"] .endpoint-item__type-badge {
          background: rgba(99, 102, 241, 0.18); color: #c7d2fe; border-color: rgba(129, 140, 248, 0.35);
        }
        [data-theme="dark"] .endpoint-edit-form {
          background: var(--bg-tertiary); border-color: var(--accent-blue);
        }
      `}</style>
    </div>
  )
}
