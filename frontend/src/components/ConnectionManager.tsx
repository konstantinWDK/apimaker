import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnInfo, DbConnectionInfo, ImportTableResult, TableInfo, TablePreview } from '../lib/api'
import {
  createConnection,
  deleteConnection,
  getTableSchema,
  importConnectionTable,
  listConnections,
  listTables,
  previewTable,
  testConnection,
  updateConnection,
} from '../lib/api'
import { useToast } from './Toast'

interface Props {
  projectId: string
  onImportTable: (result: ImportTableResult) => void | Promise<void>
}

export function ConnectionManager({ projectId, onImportTable }: Props) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<DbConnectionInfo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', db_type: 'postgresql', host: '127.0.0.1', port: 5432, username: '', password: '', database: '' })
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [exploringId, setExploringId] = useState<string | null>(null)
  const [loadingTablesId, setLoadingTablesId] = useState<string | null>(null)
  const [tables, setTables] = useState<TableInfo[]>([])
  const [schemaView, setSchemaView] = useState<{ table: string; columns: ColumnInfo[] } | null>(null)
  const [previewView, setPreviewView] = useState<TablePreview | null>(null)
  const [importingTable, setImportingTable] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    try {
      const data = await listConnections(projectId)
      setConnections(data)
    } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', db_type: 'postgresql', host: '127.0.0.1', port: 5432, username: '', password: '', database: '' })
  }

  const startNewConnection = () => {
    resetForm()
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast(t('connectionManager.nameRequired'), 'error'); return }
    try {
      let saved: DbConnectionInfo
      if (editingId) {
        const updates: any = { name: form.name, db_type: form.db_type }
        if (form.host) updates.host = form.host
        if (form.port) updates.port = form.port
        if (form.username) updates.username = form.username
        if (form.password) updates.password = form.password
        if (form.database) updates.database = form.database
        saved = await updateConnection(editingId, updates)
        toast(t('connectionManager.updated'), 'info')
      } else {
        saved = await createConnection(projectId, form)
        toast(t('connectionManager.created'), 'info')
      }
      resetForm()
      await load()
      await handleTest(saved.id)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const result = await testConnection(id)
      setTestResults(prev => ({ ...prev, [id]: result }))
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: e.message } }))
    }
    setTestingId(null)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(t('connectionManager.confirmDelete').replace('{name}', name))) return
    try {
      await deleteConnection(id)
      toast(t('connectionManager.deleted'), 'info')
      load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleExplore = async (id: string) => {
    setExploringId(id)
    setSchemaView(null)
    setPreviewView(null)
    setLoadingTablesId(id)
    try {
      const tbls = await listTables(id, true)
      setTables(tbls)
    } catch (e: any) { toast(e.message, 'error') }
    setLoadingTablesId(null)
  }

  const handleViewSchema = async (table: string) => {
    if (!exploringId) return
    try {
      const schema = await getTableSchema(exploringId, table)
      setSchemaView(schema)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handlePreview = async (table: string) => {
    if (!exploringId) return
    try {
      const preview = await previewTable(exploringId, table, 25)
      setPreviewView(preview)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const handleImport = async (table: string) => {
    if (!exploringId) return
    setImportingTable(table)
    try {
      const result = await importConnectionTable(exploringId, {
        table_name: table,
        dataset_name: table,
        sample_limit: 25,
        create_endpoints: true,
      })
      await onImportTable(result)
      toast(t('connectionManager.imported').replace('{table}', table), 'info')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setImportingTable(null)
    }
  }

  const dbTypeLabel = (t: string) => ({ postgresql: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite', mssql: 'SQL Server' })[t] || t

  return (
    <div className="conn-mgr">
      <div className="conn-mgr__header">
        <div>
          <p className="conn-mgr__title">{t('connectionManager.title')}</p>
          <p className="conn-mgr__subtitle">{t('connectionManager.subtitle')}</p>
        </div>
        <div className="conn-mgr__header-actions">
          <button type="button" className="btn primary btn-small" onClick={startNewConnection}>
            + {t('connectionManager.newConnection')}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="conn-mgr__form">
          <p className="conn-mgr__hint">{t('connectionManager.dockerHostHint')}</p>
          <div className="conn-mgr__form-grid">
            <label className="form-field"><span className="label">{t('connectionManager.name')}</span>
              <input className="field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('connectionManager.namePlaceholder')} /></label>
            <label className="form-field"><span className="label">{t('connectionManager.type')}</span>
              <select className="field" value={form.db_type} onChange={e => setForm({ ...form, db_type: e.target.value })}>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
                <option value="mssql">SQL Server</option>
              </select></label>
            {form.db_type !== 'sqlite' && (
              <>
                <label className="form-field"><span className="label">{t('connectionManager.host')}</span>
                  <input className="field" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="127.0.0.1" /></label>
                <label className="form-field"><span className="label">{t('connectionManager.port')}</span>
                  <input className="field" type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 5432 })} /></label>
                <label className="form-field"><span className="label">{t('connectionManager.user')}</span>
                  <input className="field" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="postgres" /></label>
                <label className="form-field"><span className="label">{t('connectionManager.password')}</span>
                  <input className="field" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
                <label className="form-field"><span className="label">{t('connectionManager.database')}</span>
                  <input className="field" value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} placeholder="mi_db" /></label>
              </>
            )}
            {form.db_type === 'sqlite' && (
              <label className="form-field" style={{ gridColumn: '1 / -1' }}><span className="label">{t('connectionManager.filePath')}</span>
                <input className="field" value={form.database} onChange={e => setForm({ ...form, database: e.target.value })} placeholder="/data/mi_bd.db" /></label>
            )}
          </div>
          <div className="conn-mgr__form-actions">
            <button type="button" className="btn primary btn-small" onClick={handleSave}>
              {editingId ? t('connectionManager.update') : t('connectionManager.save')}
            </button>
            <button type="button" className="btn ghost btn-small" onClick={resetForm}>{t('connectionManager.cancel')}</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="conn-mgr__list">
        {connections.map(conn => (
          <div key={conn.id} className="conn-mgr__item">
            <div className="conn-mgr__item-info">
              <div className="conn-mgr__item-name">
                <span className={`conn-mgr__db-badge conn-mgr__db-badge--${conn.db_type}`}>{dbTypeLabel(conn.db_type)}</span>
                {conn.name}
              </div>
              <div className="conn-mgr__item-detail">
                {conn.host && `${conn.host}:${conn.port}`}
                {conn.database && ` / ${conn.database}`}
                {conn.username && ` (${conn.username})`}
              </div>
              {testResults[conn.id] && (
                <div className={`conn-mgr__test-result ${testResults[conn.id].success ? 'ok' : 'err'}`}>
                  {testResults[conn.id].success ? '\u2713 ' : '\u2717 '}{testResults[conn.id].message}
                </div>
              )}
            </div>
            <div className="conn-mgr__item-actions">
              <button type="button" className="btn ghost btn-small" onClick={() => handleTest(conn.id)} disabled={testingId === conn.id}>
                {testingId === conn.id ? t('connectionManager.testing') : t('connectionManager.test')}
              </button>
              <button type="button" className="btn ghost btn-small" onClick={() => handleExplore(conn.id)} disabled={loadingTablesId === conn.id}>
                {loadingTablesId === conn.id ? t('connectionManager.loading') : t('connectionManager.explore')}
              </button>
              <button type="button" className="btn ghost btn-small" onClick={() => handleDelete(conn.id, conn.name)}>{t('connectionManager.delete')}</button>
            </div>

            {/* Tables explorer */}
            {exploringId === conn.id && (
              <div className="conn-mgr__explorer">
                <div className="conn-mgr__explorer-header">
                  <span className="conn-mgr__explorer-title">{t('connectionManager.tablesFound')} ({tables.length})</span>
                  <button type="button" className="btn ghost btn-small" onClick={() => { setExploringId(null); setTables([]); setSchemaView(null); setPreviewView(null) }}>{t('connectionManager.close')}</button>
                </div>
                {tables.length === 0 ? (
                  <p className="muted-text">{loadingTablesId === conn.id ? t('connectionManager.loading') : t('connectionManager.noTables')}</p>
                ) : (
                  <div className="conn-mgr__table-list">
                    {tables.map(tbl => (
                    <div key={tbl.name} className="conn-mgr__table-item">
                      <div className="conn-mgr__table-main">
                        <span className="conn-mgr__table-name">{tbl.name}</span>
                        {tbl.kind && <span className="conn-mgr__table-kind">{tbl.kind}</span>}
                        {typeof tbl.column_count === 'number' && <span className="conn-mgr__table-meta">{tbl.column_count} cols</span>}
                        {typeof tbl.row_count === 'number' && <span className="conn-mgr__table-meta">{tbl.row_count} rows</span>}
                      </div>
                      <div className="conn-mgr__table-actions">
                        <button type="button" className="btn ghost btn-small" onClick={() => handleViewSchema(tbl.name)}>{t('connectionManager.viewColumns')}</button>
                        <button type="button" className="btn ghost btn-small" onClick={() => handlePreview(tbl.name)}>{t('connectionManager.preview')}</button>
                        <button type="button" className="btn primary btn-small" onClick={() => handleImport(tbl.name)} disabled={importingTable === tbl.name}>
                          {importingTable === tbl.name ? t('connectionManager.importing') : t('connectionManager.importAsDataset')}
                        </button>
                      </div>
                      {schemaView?.table === tbl.name && (
                        <div className="conn-mgr__schema">
                          <table className="conn-mgr__schema-table">
                            <thead><tr><th>{t('connectionManager.column')}</th><th>{t('connectionManager.type')}</th><th>PK</th><th>{t('connectionManager.nullable')}</th><th>FK</th></tr></thead>
                            <tbody>
                              {schemaView.columns.map(col => (
                                <tr key={col.name}>
                                  <td><strong>{col.name}</strong></td>
                                  <td>{col.type}</td>
                                  <td>{col.is_primary_key ? '\u2713' : ''}</td>
                                  <td>{col.nullable ? '\u2713' : ''}</td>
                                  <td>{col.foreign_key || ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {previewView?.table === tbl.name && previewView.rows.length > 0 && (
                        <div className="conn-mgr__preview">
                          <table className="conn-mgr__schema-table">
                            <thead>
                              <tr>{previewView.columns.slice(0, 8).map(col => <th key={col}>{col}</th>)}</tr>
                            </thead>
                            <tbody>
                              {previewView.rows.slice(0, 5).map((row, idx) => (
                                <tr key={idx}>
                                  {previewView.columns.slice(0, 8).map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {connections.length === 0 && !showForm && (
          <p className="muted-text" style={{ textAlign: 'center', padding: '1rem' }}>
            {t('connectionManager.noConnections')}
          </p>
        )}
      </div>

      <style>{`
        .conn-mgr { display: flex; flex-direction: column; gap: 0.75rem; }
        .conn-mgr__header { display: flex; justify-content: space-between; align-items: center; }
        .conn-mgr__header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
        .conn-mgr__title { margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b; }
        .conn-mgr__subtitle { margin: 0.15rem 0 0; font-size: 0.76rem; color: #64748b; max-width: 36rem; }
        .conn-mgr__form { border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; background: #f8fafc; }
        .conn-mgr__hint { margin: 0 0 0.75rem; font-size: 0.76rem; color: #475569; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.55rem 0.7rem; }
        .conn-mgr__form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem; }
        .conn-mgr__form-actions { display: flex; gap: 0.5rem; }
        .conn-mgr__list { display: flex; flex-direction: column; gap: 0.5rem; }
        .conn-mgr__item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; background: #fff; }
        .conn-mgr__item-info { flex: 1; min-width: 0; }
        .conn-mgr__item-name { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
        .conn-mgr__item-detail { font-size: 0.78rem; color: #64748b; margin-top: 0.15rem; }
        .conn-mgr__item-actions { display: flex; gap: 0.3rem; margin-top: 0.5rem; }
        .conn-mgr__db-badge { font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; text-transform: uppercase; }
        .conn-mgr__db-badge--postgresql { background: #dbeafe; color: #1d4ed8; }
        .conn-mgr__db-badge--mysql { background: #fef3c7; color: #b45309; }
        .conn-mgr__db-badge--sqlite { background: #d1fae5; color: #047857; }
        .conn-mgr__db-badge--mssql { background: #f3e8ff; color: #7c3aed; }
        .conn-mgr__test-result { font-size: 0.75rem; margin-top: 0.25rem; padding: 0.2rem 0.4rem; border-radius: 4px; }
        .conn-mgr__test-result.ok { color: #166534; background: #dcfce7; }
        .conn-mgr__test-result.err { color: #991b1b; background: #fef2f2; }
        .conn-mgr__explorer { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; }
        .conn-mgr__explorer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .conn-mgr__explorer-title { font-size: 0.8rem; font-weight: 600; color: #475569; }
        .conn-mgr__table-list { display: flex; flex-direction: column; gap: 0.3rem; }
        .conn-mgr__table-item { border: 1px solid #f1f5f9; border-radius: 6px; padding: 0.5rem 0.75rem; background: #fafafa; }
        .conn-mgr__table-main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
        .conn-mgr__table-name { font-weight: 600; font-size: 0.82rem; font-family: monospace; }
        .conn-mgr__table-kind { font-size: 0.65rem; color: #94a3b8; margin-left: 0.3rem; }
        .conn-mgr__table-meta { font-size: 0.65rem; color: #475569; background: #e2e8f0; border-radius: 999px; padding: 0.1rem 0.4rem; }
        .conn-mgr__table-actions { display: flex; gap: 0.3rem; margin-top: 0.35rem; }
        .conn-mgr__schema, .conn-mgr__preview { margin-top: 0.5rem; overflow-x: auto; }
        .conn-mgr__schema-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
        .conn-mgr__schema-table th { text-align: left; padding: 0.25rem 0.5rem; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
        .conn-mgr__schema-table td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #f1f5f9; font-family: monospace; }
      `}</style>
    </div>
  )
}
