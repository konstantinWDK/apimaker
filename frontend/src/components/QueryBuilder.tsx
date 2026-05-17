import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Save, Copy, Plus, Trash2, ChevronRight, ChevronDown, Clock, Bookmark, Terminal, Code2, Braces, FileJson, Search } from 'lucide-react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { readToken } from '../lib/api'

type ResponseView = 'pretty' | 'raw'
type TabId = 'params' | 'headers' | 'body'

interface KvRow { key: string; value: string; enabled: boolean }
interface SavedQuery { id: string; name: string; method: string; path: string; body: string; params: KvRow[]; headers: KvRow[]; collection: string }
interface HistoryEntry { id: string; method: string; path: string; status: number; duration: number; timestamp: string }

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const MC: Record<string, string> = { GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#ef4444' }

function emptyKv(): KvRow { return { key: '', value: '', enabled: true } }

export function QueryBuilder() {
  const { t } = useTranslation()
  const { project, mockRunning, startMock } = useProjectBuilder()
  const backendConfig = readBackendConfig()
  const baseUrl = backendConfig.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const token = readToken()
  const effectiveId = project.slug || project.remoteId || project.id

  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('')
  const [params, setParams] = useState<KvRow[]>([emptyKv()])
  const [headers, setHeaders] = useState<KvRow[]>([{ key: 'Content-Type', value: 'application/json', enabled: true }])
  const [body, setBody] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('params')
  const [response, setResponse] = useState<{ status: number; body: string; duration: number; size: number } | null>(null)
  const [loading, setLoading] = useState(false)
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

  const respRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (headers.length === 1 && headers[0].key === 'Content-Type') return }, [])

  useEffect(() => {
    if (project.endpoints.length > 0 && !path) {
      const ep = project.endpoints[0]
      setMethod(ep.method)
      setPath(ep.path)
      setBody(ep.method === 'POST' || ep.method === 'PUT' ? '{\n  \n}' : '')
    }
  }, [project.endpoints, path])

  const authKey = project.authMethod === 'apikey' ? 'X-API-Key' : project.authMethod === 'jwt' ? 'Authorization' : null
  const authVal = project.authMethod === 'apikey' ? (project.apiKey || '') : ''

  // Auto-add auth header
  useEffect(() => {
    if (!authKey) return
    setHeaders(prev => {
      if (prev.some(h => h.key === authKey)) return prev
      return [{ key: authKey, value: authVal, enabled: true }, ...prev]
    })
  }, [project.id])

  const buildUrl = useCallback(() => {
    const mockBase = `${baseUrl}/api/mock/${effectiveId}`
    let url = mockBase + (path.startsWith('/') ? path : `/${path}`)
    const active = params.filter(p => p.key && p.enabled)
    if (active.length) {
      url += '?' + active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    }
    return url
  }, [path, params, baseUrl, effectiveId])

  const execute = useCallback(async () => {
    const url = buildUrl()
    setLoading(true)
    setResponse(null)
    const start = performance.now()
    try {
      const h: Record<string, string> = {}
      headers.filter(hh => hh.key && hh.enabled).forEach(hh => { h[hh.key] = hh.value })
      const res = await fetch(url, {
        method,
        headers: h,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? body || undefined : undefined,
      })
      const duration = Math.round(performance.now() - start)
      const text = await res.text()
      const size = new Blob([text]).size
      setResponse({ status: res.status, body: text, duration, size })
      const entry: HistoryEntry = {
        id: crypto.randomUUID(), method, path, status: res.status, duration,
        timestamp: new Date().toISOString(),
      }
      setHistory(prev => {
        const next = [entry, ...prev].slice(0, 50)
        localStorage.setItem('doapi-history', JSON.stringify(next))
        return next
      })
    } catch {
      setResponse({ status: 0, body: 'Connection error', duration: 0, size: 0 })
    } finally { setLoading(false) }
  }, [method, path, body, headers, params, buildUrl])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); execute() }
  }

  const saveQuery = () => {
    if (!queryName.trim()) return
    const q: SavedQuery = {
      id: crypto.randomUUID(), name: queryName.trim(), method, path, body,
      params: params.filter(p => p.key), headers: headers.filter(h => h.key),
      collection,
    }
    const next = [...savedQueries, q]
    setSavedQueries(next)
    localStorage.setItem('doapi-queries', JSON.stringify(next))
    setQueryName('')
    setShowSave(false)
  }

  const loadQuery = (q: SavedQuery) => {
    setMethod(q.method); setPath(q.path); setBody(q.body)
    setParams(q.params.length ? q.params : [emptyKv()])
    setHeaders(q.headers.length ? q.headers : [{ key: 'Content-Type', value: 'application/json', enabled: true }])
  }

  const deleteQuery = (id: string) => {
    const next = savedQueries.filter(q => q.id !== id)
    setSavedQueries(next)
    localStorage.setItem('doapi-queries', JSON.stringify(next))
  }

  const copyCurl = async () => {
    const url = buildUrl()
    let curl = `curl -X ${method} '${url}'`
    headers.filter(h => h.key && h.enabled).forEach(h => { curl += ` \\\n  -H '${h.key}: ${h.value}'` })
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) curl += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`
    await navigator.clipboard.writeText(curl)
  }

  const copyResponse = async () => {
    if (response) await navigator.clipboard.writeText(response.body)
  }

  const loadHistory = (entry: HistoryEntry) => {
    setMethod(entry.method)
    setPath(entry.path)
  }

  const formatResponse = (): string => {
    if (!response) return ''
    if (respView === 'raw') return response.body
    try { return JSON.stringify(JSON.parse(response.body), null, 2) } catch { return response.body }
  }

  const groups = savedQueries.reduce<Record<string, SavedQuery[]>>((acc, q) => {
    const c = q.collection || 'Default'
    if (!acc[c]) acc[c] = []
    acc[c].push(q)
    return acc
  }, {})

  return (
    <div className="page-container" onKeyDown={handleKeyDown}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('query.title')}</h1>
          <p className="page-subtitle">{t('query.subtitle')}</p>
        </div>
      </div>

      {!mockRunning && (
        <div className="info-card" style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400e' }}>{t('query.mockRequired')}
            <button type="button" className="btn ghost" onClick={startMock} style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.78rem', border: '1px solid #f59e0b' }}>{t('query.startMock')}</button>
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* URL bar */}
          <div className="query-urlbar" style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{
                padding: '0.45rem 0.6rem', borderRadius: 8, border: `2px solid ${MC[method] || '#64748b'}`,
                background: 'var(--bg-secondary)', color: MC[method] || 'var(--text-primary)',
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', width: 80, textAlign: 'center',
              }}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div style={{ flex: 1, position: 'relative' }}>
              <input value={path} onChange={e => setPath(e.target.value)}
                placeholder="/pokemon"
                style={{
                  width: '100%', padding: '0.45rem 0.75rem', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }} />
            </div>
            <button type="button" className="btn primary" onClick={execute} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 1rem', fontWeight: 700 }}>
              <Play size={15} /> {loading ? '...' : t('query.send')}
            </button>
          </div>

          {/* Tabs: Params / Headers / Body */}
          <div className="query-tabs" style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              {(['params', 'headers', 'body'] as TabId[]).map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '0.5rem 1rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                    background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
                    color: activeTab === tab ? 'var(--accent-blue)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  }}>
                  {tab === 'params' ? t('query.params') : tab === 'headers' ? t('query.headers') : t('query.body')}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.75rem' }}>
              {activeTab === 'params' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0 0.25rem' }}>
                    <span style={{ width: 24 }}></span>
                    <span style={{ flex: 1 }}>{t('query.key')}</span>
                    <span style={{ flex: 1 }}>{t('query.value')}</span>
                  </div>
                  {params.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={p.enabled} onChange={() => {
                        const next = [...params]; next[i] = { ...p, enabled: !p.enabled }; setParams(next)
                      }} style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }} />
                      <input value={p.key} onChange={e => { const n = [...params]; n[i] = { ...p, key: e.target.value }; setParams(n) }}
                        placeholder={t('query.key')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <input value={p.value} onChange={e => { const n = [...params]; n[i] = { ...p, value: e.target.value }; setParams(n) }}
                        placeholder={t('query.value')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      <button type="button" className="btn ghost" onClick={() => setParams(params.filter((_, j) => j !== i))} style={{ padding: '0.25rem' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn ghost" onClick={() => setParams([...params, emptyKv()])} style={{ alignSelf: 'flex-start', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={13} /> {t('query.addParam')}
                  </button>
                </div>
              )}
              {activeTab === 'headers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0 0.25rem' }}>
                    <span style={{ width: 24 }}></span>
                    <span style={{ flex: 1 }}>{t('query.key')}</span>
                    <span style={{ flex: 1 }}>{t('query.value')}</span>
                  </div>
                  {headers.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input type="checkbox" checked={h.enabled} onChange={() => {
                        const next = [...headers]; next[i] = { ...h, enabled: !h.enabled }; setHeaders(next)
                      }} style={{ width: 16, height: 16, accentColor: 'var(--accent-blue)' }} />
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
                    <Plus size={13} /> {t('query.addHeader')}
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

          {/* Actions bar */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn ghost" onClick={() => setShowSave(!showSave)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <Save size={14} /> {t('query.save')}
            </button>
            <button type="button" className="btn ghost" onClick={copyCurl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <Terminal size={14} /> cURL
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('query.sendHint')}</span>
          </div>

          {showSave && (
            <div className="info-card" style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input value={queryName} onChange={e => setQueryName(e.target.value)}
                  placeholder={t('query.namePlaceholder')} autoFocus
                  style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <input value={collection} onChange={e => setCollection(e.target.value)}
                  placeholder={t('query.collection')}
                  style={{ width: 140, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                <button type="button" className="btn primary" onClick={saveQuery} style={{ fontSize: '0.82rem' }}>{t('query.saveQuery')}</button>
                <button type="button" className="btn ghost" onClick={() => setShowSave(false)} style={{ fontSize: '0.82rem' }}>{t('query.cancel')}</button>
              </div>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="info-card" style={{ padding: 0, overflow: 'hidden' }} ref={respRef}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
              }}>
                <span style={{
                  fontWeight: 700, fontSize: '0.85rem',
                  color: response.status >= 200 && response.status < 300 ? 'var(--accent-green)' : response.status >= 400 ? 'var(--accent-red)' : 'var(--text-muted)',
                }}>
                  {response.status || 'ERR'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{response.duration}ms</span>
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
                      {v === 'pretty' ? <FileJson size={12} style={{ verticalAlign: 'middle' }} /> : <Code2 size={12} style={{ verticalAlign: 'middle' }} />}
                      {' '}{v === 'pretty' ? t('query.pretty') : t('query.raw')}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn ghost" onClick={copyResponse} style={{ padding: '0.2rem 0.4rem' }} title={t('query.copy')}>
                  <Copy size={13} />
                </button>
              </div>
              <pre style={{
                margin: 0, padding: '0.75rem', fontSize: '0.78rem', lineHeight: 1.5, overflow: 'auto', maxHeight: 400,
                fontFamily: 'monospace', background: 'var(--code-bg, #0a0f1c)', color: '#e2e8f0',
              }}>
                {formatResponse()}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar: Saved Queries + History */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Saved Queries */}
          <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              onClick={() => setCollectionsOpen(!collectionsOpen)}>
              <Bookmark size={14} style={{ color: 'var(--accent-indigo)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', flex: 1 }}>{t('query.savedQueries')}</span>
              {collectionsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {collectionsOpen && (
              <div style={{ maxHeight: 280, overflow: 'auto' }}>
                {Object.keys(groups).length === 0 ? (
                  <p style={{ padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                    {t('query.noSaved')}
                  </p>
                ) : Object.entries(groups).map(([col, qs]) => (
                  <div key={col}>
                    <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                      {col}
                    </div>
                    {qs.map(q => (
                      <div key={q.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem',
                        cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, color: '#fff', padding: '0.1rem 0.3rem', borderRadius: 3,
                          background: MC[q.method] || '#64748b', minWidth: 32, textAlign: 'center',
                        }}>{q.method}</span>
                        <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={() => loadQuery(q)}>
                          {q.name}
                        </span>
                        <button type="button" onClick={() => deleteQuery(q.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem', fontSize: '0.75rem' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="info-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
              onClick={() => setHistOpen(!histOpen)}>
              <Clock size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', flex: 1 }}>{t('query.history')}</span>
              {histOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {histOpen && (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {history.length === 0 ? (
                  <p style={{ padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                    {t('query.noHistory')}
                  </p>
                ) : history.map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem',
                  }}
                    onClick={() => loadHistory(entry)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontWeight: 700, color: entry.status >= 200 && entry.status < 300 ? 'var(--accent-green)' : 'var(--accent-red)', minWidth: 28 }}>{entry.status}</span>
                    <span style={{
                      fontWeight: 600, fontSize: '0.65rem', color: MC[entry.method] || '#64748b', minWidth: 36,
                    }}>{entry.method}</span>
                    <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.path}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{entry.duration}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .query-urlbar select:focus { outline: none; }
        .query-tabs textarea:focus { outline: none; border-color: var(--accent-blue); }
      `}</style>
    </div>
  )
}
