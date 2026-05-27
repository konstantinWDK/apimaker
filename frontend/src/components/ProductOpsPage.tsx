import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { SectionCard } from './SectionCard'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import {
  createAutomation,
  createDatasource,
  createRelease,
  createSavedQuery,
  importContract,
  listAutomations,
  listDatasources,
  listDeployProviders,
  listPlugins,
  listReleases,
  listRuntimeLogs,
  listSavedQueries,
  runSavedQuery,
} from '../lib/api'

type Tab = 'datasources' | 'queries' | 'logs' | 'releases' | 'automations' | 'imports' | 'platform'
type QueryFormState = {
  name: string
  statement: string
  connection_id: string
  datasource_id: string
  expose_as_endpoint: boolean
  endpoint_path: string
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'datasources', label: 'Datasources' },
  { id: 'queries', label: 'Queries' },
  { id: 'logs', label: 'Logs' },
  { id: 'releases', label: 'Releases' },
  { id: 'automations', label: 'Automations' },
  { id: 'imports', label: 'Imports' },
  { id: 'platform', label: 'Platform' },
]

const prettyDate = (value?: string) => value ? new Date(value).toLocaleString() : ''

export function ProductOpsPage() {
  const { t } = useTranslation()
  const { project, saveProject } = useProjectBuilder()
  const projectId = project.remoteId || project.id
  const [activeTab, setActiveTab] = useState<Tab>('datasources')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [datasources, setDatasources] = useState<any[]>([])
  const [queries, setQueries] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [automations, setAutomations] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [plugins, setPlugins] = useState<any | null>(null)
  const [queryResult, setQueryResult] = useState<any | null>(null)

  const [datasourceForm, setDatasourceForm] = useState({ name: 'Manual Source', source_type: 'manual' })
  const [queryForm, setQueryForm] = useState<QueryFormState>({
    name: 'List rows',
    statement: 'SELECT 1',
    connection_id: '',
    datasource_id: '',
    expose_as_endpoint: true,
    endpoint_path: '/reports/list-rows',
  })
  const [releaseMessage, setReleaseMessage] = useState('')
  const [automationForm, setAutomationForm] = useState({
    name: 'Log endpoint calls',
    trigger_event: 'endpoint.called',
    actions: '[{"type":"runtime_log","event_type":"automation.endpoint","message":"Endpoint called"}]',
  })
  const [importForm, setImportForm] = useState({
    format: 'openapi',
    document: '{\n  "paths": {\n    "/hello": {\n      "get": { "summary": "Hello" }\n    }\n  }\n}',
  })

  const ensureRemoteProject = useCallback(async () => {
    if (project.remoteId) return project.remoteId
    const savedId = await saveProject()
    if (!savedId) throw new Error(t('productOps.saveFirst'))
    return savedId
  }, [project.remoteId, saveProject])

  const refresh = useCallback(async (projectIdOverride?: string) => {
    const targetProjectId = projectIdOverride || projectId
    if (!targetProjectId) return
    setLoading(true)
    setError(null)
    try {
      const [ds, qs, lg, rel, aut, prov, plug] = await Promise.all([
        listDatasources(targetProjectId).catch(() => []),
        listSavedQueries(targetProjectId).catch(() => []),
        listRuntimeLogs(targetProjectId).catch(() => []),
        listReleases(targetProjectId).catch(() => []),
        listAutomations(targetProjectId).catch(() => []),
        listDeployProviders().catch(() => []),
        listPlugins().catch(() => null),
      ])
      setDatasources(ds)
      setQueries(qs)
      setLogs(lg)
      setReleases(rel)
      setAutomations(aut)
      setProviders(prov)
      setPlugins(plug)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('productOps.loadError'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { refresh() }, [refresh])

  const runAction = async (fn: (id: string) => Promise<void>, message: string) => {
    setError(null)
    setSuccess(null)
    try {
      const id = await ensureRemoteProject()
      await fn(id)
      setSuccess(message)
      await refresh(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('productOps.actionError'))
    }
  }

  const datasourceOptions = useMemo(() => datasources.map((item) => (
    <option key={item.id} value={item.id}>{item.name}</option>
  )), [datasources])

  return (
    <SectionCard title={t('productOps.title')} subtitle={t('productOps.subtitle')} fullWidth>
      <div className="ops-page">
        <div className="ops-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ops-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
        {loading && <p className="muted-text">{t('productOps.loading')}</p>}

        {activeTab === 'datasources' && (
          <div className="ops-grid">
            <div className="ops-panel">
              <h3>{t('productOps.newDatasource')}</h3>
              <label>{t('productOps.name')}</label>
              <input value={datasourceForm.name} onChange={e => setDatasourceForm({ ...datasourceForm, name: e.target.value })} />
              <label>{t('productOps.type')}</label>
              <select value={datasourceForm.source_type} onChange={e => setDatasourceForm({ ...datasourceForm, source_type: e.target.value })}>
                <option value="manual">Manual</option>
                <option value="csv">CSV</option>
                <option value="database">Database</option>
                <option value="rest">REST</option>
              </select>
              <button className="btn primary btn-sm" type="button" onClick={() => runAction(async (id) => {
                await createDatasource(id, { ...datasourceForm, config: {} })
              }, t('productOps.datasourceCreated'))}>
                {t('productOps.createDatasource')}
              </button>
            </div>
            <ListPanel title={t('productOps.datasources')} items={datasources} render={(item) => (
              <>
                <strong>{item.name}</strong>
                <span>{item.source_type}</span>
              </>
            )} />
          </div>
        )}

        {activeTab === 'queries' && (
          <div className="ops-grid">
            <div className="ops-panel">
              <h3>{t('productOps.newQuery')}</h3>
              <label>{t('productOps.name')}</label>
              <input value={queryForm.name} onChange={e => setQueryForm({ ...queryForm, name: e.target.value })} />
              <label>{t('productOps.datasource')}</label>
              <select value={queryForm.datasource_id} onChange={e => setQueryForm({ ...queryForm, connection_id: '', datasource_id: e.target.value })}>
                <option value="">{t('productOps.noDatasource')}</option>
                {datasourceOptions}
              </select>
              <label>SQL</label>
              <textarea rows={5} value={queryForm.statement} onChange={e => setQueryForm({ ...queryForm, statement: e.target.value })} />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={queryForm.expose_as_endpoint}
                  onChange={e => setQueryForm({ ...queryForm, expose_as_endpoint: e.target.checked })}
                />
                {t('productOps.exposeAsEndpoint')}
              </label>
              {queryForm.expose_as_endpoint && (
                <>
                  <label>{t('productOps.endpointPath')}</label>
                  <input value={queryForm.endpoint_path} onChange={e => setQueryForm({ ...queryForm, endpoint_path: e.target.value })} />
                </>
              )}
              <button className="btn primary btn-sm" type="button" onClick={() => runAction(async (id) => {
                await createSavedQuery(id, {
                  ...queryForm,
                  datasource_id: queryForm.datasource_id || null,
                  connection_id: queryForm.connection_id || null,
                  query_type: 'sql',
                  bindings: {},
                })
              }, t('productOps.querySaved'))}>
                {t('productOps.saveQuery')}
              </button>
            </div>
            <div className="ops-panel">
              <h3>{t('productOps.queries')}</h3>
              <div className="ops-list">
                {queries.length === 0 ? <p className="muted-text">{t('productOps.noQueries')}</p> : queries.map((item) => (
                  <div className="ops-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.statement}</span>
                      {item.endpoint?.enabled && <small>GET {item.endpoint.path}</small>}
                    </div>
                    <button className="btn ghost btn-sm" type="button" onClick={() => runAction(async (id) => {
                      const result = await runSavedQuery(id, item.id)
                      setQueryResult(result)
                    }, t('productOps.queryExecuted'))}>
                      {t('productOps.execute')}
                    </button>
                  </div>
                ))}
              </div>
              {queryResult && (
                <pre className="ops-pre">{JSON.stringify(queryResult, null, 2)}</pre>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <ListPanel title={t('productOps.runtimeLogs')} items={logs} render={(item) => (
            <>
              <strong>{item.event_type}</strong>
              <span>{[item.method, item.path, item.status_code].filter(Boolean).join(' ') || item.message}</span>
              <small>{prettyDate(item.created_at)}</small>
            </>
          )} />
        )}

        {activeTab === 'releases' && (
          <div className="ops-grid">
            <div className="ops-panel">
              <h3>{t('productOps.publishRelease')}</h3>
              <label>{t('productOps.message')}</label>
              <input value={releaseMessage} onChange={e => setReleaseMessage(e.target.value)} placeholder={t('productOps.releasePlaceholder')} />
              <button className="btn primary btn-sm" type="button" onClick={() => runAction(async (id) => {
                await createRelease(id, releaseMessage)
                setReleaseMessage('')
              }, t('productOps.releasePublished'))}>
                {t('productOps.publish')}
              </button>
            </div>
            <ListPanel title={t('productOps.releases')} items={releases} render={(item) => (
              <>
                <strong>v{item.version} {item.is_active ? t('productOps.current') : ''}</strong>
                <span>{item.message || t('productOps.noMessage')}</span>
                <small>{prettyDate(item.created_at)}</small>
              </>
            )} />
          </div>
        )}

        {activeTab === 'automations' && (
          <div className="ops-grid">
            <div className="ops-panel">
              <h3>{t('productOps.newAutomation')}</h3>
              <label>{t('productOps.name')}</label>
              <input value={automationForm.name} onChange={e => setAutomationForm({ ...automationForm, name: e.target.value })} />
              <label>{t('productOps.trigger')}</label>
              <select value={automationForm.trigger_event} onChange={e => setAutomationForm({ ...automationForm, trigger_event: e.target.value })}>
                <option value="endpoint.called">endpoint.called</option>
                <option value="record.created">record.created</option>
                <option value="record.updated">record.updated</option>
                <option value="record.deleted">record.deleted</option>
                <option value="manual">manual</option>
              </select>
              <label>{t('productOps.actionsJson')}</label>
              <textarea rows={6} value={automationForm.actions} onChange={e => setAutomationForm({ ...automationForm, actions: e.target.value })} />
              <button className="btn primary btn-sm" type="button" onClick={() => runAction(async (id) => {
                await createAutomation(id, { ...automationForm, actions: JSON.parse(automationForm.actions) })
              }, t('productOps.automationCreated'))}>
                {t('productOps.createAutomation')}
              </button>
            </div>
            <ListPanel title={t('productOps.automations')} items={automations} render={(item) => (
              <>
                <strong>{item.name}</strong>
                <span>{item.trigger_event} - {item.is_active ? t('productOps.active') : t('productOps.paused')}</span>
              </>
            )} />
          </div>
        )}

        {activeTab === 'imports' && (
          <div className="ops-panel">
            <h3>{t('productOps.importContract')}</h3>
            <label>{t('productOps.format')}</label>
            <select value={importForm.format} onChange={e => setImportForm({ ...importForm, format: e.target.value })}>
              <option value="openapi">OpenAPI</option>
              <option value="postman">Postman</option>
            </select>
            <label>{t('productOps.documentJson')}</label>
            <textarea rows={12} value={importForm.document} onChange={e => setImportForm({ ...importForm, document: e.target.value })} />
            <button className="btn primary btn-sm" type="button" onClick={() => runAction(async (id) => {
              await importContract(id, { format: importForm.format, document: JSON.parse(importForm.document) })
            }, t('productOps.contractImported'))}>
              {t('productOps.importEndpoints')}
            </button>
          </div>
        )}

        {activeTab === 'platform' && (
          <div className="ops-grid">
            <ListPanel title={t('productOps.deployProviders')} items={providers} render={(item) => (
              <>
                <strong>{item.name}</strong>
                <span>{item.status}</span>
              </>
            )} />
            <div className="ops-panel">
              <h3>{t('productOps.registeredPlugins')}</h3>
              <pre className="ops-pre">{JSON.stringify(plugins, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .ops-page { display: flex; flex-direction: column; gap: 1rem; }
        .ops-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; }
        .ops-tab { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 0.4rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
        .ops-tab.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 700; }
        .ops-grid { display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(320px, 1.2fr); gap: 1rem; align-items: start; }
        .ops-panel { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #fff; display: flex; flex-direction: column; gap: 0.65rem; }
        .ops-panel h3 { margin: 0; font-size: 0.95rem; color: #0f172a; }
        .ops-panel label { font-size: 0.72rem; font-weight: 700; color: #475569; text-transform: uppercase; }
        .ops-panel input, .ops-panel select, .ops-panel textarea {
          width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px;
          padding: 0.48rem 0.58rem; font: inherit; font-size: 0.85rem;
        }
        .ops-panel textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
        .ops-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .ops-row { border: 1px solid #e2e8f0; border-radius: 7px; padding: 0.65rem 0.75rem; display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; }
        .ops-row div { min-width: 0; display: flex; flex-direction: column; gap: 0.18rem; }
        .ops-row strong { color: #0f172a; font-size: 0.85rem; }
        .ops-row span, .ops-row small { color: #64748b; font-size: 0.76rem; overflow-wrap: anywhere; }
        .ops-pre { margin: 0; padding: 0.75rem; border-radius: 7px; background: #0f172a; color: #e2e8f0; overflow: auto; font-size: 0.75rem; }
        @media (max-width: 900px) { .ops-grid { grid-template-columns: 1fr; } }
      `}</style>
    </SectionCard>
  )
}

function ListPanel({ title, items, render }: { title: string; items: any[]; render: (item: any) => ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="ops-panel">
      <h3>{title}</h3>
      <div className="ops-list">
        {items.length === 0 ? <p className="muted-text">{t('productOps.noRecords')}</p> : items.map((item) => (
          <div className="ops-row" key={item.id || item.name}>
            <div>{render(item)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
