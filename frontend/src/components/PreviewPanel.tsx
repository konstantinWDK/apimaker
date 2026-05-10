import type { ProjectDraft } from '../types/schemas'
import { getPreviewData } from '../lib/preview'

interface Props {
  project: ProjectDraft
}

export function PreviewPanel({ project }: Props) {
  const { columns, rows, payload } = getPreviewData(project)

  return (
    <div className="preview-panel">
      <div className="preview-block preview-block--table">
        <div className="preview-block__header">
          <p className="eyebrow">Vista previa del Dataset</p>
          <span className="badge badge--emerald">{rows.length} {rows.length === 1 ? 'fila' : 'filas'}</span>
        </div>
        <div className="preview-table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                {columns.length > 0 
                  ? columns.map((field) => <th key={field.id}>{field.name || 'Sin nombre'}</th>)
                  : <th className="muted-text">Esperando columnas...</th>
                }
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((field) => (
                      <td key={field.id}>{row[field.name] ?? '-'}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="preview-table__empty">
                    {columns.length > 0 
                      ? 'No hay datos para mostrar con estas columnas.' 
                      : 'Define el esquema a la izquierda para ver la vista previa.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
