import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Table2, Activity, Plus, Settings, X, GripVertical, RefreshCw, ChevronDown, LayoutDashboard } from 'lucide-react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { readToken } from '../lib/api'
import type { DatasetMeta, ApiEndpoint } from '../types/schemas'

type WidgetType = 'metric' | 'table' | 'chart'
type ChartField = string
type Aggregate = 'count' | 'avg' | 'sum'

interface WidgetConfig {
  id: string
  type: WidgetType
  title: string
  endpointId?: string
  field?: string
  aggregate?: Aggregate
  refresh?: number
  datasetId?: string
}

interface MetricData { value: number; label: string; change?: number }
interface TableData { cols: string[]; rows: Record<string, unknown>[] }
interface ChartData { labels: string[]; values: number[] }

const WIDGET_PRESETS: { type: WidgetType; label: string; icon: string }[] = [
  { type: 'metric', label: 'Metric', icon: '#' },
  { type: 'table', label: 'Table', icon: '⊞' },
  { type: 'chart', label: 'Chart', icon: '▤' },
]

function useDashboard() {
  const key = 'doapi-dashboard'
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') }
    catch { return [] }
  })
  const save = (w: WidgetConfig[]) => {
    setWidgets(w)
    localStorage.setItem(key, JSON.stringify(w))
  }
  return { widgets, save }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { project } = useProjectBuilder()
  const { widgets, save } = useDashboard()
  const [editing, setEditing] = useState(false)
  const [editWidget, setEditWidget] = useState<WidgetConfig | null>(null)
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<WidgetType>('metric')
  const [data, setData] = useState<Record<string, MetricData | TableData | ChartData>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const mockBase = `${baseUrl}/api/mock/${project.remoteId || project.slug || project.id}`

  const findEndpoint = (dsId?: string) =>
    project.endpoints.find(e => (dsId ? e.targetDatasetId === dsId : true) && e.operationType === 'list')

  const fetchWidget = useCallback(async (w: WidgetConfig) => {
    setLoading(prev => ({ ...prev, [w.id]: true }))
    try {
      const ep = w.endpointId
        ? project.endpoints.find(e => e.id === w.endpointId)
        : findEndpoint(w.datasetId)

      if (!ep) { setLoading(prev => ({ ...prev, [w.id]: false })); return }

      const path = ep.path.startsWith('/') ? ep.path : `/${ep.path}`
      const res = await fetch(`${mockBase}${path}?limit=100`, { headers })
      if (!res.ok) { setLoading(prev => ({ ...prev, [w.id]: false })); return }
      const json = await res.json()
      const items = json.data ?? json ?? []
      const rows = Array.isArray(items) ? items : []

      if (w.type === 'metric') {
        const f = w.field || 'id'
        const vals = rows.map((r: Record<string, unknown>) => Number(r[f])).filter((n: number) => !isNaN(n))
        const value = w.aggregate === 'avg'
          ? (vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length * 10) / 10 : 0)
          : w.aggregate === 'sum'
            ? vals.reduce((a: number, b: number) => a + b, 0)
            : rows.length
        setData(prev => ({ ...prev, [w.id]: { value, label: w.title, change: 0 } as MetricData }))
      } else if (w.type === 'table') {
        const cols = rows.length ? Object.keys(rows[0]).slice(0, 6) : []
        setData(prev => ({ ...prev, [w.id]: { cols, rows: rows.slice(0, 10) } as TableData }))
      } else if (w.type === 'chart') {
        const f = w.field
        const groups: Record<string, number> = {}
        if (f) {
          rows.forEach((r: Record<string, unknown>) => {
            const v = String(r[f] ?? 'unknown')
            groups[v] = (groups[v] || 0) + 1
          })
        } else {
          groups['Total'] = rows.length
        }
        const labels = Object.keys(groups).slice(0, 10)
        const values = labels.map(l => groups[l])
        setData(prev => ({ ...prev, [w.id]: { labels, values } as ChartData }))
      }
    } catch { /* ignore */ }
    setLoading(prev => ({ ...prev, [w.id]: false }))
  }, [project.endpoints, mockBase, headers])

  useEffect(() => {
    widgets.forEach(w => {
      fetchWidget(w)
      if (w.refresh && w.refresh > 0) {
        intervals.current[w.id] = setInterval(() => fetchWidget(w), w.refresh * 1000)
      }
    })
    return () => { Object.values(intervals.current).forEach(clearInterval) }
  }, [widgets, fetchWidget])

  const addWidget = () => {
    const dsId = project.datasets[0]?.id
    const ep = findEndpoint(dsId)
    const w: WidgetConfig = {
      id: crypto.randomUUID(),
      type: newType,
      title: `${newType.charAt(0).toUpperCase() + newType.slice(1)} ${widgets.length + 1}`,
      datasetId: dsId,
      endpointId: ep?.id,
      field: newType === 'chart' ? project.datasets[0]?.fields?.[0]?.name : undefined,
      aggregate: newType === 'metric' ? 'count' : undefined,
      refresh: 0,
    }
    save([...widgets, w])
    setAdding(false)
  }

  const removeWidget = (id: string) => {
    save(widgets.filter(w => w.id !== id))
    if (intervals.current[id]) clearInterval(intervals.current[id])
  }

  const updateWidget = (w: WidgetConfig) => {
    save(widgets.map(x => x.id === w.id ? w : x))
    setEditWidget(null)
    setEditing(false)
  }

  const ds = project.datasets

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

      {widgets.length === 0 && (
        <div className="info-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <LayoutDashboard size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>{t('dash.empty')}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {widgets.map(w => (
          <div key={w.id} className="info-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem',
              borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>{w.title}</span>
              <button type="button" className="btn ghost" onClick={() => setEditWidget(w)} style={{ padding: '0.2rem' }}>
                <Settings size={13} />
              </button>
              <button type="button" className="btn ghost" onClick={() => removeWidget(w.id)} style={{ padding: '0.2rem', color: 'var(--accent-red)' }}>
                <X size={13} />
              </button>
            </div>
            <div style={{ padding: '0.75rem', minHeight: 100 }}>
              {loading[w.id] && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t('dash.loading')}</div>
              )}
              {!loading[w.id] && w.type === 'metric' && renderMetric(data[w.id] as MetricData)}
              {!loading[w.id] && w.type === 'table' && renderTable(data[w.id] as TableData)}
              {!loading[w.id] && w.type === 'chart' && renderChart(data[w.id] as ChartData)}
              {!loading[w.id] && !data[w.id] && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{t('dash.noData')}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Widget Modal */}
      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem', width: 'min(400px, 90vw)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t('dash.addWidget')}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {WIDGET_PRESETS.map(p => (
                <button key={p.type} type="button" onClick={() => setNewType(p.type)}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: newType === p.type ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: newType === p.type ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem',
                  }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{p.icon}</div>
                  {p.label}
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

      {/* Edit Widget Modal */}
      {editWidget && (
        <EditWidgetModal
          widget={editWidget}
          datasets={ds}
          endpoints={project.endpoints}
          onSave={updateWidget}
          onClose={() => setEditWidget(null)}
          t={t}
        />
      )}

      <style>{`
        .modal-overlay { animation: fadeIn 0.15s ease; }
        .modal-content { animation: slideUp 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

function renderMetric(d: MetricData | undefined) {
  if (!d) return null
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-blue)', lineHeight: 1.1 }}>{d.value.toLocaleString()}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{d.label}</div>
      {d.change !== undefined && (
        <div style={{ fontSize: '0.78rem', color: d.change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '0.25rem' }}>
          {d.change >= 0 ? '+' : ''}{d.change}%
        </div>
      )}
    </div>
  )
}

function renderTable(d: TableData | undefined) {
  if (!d || !d.rows.length) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No data</div>
  return (
    <div style={{ overflowX: 'auto', fontSize: '0.78rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            {d.cols.map(col => (
              <th key={col} style={{ padding: '0.35rem 0.5rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {d.cols.map(col => (
                <td key={col} style={{ padding: '0.3rem 0.5rem', color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  if (!d || !d.labels.length) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No data</div>
  const max = Math.max(...d.values, 1)
  return (
    <div style={{ padding: '0.5rem 0' }}>
      {d.labels.map((label, i) => {
        const pct = (d.values[i] / max) * 100
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ minWidth: 80, fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 22, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: `linear-gradient(90deg, var(--accent-blue), ${i % 2 === 0 ? 'var(--accent-sky)' : 'var(--accent-indigo)'})`,
                borderRadius: 4, transition: 'width 0.3s ease', display: 'flex', alignItems: 'center', paddingLeft: '0.4rem',
                minWidth: pct > 10 ? undefined : 0,
              }}>
                {pct > 10 && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{d.values[i]}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EditWidgetModal({ widget, datasets, endpoints, onSave, onClose, t }: {
  widget: WidgetConfig; datasets: DatasetMeta[]; endpoints: ApiEndpoint[]
  onSave: (w: WidgetConfig) => void; onClose: () => void; t: (k: string) => string
}) {
  const [w, setW] = useState<WidgetConfig>({ ...widget })
  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '1.5rem', width: 'min(420px, 90vw)', border: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{t('dash.configure')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{t('dash.titleLabel')}</label>
            <input value={w.title} onChange={e => setW({ ...w, title: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{t('dash.dataset')}</label>
            <select value={w.datasetId || ''} onChange={e => setW({ ...w, datasetId: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {(w.type === 'chart') && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{t('dash.field')}</label>
              <select value={w.field || ''} onChange={e => setW({ ...w, field: e.target.value })}
                style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                {datasets.find(d => d.id === w.datasetId)?.fields.map((f: { id: string; name: string }) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          {w.type === 'metric' && (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{t('dash.aggregate')}</label>
              <select value={w.aggregate || 'count'} onChange={e => setW({ ...w, aggregate: e.target.value as Aggregate })}
                style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                <option value="count">Count</option>
                <option value="avg">Average</option>
                <option value="sum">Sum</option>
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>{t('dash.refresh')}</label>
            <select value={w.refresh || 0} onChange={e => setW({ ...w, refresh: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
              <option value={0}>{t('dash.manual')}</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1min</option>
              <option value={300}>5min</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button type="button" className="btn ghost" onClick={onClose}>{t('dash.cancel')}</button>
          <button type="button" className="btn primary" onClick={() => onSave(w)}>{t('dash.save')}</button>
        </div>
      </div>
    </div>
  )
}
