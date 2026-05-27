import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { createGenerationJob, fetchMappings, getGenerationJob, createMapping, deleteMapping } from '../lib/api'
import type { GenerationJob } from '../lib/api'

export function BuilderPage() {
  const { t } = useTranslation()
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
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'datasets' | 'endpoints' | 'mappings' | 'connections' | 'result' | 'webhooks' | 'versions'>('datasets')
  const [isImportingDB, setIsImportingDB] = useState(false)
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null)
  const [mappings, setMappings] = useState<MappingRule[]>([])
  const localBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
  const backendBaseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const tabs = useMemo(
    () => [
      { id: 'datasets', label: t('builder.datasets') },
      { id: 'endpoints', label: t('builder.endpoints') },
      { id: 'mappings', label: t('builder.mappings') },
      { id: 'connections', label: t('builder.dataSources') },
      { id: 'webhooks', label: t('builder.webhooks') },
      { id: 'versions', label: t('builder.versions') },
      { id: 'result', label: t('builder.generatedApi') },
    ],
    [t],
  )

  const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`)

  const waitForGenerationJob = async (projectId: string, jobId: string) => {
    let lastJob = await getGenerationJob(projectId, jobId)
    setGenerationJob(lastJob)

    for (let attempt = 0; attempt < 60 && ['pending', 'running'].includes(lastJob.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      lastJob = await getGenerationJob(projectId, jobId)
      setGenerationJob(lastJob)
    }

    return lastJob
  }

  const handleGenerate = async () => {
    if (project.endpoints.length === 0) {
      setGenerationWarning(t('builder.addEndpointFirst'))
      setActiveTab('endpoints')
      return
    }
    setIsGenerating(true)
    setGenerationJob(null)
    try {
      const endpoints = project.endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: normalizePath(endpoint.path),
        description: endpoint.summary || endpoint.name,
      }))

      const effectiveProjectId = await saveProject()
      if (!effectiveProjectId) {
        toast(t('app.saveError'), 'error')
        return
      }

      const createdJob = await createGenerationJob(effectiveProjectId, {
        include_mock_server: true,
        include_sdk: project.includeSdk !== false,
        include_data: project.includeData !== false,
      })
      setGenerationJob(createdJob)
      setActiveTab('result')

      const completedJob = await waitForGenerationJob(effectiveProjectId, createdJob.id)
      if (completedJob.status !== 'success') {
        toast(`Error al generar bundle: ${completedJob.error || 'Job failed'}`, 'error')
        return
      }

      const generationResult: GenerationResult = {
        message: t('builder.bundleSuccess'),
        retentionNotice: t('builder.bundleSuccessHint'),
        apiUrl: `${localBaseUrl}/api/mock/${effectiveProjectId}${endpoints[0]?.path ?? '/records'}`,
        docsUrl: `${backendBaseUrl}/projects/${effectiveProjectId}/docs`,
        endpoints,
        shareUrl: `${window.location.origin}/share/${effectiveProjectId}/${slugify(project.name)}`,
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
      document.title = `${project.name} | DoApi Studio`
    } else {
      document.title = 'DoApi Studio'
    }
  }, [project.name])

  // AUTO-SAVE is handled by useProjectBuilder's internal 1s debounce queue.
  // Auto-save is triggered per-field via updateProject/upsertDataset/upsertEndpoint.

  useEffect(() => {
    const pid = project.slug || project.remoteId
    if (!pid) return
    fetchMappings(pid).then(setMappings).catch(() => {})
  }, [project.slug, project.remoteId])

  const handleAddMapping = useCallback(async (sourceFieldId: string, targetFieldId: string) => {
    const pid = project.slug || project.remoteId
    if (!pid) {
      toast(t('builder.saveFirst'), 'error')
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
  }, [project.slug, project.remoteId, project.datasets, toast, t])

  const handleImportTable = useCallback((tableName: string, columns: any[]) => {
    const dsId = crypto.randomUUID()
    const inferType = (dbType: string): FieldType => {
      const dt = dbType.toLowerCase()
      if (dt.includes('int')) return 'integer'
      if (dt.includes('float') || dt.includes('double') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('real')) return 'float'
      if (dt.includes('bool')) return 'boolean'
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
      return {
        ...prev,
        endpoints: updatedEndpoints,
        apiUrl: `${localBaseUrl}/api/mock/${project.id}${updatedEndpoints[0]?.path ?? '/records'}`,
        docsUrl: `${backendBaseUrl}/projects/${project.id}/docs`,
        projectName: project.name,
      }
    })
  }, [project.endpoints, project.name, project.id, localBaseUrl])

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
                  {t('builder.backToDatasets')}
                </button>
                <span className="dataset-breadcrumb__sep">&gt;</span>
                <span className="dataset-breadcrumb__current">{t('builder.importFromDb')}</span>
              </div>
              <SectionCard title={t('builder.importDbTitle')} subtitle={t('builder.importDbSubtitle')} accent="sky" fullWidth>
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
                  {t('builder.backToDatasets')}
                </button>
                <span className="dataset-breadcrumb__sep">&gt;</span>
                <span className="dataset-breadcrumb__current">{t('builder.editingDataset', { name: currentDataset.name })}</span>
              </div>
              <SectionCard title={currentDataset.name} subtitle={t('builder.editSchema')} accent="sky" fullWidth>
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
                  name: t('builder.newDatasetTable', { n: project.datasets.length + 1 }),
                  sourceType: 'manual',
                  fields: [{ id: crypto.randomUUID(), name: 'id', type: 'integer', required: true, isPrimaryKey: true }],
                  sampleRows: []
                })
                setEditingDatasetId(newId)
              }}>
                {t('builder.newDataset')}
              </button>
              <button type="button" className="btn ghost" onClick={() => setIsImportingDB(true)}>
                {t('builder.importFromDb')}
              </button>
            </div>

            <SectionCard title={t('builder.dataModel')} subtitle={t('builder.dataModelDesc', { count: project.datasets.length })} accent="emerald" fullWidth>
              <SchemaDiagram
                datasets={project.datasets}
                onDatasetClick={(id) => { setSelectedDatasetId(id); setEditingDatasetId(id); setIsImportingDB(false); }}
                onDeleteDataset={(id) => {
                  if (confirm(t('builder.deleteDatasetConfirm'))) {
                    removeDataset(id)
                    if (selectedDatasetId === id) setSelectedDatasetId(project.datasets.filter(d => d.id !== id)[0]?.id || null)
                  }
                }}
                activeDatasetId={selectedDatasetId}
              />
            </SectionCard>

            {project.datasets.length === 0 && (
              <SectionCard title={t('builder.datasets')} subtitle={t('builder.createFirstDataset')} accent="sky" fullWidth>
                <div className="empty-state">
                  <p className="muted-text">{t('builder.noDatasetsHint')}</p>
                </div>
              </SectionCard>
            )}

          </div>
        )
      case 'endpoints':
        return (
          <SectionCard title={t('builder.restEndpoints')} subtitle={t('builder.crudBase')} fullWidth>
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
                <p className="muted-text">{t('builder.needsTwoDatasets')}</p>
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
          <SectionCard title={t('builder.dataSources')} subtitle={t('builder.externalSourcesDesc')} accent="sky" fullWidth>
            <ConnectionManager
              projectId={project.slug || project.remoteId || project.id}
              onImportTable={handleImportTable}
            />
          </SectionCard>
        )
      case 'webhooks':
        return (
          <SectionCard title={t('builder.webhooks')} subtitle={t('builder.webhooksDesc')} accent="sky" fullWidth>
            <WebhookPanel projectId={project.slug || project.remoteId || project.id} />
          </SectionCard>
        )
      case 'versions':
        return (
          <SectionCard title={t('builder.versions')} subtitle={t('builder.versionsDesc')} accent="sky" fullWidth>
            <VersionPanel projectId={project.slug || project.remoteId || project.id} />
          </SectionCard>
        )
      case 'result':
        return (
          <SectionCard title={t('builder.title')} subtitle={effectiveResult ? t('builder.bundleContains') : t('builder.generateHint')} accent="emerald" fullWidth>
            <div className="generation-result-flow">
              <div className="gen-options">
                <p className="gen-options__title">{t('builder.generationOptions')}</p>
                <div className="gen-options__checks">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={project.includeData !== false} onChange={(e) => updateProject({ includeData: e.target.checked })} />
                    {t('builder.includeSeeds')}
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={project.includeSdk !== false} onChange={(e) => updateProject({ includeSdk: e.target.checked })} />
                    {t('builder.generateSdk')}
                  </label>
                </div>
              </div>

              {effectiveResult ? (
                <>
                  {generationJob && (
                    <p className="muted-text">
                      {t('generation.jobStatus')}: {t(`generation.jobStatus.${generationJob.status}`)}
                    </p>
                  )}
                  <GenerationResultPanel
                    result={effectiveResult}
                    projectId={project.slug || project.remoteId || project.id}
                  />

                  <div className="deployment-notice">
                    <p>{t('builder.bundleContains', { stack: project.targetStack.toUpperCase() })}</p>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p className="muted-text">
                    {generationJob
                      ? `${t('generation.jobStatus')}: ${t(`generation.jobStatus.${generationJob.status}`)}`
                      : t('builder.generateHint')}
                  </p>
                  <button type="button" className="btn ghost btn-small" onClick={handleGenerate} disabled={isGenerating || isSyncing}>
                    {isGenerating ? t('builder.processing') : t('builder.generateNow')}
                  </button>
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
              <h1 className="page-title">{project.name || t('builder.projectTitle')}</h1>
              {project.datasets.length > 0 && (
                <div className="dataset-badge">
                  {t('builder.activeDataset')}: <span className="dataset-badge__name">
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
            {t('builder.apiUpdated')}
          </div>
        )}
        <button type="button" className="fab" onClick={handleGenerate} disabled={isGenerating || isSyncing}>
          {isSyncing ? (
            <span className="fab__loading">{t('builder.syncing')}</span>
          ) : isGenerating ? (
            <span className="fab__loading">{t('builder.processing')}</span>
          ) : (
            <>
              <svg className="fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {project.remoteId ? t('builder.updateApi') : t('builder.saveAndLaunch')}
            </>
          )}
        </button>
      </div>
    </>
  )
}
