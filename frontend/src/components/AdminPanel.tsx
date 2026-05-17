import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Search, X, ChevronLeft, ChevronRight, Save, Database } from 'lucide-react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { readToken } from '../lib/api'
import type { FieldType } from '../types/schemas'

interface RecordData { _id?: string; id?: string; [key: string]: unknown }

function getMockEndpoint(dsName: string, endpoints: { path: string; method: string; operationType?: string; targetDatasetId?: string }[], opType: string): { method: string; path: string } | null {
  const byOp = endpoints.find(e => e.operationType === opType)
  if (byOp) return { method: byOp.method, path: byOp.path }
  const byMethod = endpoints.find(e => e.method === (opType === 'list' || opType === 'get' ? 'GET' : opType === 'create' ? 'POST' : opType === 'update' ? 'PUT' : 'DELETE'))
  if (byMethod) return { method: byMethod.method, path: byMethod.path }
  const guess = opType === 'list' || opType === 'create' ? '' : '/{id}'
  return { method: opType === 'list' ? 'GET' : opType === 'create' ? 'POST' : opType === 'update' ? 'PUT' : 'DELETE', path: `/${dsName.toLowerCase()}${guess}` }
}

function fieldInput(type: FieldType, value: unknown, onChange: (v: unknown) => void) {
  const common = {
    style: {
      width: '100%', padding: '0.45rem 0.6rem', borderRadius: 6,
      border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
      color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' as const,
    },
  }
  switch (type) {
    case 'boolean':
      return <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
    case 'integer':
      return <input {...common} type="number" step="1" value={value as string ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')} />
    case 'float':
      return <input {...common} type="number" step="0.01" value={value as string ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')} />
    case 'datetime':
      return <input {...common} type="datetime-local" value={typeof value === 'string' ? value.slice(0, 16) : (value as string ?? '')}
        onChange={e => onChange(e.target.value ? `${e.target.value}:00Z` : '')} />
    default:
      return <input {...common} type="text" value={value as string ?? ''}
        onChange={e => onChange(e.target.value)} />
  }
}

export function AdminPanel() {
  const { t } = useTranslation()
  const { project, mockRunning, startMock, mockLoading } = useProjectBuilder()
  const [selectedDsId, setSelectedDsId] = useState('')
  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState<RecordData | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const pageSize = 15

  const ds = project.datasets.find(d => d.id === selectedDsId)
  const fields = ds?.fields ?? []

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const mockBase = `${baseUrl}/api/mock/${project.remoteId || project.slug || project.id}`

  const fetchRecords = useCallback(async () => {
    if (!ds || !project.remoteId && !project.slug) return
    if (!mockRunning) return
    setLoading(true)
    try {
      const ep = getMockEndpoint(ds.name, project.endpoints, 'list')
      if (!ep) { setLoading(false); return }
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (search) params.set('name', search)
      const res = await fetch(`${mockBase}${ep.path}?${params}`, { headers })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      const items = data.data ?? data ?? []
      setRecords(Array.isArray(items) ? items : [])
      setTotal(data.total ?? items.length ?? 0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [ds, project.remoteId, project.slug, page, search, mockBase, headers, mockRunning])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  useEffect(() => {
    setSelectedDsId(prev => prev || project.datasets[0]?.id || '')
  }, [project.datasets])

  const filteredRecords = useMemo(() => {
    if (!search) return records
    const q = search.toLowerCase()
    return records.filter(r => fields.some(f => String(r[f.name] ?? '').toLowerCase().includes(q)))
  }, [records, search, fields])

  const totalPages = Math.ceil(total / pageSize)

  const openNew = () => {
    const init: Record<string, unknown> = {}
    fields.forEach(f => { init[f.name] = f.type === 'boolean' ? false : f.defaultValue ?? (f.type === 'integer' || f.type === 'float' ? '' : '') })
    setFormData(init); setEditRecord(null); setShowForm(true)
  }

  const openEdit = (rec: RecordData) => {
    const data: Record<string, unknown> = {}
    fields.forEach(f => { data[f.name] = rec[f.name] ?? '' })
    setFormData(data); setEditRecord(rec); setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const ep = editRecord ? getMockEndpoint(ds?.name || '', project.endpoints, 'update') : getMockEndpoint(ds?.name || '', project.endpoints, 'create')
      if (!ep) { setSaving(false); return }
      const rid = editRecord?._id || editRecord?.id
      const path = rid ? ep.path.replace('{id}', String(rid)) : ep.path
      const res = await fetch(`${mockBase}${path}`, {
        method: editRecord ? 'PUT' : 'POST', headers, body: JSON.stringify(formData),
      })
      if (res.ok) { setShowForm(false); fetchRecords() }
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleDelete = async (rec: RecordData) => {
    if (!window.confirm(t('admin.deleteConfirm'))) return
    try {
      const ep = getMockEndpoint(ds?.name || '', project.endpoints, 'delete')
      if (!ep) return
      const rid = rec._id || rec.id
      await fetch(`${mockBase}${ep.path.replace('{id}', String(rid))}`, { method: 'DELETE', headers })
      fetchRecords()
    } catch { /* ignore */ }
  }

  const setFormField = (name: string, value: unknown) => setFormData(prev => ({ ...prev, [name]: value }))

  if (!project.datasets.length) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('admin.title')}</h1>
          <p className="page-subtitle">{t('admin.noDatasets')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Database size={28} style={{ color: 'var(--accent-indigo)' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{t('admin.title')}</h1>
            <p className="page-subtitle" style={{ margin: '0.15rem 0 0' }}>{t('admin.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={selectedDsId} onChange={e => { setSelectedDsId(e.target.value); setPage(1); setSearch('') }}
            style={{
              padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
            }}>
            {project.datasets.map(d => (
              <option key={d.id} value={d.id}>{d.name} · {d.fields.length} fields</option>
            ))}
          </select>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('admin.search')}
              style={{ padding: '0.4rem 0.75rem 0.4rem 2rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem', width: 180 }} />
          </div>
          <button type="button" className="btn primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={15} /> {t('admin.newRecord')}
          </button>
        </div>
      </div>

      {!mockRunning && (
        <div className="info-card" style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', color: '#92400e' }}>{t('admin.mockRequired')}</span>
          <button type="button" className="btn primary btn-small" onClick={startMock} disabled={mockLoading}>
            {mockLoading ? t('admin.starting') : t('admin.startMock')}
          </button>
        </div>
      )}

      <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('admin.loading')}</div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{search ? t('admin.noSearchResults') : t('admin.noRecords')}</p>
            {!search && <button type="button" className="btn primary btn-small" onClick={openNew} style={{ marginTop: '0.5rem' }}>+ {t('admin.newRecord')}</button>}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    {fields.slice(0, 7).map(f => (
                      <th key={f.id} style={{
                        padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
                        color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', whiteSpace: 'nowrap',
                      }}>
                        {f.name}{f.required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
                      </th>
                    ))}
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', width: 80 }}>{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec, i) => (
                    <tr key={rec._id ?? rec.id ?? i} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {fields.slice(0, 7).map(f => (
                        <td key={f.id} style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.type === 'boolean'
                            ? <span style={{ color: rec[f.name] ? 'var(--accent-green)' : 'var(--text-muted)' }}>{rec[f.name] ? '✓' : '—'}</span>
                            : f.type === 'datetime'
                              ? typeof rec[f.name] === 'string' ? new Date(rec[f.name] as string).toLocaleDateString() : (rec[f.name] as string ?? '—')
                              : String(rec[f.name] ?? '—')}
                        </td>
                      ))}
                      <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn ghost" onClick={() => openEdit(rec)} style={{ padding: '0.25rem 0.4rem' }} title={t('admin.edit')}>
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="btn ghost" onClick={() => handleDelete(rec)} style={{ padding: '0.25rem 0.4rem', color: 'var(--accent-red)' }} title={t('admin.delete')}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{total} {t('admin.totalRecords')}</span>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.25rem 0.5rem' }}><ChevronLeft size={14} /></button>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600, padding: '0 0.5rem' }}>{page} / {totalPages || 1}</span>
                <button type="button" className="btn ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '0.25rem 0.5rem' }}><ChevronRight size={14} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem',
            width: 'min(520px, 90vw)', maxHeight: '80vh', overflow: 'auto',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{editRecord ? t('admin.editRecord') : t('admin.newRecord')}</h2>
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)} style={{ padding: '0.25rem' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {fields.map(f => (
                <div key={f.id}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {f.name}{f.required && <span style={{ color: 'var(--accent-red)', marginLeft: 2 }}>*</span>}
                  </label>
                  {fieldInput(f.type, formData[f.name], v => setFormField(f.name, v))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>{t('admin.cancel')}</button>
              <button type="button" className="btn primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Save size={14} /> {saving ? t('admin.saving') : t('admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
