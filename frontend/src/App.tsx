import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'

import { SetupWizard } from './components/SetupWizard'
import { ApiUsagePanel } from './components/ApiUsagePanel'
import { LoginScreen } from './components/LoginScreen'
import { ProjectSidebar } from './components/ProjectSidebar'
import { ShareView } from './components/ShareView'
import { UserCard } from './components/UserCard'
import { InfoPage } from './components/InfoPage'
import { DocsPage } from './components/DocsPage'
import { ConfigPage } from './components/ConfigPage'
import { BuilderPage } from './components/BuilderPage'
import { SimulatorPage } from './components/SimulatorPage'
import { useProjectBuilder } from './hooks/useProjectBuilder'
import { useAuth } from './hooks/useAuth'
import { useToast } from './components/Toast'
import type { ProjectDraft } from './types/schemas'
import { readBackendConfig } from './lib/backendConfig'
import { apiFetch } from './lib/api'

export function App() {
  const location = useLocation()
  const isShareView = location.pathname.startsWith('/share/')
  const { isAuthenticated, login, error: authError, logout, authStatus } = useAuth()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const toast = useToast()
  const {
    project,
    replaceProject,
    startMock,
    stopMock,
    checkMockStatus,
    deleteProject,
    mockRunning,
    mockLoading,
    mockError,
    refreshProjects,
    projects,
    saveProject,
  } = useProjectBuilder()

  const navigate = useNavigate()

  if (isShareView) {
    return <ShareView />
  }

  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} error={authError ?? undefined} />
  }

  const performLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  const handleGenerate = useCallback(async () => {
    const effectiveProjectId = await saveProject()
    if (!effectiveProjectId) {
      toast('Error al guardar el proyecto. Asegúrate de estar autenticado.', 'error')
    }
  }, [saveProject, toast])

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch(`${readBackendConfig().baseUrl?.replace(/\/$/, '')}/setup/status`)
        if (res.ok) {
          const data = await res.json()
          setNeedsSetup(!data.is_configured)
        }
      } catch {
        // Fallback or ignore
      }
    }
    checkSetup()
  }, [])

  useEffect(() => {
    if (!project.remoteId || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`/projects/${project.remoteId}/mock/status`).then(r => r.json())
        if (cancelled) return
        if (res.status !== 'running') {
          await apiFetch(`/projects/${project.remoteId}/mock/start`, { method: 'POST' })
          if (!cancelled) {
            useProjectBuilder.getState().checkMockStatus()
          }
        } else {
          if (!cancelled) checkMockStatus()
        }
      } catch {
        // Mock server not available — don't block the UI
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.remoteId, isAuthenticated])

  return (
    <div className="shell">
      <div className="app-wrapper">
        <div className="sidebar-stack">
          <UserCard
            username={authStatus.username}
            mustChange={authStatus.mustChange}
            onOpenSettings={() => navigate('/config')}
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
              <button type="button" onClick={() => navigate('/config')}>
                Cambiar ahora
              </button>
            </div>
          ) : null}
          <div className="top-nav">
            <div className="nav-buttons">
              <NavLink
                to="/"
                end
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Editor
              </NavLink>
              <NavLink
                to="/usage"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Uso
              </NavLink>
              <NavLink
                to="/simulator"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Simulador
              </NavLink>
              <NavLink
                to="/info"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Información
              </NavLink>
              <NavLink
                to="/config"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Configuración
              </NavLink>
              <NavLink
                to="/docs"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                Documentación
              </NavLink>
            </div>
            <a className="github-button" href="https://github.com/" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .5a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58v-2.02c-3.34.72-4.05-1.61-4.05-1.61-.55-1.4-1.34-1.78-1.34-1.78-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.24 1.83 1.24 1.08 1.85 2.83 1.32 3.52 1 .11-.8.42-1.32.76-1.62-2.66-.3-5.46-1.34-5.46-5.96 0-1.32.47-2.4 1.24-3.24-.12-.3-.54-1.5.12-3.12 0 0 1-.32 3.3 1.23a11.4 11.4 0 016 0c2.31-1.55 3.3-1.23 3.3-1.23.66 1.62.24 2.82.12 3.12.77.84 1.24 1.92 1.24 3.24 0 4.64-2.8 5.66-5.47 5.96.42.36.81 1.06.81 2.14v3.17c0 .32.21.7.82.58A12 12 0 0012 .5z" />
              </svg>
              GitHub
            </a>
          </div>

          <Routes>
            <Route path="/" element={<BuilderPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/usage" element={<ApiUsagePanel />} />
            <Route path="/info" element={<InfoPage />} />
            <Route path="/config" element={<ConfigPage authStatus={authStatus} onLogout={performLogout} />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App
