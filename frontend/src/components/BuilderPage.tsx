import { useCallback, useEffect, useMemo, useState } from 'react'

import { DatabaseImportPanel } from './DatabaseImportPanel'
import { DataMappingPanel } from './DataMappingPanel'
import { EndpointDesigner } from './EndpointDesigner'
import { GenerationResultPanel } from './GenerationResultPanel'
import { DatasetEditor } from './DatasetEditor'
import { SchemaDiagram } from './SchemaDiagram'
import { ProjectForm } from './ProjectForm'
import { SectionCard } from './SectionCard'
import { WebhookPanel } from './WebhookPanel'
import { VersionPanel } from './VersionPanel'
import { ConnectionManager } from './ConnectionManager'

import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { useToast } from './Toast'
import type { FieldType, GenerationResult, MappingRule } from '../types/schemas'
import { slugify } from '../lib/slug'
import { readBackendConfig } from '../lib/backendConfig'
import { fetchMappings, createMapping, deleteMapping } from '../lib/api'

export function BuilderPage() {
  const toast = useToast()
  const {
    project,
    updateProject,
    upsertDataset,
    upsertEndpoint,
    removeEndpoint,
    setGenerationResult,
    removeDataset,
    saveProject,
    isSyncing,
    isGenerating,
    setIsGenerating,
    selectedDatasetId,
    setSelectedDatasetId,
  } = useProjectBuilder()

  const [result, setResult] = useState<GenerationResult | null>(null)
  const [generationWarning, setGenerationWarning] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'datasets' | 'endpoints' | 'mappings' | 'connections' | 'result' | 'webhooks' | 'versions'>('datasets')
  const [isImportingDB, setIsImportingDB] = useState(false)
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null)
  const [mappings, setMappings] = useState<MappingRule[]>([])
  const localBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
  const backendBaseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const tabs = useMemo(
    () => [
      { id: 'datasets', label: 'Datasets' },
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'mappings', label: 'Mappings' },
      { id: 'connections', label: 'Fuentes de Datos' },
      { id: 'webhooks', label: 'Webhooks' },
      { id: 'versions', label: 'Versiones' },
      { id: 'result', label: 'API generada' },
    ],
    [],
  )

  const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

  const handleGenerate = async () => {
    if (project.endpoints.length === 0) {
      setGenerationWarning('Añade al menos un endpoint antes de generar la API')
      setActiveTab('endpoints')
      return
    }
    setIsGenerating(true)
    try {
      const endpoints = project.endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: normalizePath(endpoint.path),
        description: endpoint.summary || endpoint.name,
      }))

      const effectiveProjectId = await saveProject()
      if (!effectiveProjectId) {
        toast('Error al guardar el proyecto. Asegúrate de estar autenticado.', 'error')
        return
      }

      const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
      const gr = await fetch(`${backendBaseUrl}/projects/${effectiveProjectId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          include_mock_server: true,
          include_sdk: project.includeSdk !== false,
          include_data: project.includeData !== false
        }),
      })

      if (!gr.ok) {
        toast(`Error al generar bundle: ${await gr.text()}`, 'error')
        return
      }

      const shareId = crypto.randomUUID().slice(0, 6)
      const generationResult: GenerationResult = {
        message: 'API generada con éxito',
        retentionNotice: 'Pulsa "Descargar bundle (.zip)" en la API generada para obtener el código.',
        apiUrl: `${localBaseUrl}/api/mock/${effectiveProjectId}${endpoints[0]?.path ?? '/records'}`,
        docsUrl: `${backendBaseUrl}/projects/${effectiveProjectId}/docs`,
        endpoints,
        shareUrl: `${window.location.origin}/share/${shareId}/${slugify(project.name)}`,
        projectName: project.name,
        stack: project.targetStack,
      }
      setGenerationResult({ lastGeneration: generationResult, sharePath: generationResult.shareUrl })
      setResult(generationResult)

      if (!project.remoteId) {
        setActiveTab('result')
      } else {
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
      }
    } catch (err) {
      toast(`Error: ${err instanceof Error ? err.message : 'desconocido'}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    setResult(project.lastGeneration ?? null)
    setGenerationWarning(null)
  }, [project.lastGeneration])

  useEffect(() => {
    if (project.name) {
      document.title = `${project.name} | API Maker Studio`
    } else {
      document.title = 'API Maker Studio'
    }
  }, [project.name])

  // AUTO-SAVE: Automatically sync project with backend on changes (debounced)
  useEffect(() => {
    // We only auto-save if the project is already synced (has remoteId)
    // to avoid creating multiple draft projects.
    if (!project.remoteId) return

    const timer = setTimeout(() => {
      saveProject()
    }, 3000)

    return () => clearTimeout(timer)
  }, [project.datasets, project.endpoints, project.name, project.description, project.authMethod])

  useEffect(() => {
    const pid = project.slug || project.remoteId
    if (!pid) return
    fetchMappings(pid).then(setMappings).catch(() => {})
  }, [project.slug, project.remoteId])

  const handleAddMapping = useCallback(async (sourceFieldId: string, targetFieldId: string) => {
    const pid = project.slug || project.remoteId
    if (!pid) {
      toast('Guarda el proyecto primero antes de crear mappings', 'error')
      return
    }
    const sourceDatasetId = project.datasets.find(d => d.fields.some(f => f.id === sourceFieldId))?.id
    const targetDatasetId = project.datasets.find(d => d.fields.some(f => f.id === targetFieldId))?.id
    if (!sourceDatasetId || !targetDatasetId) return
    try {
      const created = await createMapping(pid, {
        source_dataset_id: sourceDatasetId,
        source_field_id: sourceFieldId,
        target_dataset_id: targetDatasetId,
        target_field_id: targetFieldId,
      })
      setMappings(prev => [...prev, created])
    } catch (err) {
      toast(`Error al crear mapping: ${err instanceof Error ? err.message : 'desconocido'}`, 'error')
    }
  }, [project.slug, project.remoteId, project.datasets, toast])

  const handleImportTable = useCallback((tableName: string, columns: any[]) => {
    const dsId = crypto.randomUUID()
    const inferType = (dbType: string): FieldType => {
      const t = dbType.toLowerCase()
      if (t.includes('int')) return 'integer'
      if (t.includes('float') || t.includes('double') || t.includes('numeric') || t.includes('decimal') || t.includes('real')) return 'float'
      if (t.includes('bool')) return 'boolean'
      return 'string'
    }
    const fields = columns.map((col: any) => ({
      id: crypto.randomUUID(),
      name: col.name,
      type: inferType(col.type),
      required: !col.nullable,
      isPrimaryKey: col.is_primary_key,
    }))
    upsertDataset({
      id: dsId,
      name: tableName,
      sourceType: 'database',
      fields,
      sampleRows: [],
    })
    const basePath = '/' + tableName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    upsertEndpoint({ id: crypto.randomUUID(), name: 'Listar ' + tableName, method: 'GET', path: basePath, summary: 'Listar registros de ' + tableName, operationType: 'list', targetDatasetId: dsId })
    upsertEndpoint({ id: crypto.randomUUID(), name: 'Obtener ' + tableName, method: 'GET', path: basePath + '/{id}', summary: 'Obtener un registro de ' + tableName, operationType: 'get', targetDatasetId: dsId })
    upsertEndpoint({ id: crypto.randomUUID(), name: 'Crear ' + tableName, method: 'POST', path: basePath, summary: 'Crear registro en ' + tableName, operationType: 'create', targetDatasetId: dsId })
    upsertEndpoint({ id: crypto.randomUUID(), name: 'Actualizar ' + tableName, method: 'PUT', path: basePath + '/{id}', summary: 'Actualizar registro de ' + tableName, operationType: 'update', targetDatasetId: dsId })
    upsertEndpoint({ id: crypto.randomUUID(), name: 'Eliminar ' + tableName, method: 'DELETE', path: basePath + '/{id}', summary: 'Eliminar registro de ' + tableName, operationType: 'delete', targetDatasetId: dsId })
    setEditingDatasetId(dsId)
  }, [upsertDataset, upsertEndpoint])

  const handleRemoveMapping = useCallback(async (mappingId: string) => {
    const pid = project.slug || project.remoteId
    if (!pid) return
    try {
      await deleteMapping(pid, mappingId)
      setMappings(prev => prev.filter(m => m.id !== mappingId))
    } catch (err) {
      toast(`Error al eliminar mapping: ${err instanceof Error ? err.message : 'desconocido'}`, 'error')
    }
  }, [project.slug, project.remoteId, toast])

  useEffect(() => {
    if (!result || project.endpoints.length === 0) return
    const updatedEndpoints = project.endpoints.map((endpoint) => ({
      method: endpoint.method,
      path: normalizePath(endpoint.path),
      description: endpoint.summary || endpoint.name,
    }))
    setResult((prev) => {
      if (!prev) return prev
      const updated: GenerationResult = {
        ...prev,
        endpoints: updatedEndpoints,
        apiUrl: `${localBaseUrl}/api/mock/${project.id}${updatedEndpoints[0]?.path ?? '/records'}`,
        docsUrl: `${backendBaseUrl}/projects/${project.id}/docs`,
        projectName: project.name,
      }
      return updated
    })
  }, [project.endpoints, project.name, project.id, localBaseUrl, result, backendBaseUrl])

  const effectiveResult = result ?? project.lastGeneration ?? null

  const renderTabContent = () => {
    switch (activeTab) {
      case 'datasets':
        const currentDataset = project.datasets.find(d => d.id === (editingDatasetId || selectedDatasetId)) || project.datasets[0]

        if (isImportingDB) {
          return (
            <div className="datasets-tab-new">
              <div className="dataset-breadcrumb">
                <button type="button" className="dataset-breadcrumb__link" onClick={() => setIsImportingDB(false)}>
                  Volver atras a Datasets
                </button>
                <span className="dataset-breadcrumb__sep">&gt;</span>
                <span className="dataset-breadcrumb__current">Importar desde BD</span>
              </div>
              <SectionCard title="Importar desde Base de Datos" subtitle="Conecta e introspecciona tablas" accent="sky" fullWidth>
                <DatabaseImportPanel
                  onImport={(newDatasets) => {
                    newDatasets.forEach((ds) => {
                      upsertDataset(ds)
                      const basePath = '/' + ds.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                      upsertEndpoint({ id: crypto.randomUUID(), name: 'Listar ' + ds.name, method: 'GET', path: basePath, summary: 'Listar registros de ' + ds.name, operationType: 'list', targetDatasetId: ds.id })
                      upsertEndpoint({ id: crypto.randomUUID(), name: 'Obtener ' + ds.name, method: 'GET', path: basePath + '/{id}', summary: 'Obtener un registro de ' + ds.name, operationType: 'get', targetDatasetId: ds.id })
                      upsertEndpoint({ id: crypto.randomUUID(), name: 'Crear ' + ds.name, method: 'POST', path: basePath, summary: 'Crear registro en ' + ds.name, operationType: 'create', targetDatasetId: ds.id })
                      upsertEndpoint({ id: crypto.randomUUID(), name: 'Actualizar ' + ds.name, method: 'PUT', path: basePath + '/{id}', summary: 'Actualizar registro de ' + ds.name, operationType: 'update', targetDatasetId: ds.id })
                      upsertEndpoint({ id: crypto.randomUUID(), name: 'Eliminar ' + ds.name, method: 'DELETE', path: basePath + '/{id}', summary: 'Eliminar registro de ' + ds.name, operationType: 'delete', targetDatasetId: ds.id })
                    })
                    if (newDatasets.length > 0) { setSelectedDatasetId(newDatasets[0].id); setEditingDatasetId(newDatasets[0].id); }
                    setIsImportingDB(false)
                  }}
                  onCancel={() => setIsImportingDB(false)}
                />
              </SectionCard>
            </div>
          )
        }

        if (editingDatasetId && currentDataset) {
          return (
            <div className="datasets-tab-new">
              <div className="dataset-breadcrumb">
                <button type="button" className="dataset-breadcrumb__link" onClick={() => { setEditingDatasetId(null); setIsImportingDB(false); }}>
                  Volver atras a Datasets
                </button>
                <span className="dataset-breadcrumb__sep">&gt;</span>
                <span className="dataset-breadcrumb__current">Edicion: {currentDataset.name}</span>
              </div>
              <SectionCard title={currentDataset.name} subtitle="Editar esquema y datos" accent="sky" fullWidth>
                <DatasetEditor
                  dataset={currentDataset}
                  onCommit={upsertDataset}
                  otherDatasets={project.datasets.filter(d => d.id !== currentDataset.id)}
                />
              </SectionCard>
            </div>
          )
        }

        return (
          <div className="datasets-tab-new">
            <div className="datasets-action-bar">
              <button type="button" className="btn primary" onClick={() => {
                const newId = crypto.randomUUID()
                upsertDataset({
                  id: newId,
                  name: `Tabla ${project.datasets.length + 1}`,
                  sourceType: 'manual',
                  fields: [{ id: crypto.randomUUID(), name: 'id', type: 'integer', required: true, isPrimaryKey: true }],
                  sampleRows: []
                })
                setEditingDatasetId(newId)
              }}>
                + Nuevo dataset
              </button>
              <button type="button" className="btn ghost" onClick={() => setIsImportingDB(true)}>
                Importar desde BD
              </button>
            </div>

            <SectionCard title="Modelo de Datos" subtitle={`${project.datasets.length} dataset(s) — Vista general del esquema`} accent="emerald" fullWidth>
              <SchemaDiagram
                datasets={project.datasets}
                onDatasetClick={(id) => { setSelectedDatasetId(id); setEditingDatasetId(id); setIsImportingDB(false); }}
                onDeleteDataset={(id) => {
                  if (confirm('Eliminar este dataset? Esta accion no se puede deshacer.')) {
                    removeDataset(id)
                    if (selectedDatasetId === id) setSelectedDatasetId(project.datasets.filter(d => d.id !== id)[0]?.id || null)
                  }
                }}
                activeDatasetId={selectedDatasetId}
              />
            </SectionCard>

            {project.datasets.length === 0 && (
              <SectionCard title="Datasets" subtitle="Crea tu primer dataset" accent="sky" fullWidth>
                <div className="empty-state">
                  <p className="muted-text">Aun no hay datasets. Usa "+ Nuevo dataset" para empezar.</p>
                </div>
              </SectionCard>
            )}

          </div>
        )
      case 'endpoints':
        return (
          <SectionCard title="Endpoints REST" subtitle="CRUD base + rutas personalizadas" fullWidth>
            <EndpointDesigner
              project={project}
              endpoints={project.endpoints.filter((ep) => !selectedDatasetId || !ep.targetDatasetId || ep.targetDatasetId === selectedDatasetId)}
              onAdd={upsertEndpoint}
              onRemove={removeEndpoint}
              previewBase={localBaseUrl}
              warningMessage={generationWarning}
              clearWarning={() => setGenerationWarning(null)}
            />
          </SectionCard>
        )
      case 'mappings':
        return (
          <SectionCard title="" accent="sky" fullWidth>
            {project.datasets.length < 2 ? (
              <div className="empty-state">
                <p className="muted-text">Necesitas al menos 2 datasets para crear un mapeo de datos.</p>
              </div>
            ) : (
              <DataMappingPanel
                datasets={project.datasets}
                mappings={mappings}
                onAddMapping={handleAddMapping}
                onRemoveMapping={handleRemoveMapping}
              />
            )}
          </SectionCard>
        )
      case 'connections':
        return (
          <SectionCard title="Fuentes de Datos" subtitle="Conecta bases de datos externas e importa sus esquemas" accent="sky" fullWidth>
            <ConnectionManager
              projectId={project.slug || project.remoteId || project.id}
              onImportTable={handleImportTable}
            />
          </SectionCard>
        )
      case 'webhooks':
        return (
          <SectionCard title="Webhooks" subtitle="Notifica a URLs externas cuando cambian los datos en el mock server" accent="sky" fullWidth>
            <WebhookPanel projectId={project.slug || project.remoteId || project.id} />
          </SectionCard>
        )
      case 'versions':
        return (
          <SectionCard title="Versiones" subtitle="Historial de cambios del proyecto" accent="sky" fullWidth>
            <VersionPanel projectId={project.slug || project.remoteId || project.id} />
          </SectionCard>
        )
      case 'result':
        return (
          <SectionCard title="Proyecto Generado" subtitle={effectiveResult ? "Descarga el código fuente completo listo para producción" : "Configura las opciones y genera tu API"} accent="emerald" fullWidth>
            <div className="generation-result-flow">
              <div className="gen-options">
                <p className="gen-options__title">Opciones de generación</p>
                <div className="gen-options__checks">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={project.includeData !== false} onChange={(e) => updateProject({ includeData: e.target.checked })} />
                    Incluir datos de ejemplo (seeds)
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={project.includeSdk !== false} onChange={(e) => updateProject({ includeSdk: e.target.checked })} />
                    Generar SDK (TypeScript + Python)
                  </label>
                </div>
              </div>

              {effectiveResult ? (
                <>
                  <GenerationResultPanel
                    result={effectiveResult}
                    projectId={project.slug || project.remoteId || project.id}
                  />

                  <div className="deployment-notice">
                    <p>Este bundle contiene la arquitectura completa (modelos, controladores, seguridad y Docker) para el stack <strong>{project.targetStack.toUpperCase()}</strong>.</p>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p className="muted-text">Genera la API en la vista principal para ver los detalles.</p>
                  <button type="button" className="btn ghost btn-small" onClick={handleGenerate}>Generar ahora</button>
                </div>
              )}
            </div>
          </SectionCard>
        )
      default:
        return null
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__main">
          <div className="app-header__hero">
            <div className="app-header__hero-top">
              <h1 className="page-title">{project.name || 'Nuevo Proyecto'}</h1>
              {project.datasets.length > 0 && (
                <div className="dataset-badge">
                  Dataset activo: <span className="dataset-badge__name">
                    {project.datasets.find(d => d.id === selectedDatasetId)?.name || project.datasets[0]?.name}
                  </span>
                </div>
              )}
            </div>
            <ProjectForm project={project} onChange={updateProject} />
          </div>
        </div>
      </header>

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTab ? 'tab-button active' : 'tab-button'}
            onClick={() => {
              setActiveTab(tab.id as typeof activeTab)
              if (tab.id === 'endpoints') setSelectedDatasetId(null)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">{renderTabContent()}</div>

      <div className="fab-container">
        {showSuccess && (
          <div className="fab-success-msg">
            ¡API actualizada con éxito!
          </div>
        )}
        <button type="button" className="fab" onClick={handleGenerate} disabled={isGenerating || isSyncing}>
          {isSyncing ? (
            <span className="fab__loading">Sincronizando...</span>
          ) : isGenerating ? (
            <span className="fab__loading">Procesando...</span>
          ) : (
            <>
              <svg className="fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {project.remoteId ? 'Actualizar API' : 'Guardar y lanzar API'}
            </>
          )}
        </button>
      </div>
    </>
  )
}
