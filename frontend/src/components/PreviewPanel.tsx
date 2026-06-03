import { useTranslation } from 'react-i18next'
import type { ProjectDraft } from '../types/schemas'
import { getPreviewData } from '../lib/preview'

interface Props {
  project: ProjectDraft
  datasetId?: string
}

export function PreviewPanel({ project, datasetId }: Props) {
  const { t } = useTranslation()
  const { columns, rows } = getPreviewData(project, datasetId)

  return (
    <div className="preview-panel">
      <div className="preview-block preview-block--table">
        <div className="preview-block__header">
          <p className="eyebrow">{t('preview.datasetPreview')}</p>
          <span className="badge badge--emerald">{rows.length} {rows.length === 1 ? t('preview.row') : t('preview.rows')}</span>
        </div>
        <div className="preview-table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                {columns.length > 0 
                  ? columns.map((field: any) => <th key={field.id}>{field.name || t('preview.unnamed')}</th>)
                  : <th className="muted-text">{t('preview.waitingColumns')}</th>
                }
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row: any, rowIndex: number) => (
                  <tr key={rowIndex}>
                    {columns.map((field: any) => (
                      <td key={field.id}>{String(row[field.name] ?? '')}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="preview-table__empty">
                    {columns.length > 0 
                      ? t('preview.noData') 
                      : t('preview.defineSchema')}
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
