import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  history: ProjectDraft[]
  onSave: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return date.toLocaleDateString()
}

export function ProjectSidebar({ project, history, onSave, onSelect, onDelete, onCreate }: Props) {
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
        <button type="button" className="btn primary btn-full" onClick={onSave}>
          Guardar proyecto
        </button>
      </div>

      <div className="sidebar__list">
        <div className="sidebar__list-header">
          <p className="sidebar__list-title">Colección local</p>
        </div>
        <button type="button" className="btn ghost btn-small sidebar__new" onClick={onCreate}>
          + Nuevo proyecto
        </button>
        {history.length === 0 ? (
          <p className="muted-text">Tus proyectos permanentes aparecerán aquí.</p>
        ) : (
          <ul>
            {history.map((item) => (
              <li key={item.id} className="sidebar__list-item">
                <button type="button" className="sidebar__list-button" onClick={() => onSelect(item.id)}>
                  <div>
                    <p className="sidebar__list-name">{item.name}</p>
                    <p className="sidebar__list-meta">{item.endpoints.length} endpoints · {formatDate(item.updatedAt)}</p>
                  </div>
                  <span
                    role="button"
                    className="icon-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(item.id)
                    }}
                  >
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
