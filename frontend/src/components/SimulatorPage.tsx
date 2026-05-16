import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiPlayground } from './ApiPlayground'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { apiFetch } from '../lib/api'

interface Deployment {
  slug: string
  name: string
  url: string
  stack: string
  status: string
  docker_status?: string
  endpoints?: string[]
}

export function SimulatorPage() {
  const { t } = useTranslation()
  const { project, startMock, mockRunning, mockLoading, mockError } = useProjectBuilder()
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(
    project.datasets[0]?.id
  )
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([])
  const [activeDeploymentUrl, setActiveDeploymentUrl] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDatasetId(project.datasets[0]?.id)
    setActiveDeploymentUrl(null)
    apiFetch('/api/deploy/list')
      .then(r => r.json())
      .then((data: Deployment[]) => setAllDeployments(data.filter(d => d.docker_status === 'running')))
      .catch(() => {})
  }, [project.slug, project.remoteId])

  const projectSlugs = [project.slug, project.remoteId].filter(Boolean) as string[]
  const runningDeployments = allDeployments.filter(d =>
    d.docker_status === 'running' && projectSlugs.includes(d.slug)
  )

  return (
    <div className="simulator-page">
      <div className="simulator-page__header">
        <p className="simulator-page__eyebrow">{t('simulator.eyebrow')}</p>
        <h1 className="simulator-page__title">
          {t('simulator.title')} <span>{project.name || t('simulator.newProject')}</span>
        </h1>
        {project.datasets.length > 0 && (
          <div className="simulator-page__dataset-select">
            <label className="simulator-page__dataset-label">{t('simulator.activeDataset')}</label>
            <select
              className="simulator-page__dataset-dropdown"
              value={selectedDatasetId || ''}
              onChange={e => setSelectedDatasetId(e.target.value || undefined)}
            >
              <option value="">{t('simulator.allDatasets')}</option>
              {project.datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.fields.length} {t('simulator.fields')}, {(ds.sampleRows || []).length} {t('simulator.rows')})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {runningDeployments.length > 0 && (
        <div className="sim-deployments">
          <div className="sim-deployments__label">{t('simulator.activeDeployments')}</div>
          <div className="sim-deployments__list">
            <button
              className={`sim-deployments__item${!activeDeploymentUrl ? ' active' : ''}`}
              onClick={() => setActiveDeploymentUrl(null)}
            >
              {t('simulator.localMock')}
            </button>
            {runningDeployments.map(dep => (
              <button
                key={dep.slug}
                className={`sim-deployments__item${activeDeploymentUrl === dep.url ? ' active' : ''}`}
                onClick={() => setActiveDeploymentUrl(dep.url)}
              >
                {dep.name}
                <span className="sim-deployments__stack">{dep.stack}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ApiPlayground
        project={project}
        mockRunning={mockRunning}
        onStartMock={startMock}
        mockLoading={mockLoading}
        mockError={mockError}
        selectedDatasetId={selectedDatasetId}
        deploymentBaseUrl={activeDeploymentUrl}
      />

      <style>{`
        .simulator-page { display: flex; flex-direction: column; gap: 1rem; }
        .simulator-page__header {
          display: flex; flex-direction: column; gap: 0.15rem;
        }
        .simulator-page__eyebrow {
          margin: 0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #6366f1;
        }
        .simulator-page__title {
          margin: 0 0 0.5rem; font-size: 1.3rem; font-weight: 700; color: #0f172a;
        }
        .simulator-page__title span { color: #6366f1; }
        .simulator-page__dataset-select { display: flex; flex-direction: column; gap: 0.25rem; align-self: flex-start; }
        .simulator-page__dataset-label {
          font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .simulator-page__dataset-dropdown {
          padding: 0.35rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
          font-size: 0.8rem; background: #fff; cursor: pointer; min-width: 240px;
          outline: none;
        }
        .simulator-page__dataset-dropdown:focus { border-color: #6366f1; }
        .sim-deployments { display: flex; flex-direction: column; gap: 0.35rem; }
        .sim-deployments__label {
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;
        }
        .sim-deployments__list { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .sim-deployments__item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;
          background: #fff; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #334155;
          transition: all 0.12s;
        }
        .sim-deployments__item:hover { border-color: #6366f1; color: #4f46e5; }
        .sim-deployments__item.active { border-color: #6366f1; background: #eef2ff; color: #4f46e5; }
        .sim-deployments__stack {
          font-size: 0.65rem; font-weight: 500; color: #94a3b8; text-transform: uppercase;
        }
      `}</style>
    </div>
  )
}
