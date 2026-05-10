import { useEffect, useState } from 'react'
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
}

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString()
}

export function ProjectSidebar({ project, projects, onCreate, onSwitchProject, onDelete, onSync, mockRunning, mockLoading, mockError, onStartMock, onStopMock }: Props) {
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [dbStatus, setDbStatus] = useState<{ dev: string; prod: string; current: string } | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const config = readBackendConfig()
        const token = typeof window !== 'undefined' ? window.sessionStorage.getItem('apimaker-jwt-token') : null
        
        // Check general health
        const healthRes = await fetch(`${config.baseUrl?.replace(/\/$/, '')}/health`)
        if (healthRes.ok) {
          setBackendStatus('online')
        } else {
          setBackendStatus('offline')
        }

        // Check admin config for DBs
        if (token) {
          const adminRes = await fetch(`${config.baseUrl?.replace(/\/$/, '')}/admin/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (adminRes.ok) {
            const adminData = await adminRes.json()
            setDbStatus({
              dev: adminData.dev.database_type,
              prod: adminData.prod.database_type,
              current: adminData.environment
            })
          }
        }
      } catch (e) {
        setBackendStatus('offline')
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const datasetName = project.dataset?.name ?? 'Sin dataset'
  const fields = project.dataset?.fields.length ?? 0
  const rows = project.dataset?.sampleRows?.length ?? 0
  const endpoints = project.endpoints.length

  return (
    <aside className="sidebar">
      <div className="sidebar__project-header">
        <h1 className="sidebar__h1-title">{project.name || 'Nuevo Proyecto'}</h1>
        <p className="sidebar__subtitle">Stack: {project.targetStack}</p>
        
        <dl className="sidebar__stats">
          <div>
            <dt>Dataset</dt>
            <dd>{datasetName}</dd>
          </div>
          <div>
            <dt>Campos</dt>
            <dd>{fields}</dd>
          </div>
          <div>
            <dt>Filas</dt>
            <dd>{rows}</dd>
          </div>
          <div>
            <dt>Endpoints</dt>
            <dd>{endpoints}</dd>
          </div>
        </dl>
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
          
          {dbStatus && (
            <div className="sidebar__db-status-group">
              <div className="sidebar__status-indicator">
                <span className={`sidebar__mock-dot ${dbStatus.current === 'development' && dbStatus.dev === 'sqlite' ? 'on' : 'idle'}`} />
                <span className="sidebar__status-text">
                  SQLite <span className="sidebar__status-tag">dev</span>
                </span>
              </div>
              <div className="sidebar__status-indicator">
                <span className={`sidebar__mock-dot ${dbStatus.current === 'development' && dbStatus.dev === 'postgresql' ? 'on' : 'idle'}`} />
                <span className="sidebar__status-text">
                  Postgres <span className="sidebar__status-tag">dev</span>
                </span>
              </div>
              <div className="sidebar__status-indicator">
                <span className={`sidebar__mock-dot ${dbStatus.current === 'production' ? 'on' : 'idle'}`} />
                <span className="sidebar__status-text">
                  Postgres <span className="sidebar__status-tag">prod</span>
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="sidebar__card sidebar__card--status">
          <div className="sidebar__status-item">
            <div className="sidebar__mock-bar">
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
                  {mockLoading ? 'Iniciando...' : 'Iniciar mock'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost btn-small btn-full"
                  onClick={onStopMock}
                  disabled={mockLoading}
                >
                  {mockLoading ? 'Parando...' : 'Parar mock'}
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
            {project.remoteId && (
              <p className="success-text" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                ✓ Proyecto sincronizado con el backend
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar__list">
        <div className="sidebar__list-header">
          <p className="sidebar__list-title">Proyectos</p>
        </div>
        <button type="button" className="btn ghost btn-small sidebar__new" onClick={onCreate}>
          + Nuevo proyecto
        </button>
        {projects.length === 0 ? (
          <p className="muted-text">Guarda tu proyecto para verlo aquí.</p>
        ) : (
          <ul>
            {projects
              .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
              .map((item) => {
                const isActive = item.id === project.id
                return (
                  <li key={item.id} className={`sidebar__list-item${isActive ? ' active' : ''}`}>
                    <button type="button" className="sidebar__list-button" onClick={() => onSwitchProject(item)}>
                      <div>
                        <p className="sidebar__list-name">{item.name}</p>
                        <p className="sidebar__list-meta">{item.endpoints.length} endpoints · {formatDate(item.updatedAt)}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="sidebar__delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(item.id)
                      }}
                      aria-label={`Eliminar ${item.name}`}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
    </aside>
  )
}
