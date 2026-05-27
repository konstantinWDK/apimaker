import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Play, Shield, Settings, Rocket, Database, TestTube, BookOpen, Info, Activity, LayoutList, BarChart3 } from 'lucide-react'

import { SetupWizard } from './components/SetupWizard'
import { ErrorBoundary } from './components/ErrorBoundary'

import { LoginScreen } from './components/LoginScreen'
import { ProjectSidebar } from './components/ProjectSidebar'
import { ShareView } from './components/ShareView'
import { UserCard } from './components/UserCard'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ThemeToggle } from './components/ThemeToggle'
import { NavDropdown } from './components/NavDropdown'
import { ProjectSelector } from './components/ProjectSelector'
import { useProjectBuilder, createDefaultProject } from './hooks/useProjectBuilder'
import { useAuth } from './hooks/useAuth'
import { useToast } from './components/Toast'
import { readBackendConfig } from './lib/backendConfig'
import { apiFetch } from './lib/api'

const AdminPanel = lazy(() => import('./components/AdminPanel').then((module) => ({ default: module.AdminPanel })))
const BuilderPage = lazy(() => import('./components/BuilderPage').then((module) => ({ default: module.BuilderPage })))
const ConfigPage = lazy(() => import('./components/ConfigPage').then((module) => ({ default: module.ConfigPage })))
const DashboardPage = lazy(() => import('./components/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const DeployPage = lazy(() => import('./components/DeployPage').then((module) => ({ default: module.DeployPage })))
const DocsPage = lazy(() => import('./components/DocsPage').then((module) => ({ default: module.DocsPage })))
const InfoPage = lazy(() => import('./components/InfoPage').then((module) => ({ default: module.InfoPage })))
const MonitorPage = lazy(() => import('./components/MonitorPage').then((module) => ({ default: module.MonitorPage })))
const ProductOpsPage = lazy(() => import('./components/ProductOpsPage').then((module) => ({ default: module.ProductOpsPage })))
const SecurityPage = lazy(() => import('./components/SecurityPage').then((module) => ({ default: module.SecurityPage })))
const SimulatorPage = lazy(() => import('./components/SimulatorPage').then((module) => ({ default: module.SimulatorPage })))
const TestsPage = lazy(() => import('./components/TestsPage').then((module) => ({ default: module.TestsPage })))

function PageFallback() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
    </div>
  )
}

export function App() {
  const { t } = useTranslation()
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
    isSyncing,
    globalDeployState,
    globalDeployStatus,
    setGlobalDeployState,
  } = useProjectBuilder()

  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) return
    refreshProjects()
  }, [refreshProjects, isAuthenticated])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const checkSetup = async () => {
      try {
        const res = await fetch(`${readBackendConfig().baseUrl?.replace(/\/$/, '')}/setup/status`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setNeedsSetup(!data.is_configured)
        } else {
          setNeedsSetup(false)
        }
      } catch {
        clearTimeout(timeout)
        if (!cancelled) setNeedsSetup(false)
      }
    }

    const safetyTimeout = setTimeout(() => {
      if (!cancelled && needsSetup === null) {
        setNeedsSetup(false)
      }
    }, 7000)

    checkSetup()
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(safetyTimeout)
      clearTimeout(timeout)
    }
  }, [])

  const prevRemoteIdRef = useRef<string | undefined>()
  useEffect(() => {
    if (!project.remoteId || !isAuthenticated) return
    let cancelled = false

    const syncFromBackend = async () => {
      try {
        await apiFetch(`/projects/${project.remoteId}/mock/status`).then(r => r.json())
        if (!cancelled) checkMockStatus()
      } catch {
        if (!cancelled) checkMockStatus()
      }
    }

    if (prevRemoteIdRef.current && prevRemoteIdRef.current !== project.remoteId) {
      apiFetch(`/projects/${prevRemoteIdRef.current}/mock/stop`, { method: 'POST' }).catch(() => {})
    }
    prevRemoteIdRef.current = project.remoteId

    syncFromBackend()
    const interval = setInterval(checkMockStatus, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.remoteId, isAuthenticated])

  if (isShareView) {
    return <ShareView />
  }

  if (needsSetup === null) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="muted-text">{t('app.loading')}</p>
      </div>
    )
  }

  if (needsSetup) {
    return <SetupWizard onComplete={() => setNeedsSetup(false)} />
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} error={authError ?? undefined} />
  }

  const performLogout = () => {
    logout()
  }

  return (
    <div className="shell">
      {authStatus.mustChange ? (
        <div className="security-banner">
          <span>{t('app.credentialsBanner')}</span>
          <button type="button" onClick={() => navigate('/config')}>
            {t('app.changeNow')}
          </button>
        </div>
      ) : null}
      <div className="top-nav">
        <ProjectSelector
          project={project}
          projects={projects}
          onCreate={() => replaceProject(createDefaultProject())}
          onSwitchProject={replaceProject}
          onDelete={async (id: string) => {
            const p = projects.find(p => p.id === id)
            const name = p?.name || t('sidebar.newProject')
            if (window.confirm(t('app.deleteConfirm', { name }))) {
              await deleteProject(id)
              toast(t('app.deleted', { name }), 'info')
            }
          }}
        />
        <div className="nav-buttons">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <LayoutDashboard size={16} />
            {t('nav.editor')}
          </NavLink>

          <NavDropdown
            label={t('nav.apiTools')}
            icon={<Play size={16} />}
            items={[
              { label: t('nav.simulator'), path: '/simulator', icon: <Play size={14} /> },
              { label: t('nav.dashboard'), path: '/dashboard', icon: <BarChart3 size={14} /> },
              { label: t('nav.monitor'), path: '/monitor', icon: <Activity size={14} /> },
              { label: t('nav.security'), path: '/security', icon: <Shield size={14} /> },
            ]}
          />

          <NavLink
            to="/deploy"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Rocket size={16} />
            {t('nav.deploy')}
          </NavLink>

          <NavDropdown
            label={t('nav.settings')}
            icon={<Settings size={16} />}
            items={[
              { label: t('nav.config'), path: '/config', icon: <Settings size={14} /> },
              { label: t('nav.admin'), path: '/admin', icon: <LayoutList size={14} /> },
              { label: t('nav.operations'), path: '/operations', icon: <Database size={14} /> },
              { label: t('nav.tests'), path: '/tests', icon: <TestTube size={14} /> },
            ]}
          />
          <NavLink
            to="/docs"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <BookOpen size={16} />
            {t('nav.docs')}
          </NavLink>
          <NavLink
            to="/info"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Info size={16} />
            {t('nav.info')}
          </NavLink>
        </div>
        <div className="nav-actions">
          <LanguageSwitcher />
          <ThemeToggle />
          <a className="github-button" href="https://github.com/" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a12 12 0 00-3.79 23.4c.6.1.82-.26.82-.58v-2.02c-3.34.72-4.05-1.61-4.05-1.61-.55-1.4-1.34-1.78-1.34-1.78-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.24 1.83 1.24 1.08 1.85 2.83 1.32 3.52 1 .11-.8.42-1.32.76-1.62-2.66-.3-5.46-1.34-5.46-5.96 0-1.32.47-2.4 1.24-3.24-.12-.3-.54-1.5.12-3.12 0 0 1-.32 3.3 1.23a11.4 11.4 0 016 0c2.31-1.55 3.3-1.23 3.3-1.23.66 1.62.24 2.82.12 3.12.77.84 1.24 1.92 1.24 3.24 0 4.64-2.8 5.66-5.47 5.96.42.36.81 1.06.81 2.14v3.17c0 .32.21.7.82.58A12 12 0 0012 .5z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>
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
            onSync={saveProject}
            isSyncing={isSyncing}
            mockRunning={mockRunning}
            mockLoading={mockLoading}
            mockError={mockError}
            onStartMock={startMock}
            onStopMock={stopMock}
          />
        </div>
        <div className="app-content">
          <div key={location.key} className="page-enter">
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes location={location}>
                  <Route path="/" element={<BuilderPage />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/info" element={<InfoPage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/deploy" element={<DeployPage />} />
                  <Route path="/operations" element={<ProductOpsPage />} />
                  <Route path="/monitor" element={<MonitorPage />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/config" element={<ConfigPage authStatus={authStatus} onLogout={performLogout} />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/tests" element={<TestsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {globalDeployState !== 'idle' && (
        <div className={`global-deploy-toast ${globalDeployState}`}>
          {globalDeployState === 'deploying' && <div className="global-deploy-spinner"></div>}
          {globalDeployState === 'success' && <span style={{color: '#4ade80', fontSize: '1.2rem'}}>✓</span>}
          {globalDeployState === 'error' && <span style={{color: '#f87171', fontSize: '1.2rem'}}>✕</span>}
          <span>{globalDeployStatus}</span>
          {globalDeployState !== 'deploying' && (
            <button 
              onClick={() => setGlobalDeployState('idle')}
              style={{
                background: 'none', border: 'none', color: '#94a3b8', 
                cursor: 'pointer', fontSize: '1.1rem', padding: '0 0.2rem',
                marginLeft: '0.5rem'
              }}
              title={t('app.close')}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default App
