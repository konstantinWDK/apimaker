import { useState } from 'react'
import { ApiPlayground } from './ApiPlayground'
import { useProjectBuilder } from '../hooks/useProjectBuilder'

export function SimulatorPage() {
  const { project, startMock, mockRunning, mockLoading, mockError } = useProjectBuilder()
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(
    project.datasets[0]?.id
  )

  return (
    <div className="simulator-page">
      <div className="simulator-page__header">
        <div>
          <p className="simulator-page__eyebrow">API Simulator</p>
          <h1 className="simulator-page__title">
            Probando <span>{project.name || 'Nuevo Proyecto'}</span>
          </h1>
        </div>
        {project.datasets.length > 0 && (
          <div className="simulator-page__dataset-select">
            <label className="simulator-page__dataset-label">Dataset activo</label>
            <select
              className="simulator-page__dataset-dropdown"
              value={selectedDatasetId || ''}
              onChange={e => setSelectedDatasetId(e.target.value || undefined)}
            >
              <option value="">Todos los datasets</option>
              {project.datasets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.fields.length} campos, {(ds.sampleRows || []).length} filas)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ApiPlayground
        project={project}
        mockRunning={mockRunning}
        onStartMock={startMock}
        mockLoading={mockLoading}
        mockError={mockError}
        selectedDatasetId={selectedDatasetId}
      />

      <style>{`
        .simulator-page { display: flex; flex-direction: column; gap: 1rem; }
        .simulator-page__header {
          display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
          flex-wrap: wrap;
        }
        .simulator-page__eyebrow {
          margin: 0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; color: #6366f1;
        }
        .simulator-page__title {
          margin: 0.1rem 0 0; font-size: 1.3rem; font-weight: 700; color: #0f172a;
        }
        .simulator-page__title span { color: #6366f1; }
        .simulator-page__dataset-select { display: flex; flex-direction: column; gap: 0.25rem; }
        .simulator-page__dataset-label {
          font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .simulator-page__dataset-dropdown {
          padding: 0.35rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 6px;
          font-size: 0.8rem; background: #fff; cursor: pointer; min-width: 250px;
          outline: none;
        }
        .simulator-page__dataset-dropdown:focus { border-color: #6366f1; }
      `}</style>
    </div>
  )
}
