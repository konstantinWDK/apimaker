import type { DatasetMeta } from '../types/schemas'

interface Props {
  datasets: DatasetMeta[]
  onDatasetClick?: (id: string) => void
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

export function SchemaDiagram({ datasets, onDatasetClick, activeDatasetId }: Props) {
  if (datasets.length === 0) {
    return (
      <div className="schema-diagram__empty">
        <p>No hay datasets definidos</p>
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
            <span className="schema-diagram__icon">{dataset.icon ?? ''}</span>
            <span className="schema-diagram__name">{dataset.name}</span>
            <span className="schema-diagram__count">{dataset.fields.length} campos</span>
          </div>

          {/* Fields list */}
          <div className="schema-diagram__fields">
            {dataset.fields.slice(0, 12).map(field => (
              <div key={field.id} className="schema-diagram__field">
                <span
                  className="schema-diagram__type-badge"
                  style={{ backgroundColor: TYPE_COLORS[field.type] ?? '#94a3b8' }}
                >
                  {TYPE_ICONS[field.type] ?? '·'}
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
              <div className="schema-diagram__more">+{dataset.fields.length - 12} más...</div>
            )}
          </div>

          {/* Sample data preview */}
          {dataset.sampleRows.length > 0 && (
            <div className="schema-diagram__preview">
              <div className="schema-diagram__preview-header">
                {dataset.sampleRows.length} filas
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
