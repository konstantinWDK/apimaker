import { useEffect, useMemo, useState } from 'react'

import { ApiPlayground } from './components/ApiPlayground'
import { ApiUsagePanel } from './components/ApiUsagePanel'
import { BackendSyncCard } from './components/BackendSyncCard'
import { CredentialPanel } from './components/CredentialPanel'
import { DatabaseConfigPanel } from './components/DatabaseConfigPanel'
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
  const [activeTab, setActiveTab] = useState<'datasets' | 'endpoints' | 'security' | 'simulator' | 'delivery' | 'result'>('datasets')
  const [isImportingDB, setIsImportingDB] = useState(false)
  const [activePage, setActivePage] = useState<'builder' | 'info' | 'usage' | 'admin'>('builder')
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
        body: JSON.stringify({ include_mock_server: true, include_sdk: true }),
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
        const currentDataset = project.datasets.find(d => d.id === selectedDatasetId) || project.datasets[0]
        return (
          <div className="datasets-tab-new">
            {/* Schema diagram overview */}
            <SectionCard title="Modelo de Datos" subtitle={`${project.datasets.length} dataset(s) — Vista general del esquema`} accent="emerald" fullWidth>
              <SchemaDiagram
                datasets={project.datasets}
                onDatasetClick={(id) => { setSelectedDatasetId(id); setIsImportingDB(false); }}
                activeDatasetId={selectedDatasetId}
              />
            </SectionCard>

            {/* Dataset editor for selected dataset */}
            {currentDataset ? (
              <SectionCard title={`${currentDataset.name}`} subtitle="Editar esquema y datos" accent="sky" fullWidth>
                <DatasetEditor
                  dataset={currentDataset}
                  onCommit={upsertDataset}
                  otherDatasets={project.datasets.filter(d => d.id !== currentDataset.id)}
                />
              </SectionCard>
            ) : (
              <SectionCard title="Datasets" subtitle="Crea tu primer dataset" accent="sky" fullWidth>
                <div className="empty-state">
                  <p className="muted-text">Añade un dataset para empezar a diseñar tu API.</p>
                  <button type="button" className="btn primary" onClick={() => {
                    const newId = crypto.randomUUID()
                    upsertDataset({
                      id: newId,
                      name: 'Usuarios',
                      sourceType: 'manual',
                      icon: '',
                      description: 'Usuarios del sistema',
                      fields: [
                        { id: crypto.randomUUID(), name: 'id', type: 'integer', required: true, isPrimaryKey: true, fakerCategory: 'number' },
                        { id: crypto.randomUUID(), name: 'nombre', type: 'string', required: true, fakerCategory: 'name' },
                        { id: crypto.randomUUID(), name: 'email', type: 'email', required: true, fakerCategory: 'email' },
                      ],
                      sampleRows: []
                    })
                    setSelectedDatasetId(newId)
                  }}>
                    + Crear dataset de ejemplo
                  </button>
                </div>
              </SectionCard>
            )}

            {/* DB import panel (collapsible) */}
            {isImportingDB && (
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
                    if (newDatasets.length > 0) setSelectedDatasetId(newDatasets[0].id)
                    setIsImportingDB(false)
                  }}
                  onCancel={() => setIsImportingDB(false)}
                />
              </SectionCard>
            )}

            {/* Add dataset button bar */}
            <div className="datasets-action-bar">
              <button type="button" className="btn ghost" onClick={() => {
                const newId = crypto.randomUUID()
                upsertDataset({
                  id: newId,
                  name: `Tabla ${project.datasets.length + 1}`,
                  sourceType: 'manual',
                  fields: [{ id: crypto.randomUUID(), name: 'id', type: 'integer', required: true, isPrimaryKey: true }],
                  sampleRows: []
                })
                setSelectedDatasetId(newId)
              }}>
                + Nuevo dataset
              </button>
              <button type="button" className="btn ghost" onClick={() => setIsImportingDB(!isImportingDB)}>
                {isImportingDB ? 'Cerrar importacion' : 'Importar desde BD'}
              </button>
            </div>
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
      case 'result':
        return effectiveResult ? (
          <SectionCard title="API generada" subtitle="Sandbox, docs y endpoints" accent="emerald" fullWidth>
            <div className="api-delivery-grid">
              <GenerationResultPanel result={effectiveResult} projectId={project.slug || project.remoteId || project.id} />
              <EndpointGallery
                endpoints={effectiveResult.endpoints}
                baseUrl={effectiveResult.apiUrl}
                authMethod={project.authMethod}
                apiKey={project.apiKey}
              />
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="API generada" subtitle="Tu sandbox aparecerá aquí" fullWidth>
            <div className="empty-state">
              <p className="muted-text">Genera la API en la vista principal para ver los detalles.</p>
              <button type="button" className="btn ghost btn-small" onClick={handleGenerate}>Generar ahora</button>
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
            onOpenSettings={() => setActivePage('admin')}
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
              <button type="button" onClick={() => setActivePage('admin')}>
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
                  <h1 className="page-title">{project.name || 'Nuevo Proyecto'}</h1>
                  <ProjectForm project={project} onChange={updateProject} />
                </div>
              </header>


              {selectedDatasetId && project.datasets.find(d => d.id === selectedDatasetId) && (
                <div className="dataset-badge">
                  Dataset activo: <span className="dataset-badge__name">{project.datasets.find(d => d.id === selectedDatasetId)?.name}</span>
                </div>
              )}
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
            <SectionCard title="Información" subtitle="Notas del proyecto" fullWidth>
              <div className="info-panel">
                <p>
                  API Maker es un constructor open source que traduce tus datasets y endpoints en especificaciones OpenAPI, documentación Redoc y un
                  sandbox que puedes alojar donde quieras. Todo el flujo ocurre en tu navegador y se sincroniza con tu backend cuando lo necesites.
                </p>
                <p className="muted-text">
                  Casos de uso recomendados:
                  <ul>
                    <li>Prototipado rápido de APIs internas antes de escribir código real.</li>
                    <li>Entregar a tus clientes un builder autogestionado para que definan su dominio.</li>
                    <li>Escenarios educativos/bootcamps donde se necesita visualizar cómo los datos se convierten en endpoints REST.</li>
                  </ul>
                </p>
                <p>
                  Facilita compartir la API gracias a:
                  <ul>
                    <li>Documentación alojada en tu propio servidor (Redoc + openapi.json).</li>
                    <li>Snippets generados automáticamente (payload estimado, lista de rutas, enlaces directos).</li>
                    <li>Snapshots locales y enlaces compartibles para revisión sin necesidad de cuentas.</li>
                  </ul>
                </p>
                <p>
                  Cómo arrancar el proyecto:
                  <ul>
                    <li>
                      Backend: `cd backend && python -m venv .venv && source .venv/bin/activate` (Windows: `.venv\Scripts\activate`), `pip install -e .[dev]`,
                      (opcional) `export APIMAKER_BUILDER_TOKEN=tu_token`, `uvicorn app.main:app --reload`.
                    </li>
                    <li>Frontend: `cd frontend && npm install && npm run dev -- --open`.</li>
                    <li>Producción: `npm run build` en frontend y despliega FastAPI detrás de tu reverse proxy favorito.</li>
                  </ul>
                </p>
                <p>
                  Para APIs públicas, genera el enlace compartible desde la pestaña “API generada”; para integraciones privadas, sincroniza con el
                  backend y descarga el openapi.json. Visita la pestaña “Cómo usarla” para configurar el backend y probar la conexión. Cuando montes el
                  servicio en tu servidor, mantén el builder (UI) detrás de tu VPN o un reverse proxy con autenticación básica/JWT y expón sólo las
                  rutas públicas (`/api/...` y `/projects/&#123;id&#125;/docs`) para tus consumidores. Próximamente añadiremos autenticación integrada, despliegues con un clic y exportación directa de código.
                </p>
              </div>
            </SectionCard>
          )}

          {activePage === 'admin' && (
            <div className="admin-grid">
              <SectionCard title="Base de datos" subtitle="Configuración y sincronización" fullWidth>
                <DatabaseConfigPanel />
              </SectionCard>
              <SectionCard title="Administración" subtitle="Control de acceso al builder" fullWidth>
              <div className="info-panel">
                <p>
                  Actualiza el usuario y contraseña que protegen este builder. Tras guardar, deberás iniciar sesión de nuevo. También puedes
                  restablecer a los valores por defecto (admin / admin) cuando entregues la herramienta a otro equipo.
                </p>
                <CredentialPanel
                  currentUsername={authStatus.username}
                  onUpdate={async (newUsername, newPassword, currentPassword) => {
                    // Get current token
                    const token = readToken()
                    if (!token) throw new Error('No estás autenticado')
                    // Change username if different
                    if (newUsername !== authStatus.username) {
                      await apiFetch('/auth/change-username', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ new_username: newUsername, current_password: currentPassword }),
                      })
                    }
                    // Change password if provided
                    if (newPassword) {
                      await apiFetch('/auth/change-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
                      })
                    }
                    performLogout()
                  }}
                  onReset={async () => {
                    await resetCredentials()
                    performLogout()
                  }}
                />
                <p className="muted-text">Consejo: cambia estas credenciales después de cada despliegue y guarda el acceso en un gestor seguro.</p>
              </div>
            </SectionCard>
            </div>
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
