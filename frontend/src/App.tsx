import { useEffect, useMemo, useState } from 'react'

import { ApiPlayground } from './components/ApiPlayground'
import { ApiUsagePanel } from './components/ApiUsagePanel'
import { BackendSyncCard } from './components/BackendSyncCard'
import { CredentialPanel } from './components/CredentialPanel'
import { DatasetUploader } from './components/DatasetUploader'
import { EndpointDesigner } from './components/EndpointDesigner'
import { EndpointGallery } from './components/EndpointGallery'
import { GenerationResultPanel } from './components/GenerationResultPanel'
import { LoginScreen } from './components/LoginScreen'
import { PayloadPreview } from './components/PayloadPreview'
import { PreviewPanel } from './components/PreviewPanel'
import { ProjectForm } from './components/ProjectForm'
import { ProjectSidebar } from './components/ProjectSidebar'
import { SectionCard } from './components/SectionCard'
import { ShareView } from './components/ShareView'
import { UserCard } from './components/UserCard'
import { useProjectBuilder } from './hooks/useProjectBuilder'
import { useAuth } from './hooks/useAuth'
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
  const {
    project,
    history,
    updateProject,
    setDataset,
    upsertEndpoint,
    removeEndpoint,
    replaceProject,
    setGenerationResult,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
  } = useProjectBuilder()

  if (isShareView) {
    return <ShareView />
  }
  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} error={authError ?? undefined} />
  }
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [generationWarning, setGenerationWarning] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'schema' | 'endpoints' | 'delivery' | 'result'>('schema')
  const [activePage, setActivePage] = useState<'builder' | 'info' | 'usage' | 'admin'>('builder')
  const localBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
  const backendBaseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const performLogout = () => {
    logout()
    if (typeof window !== 'undefined') {
      window.location.replace('/')
    }
  }

  const tabs = useMemo(
    () => [
      { id: 'schema', label: 'Dataset & Vista previa' },
      { id: 'endpoints', label: 'Endpoints & Simulador' },
      { id: 'delivery', label: 'Payload & Entrega' },
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

      // Auto-login: try stored credentials first, then admin/admin
      let token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
      if (!token) {
        // Try stored credentials
        const storedCreds = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-creds') : null
        const creds = storedCreds ? JSON.parse(storedCreds) : null
        const loginBody = creds || { username: 'admin', password: 'admin' }
        const loginRes = await fetch(`${backendBaseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginBody),
        })
        if (loginRes.ok) {
          const loginData = await loginRes.json()
          if (loginData.access_token && typeof window !== 'undefined') {
            window.sessionStorage.setItem('apimaker-jwt-token', loginData.access_token)
            token = loginData.access_token
          }
        }
      }
      if (!token) {
        alert('No se pudo conectar con el backend. Asegúrate de que está corriendo.')
        return
      }

      const auth = { Authorization: `Bearer ${token}` }

      // Create project if doesn't exist
      const exists = await fetch(`${backendBaseUrl}/projects/${project.id}`, { headers: auth })
      let effectiveProjectId = project.id

      if (!exists.ok) {
        const cr = await fetch(`${backendBaseUrl}/projects`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
          body: JSON.stringify({ name: project.name, description: project.description, target_stack: project.targetStack }),
        })
        if (!cr.ok) { alert(`Error al crear proyecto: ${await cr.text()}`); return }
        const createdProject = await cr.json()
        // IMPORTANT: use the server-assigned ID, not the client-side one
        effectiveProjectId = createdProject.id
        if (effectiveProjectId !== project.id) {
          replaceProject({ ...project, id: effectiveProjectId })
        }

        // Sync dataset
        if (project.dataset) {
          const dsRes = await fetch(`${backendBaseUrl}/projects/${effectiveProjectId}/dataset`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
            body: JSON.stringify({ name: project.dataset.name, source_type: project.dataset.sourceType, fields: project.dataset.fields.map(f => ({ name: f.name, type: f.type, required: f.required, description: f.description })) }),
          })
          if (!dsRes.ok) { console.error('Error syncing dataset:', await dsRes.text()) }
        }
        // Sync endpoints
        if (project.endpoints.length > 0) {
          const epRes = await fetch(`${backendBaseUrl}/projects/${effectiveProjectId}/endpoints`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
            body: JSON.stringify({ endpoints: project.endpoints.map(ep => ({ ...ep, id: crypto.randomUUID() })) }),
          })
          if (!epRes.ok) { console.error('Error syncing endpoints:', await epRes.text()) }
        }
      }

      // Generate bundle
      const gr = await fetch(`${backendBaseUrl}/projects/${effectiveProjectId}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ include_mock_server: true, include_sdk: true }),
      })
      if (!gr.ok) {
        alert(`Error al generar bundle: ${await gr.text()}`)
        return
      }

      // Build local result
      const shareId = crypto.randomUUID().slice(0, 6)
      const generationResult: GenerationResult = {
        message: 'API generated successfully',
        retentionNotice: 'Pulsa "Descargar bundle (.zip)" en la API generada para obtener el código.',
        apiUrl: `${localBaseUrl}/api/mock/${effectiveProjectId}${endpoints[0]?.path ?? '/records'}`,
        docsUrl: `${backendBaseUrl}/projects/${effectiveProjectId}/docs`,
        endpoints,
        shareUrl: `${window.location.origin}/share/${shareId}/${slugify(project.name)}`,
        projectName: project.name,
      }
      setGenerationResult({ lastGeneration: generationResult, sharePath: generationResult.shareUrl })
      setResult(generationResult)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'desconocido'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    try {
      const response = await fetch('/demo-project.json', { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo cargar el demo')
      const data = (await response.json()) as ProjectDraft
      replaceProject({ ...data, id: crypto.randomUUID() })
      setResult(null)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingDemo(false)
    }
  }

  useEffect(() => {
    setResult(project.lastGeneration ?? null)
    setGenerationWarning(null)
  }, [project.id, project.lastGeneration])

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
      case 'schema':
        return (
          <SectionCard title="Dataset y vista previa" subtitle="Carga datos y valida la tabla resultante" accent="emerald" fullWidth>
            <div className="split-panel">
              <div className="split-panel__cell">
                <DatasetUploader dataset={project.dataset} onCommit={setDataset} />
              </div>
              <div className="split-panel__cell">
                <PreviewPanel project={project} />
              </div>
            </div>
          </SectionCard>
        )
      case 'endpoints':
        return (
          <div className="tab-grid">
              <SectionCard title="Endpoints REST" subtitle="CRUD base + rutas personalizadas">
                <EndpointDesigner
                  project={project}
                  endpoints={project.endpoints}
                  onAdd={upsertEndpoint}
                  onRemove={removeEndpoint}
                  previewBase={localBaseUrl}
                  warningMessage={generationWarning}
                  clearWarning={() => setGenerationWarning(null)}
                />
              </SectionCard>
            <SectionCard title="Simulador" subtitle="Haz llamadas contra tu sandbox local">
              <ApiPlayground project={project} />
            </SectionCard>
          </div>
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
              <GenerationResultPanel result={effectiveResult} projectId={project.id} />
              <EndpointGallery endpoints={effectiveResult.endpoints} />
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="API generada" subtitle="Tu sandbox aparecerá aquí" fullWidth>
            <p className="muted-text">Genera la API en la vista principal para ver los detalles.</p>
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
            history={history}
            onSave={saveSnapshot}
            onSelect={loadSnapshot}
            onDelete={deleteSnapshot}
            onCreate={() =>
              replaceProject({
                id: crypto.randomUUID(),
                name: 'Nueva API',
                description: 'Describe tu dominio',
                targetStack: 'fastapi',
                endpoints: [],
              })}
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
              <header className="hero">
                <div className="hero__content">
                  <p className="hero__eyebrow">API Maker Studio</p>
                  <h1 className="hero__title">Diseña y lanza APIs REST sin fricción</h1>
                  <p className="hero__copy">Sube un CSV o Excel, ajusta el esquema y publica un sandbox listo para probar.</p>
                </div>
                <div className="hero__card">
                  <div className="hero__card-header">
                    <h2>Configura tu API</h2>
                    <p>Define nombre, stack y contexto inicial.</p>
                    <button type="button" className="btn ghost btn-small" onClick={handleLoadDemo} disabled={loadingDemo}>
                      {loadingDemo ? 'Cargando...' : 'Cargar demo'}
                    </button>
                  </div>
                  <ProjectForm project={project} onChange={updateProject} />
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
          )}

        </div>
      </div>
      <button type="button" className="fab" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Procesando...' : effectiveResult ? 'Actualizar API' : 'Generar API'}
      </button>
    </div>
  )
}

export default App
