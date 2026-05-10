import { useState, useMemo, useRef } from 'react'
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

type Dialect = 'postgresql' | 'mysql' | 'sqlite'
type Step = 'connect' | 'tables'

const DIALECT_DEFAULTS: Record<Dialect, { port: string; placeholder: string }> = {
  postgresql: { port: '5432', placeholder: 'mi_base_de_datos' },
  mysql:      { port: '3306', placeholder: 'mi_base_de_datos' },
  sqlite:     { port: '',     placeholder: '/ruta/al/archivo.db' },
}

const DIALECT_LABELS: Record<Dialect, string> = {
  postgresql: 'PostgreSQL',
  mysql:      'MySQL / MariaDB',
  sqlite:     'SQLite (archivo)',
}

function buildConnectionUrl(
  dialect: Dialect,
  host: string,
  port: string,
  user: string,
  password: string,
  dbname: string,
): string {
  if (dialect === 'sqlite') return `sqlite:///${dbname}`
  const auth = user ? `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ''}@` : ''
  const portStr = port ? `:${port}` : ''
  return `${dialect}://${auth}${host}${portStr}/${dbname}`
}

export function DatabaseImportPanel({ onImport, onCancel }: Props) {
  // Connection form
  const [dialect, setDialect] = useState<Dialect>('postgresql')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('5432')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [dbname, setDbname] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sqliteFile, setSqliteFile] = useState<File | null>(null)

  // State machine
  const [step, setStep] = useState<Step>('connect')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState<DBTable[]>([])
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connectionUrl = useMemo(
    () => buildConnectionUrl(dialect, host, port, user, password, dbname),
    [dialect, host, port, user, password, dbname],
  )

  const isConnectDisabled = dialect === 'sqlite'
    ? (!sqliteFile && !dbname)
    : !dbname || !host

  // Handle dialect change — update port automatically
  const handleDialectChange = (d: Dialect) => {
    setDialect(d)
    setPort(DIALECT_DEFAULTS[d].port)
    setTestStatus('idle')
    setTestMessage(null)
  }

  // Handle file selection for SQLite
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSqliteFile(file)
      setDbname(`upload:${file.name}`) // Mark as uploaded file
    }
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestMessage(null)
    try {
      const { baseUrl } = readBackendConfig()
      
      let body: any
      let headers: Record<string, string> = {}
      
      // For SQLite with uploaded file, send the file
      if (dialect === 'sqlite' && sqliteFile) {
        const formData = new FormData()
        formData.append('file', sqliteFile)
        formData.append('dialect', 'sqlite')
        body = formData
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ connection_url: connectionUrl })
      }
      
      const res = await fetch(`${baseUrl}/db/test-connection`, {
        method: 'POST',
        headers,
        body,
      })
      const data = await res.json()
      if (data.ok) {
        setTestStatus('ok')
        setTestMessage('Conexión exitosa')
      } else {
        setTestStatus('error')
        setTestMessage(data.message || 'Error de conexión')
      }
    } catch {
      setTestStatus('error')
      setTestMessage('Error de red al intentar conectar')
    }
  }

  const handleIntrospect = async () => {
    setLoading(true)
    setError(null)
    try {
      const { baseUrl } = readBackendConfig()
      
      let body: any
      let headers: Record<string, string> = {}
      
      // For SQLite with uploaded file, send the file
      if (dialect === 'sqlite' && sqliteFile) {
        const formData = new FormData()
        formData.append('file', sqliteFile)
        formData.append('dialect', 'sqlite')
        body = formData
      } else {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ connection_url: connectionUrl })
      }
      
      const res = await fetch(`${baseUrl}/db/introspect`, {
        method: 'POST',
        headers,
        body,
      })
      const data = await res.json()
      if (data.ok) {
        setTables(data.tables)
        setSelectedTables([])
        setStep('tables')
      } else {
        setError(data.message || 'Error al introspeccionar la base de datos')
      }
    } catch {
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
        sourceType: 'database' as const,
        fields: t.columns.map(col => ({
          id: crypto.randomUUID(),
          name: col.name,
          type: col.type,
          required: col.required,
          description: col.is_primary ? 'Primary Key' : undefined,
        })),
        sampleRows: [],
      }))
    onImport(datasets)
  }

  if (step === 'tables') {
    return (
      <div className="dbi">
        <div className="dbi__tables-header">
          <button type="button" className="btn ghost btn-sm dbi__back" onClick={() => setStep('connect')}>
            ← Volver
          </button>
          <p className="dbi__title">Tablas encontradas <span className="badge">{tables.length}</span></p>
          <button
            type="button"
            className="btn primary btn-sm"
            disabled={selectedTables.length === 0}
            onClick={handleFinalImport}
          >
            Importar {selectedTables.length > 0 ? `${selectedTables.length} tabla${selectedTables.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>

        <div className="dbi__table-list">
          {tables.map(table => {
            const isSelected = selectedTables.includes(table.name)
            const isExpanded = expandedTable === table.name
            return (
              <div key={table.name} className={`dbi__table-row ${isSelected ? 'selected' : ''}`}>
                <div className="dbi__table-row-main">
                  <label className="dbi__table-check-label">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTable(table.name)}
                    />
                    <span className="dbi__table-name">{table.name}</span>
                    <span className="dbi__table-meta">{table.columns.length} cols</span>
                  </label>
                  <button
                    type="button"
                    className="btn ghost btn-xs dbi__table-expand"
                    onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                  >
                    {isExpanded ? '▲ Ocultar' : '▼ Ver campos'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="dbi__columns">
                    {table.columns.map(col => (
                      <div key={col.name} className="dbi__column">
                        <span className="dbi__col-name">{col.name}</span>
                        <span className="dbi__col-type">{col.type}</span>
                        {col.is_primary && <span className="dbi__col-pk">PK</span>}
                        {col.required && !col.is_primary && <span className="dbi__col-req">requerido</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <style>{styles}</style>
      </div>
    )
  }

  return (
    <div className="dbi">
      <p className="dbi__title">Conectar base de datos externa</p>
      <p className="dbi__subtitle">Introduce los datos de conexión. Soportamos PostgreSQL, MySQL y SQLite.</p>

      {/* Dialect selector */}
      <div className="dbi__field-group">
        <label className="dbi__label">Motor</label>
        <div className="dbi__dialect-tabs">
          {(Object.keys(DIALECT_LABELS) as Dialect[]).map(d => (
            <button
              key={d}
              type="button"
              className={`dbi__dialect-btn ${dialect === d ? 'active' : ''}`}
              onClick={() => handleDialectChange(d)}
            >
              {DIALECT_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Connection fields */}
      {dialect !== 'sqlite' ? (
        <>
          <div className="dbi__row">
            <div className="dbi__field-group" style={{ flex: 3 }}>
              <label className="dbi__label">Host</label>
              <input className="field" value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" />
            </div>
            <div className="dbi__field-group" style={{ flex: 1 }}>
              <label className="dbi__label">Puerto</label>
              <input className="field" value={port} onChange={e => setPort(e.target.value)} placeholder={DIALECT_DEFAULTS[dialect].port} />
            </div>
          </div>
          <div className="dbi__row">
            <div className="dbi__field-group" style={{ flex: 1 }}>
              <label className="dbi__label">Usuario</label>
              <input className="field" value={user} onChange={e => setUser(e.target.value)} placeholder="postgres" autoComplete="username" />
            </div>
            <div className="dbi__field-group" style={{ flex: 1 }}>
              <label className="dbi__label">Contraseña</label>
              <div className="dbi__password-row">
                <input
                  className="field"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button type="button" className="dbi__show-pass" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>
          <div className="dbi__field-group">
            <label className="dbi__label">Base de datos</label>
            <input className="field" value={dbname} onChange={e => setDbname(e.target.value)} placeholder={DIALECT_DEFAULTS[dialect].placeholder} />
          </div>
        </>
      ) : (
        <div className="dbi__field-group">
          <label className="dbi__label">Archivo SQLite</label>
          <div className="dbi__file-selector">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn ghost btn-sm dbi__file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Seleccionar archivo
            </button>
            {sqliteFile && <span className="dbi__file-name">{sqliteFile.name}</span>}
          </div>
          <p className="dbi__sqlite-hint">O escribe una ruta absoluta del servidor:</p>
          <input
            className="field"
            value={dbname.startsWith('upload:') ? '' : dbname}
            onChange={e => { setDbname(e.target.value); setSqliteFile(null) }}
            placeholder="/ruta/al/archivo.db"
            style={{ marginTop: '0.5rem' }}
          />
        </div>
      )}

      {/* Connection URL preview */}
      <div className="dbi__url-preview">
        <span className="dbi__url-label">URL generada</span>
        <code className="dbi__url-value">{connectionUrl || '—'}</code>
      </div>

      {/* Test connection */}
      <div className="dbi__test-row">
        <button
          type="button"
          className="btn ghost btn-sm"
          onClick={handleTestConnection}
          disabled={isConnectDisabled || testStatus === 'testing'}
        >
          {testStatus === 'testing' ? '⏳ Probando...' : '⚡ Probar conexión'}
        </button>
        {testStatus === 'ok' && <span className="dbi__test-ok">✓ {testMessage}</span>}
        {testStatus === 'error' && <span className="dbi__test-error">✗ {testMessage}</span>}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="dbi__actions">
        <button type="button" className="btn subtle" onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className="btn primary"
          onClick={handleIntrospect}
          disabled={loading || isConnectDisabled}
        >
          {loading ? 'Explorando...' : 'Explorar tablas →'}
        </button>
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
.dbi { display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem 0; max-width: 100%; overflow-x: hidden; box-sizing: border-box; }
.dbi__title { font-size: 0.95rem; font-weight: 700; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
.dbi__subtitle { font-size: 0.8rem; color: #64748b; margin: -0.5rem 0 0; }
.dbi__label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: block; margin-bottom: 0.3rem; }
.dbi__field-group { display: flex; flex-direction: column; }
.dbi__row { display: flex; gap: 0.75rem; }
.dbi__dialect-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.dbi__dialect-btn { padding: 0.35rem 0.85rem; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; font-size: 0.8rem; font-weight: 500; cursor: pointer; color: #475569; transition: all 0.15s; }
.dbi__dialect-btn.active { border-color: #3b82f6; background: #eff6ff; color: #2563eb; font-weight: 600; }
.dbi__dialect-btn:hover:not(.active) { background: #f8fafc; }
.dbi__password-row { position: relative; display: flex; align-items: center; }
.dbi__password-row .field { flex: 1; padding-right: 2.5rem; }
.dbi__show-pass { position: absolute; right: 0.6rem; background: none; border: none; cursor: pointer; font-size: 1rem; line-height: 1; }
.dbi__url-preview { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.6rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; }
.dbi__url-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 600; }
.dbi__url-value { font-size: 0.78rem; color: #475569; font-family: 'SF Mono', 'Fira Code', monospace; word-break: break-all; }
.dbi__test-row { display: flex; align-items: center; gap: 0.75rem; }
.dbi__test-ok { font-size: 0.8rem; color: #16a34a; font-weight: 500; }
.dbi__test-error { font-size: 0.8rem; color: #dc2626; font-weight: 500; }
.dbi__file-selector { display: flex; align-items: center; gap: 0.75rem; }
.dbi__file-btn { white-space: nowrap; }
.dbi__file-name { font-size: 0.82rem; color: #475569; font-family: monospace; background: #f1f5f9; padding: 0.3rem 0.6rem; border-radius: 4px; }
.dbi__sqlite-hint { font-size: 0.72rem; color: #94a3b8; margin: 0.5rem 0 0; }
.dbi__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }

/* Tables step */
.dbi__tables-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; max-width: 100%; }
.dbi__back { flex-shrink: 0; }
.dbi__tables-header .dbi__title { flex: 1; }
.dbi__table-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 380px; overflow-y: auto; max-width: 100%; box-sizing: border-box; }
.dbi__table-row { border: 1px solid #e2e8f0; border-radius: 8px; transition: all 0.15s; }
.dbi__table-row.selected { border-color: #93c5fd; background: #eff6ff; }
.dbi__table-row-main { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.9rem; max-width: 100%; box-sizing: border-box; }
.dbi__table-check-label { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; flex: 1; }
.dbi__table-name { font-size: 0.88rem; font-weight: 600; color: #1e293b; }
.dbi__table-meta { font-size: 0.72rem; color: #94a3b8; }
.dbi__table-expand { flex-shrink: 0; font-size: 0.72rem; }
.dbi__columns { padding: 0.5rem 0.9rem 0.75rem; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.dbi__column { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.35rem 0.5rem; min-width: 0; flex: 1 1 180px; max-width: 100%; }
.dbi__col-name { color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.dbi__col-type { color: #7c3aed; font-size: 0.68rem; font-family: monospace; background: #f3f0ff; padding: 0.1rem 0.35rem; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
.dbi__col-pk { color: #b45309; font-size: 0.68rem; font-weight: 700; background: #fef3c7; padding: 0.1rem 0.4rem; border-radius: 4px; }
.dbi__col-req { color: #6b7280; font-size: 0.68rem; }
`
