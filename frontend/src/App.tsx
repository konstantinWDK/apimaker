import { useEffect, useMemo, useState } from 'react'

import { ApiPlayground } from './components/ApiPlayground'
import { ApiUsagePanel } from './components/ApiUsagePanel'
import { BackendSyncCard } from './components/BackendSyncCard'
import { DatabaseImportPanel } from './components/DatabaseImportPanel'
import { EndpointDesigner } from './components/EndpointDesigner'
import { EndpointGallery } from './components/EndpointGallery'
import { GenerationResultPanel } from './components/GenerationResultPanel'
import { DatasetEditor } from './components/DatasetEditor'
import { SchemaDiagram } from './components/SchemaDiagram'
import { LoginScreen } from './components/LoginScreen'
import { PayloadPreview } from './components/PayloadPreview'
import { ProjectForm } from './components/ProjectForm'
import { ProjectSidebar } from './components/ProjectSidebar'
import { SectionCard } from './components/SectionCard'
import { SecurityConfigPanel } from './components/SecurityConfigPanel'
import { ShareView } from './components/ShareView'
import { UserCard } from './components/UserCard'
import { ConfigPanel } from './components/ConfigPanel'
import { WebhookPanel } from './components/WebhookPanel'
import { VersionPanel } from './components/VersionPanel'
import { useProjectBuilder } from './hooks/useProjectBuilder'
import { useAuth } from './hooks/useAuth'
import { useToast } from './components/Toast'
import type { GenerationResult, ProjectDraft } from './types/schemas'
import { slugify } from './lib/slug'
import { readBackendConfig } from './lib/backendConfig'

// Helpers from useAuth for credential panel
const readToken = () => typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
const apiFetch = async (path: string, init?: RequestInit) => {
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(`${readBackendConfig().baseUrl?.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Error al contactar el backend')
  }
  return response
}

export function App() {
  const isShareView = typeof window !== 'undefined' && window.location.pathname.startsWith('/share/')
  const { isAuthenticated, login, error: authError, logout, resetCredentials, authStatus } = useAuth()
  const toast = useToast()
  const {
    project,
    updateProject,
    upsertDataset,
    upsertEndpoint,
    removeEndpoint,
    replaceProject,
    setGenerationResult,
    startMock,
    stopMock,
    deleteProject,
    mockRunning,
    mockLoading,
    mockError,
    refreshProjects,
    projects,
    removeDataset,
    saveProject,
    isGenerating,
    setIsGenerating,
  } = useProjectBuilder()

  if (isShareView) {
    return <ShareView />
  }
  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} error={authError ?? undefined} />
  }
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [generationWarning, setGenerationWarning] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'datasets' | 'endpoints' | 'security' | 'simulator' | 'delivery' | 'result' | 'webhooks' | 'versions'>('datasets')
  const [isImportingDB, setIsImportingDB] = useState(false)
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<'builder' | 'info' | 'usage' | 'config'>('builder')
  const localBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
  const backendBaseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const { selectedDatasetId, setSelectedDatasetId } = useProjectBuilder()

  const performLogout = () => {
    logout()
    if (typeof window !== 'undefined') {
      window.location.replace('/')
    }
  }

  const tabs = useMemo(
    () => [
      { id: 'datasets', label: 'Datasets' },
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'security', label: 'Seguridad' },
      { id: 'simulator', label: 'Simulador' },
      { id: 'delivery', label: 'Cómo usarla' },
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

      // Sync with backend using the new centralized function
      const effectiveProjectId = await saveProject()
      if (!effectiveProjectId) {
        toast('Error al guardar el proyecto. Asegúrate de estar autenticado.', 'error')
        return
      }

      // Generate bundle
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

      // Build local result
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

  // Load projects from backend on mount
  useEffect(() => {
    refreshProjects()
  }, [])

  useEffect(() => {
    setResult(project.lastGeneration ?? null)
    setGenerationWarning(null)
  }, [project.lastGeneration])

  // Update browser title dynamically
  useEffect(() => {
    if (project.name) {
      document.title = `${project.name} | API Maker Studio`
    } else {
      document.title = 'API Maker Studio'
    }
  }, [project.name])

  // Sync result endpoints when project endpoints change (keep "API generada" up to date)
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
  }, [project.endpoints, project.name, project.id, localBaseUrl])

  const effectiveResult = result ?? project.lastGeneration ?? null

  const renderTabContent = () => {
    switch (activeTab) {
      case 'datasets':
        const currentDataset = project.datasets.find(d => d.id === (editingDatasetId || selectedDatasetId)) || project.datasets[0]

        // Import mode
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

        // Editing mode: show breadcrumb + editor
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

        // Overview mode: diagram + actions
        return (
          <div className="datasets-tab-new">
            {/* Action bar at top */}
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

            {/* Schema diagram overview */}
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

            {/* Empty state when no datasets */}
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
      case 'security':
        return (
          <SectionCard title="Configuración de Seguridad" subtitle="Protege tus endpoints y limita el tráfico" accent="amber" fullWidth>
            <SecurityConfigPanel project={project} onChange={updateProject} />
          </SectionCard>
        )
      case 'simulator':
        return (
          <SectionCard title="Simulador" subtitle="Haz llamadas contra tu sandbox local" accent="sky" fullWidth>
            <ApiPlayground
              project={project}
              mockRunning={mockRunning}
              onStartMock={startMock}
              mockLoading={mockLoading}
              mockError={mockError}
              selectedDatasetId={selectedDatasetId ?? undefined}
            />
          </SectionCard>
        )
      case 'delivery':
        return (
          <div className="tab-grid">
            <SectionCard title="Payload estimado" subtitle="Vista previa del JSON que expondrá tu API">
              <PayloadPreview project={project} />
            </SectionCard>
            <SectionCard title="Sincronización con backend" subtitle="Publica este proyecto en tu instalación">
              <BackendSyncCard
                project={project}
                onSynced={(remoteId) => updateProject({ remoteId })}
              />
            </SectionCard>
          </div>
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
              {/* Generation options - always visible */}
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
    <div className="shell">
      <div className="app-wrapper">
        <div className="sidebar-stack">
          <UserCard
            username={authStatus.username}
            mustChange={authStatus.mustChange}
            onOpenSettings={() => setActivePage('config')}
            onLogout={performLogout}
          />
          <ProjectSidebar
            project={project}
            projects={projects}
            onSave={handleGenerate}
            onCreate={() => {
              const id = crypto.randomUUID()
              const draft: ProjectDraft = {
                id,
                name: 'Nueva API',
                description: 'Diseña tu API declarando datos y endpoints',
                authMethod: 'none',
                targetStack: 'fastapi',
                endpoints: [
                  {
                    id: crypto.randomUUID(),
                    name: 'Listar registros',
                    method: 'GET',
                    path: '/records',
                    summary: 'Obtiene la lista de elementos del dataset'
                  }
                ],
                datasets: [{
                  id: crypto.randomUUID(),
                  name: 'Dataset principal',
                  sourceType: 'manual',
                  fields: [
                    { id: crypto.randomUUID(), name: 'nombre', type: 'string', required: true, description: 'Nombre del elemento' }
                  ],
                  sampleRows: [
                    { nombre: 'Ejemplo 1' }
                  ]
                }]
              }
              replaceProject(draft)
            }}
            mockRunning={mockRunning}
            mockLoading={mockLoading}
            mockError={mockError}
            onStartMock={startMock}
            onStopMock={stopMock}
            onSwitchProject={replaceProject}
            onSync={saveProject}
            onDelete={async (id: string) => {
              const p = projects.find(p => p.id === id)
              const name = p?.name || 'este proyecto'
              if (window.confirm(`¿Estás seguro de que quieres eliminar "${name}"? Esta acción no se puede deshacer.`)) {
                await deleteProject(id)
                toast(`Proyecto "${name}" eliminado`, 'info')
              }
            }}
          />
        </div>
        <div className="app-content">
          {authStatus.mustChange ? (
            <div className="security-banner">
              <span>Estás usando las credenciales por defecto. Cámbialas para evitar accesos no autorizados.</span>
              <button type="button" onClick={() => setActivePage('config')}>
                Cambiar ahora
              </button>
            </div>
          ) : null}
            <div className="top-nav">
              <div className="nav-buttons">
                <button
                  type="button"
                  className={activePage === 'builder' ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActivePage('builder')}
                >
                  Editor
                </button>
                <button
                  type="button"
                  className={activePage === 'usage' ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActivePage('usage')}
                >
                  Uso
                </button>
                <button
                  type="button"
                  className={activePage === 'info' ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActivePage('info')}
                >
                  Información
                </button>
                <button
                  type="button"
                  className={activePage === 'config' ? 'nav-button active' : 'nav-button'}
                  onClick={() => setActivePage('config')}
                >
                  Configuración
                </button>
              </div>
              <a className="github-button" href="https://github.com/" target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 .5a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58v-2.02c-3.34.72-4.05-1.61-4.05-1.61-.55-1.4-1.34-1.78-1.34-1.78-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.24 1.83 1.24 1.08 1.85 2.83 1.32 3.52 1 .11-.8.42-1.32.76-1.62-2.66-.3-5.46-1.34-5.46-5.96 0-1.32.47-2.4 1.24-3.24-.12-.3-.54-1.5.12-3.12 0 0 1-.32 3.3 1.23a11.4 11.4 0 016 0c2.31-1.55 3.3-1.23 3.3-1.23.66 1.62.24 2.82.12 3.12.77.84 1.24 1.92 1.24 3.24 0 4.64-2.8 5.66-5.47 5.96.42.36.81 1.06.81 2.14v3.17c0 .32.21.7.82.58A12 12 0 0012 .5z" />
                </svg>
                GitHub
              </a>
            </div>

          {activePage === 'builder' && (
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
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="tab-content">{renderTabContent()}</div>
            </>
          )}

          {activePage === 'usage' && <ApiUsagePanel />}

          {activePage === 'info' && (
            <div className="info-page">
              {/* Hero */}
              <div className="info-hero">
                <div className="info-hero__content">
                  <h1 className="info-hero__title">API Maker</h1>
                  <p className="info-hero__subtitle">
                    Constructor de APIs visual y open source. Define datasets, disena endpoints y genera codigo listo para produccion en FastAPI, Express o NestJS.
                  </p>
                  <div className="info-hero__stats">
                    <div className="info-hero__stat">
                      <span className="info-hero__stat-value">3</span>
                      <span className="info-hero__stat-label">Stacks</span>
                    </div>
                    <div className="info-hero__stat">
                      <span className="info-hero__stat-value">30+</span>
                      <span className="info-hero__stat-label">Endpoints API</span>
                    </div>
                    <div className="info-hero__stat">
                      <span className="info-hero__stat-value">3</span>
                      <span className="info-hero__stat-label">SDKs</span>
                    </div>
                    <div className="info-hero__stat">
                      <span className="info-hero__stat-value">6</span>
                      <span className="info-hero__stat-label">Templates</span>
                    </div>
                  </div>
                </div>
                <div className="info-hero__graphic">
                  <svg viewBox="0 0 200 160" className="info-hero__svg">
                    <rect x="10" y="20" width="180" height="40" rx="8" fill="#e0e7ff" />
                    <rect x="20" y="30" width="60" height="6" rx="3" fill="#6366f1" />
                    <rect x="20" y="42" width="100" height="4" rx="2" fill="#a5b4fc" />
                    <rect x="10" y="80" width="180" height="40" rx="8" fill="#dbeafe" />
                    <rect x="20" y="90" width="50" height="6" rx="3" fill="#3b82f6" />
                    <rect x="20" y="102" width="80" height="4" rx="2" fill="#93c5fd" />
                    <rect x="10" y="140" width="180" height="15" rx="8" fill="#f0fdf4" />
                    <circle cx="30" cy="148" r="4" fill="#22c55e" />
                    <text x="40" y="151" fontSize="8" fill="#166534">docker compose up -d</text>
                  </svg>
                </div>
              </div>

              {/* Features grid */}
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16"/></svg>
                  </div>
                  <h3 className="info-card__title">Datasets</h3>
                  <p className="info-card__desc">Define esquemas con tipos, relaciones y datos de ejemplo. Importa desde CSV o base de datos externa.</p>
                </div>
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                  <h3 className="info-card__title">Endpoints REST</h3>
                  <p className="info-card__desc">Crea rutas CRUD automaticas o personalizadas. Cada endpoint se vincula a un dataset.</p>
                </div>
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <h3 className="info-card__title">Generacion de codigo</h3>
                  <p className="info-card__desc">Codigo listo para produccion con modelos, seguridad, Docker y SDK en TypeScript y Python.</p>
                </div>
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M14.7 6.3a1 1 0 00 0 1.4l1.6 1.6a1 1 0 00 1.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                  </div>
                  <h3 className="info-card__title">Mock server</h3>
                  <p className="info-card__desc">Simula tu API en tiempo real con datos de prueba, filtros y autenticacion. Ideal para frontends.</p>
                </div>
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  </div>
                  <h3 className="info-card__title">Compartir</h3>
                  <p className="info-card__desc">Snapshots con proteccion por contrasena, expiracion y vistas. Comparte tu API sin dar acceso al builder.</p>
                </div>
                <div className="info-card">
                  <div className="info-card__icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </div>
                  <h3 className="info-card__title">Webhooks</h3>
                  <p className="info-card__desc">Notifica a URLs externas cuando los datos cambian en el mock server. Ideal para integraciones.</p>
                </div>
              </div>

              {/* Stacks */}
              <div className="info-section">
                <h2 className="info-section__title">Stacks disponibles</h2>
                <div className="info-stacks">
                  <div className="info-stack">
                    <div className="info-stack__head">
                      <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
                      <strong>FastAPI</strong>
                      <span className="info-stack__badge">Completo</span>
                    </div>
                    <p className="info-stack__desc">SQLAlchemy, Pydantic, JWT, rate limiting, Docker multi-stage, seeds automaticos.</p>
                  </div>
                  <div className="info-stack">
                    <div className="info-stack__head">
                      <span className="info-stack__dot" style={{ background: '#10b981' }} />
                      <strong>Express</strong>
                      <span className="info-stack__badge">Completo</span>
                    </div>
                    <p className="info-stack__desc">Sequelize, rate limiting, Swagger automatico, JWT, Docker Compose con PostgreSQL.</p>
                  </div>
                  <div className="info-stack">
                    <div className="info-stack__head">
                      <span className="info-stack__dot" style={{ background: '#8b5cf6' }} />
                      <strong>NestJS</strong>
                      <span className="info-stack__badge">Completo</span>
                    </div>
                    <p className="info-stack__desc">TypeORM, Swagger decorators, AuthGuard, DTOs, estructura modular, Docker.</p>
                  </div>
                </div>
              </div>

              {/* Quick start */}
              <div className="info-section">
                <h2 className="info-section__title">Inicio rapido</h2>
                <div className="info-steps">
                  <div className="info-step">
                    <span className="info-step__num">1</span>
                    <div>
                      <strong>Crea un dataset</strong>
                      <p>Define los campos de tu modelo de datos con tipos, restricciones y datos de ejemplo.</p>
                    </div>
                  </div>
                  <div className="info-step">
                    <span className="info-step__num">2</span>
                    <div>
                      <strong>Disena endpoints</strong>
                      <p>Selecciona el dataset y elige operaciones CRUD o rutas personalizadas.</p>
                    </div>
                  </div>
                  <div className="info-step">
                    <span className="info-step__num">3</span>
                    <div>
                      <strong>Genera y descarga</strong>
                      <p>Pulsa "Guardar y lanzar API" y descarga el bundle con codigo listo para desplegar.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'config' && (
            <SectionCard title="Configuración" subtitle="Administración del sistema" fullWidth>
              <ConfigPanel
                currentUsername={authStatus.username}
                onUpdateCredentials={async (newUsername, newPassword, currentPassword) => {
                  const token = readToken()
                  if (!token) throw new Error('No estás autenticado')
                  if (newUsername !== authStatus.username) {
                    await apiFetch('/auth/change-username', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ new_username: newUsername, current_password: currentPassword }),
                    })
                  }
                  if (newPassword) {
                    await apiFetch('/auth/change-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
                    })
                  }
                  performLogout()
                }}
                onResetCredentials={async () => {
                  await resetCredentials()
                  performLogout()
                }}
              />
            </SectionCard>
          )}
        </div>
      </div>
      <div className="fab-container">
        {showSuccess && (
          <div className="fab-success-msg">
            ¡API actualizada con éxito!
          </div>
        )}
        <button type="button" className="fab" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? (
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
    </div>
  )
}

export default App
