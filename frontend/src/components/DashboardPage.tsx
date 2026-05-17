import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, X, RefreshCw, LayoutDashboard } from 'lucide-react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { readToken } from '../lib/api'
import type { ApiEndpoint, DatasetMeta } from '../types/schemas'

type WidgetType = 'metric' | 'table' | 'chart'
type Aggregate = 'count' | 'avg' | 'sum'

interface WidgetConfig {
  id: string; type: WidgetType; title: string
  field?: string; aggregate?: Aggregate; refresh?: number
  datasetId?: string; method?: string; path?: string
}

interface MetricData { value: number; label: string }
interface TableData { cols: string[]; rows: Record<string, unknown>[] }
interface ChartData { labels: string[]; values: number[] }

const DS_KEY = 'doapi-dashboard'

function defaultWidgets(projectName: string, datasets?: DatasetMeta[]): WidgetConfig[] {
  if (!projectName.toLowerCase().includes('pok') || !datasets?.length) return []
  const pokemon = datasets.find(d => d.name.toLowerCase() === 'pokemon')
  const trainers = datasets.find(d => d.name.toLowerCase() === 'trainers')
  if (!pokemon) return []

  return [
    { id: 'w-pokemon-count', type: 'metric' as WidgetType, title: 'Total Pokémon', field: 'pokedex_id', aggregate: 'count' as Aggregate, datasetId: pokemon.id },
    { id: 'w-avg-level', type: 'metric' as WidgetType, title: 'Avg Level', field: 'level', aggregate: 'avg' as Aggregate, datasetId: pokemon.id },
    { id: 'w-types', type: 'chart' as WidgetType, title: 'Pokémon by Type', field: 'type', datasetId: pokemon.id },
    { id: 'w-regions', type: 'chart' as WidgetType, title: 'Pokémon by Region', field: 'region', datasetId: pokemon.id },
    { id: 'w-pokemon', type: 'table' as WidgetType, title: 'Pokémon List', datasetId: pokemon.id },
    ...(trainers ? [
      { id: 'w-trainer-count', type: 'metric' as WidgetType, title: 'Total Trainers', field: 'trainer_id', aggregate: 'count' as Aggregate, datasetId: trainers.id },
      { id: 'w-trainers', type: 'table' as WidgetType, title: 'Trainer List', datasetId: trainers.id },
    ] : []),
  ]
}

function findEndpoint(datasets: DatasetMeta[], endpoints: ApiEndpoint[], dsId?: string, opType = 'list'): { method: string; path: string } | null {
  if (!dsId) return null
  const ds = datasets.find(d => d.id === dsId)
  if (!ds) return null

  // Try exact match by targetDatasetId + operationType
  const exact = endpoints.find(e => e.targetDatasetId === dsId && e.operationType === opType)
  if (exact) return { method: exact.method, path: exact.path }

  // Try matching by dataset name in path (e.g. ds.name="pokemon", endpoint path="/pokemon")
  const byPath = endpoints.find(e => {
    const cleanPath = e.path.replace(/^\/+/, '').split('/')[0]
    return cleanPath.toLowerCase() === ds.name.toLowerCase() && (opType === 'list' ? e.operationType === 'list' || e.method === 'GET' : e.operationType === opType)
  })
  if (byPath) return { method: byPath.method, path: byPath.path }

  // Fallback: construct from dataset name
  return { method: 'GET', path: `/${ds.name.toLowerCase()}` }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { project, mockRunning, startMock, mockLoading } = useProjectBuilder()
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(DS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })

  // Regenerate defaults once project + datasets are loaded
  const defaultsGenerated = useRef(false)
  useEffect(() => {
    if (defaultsGenerated.current) return
    if (!project.name || !project.datasets.length) return
    const defaults = defaultWidgets(project.name, project.datasets)
    if (defaults.length > 0) {
      const saved = localStorage.getItem(DS_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return
        } catch {}
      }
      defaultsGenerated.current = true
      setWidgets(defaults)
      localStorage.setItem(DS_KEY, JSON.stringify(defaults))
    }
  }, [project.name, project.datasets.length])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [data, setData] = useState<Record<string, MetricData | TableData | ChartData>>({})
  const [editing, setEditing] = useState<WidgetConfig | null>(null)
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<WidgetType>('metric')
  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (project.authMethod === 'apikey' && project.apiKey) {
    headers['X-API-Key'] = project.apiKey
  }
  const mockBase = `${baseUrl}/api/mock/${project.remoteId || project.slug || project.id}`

  const saveWidgets = (w: WidgetConfig[]) => {
    setWidgets(w)
    localStorage.setItem(DS_KEY, JSON.stringify(w))
  }

  const fetchWidget = useCallback(async (w: WidgetConfig) => {
    if (!mockRunning) return
    const ep = findEndpoint(project.datasets, project.endpoints, w.datasetId)
    if (!ep) return

    setLoading(prev => ({ ...prev, [w.id]: true }))
    try {
      const path = ep.path.startsWith('/') ? ep.path : `/${ep.path}`
      const limit = w.type === 'table' ? 10 : 200
      const res = await fetch(`${mockBase}${path}?limit=${limit}`, { headers })
      if (!res.ok) { setLoading(prev => ({ ...prev, [w.id]: false })); return }
      const json = await res.json()
      const items = json.data ?? json ?? []
      const rows = Array.isArray(items) ? items : []

      if (w.type === 'metric') {
        const f = w.field
        const vals = f ? rows.map((r: Record<string, unknown>) => Number(r[f])).filter((n: number) => !isNaN(n)) : []
        const value = w.aggregate === 'avg'
          ? vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10 : 0
          : w.aggregate === 'sum'
            ? vals.reduce((a: number, b: number) => a + b, 0)
            : rows.length
        setData(prev => ({ ...prev, [w.id]: { value, label: w.title } as MetricData }))
      } else if (w.type === 'table') {
        const cols = rows.length ? Object.keys(rows[0]).slice(0, 6) : []
        setData(prev => ({ ...prev, [w.id]: { cols, rows: rows.slice(0, 10) } as TableData }))
      } else if (w.type === 'chart' && w.field) {
        const groups: Record<string, number> = {}
        rows.forEach((r: Record<string, unknown>) => {
          const v = String(r[w.field!] ?? 'unknown')
          groups[v] = (groups[v] || 0) + 1
        })
        const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10)
        setData(prev => ({ ...prev, [w.id]: { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) } as ChartData }))
      }
    } catch { /* ignore */ }
    setLoading(prev => ({ ...prev, [w.id]: false }))
  }, [project.datasets, project.endpoints, mockBase, headers])

  // Fetch widgets when mock server state changes
  useEffect(() => {
    if (!mockRunning) return
    widgets.forEach(w => fetchWidget(w))
  }, [mockRunning])

  // Set up periodic refresh intervals
  useEffect(() => {
    if (!mockRunning) return () => { Object.values(intervals.current).forEach(clearInterval) }
    widgets.forEach(w => {
      if (w.refresh && w.refresh > 0) {
        intervals.current[w.id] = setInterval(() => fetchWidget(w), w.refresh * 1000)
      }
    })
    return () => { Object.values(intervals.current).forEach(clearInterval) }
  }, [mockRunning, widgets, fetchWidget])

  const addWidget = () => {
    const dsId = project.datasets[0]?.id
    const w: WidgetConfig = {
      id: crypto.randomUUID(), type: newType,
      title: `${newType.charAt(0).toUpperCase() + newType.slice(1)} ${widgets.length + 1}`,
      datasetId: dsId,
      field: newType === 'chart' ? project.datasets[0]?.fields?.[0]?.name : undefined,
      aggregate: newType === 'metric' ? 'count' : undefined,
      refresh: 0,
    }
    saveWidgets([...widgets, w])
    setAdding(false)
  }

  const removeWidget = (id: string) => {
    saveWidgets(widgets.filter(w => w.id !== id))
    if (intervals.current[id]) clearInterval(intervals.current[id])
  }

  const updateWidget = (w: WidgetConfig) => {
    saveWidgets(widgets.map(x => x.id === w.id ? w : x))
    setEditing(null)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dash.title')}</h1>
          <p className="page-subtitle">{t('dash.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn ghost" onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Plus size={15} /> {t('dash.addWidget')}
          </button>
          <button type="button" className="btn ghost" onClick={() => widgets.forEach(fetchWidget)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <RefreshCw size={15} /> {t('dash.refresh')}
          </button>
        </div>
      </div>

      {!mockRunning && (
        <div className="info-card" style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.85rem', color: '#92400e' }}>{t('dash.mockRequired')}</span>
          <button type="button" className="btn primary btn-small" onClick={startMock} disabled={mockLoading}>
            {mockLoading ? t('dash.starting') : t('dash.startMock')}
          </button>
        </div>
      )}

      {widgets.length === 0 && (
        <div className="info-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <LayoutDashboard size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>{t('dash.empty')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {widgets.map(w => (
          <div key={w.id} className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>{w.title}</span>
              <button type="button" className="btn ghost" onClick={() => setEditing(w)} style={{ padding: '0.2rem' }}><Settings size={13} /></button>
              <button type="button" className="btn ghost" onClick={() => removeWidget(w.id)} style={{ padding: '0.2rem', color: 'var(--accent-red)' }}><X size={13} /></button>
            </div>
            <div style={{ padding: '0.75rem', minHeight: 100 }}>
              {loading[w.id] && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t('dash.loading')}</div>}
              {!loading[w.id] && w.type === 'metric' && renderMetric(data[w.id] as MetricData)}
              {!loading[w.id] && w.type === 'table' && renderTable(data[w.id] as TableData)}
              {!loading[w.id] && w.type === 'chart' && renderChart(data[w.id] as ChartData)}
              {!loading[w.id] && !data[w.id] && !mockRunning && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t('dash.mockRequired')}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem', width: 'min(400px, 90vw)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t('dash.addWidget')}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['metric', 'table', 'chart'] as WidgetType[]).map(tp => (
                <button key={tp} type="button" onClick={() => setNewType(tp)}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: newType === tp ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: newType === tp ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem',
                  }}>
                  {tp === 'metric' ? '#' : tp === 'table' ? '⊞' : '▤'}
                  <div style={{ marginTop: '0.2rem', fontSize: '0.75rem' }}>{tp.charAt(0).toUpperCase() + tp.slice(1)}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>{t('dash.cancel')}</button>
              <button type="button" className="btn primary" onClick={addWidget}>{t('dash.add')}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditWidgetModal
          widget={editing}
          datasets={project.datasets}
          onSave={updateWidget}
          onClose={() => setEditing(null)}
          t={t}
        />
      )}
    </div>
  )
}

function renderMetric(d: MetricData | undefined) {
  if (!d) return null
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1.1 }}>{d.value.toLocaleString()}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{d.label}</div>
    </div>
  )
}

function renderTable(d: TableData | undefined) {
  if (!d || !d.rows.length) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</div>
  return (
    <div style={{ overflowX: 'auto', fontSize: '0.78rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            {d.cols.map(col => (
              <th key={col} style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {d.cols.map(col => (
                <td key={col} style={{ padding: '0.25rem 0.4rem', color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                  {String(row[col] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderChart(d: ChartData | undefined) {
  if (!d || !d.labels.length) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</div>
  const max = Math.max(...d.values, 1)
  const colors = ['var(--accent-blue)', 'var(--accent-sky)', 'var(--accent-indigo)', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
  return (
    <div style={{ padding: '0.25rem 0' }}>
      {d.labels.map((label, i) => {
        const pct = (d.values[i] / max) * 100
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
            <span style={{ minWidth: 70, fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(pct, 3)}%`, height: '100%',
                background: colors[i % colors.length],
                borderRadius: 4, transition: 'width 0.3s ease',
                display: 'flex', alignItems: 'center', paddingLeft: '0.35rem',
              }}>
                <span style={{ color: '#fff', fontSize: '0.68rem', fontWeight: 700 }}>{d.values[i]}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EditWidgetModal({ widget, datasets, onSave, onClose, t }: {
  widget: WidgetConfig; datasets: DatasetMeta[]
  onSave: (w: WidgetConfig) => void; onClose: () => void; t: (k: string) => string
}) {
  const [w, setW] = useState<WidgetConfig>({ ...widget })
  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem', width: 'min(420px, 90vw)', border: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t('dash.configure')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
            {t('dash.titleLabel')}
            <input value={w.title} onChange={e => setW({ ...w, title: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box', marginTop: '0.25rem' }} />
          </label>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
            {t('dash.dataset')}
            <select value={w.datasetId || ''} onChange={e => setW({ ...w, datasetId: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name} ({d.fields.length} fields)</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
            {t('dash.field')}
            <select value={w.field || ''} onChange={e => setW({ ...w, field: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              <option value="">—</option>
              {datasets.find(d => d.id === w.datasetId)?.fields.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
          {w.type === 'metric' && (
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
              {t('dash.aggregate')}
              <select value={w.aggregate || 'count'} onChange={e => setW({ ...w, aggregate: e.target.value as Aggregate })}
                style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                <option value="count">Count</option>
                <option value="avg">Average</option>
                <option value="sum">Sum</option>
              </select>
            </label>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button type="button" className="btn ghost" onClick={onClose}>{t('dash.cancel')}</button>
          <button type="button" className="btn primary" onClick={() => onSave(w)}>{t('dash.save')}</button>
        </div>
      </div>
    </div>
  )
}
