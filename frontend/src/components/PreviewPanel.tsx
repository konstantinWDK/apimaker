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
        <p className="eyebrow">Tabla previa</p>
        <div className="preview-table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                {columns.length
                  ? columns.map((field) => <th key={field.id}>{field.name || 'Column'}</th>)
                  : Object.keys(payload.data[0] ?? {}).map((key) => <th key={key}>{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length
                ? rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {(columns.length ? columns.map((field) => field.name) : Object.keys(row)).map((key) => (
                        <td key={`${rowIndex}-${key}`}>{row[key ?? ''] ?? ''}</td>
                      ))}
                    </tr>
                  ))
                : (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="preview-table__empty">
                        Añade columnas o sube un archivo para ver datos de ejemplo.
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
