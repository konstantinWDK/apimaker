import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  projects: ProjectDraft[]
  onSave: () => void
  onCreate: () => void
  onSwitchProject: (project: ProjectDraft) => void
  onDelete: (id: string) => void
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

export function ProjectSidebar({ project, projects, onSave, onCreate, onSwitchProject, onDelete, mockRunning, mockLoading, mockError, onStartMock, onStopMock }: Props) {
  const datasetName = project.dataset?.name ?? 'Sin dataset'
  const fields = project.dataset?.fields.length ?? 0
  const rows = project.dataset?.sampleRows?.length ?? 0
  const endpoints = project.endpoints.length

  return (
    <aside className="sidebar">
      <div className="sidebar__card">
        <p className="sidebar__title">{project.name}</p>
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

      {/* Mock server control */}
      <div className="sidebar__card">
        <p className="sidebar__title" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Mock server
        </p>
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
