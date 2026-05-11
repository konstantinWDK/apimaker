import { useState } from 'react'
import type { FieldSchema } from '../types/schemas'

interface Props {
  fields: FieldSchema[]
  rows: Array<Record<string, string>>
  onUpdateRow: (rowIndex: number, cellKey: string, value: string) => void
  onRemoveRow: (rowIndex: number) => void
  onRegenerateRow: (rowIndex: number) => void
  onAddRow: () => void
}

const TYPE_BADGE: Record<string, string> = {
  string: 'Aa',
  integer: '123',
  float: '1.5',
  boolean: 'B',
  datetime: 'DT',
  email: '@',
  uuid: 'ID',
}

const PAGE_SIZE = 10

export function DataEditor({ fields, rows, onUpdateRow, onRemoveRow, onRegenerateRow }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  if (fields.length === 0) {
    return (
      <div className="data-editor__empty">
        <p>Define campos en la pestaña "Esquema" primero</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="data-editor__empty">
        <p>No hay datos. Usa "Regenerar" en la barra de herramientas para generar filas de prueba.</p>
      </div>
    )
  }

  const visibleRows = rows.slice(0, visibleCount)
  const hasMore = visibleCount < rows.length

  return (
    <div className="data-editor__table">
      <table>
        <thead>
          <tr>
            <th className="data-editor__row-num">#</th>
            <th className="data-editor__actions-hdr"></th>
            {fields.map((field, idx) => (
              <th key={field.id} title={`${field.description ?? ''} (${field.type})`}>
                <span className="data-editor__th-icon">{TYPE_BADGE[field.type] ?? 'Aa'}</span>
                {field.name || `field_${idx + 1}`}
                {field.required && <span className="data-editor__required">*</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="data-editor__row-num">{rowIndex + 1}</td>
              <td className="data-editor__actions">
                <button
                  type="button"
                  className="data-editor__cell-btn"
                  onClick={() => onRegenerateRow(rowIndex)}
                  title="Regenerar fila"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.9L23 10M1 14l5.1 4.9a9 9 0 0 0 14.4-3.9"/></svg>
                </button>
                <button
                  type="button"
                  className="data-editor__cell-btn data-editor__cell-btn--danger"
                  onClick={() => onRemoveRow(rowIndex)}
                  title="Eliminar fila"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </td>
              {fields.map((field, fieldIdx) => {
                const key = field.name || `field_${fieldIdx + 1}`
                const value = row[key] ?? ''
                return (
                  <td key={field.id}>
                    {field.type === 'boolean' ? (
                      <select
                        className="data-editor__cell data-editor__cell--select"
                        value={value}
                        onChange={e => onUpdateRow(rowIndex, key, e.target.value)}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'datetime' ? 'date' : 'text'}
                        className="data-editor__cell"
                        value={value}
                        onChange={e => onUpdateRow(rowIndex, key, e.target.value)}
                        placeholder={field.defaultValue ?? ''}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="data-editor__more">
          <button type="button" className="btn ghost btn-sm" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
            Mostrar siguientes {Math.min(PAGE_SIZE, rows.length - visibleCount)} filas ({rows.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  )
}
