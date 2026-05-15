import { useEffect, useRef, useState } from 'react'
import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  project: ProjectDraft
  projects: ProjectDraft[]
  onSave: () => void
  onCreate: () => void
  onSwitchProject: (project: ProjectDraft) => void
  onDelete: (id: string) => void
  onSync: () => void
  mockRunning: boolean
  mockLoading: boolean
  mockError: string | null
  onStartMock: () => void
  onStopMock: () => void
  isSyncing?: boolean
}

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString()
}

export function ProjectSidebar({ project, projects, onCreate, onSwitchProject, onDelete, onSync, mockRunning, mockLoading, mockError, onStartMock, onStopMock, isSyncing }: Props) {
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [dbType, setDbType] = useState<string | null>(null)
  const [dockerAvail, setDockerAvail] = useState<{ available: boolean; version?: string; containers_running?: number } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const config = readBackendConfig()
        const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
        const baseUrl = config.baseUrl?.replace(/\/$/, '')

        const [healthRes, dockerRes] = await Promise.allSettled([
          fetch(`${baseUrl}/health`),
          fetch(`${baseUrl}/api/deploy/docker-status`).then(r => r.json()).catch(() => null),
        ])

        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          setBackendStatus('online')
        } else {
          setBackendStatus('offline')
        }

        if (dockerRes.status === 'fulfilled' && dockerRes.value?.available) {
          setDockerAvail(dockerRes.value)
        } else {
          setDockerAvail(null)
        }

        if (token) {
          try {
            const adminRes = await fetch(`${baseUrl}/admin/config`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            if (adminRes.ok) {
              const adminData = await adminRes.json()
              setDbType(adminData.current_database_info?.database_type || adminData.dev?.database_type || 'sqlite')
            }
          } catch { /* ignore */ }
        }
      } catch {
        setBackendStatus('offline')
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const datasetsCount = project.datasets.length
  const fieldsCount = project.datasets.reduce((acc, ds) => acc + ds.fields.length, 0)
  const rowsCount = project.datasets.reduce((acc, ds) => acc + (ds.sampleRows?.length ?? 0), 0)
  const sizeBytes = project.datasets.reduce((acc, ds) => acc + (ds.sampleRows ? JSON.stringify(ds.sampleRows).length : 0), 0)
  const sizeKb = sizeBytes > 0 ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB` : '0 KB'
  const endpoints = project.endpoints.length

  const sortedProjects = [...projects].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  return (
    <aside className="sidebar">
      {/* Project selector dropdown */}
      <div className="sidebar__project-selector" ref={dropdownRef}>
        <button
          type="button"
          className="sidebar__project-trigger"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <div className="sidebar__project-trigger-info">
            <span className="sidebar__project-trigger-name">{project.name || 'Nuevo Proyecto'}</span>
            <span className="sidebar__project-trigger-meta">
              {project.targetStack} · {endpoints} endpoints · {datasetsCount} datasets
            </span>
          </div>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`sidebar__project-chevron ${dropdownOpen ? 'open' : ''}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="sidebar__project-dropdown">
            <div className="sidebar__project-dropdown-header">
              <span>Proyectos</span>
              <button type="button" className="sidebar__project-dropdown-new" onClick={onCreate}>
                + Nuevo
              </button>
            </div>
            <div className="sidebar__project-dropdown-list">
              {sortedProjects.length === 0 ? (
                <p className="sidebar__project-dropdown-empty">Guarda tu proyecto para verlo aqui.</p>
              ) : (
                sortedProjects.map((item) => {
                  const isActive = item.id === project.id
                  const epCount = item.endpoints?.length ?? 0
                  const dsCount = item.datasets?.length ?? 0
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar__project-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSwitchProject(item)
                        setDropdownOpen(false)
                      }}
                    >
                      <div className="sidebar__project-dropdown-item-main">
                        <span className="sidebar__project-dropdown-item-name">{item.name}</span>
                        <span className="sidebar__project-dropdown-item-meta">
                          {item.targetStack} · {epCount} endp · {dsCount} ds · {formatDate(item.updatedAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="sidebar__project-dropdown-delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(item.id)
                        }}
                        aria-label={`Eliminar ${item.name}`}
                      >
                        ×
                      </button>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar__section">
        <p className="sidebar__section-title">Informacion del Proyecto</p>
        <div className="sidebar__status-card" style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
            <h1 className="sidebar__h1-title">{project.name || 'Nuevo Proyecto'}</h1>
            <p className="sidebar__subtitle" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Stack: {project.targetStack}</p>
          </div>

          <dl className="sidebar__stats" style={{ margin: 0 }}>
            <div>
              <dt>Tablas</dt>
              <dd>{datasetsCount}</dd>
            </div>
            <div>
              <dt>Campos</dt>
              <dd>{fieldsCount}</dd>
            </div>
            <div>
              <dt>Filas</dt>
              <dd>{rowsCount}</dd>
            </div>
            <div>
              <dt>Peso</dt>
              <dd>{sizeKb}</dd>
            </div>
            <div>
              <dt>Endpoints</dt>
              <dd>{endpoints}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Monitoring & Status */}
      <div className="sidebar__section">
        <p className="sidebar__section-title">Status</p>

        <div className="sidebar__status-card">
          <div className="sidebar__status-indicator">
            <span className={`sidebar__mock-dot ${backendStatus === 'online' ? 'on' : (backendStatus === 'offline' ? 'off' : 'checking')}`} />
            <span className="sidebar__status-text">
              {backendStatus === 'online' ? 'Backend Online' : (backendStatus === 'offline' ? 'Backend Offline' : 'Comprobando...')}
            </span>
          </div>

          {dbType && (
            <div className="sidebar__db-status-group">
              <div className="sidebar__status-indicator">
                <span className="sidebar__mock-dot on" />
                <span className="sidebar__status-text">
                  BD: {dbType === 'postgresql' ? 'PostgreSQL' : 'SQLite'}
                </span>
              </div>
            </div>
          )}

          {dockerAvail && (
            <div className="sidebar__db-status-group">
              <div className="sidebar__status-indicator">
                <span className="sidebar__mock-dot on" />
                <span className="sidebar__status-text">
                  Docker v{dockerAvail.version}
                </span>
                <span className="sidebar__status-tag">{dockerAvail.containers_running} contenedores</span>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar__card sidebar__card--status">
          <div className="sidebar__status-item">
            <div className="sidebar__status-bar">
              <span className="sidebar__status-label">Live Mode</span>
              <span className={`sidebar__mock-dot ${mockRunning ? 'on' : 'off'}`} />
              <span className="sidebar__mock-label">
                {mockRunning ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="sidebar__mock-actions">
              {!mockRunning ? (
                <button
                  type="button"
                  className="btn ghost btn-small btn-full"
                  onClick={onStartMock}
                  disabled={mockLoading}
                >
                  {mockLoading ? 'Iniciando...' : 'Iniciar live'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost btn-small btn-full"
                  onClick={onStopMock}
                  disabled={mockLoading}
                >
                  {mockLoading ? 'Parando...' : 'Parar live'}
                </button>
              )}
            </div>
            {mockError && (
              <p className="sidebar__mock-error">{mockError}</p>
            )}
          </div>

          <div className="sidebar__status-divider" />

          <div className="sidebar__status-item">
            <div className="sidebar__mock-bar">
              <span className={`sidebar__mock-dot ${project.remoteId ? 'on' : 'off'}`} />
              <span className="sidebar__mock-label">
                {project.remoteId ? 'Sincronizado' : 'Pendiente'}
              </span>
            </div>

            <div className="sidebar__mock-actions">
              <button
                type="button"
                className="btn primary btn-small btn-full"
                onClick={onSync}
              >
            {project.remoteId ? 'Actualizar en backend' : 'Sincronizar con backend'}
              </button>
            </div>
            {isSyncing && (
              <p className="sidebar__description" style={{ color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="sidebar__mock-dot checking" /> Sincronizando cambios...
              </p>
            )}
            {project.remoteId && !isSyncing && (
              <p className="success-text" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Proyecto sincronizado con el backend
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
