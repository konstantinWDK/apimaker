import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Play, Shield, Settings, Rocket, Database, TestTube, BookOpen, Info, Activity, LayoutList, Search, BarChart3 } from 'lucide-react'

import { SetupWizard } from './components/SetupWizard'
import { ErrorBoundary } from './components/ErrorBoundary'

import { LoginScreen } from './components/LoginScreen'
import { ProjectSidebar } from './components/ProjectSidebar'
import { ShareView } from './components/ShareView'
import { UserCard } from './components/UserCard'
import { InfoPage } from './components/InfoPage'
import { DocsPage } from './components/DocsPage'
import { ConfigPage } from './components/ConfigPage'
import { SecurityPage } from './components/SecurityPage'
import { DeployPage } from './components/DeployPage'
import { BuilderPage } from './components/BuilderPage'
import { SimulatorPage } from './components/SimulatorPage'
import { ProductOpsPage } from './components/ProductOpsPage'
import { TestsPage } from './components/TestsPage'
import { MonitorPage } from './components/MonitorPage'
import { AdminPanel } from './components/AdminPanel'
import { QueryBuilder } from './components/QueryBuilder'
import { DashboardPage } from './components/DashboardPage'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ThemeToggle } from './components/ThemeToggle'
import { useProjectBuilder, createDefaultProject } from './hooks/useProjectBuilder'
import { useAuth } from './hooks/useAuth'
import { useToast } from './components/Toast'
import { readBackendConfig } from './lib/backendConfig'
import { apiFetch } from './lib/api'

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

  const handleGenerate = useCallback(async () => {
    const effectiveProjectId = await saveProject()
    if (!effectiveProjectId) {
      toast(t('app.saveError'), 'error')
    }
  }, [saveProject, toast])

  const prevRemoteIdRef = useRef<string | undefined>()
  useEffect(() => {
    if (!project.remoteId || !isAuthenticated) return
    let cancelled = false

    const syncFromBackend = async () => {
      try {
        const res = await apiFetch(`/projects/${project.remoteId}/mock/status`).then(r => r.json())
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
        <div className="nav-buttons">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <LayoutDashboard size={16} />
            {t('nav.editor')}
          </NavLink>

          <NavLink
            to="/simulator"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Play size={16} />
            {t('nav.simulator')}
          </NavLink>
          <NavLink
            to="/deploy"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Rocket size={16} />
            {t('nav.deploy')}
          </NavLink>
          <NavLink
            to="/security"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Shield size={16} />
            {t('nav.security')}
          </NavLink>
          <NavLink
            to="/config"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Settings size={16} />
            {t('nav.config')}
          </NavLink>
          <NavLink
            to="/operations"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Database size={16} />
            {t('nav.operations')}
          </NavLink>
          <NavLink
            to="/monitor"
            className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
          >
            <Activity size={16} />
                {t('nav.monitor')}
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                <BarChart3 size={16} />
                {t('nav.dashboard')}
              </NavLink>
              <NavLink
                to="/queries"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                <Search size={16} />
                {t('nav.queries')}
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                <LayoutList size={16} />
                {t('nav.admin')}
              </NavLink>
              <NavLink
                to="/tests"
                className={({ isActive }) => isActive ? 'nav-button active' : 'nav-button'}
              >
                <TestTube size={16} />
                {t('nav.tests')}
          </NavLink>
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
            projects={projects}
            onSave={handleGenerate}
            onCreate={() => {
              replaceProject(createDefaultProject())
            }}
            mockRunning={mockRunning}
            mockLoading={mockLoading}
            mockError={mockError}
            onStartMock={startMock}
            onStopMock={stopMock}
            onSwitchProject={replaceProject}
            onSync={saveProject}
            isSyncing={isSyncing}
            onDelete={async (id: string) => {
              const p = projects.find(p => p.id === id)
              const name = p?.name || t('sidebar.newProject')
              if (window.confirm(t('app.deleteConfirm', { name }))) {
                await deleteProject(id)
                toast(t('app.deleted', { name }), 'info')
              }
            }}
          />
        </div>
        <div className="app-content">
          <div key={location.key} className="page-enter">
            <ErrorBoundary>
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
                <Route path="/queries" element={<QueryBuilder />} />
                <Route path="/config" element={<ConfigPage authStatus={authStatus} onLogout={performLogout} />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/tests" element={<TestsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
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
