import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  project: ProjectDraft
  onSync: () => void
  mockRunning: boolean
  mockLoading: boolean
  mockError: string | null
  onStartMock: () => void
  onStopMock: () => void
  isSyncing?: boolean
}

export function ProjectSidebar({ project, onSync, mockRunning, mockLoading, mockError, onStartMock, onStopMock, isSyncing }: Props) {
  const { t } = useTranslation()
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [dbType, setDbType] = useState<string | null>(null)
  const [dockerAvail, setDockerAvail] = useState<{ available: boolean; version?: string; containers_running?: number } | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const config = readBackendConfig()
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

        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          try {
            const healthData = await healthRes.value.json()
            if (healthData.database) {
              setDbType(healthData.database)
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

  const datasetsCount = project.datasets.length
  const fieldsCount = project.datasets.reduce((acc, ds) => acc + ds.fields.length, 0)
  const rowsCount = project.datasets.reduce((acc, ds) => acc + (ds.sampleRows?.length ?? 0), 0)
  const sizeBytes = project.datasets.reduce((acc, ds) => acc + (ds.sampleRows ? JSON.stringify(ds.sampleRows).length : 0), 0)
  const sizeKb = sizeBytes > 0 ? `${Math.max(1, Math.round(sizeBytes / 1024))} KB` : '0 KB'
  const endpoints = project.endpoints.length

  return (
    <aside className="sidebar">

      <div className="sidebar__section">
        <p className="sidebar__section-title">{t('sidebar.projectInfo')}</p>
        <div className="sidebar__status-card" style={{ padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
            <h1 className="sidebar__h1-title">{project.name || t('sidebar.newProject')}</h1>
            <p className="sidebar__subtitle" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{t('sidebar.stack')}: {project.targetStack}</p>
          </div>

          <dl className="sidebar__stats" style={{ margin: 0 }}>
            <div>
              <dt>{t('sidebar.tables')}</dt>
              <dd>{datasetsCount}</dd>
            </div>
            <div>
              <dt>{t('sidebar.fields')}</dt>
              <dd>{fieldsCount}</dd>
            </div>
            <div>
              <dt>{t('sidebar.rows')}</dt>
              <dd>{rowsCount}</dd>
            </div>
            <div>
              <dt>Peso</dt>
              <dd>{sizeKb}</dd>
            </div>
            <div>
              <dt>{t('sidebar.endpoints')}</dt>
              <dd>{endpoints}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Monitoring & Status */}
      <div className="sidebar__section">
        <p className="sidebar__section-title">{t('sidebar.status')}</p>

        <div className="sidebar__status-card">
          <div className="sidebar__status-indicator">
            <span className={`sidebar__mock-dot ${backendStatus === 'online' ? 'on' : (backendStatus === 'offline' ? 'off' : 'checking')}`} />
            <span className="sidebar__status-text">
              {backendStatus === 'online' ? t('sidebar.backendOnline') : (backendStatus === 'offline' ? t('sidebar.backendOffline') : t('sidebar.checking'))}
            </span>
          </div>

          {dbType && (
            <div className="sidebar__db-status-group">
              <div className="sidebar__status-indicator">
                <span className="sidebar__mock-dot on" />
                <span className="sidebar__status-text">
                  {dbType === 'postgresql' ? t('sidebar.dbPostgres') : t('sidebar.dbSqlite')}
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
                <span className="sidebar__status-tag">{dockerAvail.containers_running} {t('sidebar.containers')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar__card sidebar__card--status">
          <div className="sidebar__status-item">
            <div className="sidebar__status-bar">
              <span className="sidebar__status-label">{t('sidebar.liveMode')}</span>
              <span className={`sidebar__mock-dot ${mockRunning ? 'on' : 'off'}`} />
              <span className="sidebar__mock-label">
                {mockRunning ? t('sidebar.active') : t('sidebar.inactive')}
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
                  {mockLoading ? t('sidebar.starting') : t('sidebar.startLive')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost btn-small btn-full"
                  onClick={onStopMock}
                  disabled={mockLoading}
                >
                  {mockLoading ? t('sidebar.stopping') : t('sidebar.stopLive')}
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
                {project.remoteId ? t('sidebar.synced') : t('sidebar.pending')}
              </span>
            </div>

            <div className="sidebar__mock-actions">
              <button
                type="button"
                className="btn primary btn-small btn-full"
                onClick={onSync}
              >
            {project.remoteId ? t('sidebar.syncToBackend') : t('sidebar.syncToBackend')}
              </button>
            </div>
            {isSyncing && (
              <p className="sidebar__description" style={{ color: '#6366f1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="sidebar__mock-dot checking" /> {t('sidebar.syncing')}
              </p>
            )}
            {project.remoteId && !isSyncing && (
              <p className="success-text" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {t('sidebar.syncedWithBackend')}
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
