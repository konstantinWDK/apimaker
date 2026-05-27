import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Save, Terminal, Plus, Trash2, ChevronRight, ChevronDown, Clock, Bookmark, FileJson, Code2 } from 'lucide-react'
import type { ProjectDraft } from '../types/schemas'
import { readBackendConfig } from '../lib/backendConfig'

interface Props {
  project: ProjectDraft
  mockRunning: boolean
  onStartMock: () => Promise<void>
  mockLoading?: boolean
  mockError?: string | null
  selectedDatasetId?: string
  deploymentBaseUrl?: string | null
}

interface ApiResponse { url: string; status: number; body: unknown; method: string; time: number; size: number }
interface KvRow { key: string; value: string; enabled: boolean }
interface SavedQuery { id: string; name: string; method: string; path: string; body: string; params: KvRow[]; headers: KvRow[]; collection: string }
interface HistoryEntry { id: string; method: string; path: string; status: number; duration: number; timestamp: string }

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const METHOD_COLORS: Record<string, string> = { GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444' }
type ResponseView = 'pretty' | 'raw'
function emptyKv(): KvRow { return { key: '', value: '', enabled: true } }

export function ApiPlayground({ project, mockRunning, onStartMock, mockLoading, selectedDatasetId, deploymentBaseUrl }: Props) {
  const { t } = useTranslation()
  const backendConfig = readBackendConfig()
  const backendBaseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const effectiveId = project.slug || project.remoteId || project.id
  const mockBase = deploymentBaseUrl || `${backendBaseUrl}/api/mock/${effectiveId}`

  const endpoints = useMemo(() =>
    selectedDatasetId
      ? project.endpoints.filter(ep => !ep.targetDatasetId || ep.targetDatasetId === selectedDatasetId)
      : project.endpoints,
    [project.endpoints, selectedDatasetId]
  )

  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [body, setBody] = useState('')
  const [params, setParams] = useState<KvRow[]>([emptyKv()])
  const [headers, setHeaders] = useState<KvRow[]>([{ key: 'Content-Type', value: 'application/json', enabled: true }])
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params')
  const [respView, setRespView] = useState<ResponseView>('pretty')

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => {
    try { return JSON.parse(localStorage.getItem('doapi-queries') || '[]') } catch { return [] }
  })
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('doapi-history') || '[]') } catch { return [] }
  })
  const [queryName, setQueryName] = useState('')
  const [collection, setCollection] = useState('Default')
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [histOpen, setHistOpen] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [sidebarOpen] = useState(true)

  const authKey = project.authMethod === 'apikey' ? 'X-API-Key' : project.authMethod === 'jwt' ? 'Authorization' : null
  const authVal = project.authMethod === 'apikey' ? (project.apiKey || '') : ''

  useEffect(() => {
    if (!authKey) return
    setHeaders(prev => prev.some(h => h.key === authKey) ? prev : [{ key: authKey, value: authVal, enabled: true }, ...prev])
  }, [project.id])

  useEffect(() => {
    if (endpoints.length > 0 && !url) {
      const ep = endpoints[0]
      setMethod(ep.method)
      setUrl(ep.path)
      setBody(ep.method === 'POST' || ep.method === 'PUT' ? '{\n  \n}' : '')
    }
  }, [endpoints, url])

  const buildFullUrl = useCallback(() => {
    let fullUrl = mockBase + (url.startsWith('/') ? url : `/${url}`)
    const active = params.filter(p => p.key && p.enabled)
    if (active.length) fullUrl += '?' + active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    return fullUrl
  }, [url, params, mockBase])

  const execute = useCallback(async (m?: string, p?: string, b?: string) => {
    const execMethod = m || method
    const execPath = p || url
    const execBody = b !== undefined ? b : body
    const execUrl = mockBase + (execPath.startsWith('/') ? execPath : `/${execPath}`) + (
      params.filter(p2 => p2.key && p2.enabled).length
        ? '?' + params.filter(p2 => p2.key && p2.enabled).map(p2 => `${encodeURIComponent(p2.key)}=${encodeURIComponent(p2.value)}`).join('&')
        : ''
    )
    setLoading(true)
    const start = performance.now()
    try {
      const h: Record<string, string> = {}
      headers.filter(hh => hh.key && hh.enabled).forEach(hh => { h[hh.key] = hh.value })
      const res = await fetch(execUrl, {
        method: execMethod,
        headers: h,
        body: ['POST', 'PUT', 'PATCH'].includes(execMethod) ? execBody || undefined : undefined,
      })
      const text = await res.text()
      const duration = Math.round(performance.now() - start)
      let parsed = text
      try { parsed = JSON.stringify(JSON.parse(text), null, 2) } catch {}
      setResponse({ url: execUrl, status: res.status, body: parsed, method: execMethod, time: duration, size: text.length })
      const entry: HistoryEntry = { id: crypto.randomUUID(), method: execMethod, path: execPath, status: res.status, duration, timestamp: new Date().toISOString() }
      setHistory(prev => {
        const next = [entry, ...prev].slice(0, 50)
        localStorage.setItem('doapi-history', JSON.stringify(next)); return next
      })
    } catch {
      setResponse({ url: execUrl, status: 0, body: 'Connection error', method: execMethod, time: 0, size: 0 })
    } finally { setLoading(false) }
  }, [method, url, body, headers, params, mockBase])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); execute() }
  }

  const saveQuery = () => {
    if (!queryName.trim()) return
    const q: SavedQuery = { id: crypto.randomUUID(), name: queryName.trim(), method, path: url, body, params: params.filter(p => p.key), headers: headers.filter(h => h.key), collection }
    const next = [...savedQueries, q]
    setSavedQueries(next)
    localStorage.setItem('doapi-queries', JSON.stringify(next))
    setQueryName(''); setShowSave(false)
  }

  const loadQuery = (q: SavedQuery) => {
    setMethod(q.method); setUrl(q.path); setBody(q.body)
    setParams(q.params.length ? q.params : [emptyKv()])
    setHeaders(q.headers.length ? q.headers : [{ key: 'Content-Type', value: 'application/json', enabled: true }])
  }

  const deleteQuery = (id: string) => {
    const next = savedQueries.filter(q => q.id !== id)
    setSavedQueries(next)
    localStorage.setItem('doapi-queries', JSON.stringify(next))
  }

  const copyCurl = async () => {
    const full = buildFullUrl()
    let curl = `curl -X ${method} '${full}'`
    headers.filter(h => h.key && h.enabled).forEach(h => curl += ` \\\n  -H '${h.key}: ${h.value}'`)
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`
    await navigator.clipboard.writeText(curl)
  }

  const groups = savedQueries.reduce<Record<string, SavedQuery[]>>((acc, q) => {
    const c = q.collection || 'Default'
    if (!acc[c]) acc[c] = []
    acc[c].push(q)
    return acc
  }, {})

  return (
    <div onKeyDown={handleKeyDown}>
      {!mockRunning && (
        <div className="pg__banner" style={{ marginBottom: '0.75rem' }}>
          <span>{t('playground.mockServerStopped')}</span>
          <button type="button" className="btn primary btn-small" onClick={onStartMock} disabled={mockLoading} style={{ marginLeft: '0.5rem' }}>
            {mockLoading ? t('playground.starting') : t('playground.startMockServer')}
          </button>
        </div>
      )}

      <div className="pg__layout" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div className="pg__main" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* URL Bar */}
          <div className="pg__urlbar" style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{
                padding: '0.45rem 0.6rem', borderRadius: 8, border: `2px solid ${METHOD_COLORS[method] || '#64748b'}`,
                background: 'var(--bg-secondary)', color: METHOD_COLORS[method] || 'var(--text-primary)',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', width: 80, textAlign: 'center',
              }}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="/pokemon"
                style={{
                  width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }} />
            </div>
            <button type="button" className="btn primary" onClick={() => execute()} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 1rem', fontWeight: 700 }}>
              <Play size={15} /> {loading ? '...' : t('playground.send')}
            </button>
          </div>

          {/* Tabs */}
          <div className="pg__editor" style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
            <div className="pg__tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              {(['params', 'headers', 'body'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                    color: activeTab === tab ? 'var(--accent-blue)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  }}>
                  {tab === 'params' ? t('playground.params') : tab === 'headers' ? t('playground.headers') : t('playground.body')}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.75rem' }}>
              {activeTab === 'params' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {params.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={p.enabled} onChange={() => { const n = [...params]; n[i] = { ...p, enabled: !p.enabled }; setParams(n) }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }} />
                      <input value={p.key} onChange={e => { const n = [...params]; n[i] = { ...p, key: e.target.value }; setParams(n) }}
                        placeholder={t('playground.key')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <input value={p.value} onChange={e => { const n = [...params]; n[i] = { ...p, value: e.target.value }; setParams(n) }}
                        placeholder={t('playground.value')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <button type="button" className="btn ghost" onClick={() => setParams(params.filter((_, j) => j !== i))} style={{ padding: '0.25rem' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => setParams([...params, emptyKv()])} style={{ alignSelf: 'flex-start', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={13} /> {t('playground.addParam')}
                  </button>
                </div>
              )}
              {activeTab === 'headers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {headers.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={h.enabled} onChange={() => { const n = [...headers]; n[i] = { ...h, enabled: !h.enabled }; setHeaders(n) }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }} />
                      <input value={h.key} onChange={e => { const n = [...headers]; n[i] = { ...h, key: e.target.value }; setHeaders(n) }}
                        style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <input value={h.value} onChange={e => { const n = [...headers]; n[i] = { ...h, value: e.target.value }; setHeaders(n) }}
                        style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <button type="button" className="btn ghost" onClick={() => setHeaders(headers.filter((_, j) => j !== i))} style={{ padding: '0.25rem' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => setHeaders([...headers, emptyKv()])} style={{ alignSelf: 'flex-start', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={13} /> {t('playground.addHeader')}
                  </button>
                </div>
              )}
              {activeTab === 'body' && (
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  placeholder='{ "key": "value" }'
                  style={{
                    width: '100%', minHeight: 140, padding: '0.75rem', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'monospace',
                    resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
                  }} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setShowSave(!showSave)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <Save size={14} /> {t('playground.save')}
            </button>
            <button type="button" className="btn ghost" onClick={copyCurl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <Terminal size={14} /> cURL
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('playground.sendHint')}</span>
          </div>

          {showSave && (
            <div className="info-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input value={queryName} onChange={e => setQueryName(e.target.value)} placeholder={t('playground.queryName')} autoFocus
                  style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <input value={collection} onChange={e => setCollection(e.target.value)} placeholder={t('playground.collection')}
                  style={{ width: 140, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <button type="button" className="btn primary" onClick={saveQuery} style={{ fontSize: '0.82rem' }}>{t('playground.saveQuery')}</button>
                <button type="button" className="btn ghost" onClick={() => setShowSave(false)} style={{ fontSize: '0.82rem' }}>{t('playground.cancel')}</button>
              </div>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
              }}>
                <span style={{
                  fontWeight: 700, fontSize: '0.85rem',
                  color: response.status >= 200 && response.status < 300 ? 'var(--accent-green)' : response.status >= 400 ? 'var(--accent-red)' : 'var(--text-muted)',
                }}>{response.status || 'ERR'}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{response.time}ms</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{response.size >= 1024 ? `${(response.size / 1024).toFixed(1)}KB` : `${response.size}B`}</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: '0.15rem', background: 'var(--bg-primary)', borderRadius: 6, padding: '0.1rem' }}>
                  {(['pretty', 'raw'] as ResponseView[]).map(v => (
                    <button key={v} type="button" onClick={() => setRespView(v)}
                      style={{
                        padding: '0.2rem 0.5rem', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.72rem',
                        background: respView === v ? 'var(--accent-blue)' : 'transparent',
                        color: respView === v ? '#fff' : 'var(--text-muted)', fontWeight: 600,
                      }}>
                      {v === 'pretty' ? <FileJson size={12} style={{ verticalAlign: 'middle' }} /> : <Code2 size={12} style={{ verticalAlign: 'middle' }} />} {v === 'pretty' ? t('playground.pretty') : t('playground.raw')}
                    </button>
                  ))}
                </div>
              </div>
              <pre style={{
                margin: 0, padding: '0.75rem', fontSize: '0.78rem', lineHeight: 1.5, overflow: 'auto', maxHeight: 350,
                fontFamily: 'monospace', background: '#0a0f1c', color: '#e2e8f0',
              }}>
                {respView === 'pretty' ? (() => { try { return JSON.stringify(JSON.parse(response.body as string), null, 2) } catch { return String(response.body) } })() : String(response.body)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar: Saved Queries + History */}
        {sidebarOpen && (
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                onClick={() => setCollectionsOpen(!collectionsOpen)}>
                <Bookmark size={14} style={{ color: 'var(--accent-indigo)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1 }}>{t('playground.savedQueries')}</span>
                {collectionsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>
              {collectionsOpen && (
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  {Object.keys(groups).length === 0 ? (
                    <p style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>{t('playground.noSaved')}</p>
                  ) : Object.entries(groups).map(([col, qs]) => (
                    <div key={col}>
                      <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-tertiary)' }}>
                        {col}
                      </div>
                      {qs.map(q => (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fff', padding: '0.08rem 0.25rem', borderRadius: 3, background: METHOD_COLORS[q.method] || '#64748b', minWidth: 28, textAlign: 'center' }}>{q.method}</span>
                          <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => loadQuery(q)}>{q.name}</span>
                          <button type="button" onClick={() => deleteQuery(q.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem' }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                onClick={() => setHistOpen(!histOpen)}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1 }}>{t('playground.history')}</span>
                {histOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </div>
              {histOpen && (
                <div style={{ maxHeight: 180, overflow: 'auto' }}>
                  {history.length === 0 ? (
                    <p style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>{t('playground.noHistory')}</p>
                  ) : history.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.72rem' }}
                      onClick={() => { setMethod(entry.method); setUrl(entry.path); execute(entry.method, entry.path) }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontWeight: 700, color: entry.status >= 200 && entry.status < 300 ? 'var(--accent-green)' : 'var(--accent-red)', minWidth: 24 }}>{entry.status}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.62rem', color: METHOD_COLORS[entry.method] || '#64748b', minWidth: 32 }}>{entry.method}</span>
                      <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.path}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{entry.duration}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
