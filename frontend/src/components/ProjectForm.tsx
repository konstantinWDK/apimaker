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

  const setStack = (stack: 'fastapi' | 'express' | 'nest') => {
    onChange({ targetStack: stack })
  }

  return (
    <div className="compact-project-form">
      <div className="form-row">
        <div className="form-group">
          <label className="label-tiny">Nombre del Proyecto</label>
          <input
            name="name"
            value={project.name}
            onChange={handleInput}
            className="field field-compact"
            placeholder="API de inventario"
          />
        </div>
        <div className="form-group">
          <label className="label-tiny">Slug</label>
          <input
            name="slug"
            value={project.slug ?? ''}
            onChange={handleInput}
            className="field field-compact"
            placeholder="slug"
          />
        </div>
        <div className="form-group">
          <label className="label-tiny">Stack Objetivo</label>
          <div className="stack-bubbles">
            {(['fastapi', 'express', 'nest'] as const).map(s => (
              <button
                key={s}
                type="button"
                className={`stack-bubble ${project.targetStack === s ? 'active' : ''}`}
                onClick={() => setStack(s)}
              >
                {s === 'fastapi' ? 'Python (FastAPI)' : s === 'express' ? 'Node (Express)' : 'Node (NestJS)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .compact-project-form {
          width: 100%;
          margin-top: 0.5rem;
        }
        .form-row {
          display: flex;
          gap: 1.5rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .label-tiny {
          font-size: 0.65rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .field-compact {
          padding: 0.4rem 0.75rem;
          font-size: 0.85rem;
          border-radius: 6px;
          height: 34px;
          min-width: 180px;
        }
        .stack-bubbles {
          display: flex;
          gap: 0.4rem;
          height: 34px;
          align-items: center;
        }
        .stack-bubble {
          padding: 0.35rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .stack-bubble:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .stack-bubble.active {
          background: #eff6ff;
          color: #2563eb;
          border-color: #bfdbfe;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
      `}</style>
    </div>
  )
}
