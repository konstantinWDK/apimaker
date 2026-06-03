import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, BarChart3, Clock, RefreshCw, AlertTriangle, Terminal, Table2 } from 'lucide-react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { apiFetch } from '../lib/api'

interface LogEntry {
  id: string
  event_type: string
  method: string
  path: string
  status_code: number
  duration_ms: number
  message: string
  source: string
  created_at: string
}

interface EndpointSummary {
  method: string
  path: string
  count: number
  errors: number
  avg_duration_ms: number
}

interface Summary {
  total_requests: number
  error_count: number
  error_rate: number
  avg_duration_ms: number
  max_duration_ms: number
  by_endpoint: EndpointSummary[]
  since_minutes: number
}

type ViewMode = 'console' | 'table'

function methodColor(method: string) {
  const map: Record<string, string> = {
    GET: '#22c55e', POST: '#3b82f6',
    PUT: '#f59e0b', PATCH: '#f59e0b', DELETE: '#ef4444',
  }
  return map[method] || '#64748b'
}

function statusColor(code: number) {
  if (code >= 500) return '#ef4444'
  if (code >= 400) return '#f59e0b'
  if (code >= 300) return '#3b82f6'
  return '#22c55e'
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export function MonitorPage() {
  const { t } = useTranslation()
  const { project } = useProjectBuilder()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterMethod, setFilterMethod] = useState('')
  const [sinceMinutes, setSinceMinutes] = useState(60)
  const [viewMode, setViewMode] = useState<ViewMode>('console')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const prevLogsLen = useRef(0)

  const projectId = project.remoteId || project.slug || project.id

  const fetchData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ since_minutes: String(sinceMinutes), per_page: '200' })
      if (filterMethod) params.set('method', filterMethod)

      const [logsRes, summaryRes] = await Promise.all([
        apiFetch(`/projects/${projectId}/monitor/logs?${params}`).then(r => r.json()),
        apiFetch(`/projects/${projectId}/monitor/summary?since_minutes=${sinceMinutes}`).then(r => r.json()),
      ])
      setLogs(logsRes.logs || [])
      setSummary(summaryRes)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId, sinceMinutes, filterMethod])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 10000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  useEffect(() => {
    if (viewMode === 'console' && logs.length > prevLogsLen.current) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLogsLen.current = logs.length
  }, [logs.length, viewMode])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('monitor.title')}</h1>
          <p className="page-subtitle">{t('monitor.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="view-toggle" style={{ display: 'flex', gap: '0.15rem', background: 'var(--bg-tertiary)', borderRadius: 8, padding: '0.15rem' }}>
            <button
              type="button"
              className={`view-toggle__btn ${viewMode === 'console' ? 'active' : ''}`}
              onClick={() => setViewMode('console')}
              style={{
                padding: '0.3rem 0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'console' ? 'var(--bg-secondary)' : 'transparent',
                color: viewMode === 'console' ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              <Terminal size={13} /> Console
            </button>
            <button
              type="button"
              className={`view-toggle__btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.3rem 0.6rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--bg-secondary)' : 'transparent',
                color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              <Table2 size={13} /> Table
            </button>
          </div>
          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          >
            <option value="">{t('monitor.allMethods')}</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select
            value={sinceMinutes}
            onChange={e => setSinceMinutes(Number(e.target.value))}
            style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          >
            <option value={15}>{t('monitor.last15min')}</option>
            <option value={60}>{t('monitor.lastHour')}</option>
            <option value={360}>{t('monitor.last6hours')}</option>
            <option value={1440}>{t('monitor.last24hours')}</option>
          </select>
          <button type="button" className="btn ghost" onClick={fetchData} disabled={loading} style={{ padding: '0.3rem 0.5rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="info-card" style={{ textAlign: 'center' }}>
            <Activity size={20} style={{ color: 'var(--accent-blue)', marginBottom: '0.25rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.total_requests}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('monitor.totalRequests')}</div>
          </div>
          <div className="info-card" style={{ textAlign: 'center' }}>
            <BarChart3 size={20} style={{ color: summary.error_rate > 5 ? 'var(--accent-red)' : 'var(--accent-green)', marginBottom: '0.25rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.error_rate}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('monitor.errorRate')}</div>
          </div>
          <div className="info-card" style={{ textAlign: 'center' }}>
            <Clock size={20} style={{ color: 'var(--accent-indigo)', marginBottom: '0.25rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.avg_duration_ms}ms</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('monitor.avgDuration')}</div>
          </div>
          <div className="info-card" style={{ textAlign: 'center' }}>
            <AlertTriangle size={20} style={{ color: summary.error_count > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', marginBottom: '0.25rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.error_count}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('monitor.errors')}</div>
          </div>
        </div>
      )}

      {viewMode === 'console' ? (
        <>
          {logs.length === 0 ? (
            <div className="info-card" style={{ background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 10, padding: '1rem' }}>
              <p className="muted-text" style={{ textAlign: 'center', padding: '2rem', fontFamily: 'monospace', color: '#64748b' }}>{t('monitor.noLogs')}</p>
            </div>
          ) : (
            <div
              className="monitor-console"
              style={{
                background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden',
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: '0.78rem',
                lineHeight: 1.7,
              }}
            >
              <div style={{ padding: '0.5rem 1rem', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Terminal size={13} />
                <span>{t('monitor.consoleLog')}</span>
                <span style={{ marginLeft: 'auto', color: '#475569' }}>{logs.length} entries</span>
              </div>
              <div style={{ padding: '0.5rem 0', maxHeight: '60vh', overflowY: 'auto' }}>
                {logs.map(log => (
                  <div
                    key={log.id}
                    className="monitor-console__line"
                    style={{
                      padding: '0.1rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: log.source === 'telemetry' ? '#6366f1' : '#475569', minWidth: '4.5rem', flexShrink: 0, fontSize: '0.72rem' }}>
                      {fmtTime(log.created_at)}
                    </span>
                    <span style={{
                      fontWeight: 700, fontSize: '0.72rem', minWidth: '3rem', textAlign: 'center',
                      color: methodColor(log.method), flexShrink: 0,
                    }}>
                      {log.method}
                    </span>
                    <span style={{ color: statusColor(log.status_code), fontWeight: 700, minWidth: '1.8rem', textAlign: 'right', flexShrink: 0 }}>
                      {log.status_code}
                    </span>
                    <span style={{ color: '#e2e8f0', minWidth: '3.5rem', textAlign: 'right', flexShrink: 0, fontSize: '0.72rem' }}>
                      {log.duration_ms}ms
                    </span>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 600, padding: '0.08rem 0.3rem', borderRadius: 3,
                      background: log.source === 'telemetry' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)',
                      color: log.source === 'telemetry' ? '#818cf8' : '#4ade80',
                      flexShrink: 0, textTransform: 'uppercase',
                    }}>
                      {log.source === 'telemetry' ? 'RMT' : 'LCL'}
                    </span>
                    <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.path}
                    </span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {summary && summary.by_endpoint.length > 0 && (
            <div className="info-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t('monitor.byEndpoint')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {summary.by_endpoint.map((ep, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < summary.by_endpoint.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: 4,
                      background: methodColor(ep.method), color: '#fff', minWidth: 48, textAlign: 'center',
                    }}>{ep.method}</span>
                    <code style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{ep.path}</code>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>{ep.count}x</span>
                    <span style={{ fontSize: '0.78rem', color: ep.errors > 0 ? 'var(--accent-red)' : 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{ep.errors > 0 ? `${ep.errors} err` : ''}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>{ep.avg_duration_ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="info-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t('monitor.recentRequests')}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('monitor.autoRefresh')}</span>
            </div>
            {logs.length === 0 ? (
              <p className="muted-text" style={{ textAlign: 'center', padding: '2rem' }}>{t('monitor.noLogs')}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.source')}</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.method')}</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.path')}</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.status')}</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.duration')}</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t('monitor.time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: 3,
                            background: log.source === 'telemetry' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)',
                            color: log.source === 'telemetry' ? '#818cf8' : '#4ade80',
                          }}>
                            {log.source === 'telemetry' ? t('monitor.remote') : t('monitor.local')}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.35rem', borderRadius: 3,
                            background: methodColor(log.method), color: '#fff',
                          }}>{log.method}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{log.path}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ color: statusColor(log.status_code), fontWeight: 700 }}>{log.status_code}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{log.duration_ms}ms</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {fmtTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .monitor-console__line:hover { background: rgba(255,255,255,0.03); }
        .monitor-console::-webkit-scrollbar { width: 6px; }
        .monitor-console::-webkit-scrollbar-track { background: #0a0f1c; }
        .monitor-console::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        .view-toggle__btn { transition: all 0.12s; }
      `}</style>
    </div>
  )
}
