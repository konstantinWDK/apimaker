import type { ChangeEvent } from 'react'
import type { ProjectDraft } from '../types/schemas'

interface Props {
  project: ProjectDraft
  onChange: (payload: Partial<ProjectDraft>) => void
}

export function ProjectForm({ project, onChange }: Props) {
  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    onChange({ [name]: value } as Partial<ProjectDraft>)
  }

  return (
    <div className="form-grid">
      <label className="form-field">
        <span className="label">Nombre</span>
        <input
          name="name"
          value={project.name}
          onChange={handleInput}
          className="field"
          placeholder="API de inventario"
        />
      </label>
      <label className="form-field">
        <span className="label">Slug (URL amigable)</span>
        <input
          name="slug"
          value={project.slug ?? ''}
          onChange={handleInput}
          className="field"
          placeholder="ej: mi-pokedex"
        />
      </label>
      <label className="form-field">
        <span className="label">Descripción</span>
        <textarea
          name="description"
          value={project.description ?? ''}
          onChange={handleInput}
          rows={3}
          className="field"
          placeholder="Describe el dominio y necesidades de la API"
          style={{ resize: 'none' }}
        />
      </label>
      <label className="form-field">
        <span className="label">Stack objetivo</span>
        <select name="targetStack" value={project.targetStack} onChange={handleInput} className="field">
          <option value="fastapi">FastAPI (Python)</option>
          <option value="express">Express (Node)</option>
          <option value="nest">NestJS (Node)</option>
        </select>
      </label>
    </div>
  )
}
