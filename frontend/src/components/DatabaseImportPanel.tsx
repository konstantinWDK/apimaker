import { useState } from 'react'
import type { DatasetMeta } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  onImport: (datasets: DatasetMeta[]) => void
  onCancel: () => void
}

interface DBTable {
  name: string
  columns: Array<{
    name: string
    type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime'
    required: boolean
    is_primary: boolean
  }>
}

export function DatabaseImportPanel({ onImport, onCancel }: Props) {
  const [dbUrl, setDbUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState<DBTable[]>([])
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleIntrospect = async () => {
    if (!dbUrl) return
    setLoading(true)
    setError(null)
    try {
      const { baseUrl } = readBackendConfig()
      const res = await fetch(`${baseUrl}/db/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_url: dbUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        setTables(data.tables)
        setSelectedTables(data.tables.map((t: any) => t.name))
      } else {
        setError(data.message || 'Error al conectar con la base de datos')
      }
    } catch (err) {
      setError('Error de red al intentar conectar')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTable = (name: string) => {
    setSelectedTables(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    )
  }

  const handleFinalImport = () => {
    const datasets: DatasetMeta[] = tables
      .filter(t => selectedTables.includes(t.name))
      .map(t => ({
        id: crypto.randomUUID(),
        name: t.name,
        sourceType: 'manual', // We treat it as manual after import
        fields: t.columns.map(col => ({
          id: crypto.randomUUID(),
          name: col.name,
          type: col.type,
          required: col.required,
          description: col.is_primary ? 'Primary Key' : undefined
        })),
        sampleRows: []
      }))
    onImport(datasets)
  }

  return (
    <div className="db-import-panel">
      {!tables.length ? (
        <div className="db-import-form">
          <p className="label-tiny">Conectar base de datos externa</p>
          <input 
            className="field" 
            placeholder="postgresql://user:pass@localhost:5432/dbname"
            value={dbUrl}
            onChange={e => setDbUrl(e.target.value)}
          />
          <div className="db-import-hints">
            <p>Soportamos PostgreSQL, MySQL y SQLite.</p>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="db-import-actions">
            <button type="button" className="btn subtle" onClick={onCancel}>Cancelar</button>
            <button type="button" className="btn primary" onClick={handleIntrospect} disabled={loading || !dbUrl}>
              {loading ? 'Conectando...' : 'Explorar tablas'}
            </button>
          </div>
        </div>
      ) : (
        <div className="db-table-selector">
          <p className="label-tiny">Selecciona las tablas a importar</p>
          <div className="db-table-list">
            {tables.map(table => (
              <label key={table.name} className="db-table-item">
                <input 
                  type="checkbox" 
                  checked={selectedTables.includes(table.name)}
                  onChange={() => handleToggleTable(table.name)}
                />
                <div className="db-table-info">
                  <span className="db-table-name">{table.name}</span>
                  <span className="db-table-meta">{table.columns.length} columnas</span>
                </div>
              </label>
            ))}
          </div>
          <div className="db-import-actions">
            <button type="button" className="btn subtle" onClick={() => setTables([])}>Volver</button>
            <button type="button" className="btn primary" onClick={handleFinalImport}>
              Importar {selectedTables.length} tablas
            </button>
          </div>
        </div>
      )}

      <style>{`
        .db-import-panel { padding: 1rem 0; }
        .db-import-form { display: flex; flex-direction: column; gap: 1rem; }
        .db-import-hints { font-size: 0.75rem; color: #64748b; }
        .db-import-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
        .db-table-list { max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
        .db-table-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
        .db-table-item:last-child { border-bottom: none; }
        .db-table-item:hover { background: #f8fafc; }
        .db-table-name { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
        .db-table-meta { font-size: 0.75rem; color: #94a3b8; margin-left: 0.5rem; }
        .db-table-info { display: flex; align-items: baseline; }
      `}</style>
    </div>
  )
}
