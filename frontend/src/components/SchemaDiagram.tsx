import { useTranslation } from 'react-i18next'
import type { DatasetMeta } from '../types/schemas'

interface Props {
  datasets: DatasetMeta[]
  onDatasetClick?: (id: string) => void
  onDeleteDataset?: (id: string) => void
  activeDatasetId?: string | null
}

const TYPE_COLORS: Record<string, string> = {
  string: '#3b82f6',
  integer: '#10b981',
  float: '#10b981',
  boolean: '#f59e0b',
  datetime: '#8b5cf6',
  email: '#06b6d4',
  uuid: '#6366f1',
}

const TYPE_ICONS: Record<string, string> = {
  string: 'Aa',
  integer: '123',
  float: '1.5',
  boolean: 'B',
  datetime: 'DT',
  email: '@',
  uuid: 'ID',
}

export function SchemaDiagram({ datasets, onDatasetClick, onDeleteDataset, activeDatasetId }: Props) {
  const { t } = useTranslation()

  if (datasets.length === 0) {
    return (
      <div className="schema-diagram__empty">
        <p>{t('schemaDiagram.noDatasets')}</p>
      </div>
    )
  }

  return (
    <div className="schema-diagram">
      {datasets.map(dataset => (
        <div
          key={dataset.id}
          className={`schema-diagram__table ${activeDatasetId === dataset.id ? 'active' : ''}`}
          onClick={() => onDatasetClick?.(dataset.id)}
        >
          {/* Table header */}
          <div className="schema-diagram__header">
            <span className="schema-diagram__name">{dataset.name}</span>
            <span className="schema-diagram__count">{dataset.fields.length} {t('schemaDiagram.fields')}</span>
            {onDeleteDataset && (
              <button
                type="button"
                className="schema-diagram__delete"
                onClick={(e) => { e.stopPropagation(); onDeleteDataset(dataset.id); }}
                title={t('schemaDiagram.deleteDataset')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            )}
          </div>

          {/* Fields list */}
          <div className="schema-diagram__fields">
            {dataset.fields.slice(0, 12).map(field => (
              <div key={field.id} className="schema-diagram__field">
                <span
                  className="schema-diagram__type-badge"
                  style={{ backgroundColor: TYPE_COLORS[field.type] ?? '#94a3b8' }}
                >
                  {TYPE_ICONS[field.type] ?? '\u00B7'}
                </span>
                <span className="schema-diagram__field-name">
                  {field.name}
                  {field.isPrimaryKey && <span className="schema-diagram__pk-badge">PK</span>}
                  {field.required && <span className="schema-diagram__req-badge">*</span>}
                </span>
                <span className="schema-diagram__field-type">{field.type}</span>
              </div>
            ))}
            {dataset.fields.length > 12 && (
              <div className="schema-diagram__more">+{dataset.fields.length - 12} {t('schemaDiagram.more')}</div>
            )}
          </div>

          {/* Sample data preview */}
          {dataset.sampleRows.length > 0 && (
            <div className="schema-diagram__preview">
              <div className="schema-diagram__preview-header">
                {dataset.sampleRows.length} {t('schemaDiagram.rows')}
              </div>
              <table className="schema-diagram__preview-table">
                <thead>
                  <tr>
                    {dataset.fields.slice(0, 4).map(f => (
                      <th key={f.id}>{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.sampleRows.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      {dataset.fields.slice(0, 4).map(f => (
                        <td key={f.id}>{String(row[f.name] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
