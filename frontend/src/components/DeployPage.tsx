import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { apiFetch } from '../lib/api'

export function DeployPage() {
  const { t } = useTranslation()
  const { project, saveProject, updateProject } = useProjectBuilder()
  const [activeTab, setActiveTab] = useState<'desplegar' | 'cli'>('desplegar')
  const [allDeployments, setAllDeployments] = useState<any[]>([])
  const [loadingDeployments, setLoadingDeployments] = useState(true)

  const projectSlugs = [project.slug, project.remoteId].filter(Boolean) as string[]
  const deployments = allDeployments.filter((d: any) => projectSlugs.includes(d.slug))

  const loadDeployments = useCallback(async () => {
    setLoadingDeployments(true)
    try {
      const res = await apiFetch('/api/deploy/list')
      const data = await res.json()
      setAllDeployments(data)
    } catch { /* ignore */ }
    setLoadingDeployments(false)
  }, [])

  useEffect(() => { loadDeployments() }, [loadDeployments, project.slug, project.remoteId])

  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">{t('deploy.title')}</h1>
          <p className="info-hero__subtitle">
            {t('deploy.subtitle')}
          </p>
        </div>
      </div>

      <div className="docs-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`docs-tab ${activeTab === 'desplegar' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('desplegar')}>
          <span className="docs-tab__icon">▲</span> {t('deploy.tabManage')}
        </button>
        <button className={`docs-tab ${activeTab === 'cli' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('cli')}>
          <span className="docs-tab__icon">⌘</span> {t('deploy.tabCli')}
        </button>
      </div>

      {activeTab === 'desplegar' ? (
        <DeployManager
          project={project}
          saveProject={saveProject}
          updateProject={updateProject}
          deployments={deployments}
          loading={loadingDeployments}
          onDeployDone={loadDeployments}
        />
      ) : (
        <CliDeployPanel project={project} />
      )}
    </div>
  )
}

/* ========== DEPLOY MANAGER ========== */
function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let pwd = ''
  for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  return pwd
}

function DeployManager({ project, saveProject, updateProject, deployments, loading, onDeployDone }: any) {
  const { t } = useTranslation()
  const setGlobalDeployState = useProjectBuilder(s => s.setGlobalDeployState)
  const [deployType, setDeployType] = useState<'local' | 'remote'>('local')
  const [localPort, setLocalPort] = useState('8080')
  const [deployDbType, setDeployDbType] = useState<'sqlite' | 'postgresql' | 'mysql'>('sqlite')
  const [deployPgMode, setDeployPgMode] = useState<'existing' | 'new_container'>('existing')
  const [deployPgHost, setDeployPgHost] = useState('localhost')
  const [deployPgPort, setDeployPgPort] = useState('5432')
  const [deployPgUser, setDeployPgUser] = useState('postgres')
  const [deployPgPass, setDeployPgPass] = useState('')
  const [deployPgDb, setDeployPgDb] = useState('api_deploy')
  const [containerPgUser] = useState('doapi')
  const [containerPgPass] = useState(generatePassword)
  const [containerPgDb] = useState('api_deploy')
  const [containerPgPort, setContainerPgPort] = useState('5432')

  const [deployMySqlMode, setDeployMySqlMode] = useState<'existing' | 'new_container'>('existing')
  const [deployMySqlHost, setDeployMySqlHost] = useState('localhost')
  const [deployMySqlPort, setDeployMySqlPort] = useState('3306')
  const [deployMySqlUser, setDeployMySqlUser] = useState('root')
  const [deployMySqlPass, setDeployMySqlPass] = useState('')
  const [deployMySqlDb, setDeployMySqlDb] = useState('api_deploy')
  const [containerMySqlUser] = useState('doapi')
  const [containerMySqlPass] = useState(generatePassword)
  const [containerMySqlDb] = useState('api_deploy')
  const [containerMySqlPort, setContainerMySqlPort] = useState('3306')
  const [sshHost, setSshHost] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [sshAuthType, setSshAuthType] = useState<'password' | 'key'>('password')
  const [sshPassword, setSshPassword] = useState('')
  const [sshKey, setSshKey] = useState('')
  const [apiPort, setApiPort] = useState('8080')
  const [deployLog, setDeployLog] = useState<string[]>([])
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [domainInput, setDomainInput] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployDone, setDeployDone] = useState(false)
  const [dockerAvail, setDockerAvail] = useState<{ available: boolean; version?: string; containers_running?: number; error?: string } | null>(null)
  const [portStatus, setPortStatus] = useState<Record<string, 'checking' | 'free' | 'busy' | null>>({})

  useEffect(() => {
    apiFetch('/api/deploy/docker-status').then(r => r.json()).then(setDockerAvail).catch(() => setDockerAvail({ available: false }))
  }, [])

  const checkPort = useCallback(async (port: string, key: string) => {
    setPortStatus(p => ({ ...p, [key]: 'checking' }))
    try {
      const res = await apiFetch(`/api/deploy/local/check-port?port=${parseInt(port, 10)}`)
      const data = await res.json()
      setPortStatus(p => ({ ...p, [key]: data.free ? 'free' : 'busy' }))
    } catch {
      setPortStatus(p => ({ ...p, [key]: 'busy' }))
    }
  }, [])

  const log = useCallback((msg: string) => setDeployLog((prev: string[]) => [...prev, msg]), [])

  const handleAction = async (slug: string, action: 'stop' | 'delete' | 'restart' | 'start') => {
    if (action === 'delete' && !window.confirm(t('deploy.confirmDelete'))) return
    try {
      const endpoint = action === 'restart' ? 'restart' : action
      const res = await apiFetch(`/api/deploy/local/${endpoint}`, {
        method: 'POST', body: JSON.stringify({ slug }),
      })
      if (!res.ok) { const e = await res.text(); alert(e); return }
      const data = await res.json()
      data.logs?.forEach((l: string) => log(l))
      onDeployDone()
    } catch (e: any) { alert(e.message) }
  }

  const handleRedeploy = async (slug: string) => {
    setDeploying(true)
    setDeployDone(false)
    setDeployLog([])
    setGlobalDeployState('deploying', t('deploy.applyingChanges'))
    try {
      const pid = await saveProject()
      if (!pid) {
        log(t('deploy.errSave'))
        setGlobalDeployState('error', t('deploy.errSave'))
        return
      }
      log(t('deploy.logSaved'))
      log(t('deploy.logReexport'))
      const res = await apiFetch('/api/deploy/local/redeploy', {
        method: 'POST',
        body: JSON.stringify({ slug, project_id: pid }),
      })
      const result = await res.json()
      result.logs?.forEach((l: string) => log(l))
      if (result.status !== 'running') {
        setGlobalDeployState('error', result.message || t('deploy.errApplyChanges'))
        return
      }
      setDeployDone(true)
      setGlobalDeployState('success', t('deploy.changesApplied'))
      onDeployDone()
    } catch (e: any) {
      log(` ${e.message || e}`)
      setGlobalDeployState('error', e.message || t('deploy.errApplyChanges'))
    } finally {
      setDeploying(false)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true); setDeployDone(false); setDeployLog([])
    const dbName = deployDbType === 'sqlite' ? 'SQLite' : deployDbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'
    setGlobalDeployState('deploying', t('deploy.deployingApi').replace('{dbName}', dbName))
    let finalStatus: 'success' | 'error' = 'error'
    let finalMsg = t('deploy.errDeploy')
    try {
      const pid = await saveProject()
      if (!pid) { log(t('deploy.errSave')); setDeploying(false); setGlobalDeployState('error', t('deploy.errSave')); return }
      log(t('deploy.logSaved'))

      if (deployType === 'local') {
        log(t('deploy.logDeployingLocal').replace('{port}', localPort))
        const deployBody: any = { project_id: pid, port: parseInt(localPort, 10), db_type: deployDbType }
        if (deployDbType === 'postgresql') {
          deployBody.deploy_postgres_mode = deployPgMode
          if (deployPgMode === 'existing') {
            deployBody.db_host = deployPgHost
            deployBody.db_port = parseInt(deployPgPort, 10)
            deployBody.db_user = deployPgUser
            deployBody.db_password = deployPgPass
            deployBody.db_name = deployPgDb
          } else {
            deployBody.db_port = parseInt(containerPgPort, 10)
            deployBody.db_user = containerPgUser
            deployBody.db_password = containerPgPass
            deployBody.db_name = containerPgDb
          }
        } else if (deployDbType === 'mysql') {
          deployBody.deploy_mysql_mode = deployMySqlMode
          if (deployMySqlMode === 'existing') {
            deployBody.db_host = deployMySqlHost
            deployBody.db_port = parseInt(deployMySqlPort, 10)
            deployBody.db_user = deployMySqlUser
            deployBody.db_password = deployMySqlPass
            deployBody.db_name = deployMySqlDb
          } else {
            deployBody.db_port = parseInt(containerMySqlPort, 10)
            deployBody.db_user = containerMySqlUser
            deployBody.db_password = containerMySqlPass
            deployBody.db_name = containerMySqlDb
          }
        }
        const res = await apiFetch('/api/deploy/local', {
          method: 'POST', body: JSON.stringify(deployBody),
        })
        const result = await res.json()
        result.logs?.forEach((l: string) => log(l))
        if (result.status === 'running') {
          const apiPort = result.url?.split(':').pop() || localPort
          updateProject({ deployment: { host: 'localhost', user: 'docker', port: '2375', apiPort, authType: 'password', deployedAt: new Date().toISOString(), status: 'running', lastCheckAt: new Date().toISOString() } })
          setDeployDone(true)
          onDeployDone()
          finalStatus = 'success'
          finalMsg = t('deploy.successDeploy')
        } else if (result.status === 'no_docker') {
          log(t('deploy.logNoDocker'))
          finalMsg = t('deploy.errNoDocker')
        } else {
          finalMsg = t('deploy.errContainerBuild')
        }
      } else {
        log(t('deploy.logExporting'))
        const exportRes = await apiFetch(`/projects/${pid}/export`)
        const projectData = await exportRes.json()
        log(t('deploy.logExported').replace('{name}', projectData.name))
        const sshCmd = sshAuthType === 'key' && sshKey.trim() ? `ssh -i ~/.ssh/deploy_key -p ${sshPort} ${sshUser}@${sshHost}` : `ssh ${sshUser}@${sshHost} -p ${sshPort}`
        const scpCmd = sshAuthType === 'key' && sshKey.trim() ? `scp -P ${sshPort} -i ~/.ssh/deploy_key proyecto.json ${sshUser}@${sshHost}:/tmp/` : `scp -P ${sshPort} proyecto.json ${sshUser}@${sshHost}:/tmp/`
        log(t('deploy.logManual'))
        log(`   1. doapi init ${project.slug || project.id} -o proyecto.json`)
        log(`   2. ${scpCmd}`)
        log(`   3. ${sshCmd}`)
        log(`   4. doapi deploy /tmp/proyecto.json --port ${apiPort}`)
        setDeployDone(true)
        finalStatus = 'success'
        finalMsg = t('deploy.instructionsGenerated')
      }
    } catch (e: any) { log(` ${e.message || e}`); finalMsg = e.message || t('deploy.unknownError') }
    setDeploying(false)
    setGlobalDeployState(finalStatus, finalMsg)
  }

  const handleRollback = useCallback(async (slug: string, versionId: string) => {
    if (!window.confirm(t('deploy.confirmRollback'))) return
    setDeploying(true)
    log(t('deploy.rollingBack'))
    try {
      const res = await apiFetch('/api/deploy/local/rollback', {
        method: 'POST',
        body: JSON.stringify({ slug, version_id: versionId }),
      })
      const data = await res.json()
      data.logs?.forEach((l: string) => log(l))
    } catch (e: any) { log(` ${e.message}`) }
    setDeploying(false)
    onDeployDone()
  }, [onDeployDone, t])

  const handleSetDomain = useCallback(async (slug: string, domain: string) => {
    try {
      const res = await apiFetch(`/api/deploy/${slug}/domain`, {
        method: 'PATCH',
        body: JSON.stringify({ slug, domain }),
      })
      if (res.ok) onDeployDone()
    } catch { /* ignore */ }
    setEditingDomain(null)
  }, [onDeployDone])

  const handleGenerateShareUrl = useCallback(async (slug: string) => {
    try {
      const res = await apiFetch(`/api/deploy/${slug}/share`)
      const data = await res.json()
      if (data.token) {
        onDeployDone()
      }
    } catch { /* ignore */ }
  }, [onDeployDone])

  const statusColor = (s: string) => s === 'running' ? '#22c55e' : s === 'stopped' ? '#ef4444' : '#94a3b8'
  const statusLabel = (s: string) => s === 'running' ? t('deploy.statusRunning') : s === 'stopped' ? t('deploy.statusStopped') : t('deploy.statusUnknown')

  return (
    <div>
      {/* Deployments list */}
      <div className="info-card" style={{ marginBottom: '1rem' }}>
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>
          {t('deploy.deployedApis')} ({loading ? '...' : deployments.length})
        </h3>
        {loading ? (
          <p className="muted-text">{t('deploy.loading')}</p>
        ) : deployments.length === 0 ? (
          <p className="muted-text">{t('deploy.noDeployments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {deployments.map((dep: any) => (
              <div key={dep.slug} style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(dep.docker_status), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{dep.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {dep.url} · {dep.stack} · {statusLabel(dep.docker_status)}
                      {dep.version_number && <span style={{ marginLeft: '0.4rem', padding: '0.1rem 0.35rem', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>v{dep.version_number}</span>}
                    </div>
                    {dep.auth_method && (
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {dep.auth_method === 'apikey' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: '#166534', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {t('deploy.secureApiKey')}
                          </span>
                        ) : dep.auth_method === 'jwt' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: '#166534', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {t('deploy.secureJwt')}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            {t('deploy.public')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      {dep.docker_status === 'running' ? (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                        onClick={() => handleAction(dep.slug, 'stop')}>{t('deploy.stop')}</button>
                    ) : (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#166534' }}
                        onClick={() => handleAction(dep.slug, 'start')}>{t('deploy.start')}</button>
                    )}
                    {dep.version_id && (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#d97706' }}
                        onClick={() => handleRollback(dep.slug, dep.version_id)} disabled={deploying}>{t('deploy.rollback')}</button>
                    )}
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#4f46e5' }}
                      onClick={() => handleRedeploy(dep.slug)} disabled={deploying}>{t('deploy.applyChanges')}</button>
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleAction(dep.slug, 'restart')}>{t('deploy.restart')}</button>
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#6366f1' }}
                      onClick={() => handleGenerateShareUrl(dep.slug)}>URL</button>
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                      onClick={() => handleAction(dep.slug, 'delete')}>{t('deploy.delete')}</button>
                  </div>
                </div>
                {dep.db_credentials && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                    <div style={{ color: '#047857', marginBottom: '0.3rem', fontWeight: 600 }}> PostgreSQL</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.1rem 0.6rem', color: '#374151', alignItems: 'center' }}>
                      <span>{t('deploy.user')}:</span>
                      <span style={{ fontFamily: 'monospace' }}>{dep.db_credentials.user}</span>
                      <span>{t('deploy.password')}:</span>
                      <PasswordDisplay value={dep.db_credentials.password} />
                      <span>{t('deploy.database')}:</span>
                      <span style={{ fontFamily: 'monospace' }}>{dep.db_credentials.database}</span>
                      <span>{t('deploy.host')}:</span>
                      <span style={{ fontFamily: 'monospace' }}>{dep.db_credentials.host}:{dep.db_credentials.port}</span>
                    </div>
                  </div>
                )}
                {dep.endpoints && dep.endpoints.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                    <div style={{ color: '#64748b', marginBottom: '0.3rem' }}>{t('deploy.examples')}:</div>
                    {dep.endpoints.filter((ep: string) => ep.startsWith('GET')).slice(0, 2).map((ep: string) => {
                      const [, ...pathParts] = ep.split(' ')
                      const path = pathParts.join(' ')
                      return (
                        <div key={ep} style={{ marginBottom: '0.2rem' }}>
                          <code style={{ fontSize: '0.75rem', color: '#6366f1' }}>{dep.url}{path}</code>
                        </div>
                      )
                    })}
                  </div>
                )}
                {dep.custom_domain && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.78rem' }}>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </span>
                    <a href={`https://${dep.custom_domain}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>
                      {dep.custom_domain}
                    </a>
                  </div>
                )}
                {editingDomain === dep.slug ? (
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="field"
                      value={domainInput}
                      onChange={e => setDomainInput(e.target.value)}
                      placeholder="api.tudominio.com"
                      style={{ flex: 1, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                    />
                    <button type="button" className="btn primary btn-small" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleSetDomain(dep.slug, domainInput)}>{t('deploy.save')}</button>
                    <button type="button" className="btn ghost btn-small" style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => { setEditingDomain(null); setDomainInput('') }}>{t('deploy.cancel')}</button>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.3rem' }}>
                    <button type="button" className="btn ghost" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#6366f1' }}
                      onClick={() => { setEditingDomain(dep.slug); setDomainInput(dep.custom_domain || '') }}>
                      {dep.custom_domain ? t('deploy.changeDomain') : t('deploy.setDomain')}
                    </button>
                    {dep.custom_domain && (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', color: '#dc2626', marginLeft: '0.3rem' }}
                        onClick={() => handleSetDomain(dep.slug, '')}>{t('deploy.remove')}</button>
                    )}
                  </div>
                )}
                {dep.share_token && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                    <div style={{ color: '#6366f1', marginBottom: '0.3rem', fontWeight: 600 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                      {t('deploy.sharedUrl')}
                    </div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', wordBreak: 'break-all' }}>
                      {window.location.origin}/api/deploy/shared/{dep.share_token}
                    </code>
                  </div>
                )}
                <DeployLogViewer slug={dep.slug} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deploy form */}
      <div className="info-card">
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>{t('deploy.newDeploy')}</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" name="dt" checked={deployType === 'local'} onChange={() => setDeployType('local')} />
             {t('deploy.localDocker')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" name="dt" checked={deployType === 'remote'} onChange={() => setDeployType('remote')} />
             {t('deploy.remoteSsh')}
          </label>
        </div>

        {deployType === 'local' ? (
          <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              background: dockerAvail === null ? '#94a3b8' : dockerAvail?.available ? '#22c55e' : '#ef4444',
            }} />
            {dockerAvail === null ? t('deploy.verifyingDocker') : dockerAvail?.available
              ? t('deploy.dockerAvailable')
                .replace('{version}', dockerAvail.version || '')
                .replace('{count}', String(dockerAvail.containers_running ?? 0))
              : t('deploy.dockerNotAvailable').replace('{error}', dockerAvail?.error || t('deploy.unknown'))}
            {dockerAvail?.available && (
              <button type="button" className="btn ghost" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={async () => {
                  log(t('deploy.logRebuildImage'))
                  try {
                    const res = await apiFetch('/api/deploy/local/rebuild-image', { method: 'POST' })
                    const data = await res.json()
                    data.logs?.forEach((l: string) => log(l))
                  } catch (e: any) { log(` ${e.message}`) }
                }}>
                {t('deploy.rebuildImage')}
              </button>
            )}
          </div>
          <p className="muted-text" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            {t('deploy.localDesc')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <label className="form-field" style={{ margin: 0 }}>
              <span className="label">{t('deploy.apiPort')}</span>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input className="field" type="number" value={localPort} onChange={e => setLocalPort(e.target.value)} placeholder="8080"
                  style={{ width: '100px' }} />
                <button type="button" className="btn ghost" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => checkPort(localPort, 'api')}>
                  {portStatus.api === 'checking' ? '...' : portStatus.api === 'free' ? t('deploy.free') : portStatus.api === 'busy' ? t('deploy.busy') : t('deploy.check')}
                </button>
              </div>
            </label>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
              {t('deploy.deployDb')}
            </span>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
              {[
                { id: 'sqlite', label: 'SQLite', meta: t('deploy.embedded') },
                { id: 'postgresql', label: 'PostgreSQL', meta: t('deploy.externalDocker') },
                { id: 'mysql', label: 'MySQL', meta: t('deploy.externalDocker') },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDeployDbType(opt.id as any)}
                  style={{
                    flex: 1,
                    padding: '0.8rem 0.5rem',
                    borderRadius: '12px',
                    border: `2px solid ${deployDbType === opt.id ? 'var(--accent-indigo)' : 'var(--border-color)'}`,
                    background: deployDbType === opt.id ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: deployDbType === opt.id ? '#4338ca' : '#1e293b' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.65rem', color: deployDbType === opt.id ? '#6366f1' : '#64748b' }}>{opt.meta}</span>
                </button>
              ))}
            </div>
            {deployDbType === 'postgresql' && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="pgmode" checked={deployPgMode === 'existing'} onChange={() => setDeployPgMode('existing')} />
                    {t('deploy.connectExistingPg')}
                  </label>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="pgmode" checked={deployPgMode === 'new_container'} onChange={() => setDeployPgMode('new_container')} />
                    {t('deploy.newPgContainer')}
                  </label>
                </div>
                {deployPgMode === 'existing' ? (
                  <div className="form-grid" style={{ gap: '0.4rem' }}>
                    <label className="form-field"><span className="label">{t('deploy.host')}</span>
                      <input className="field" value={deployPgHost} onChange={e => setDeployPgHost(e.target.value)} placeholder="localhost" /></label>
                    <label className="form-field"><span className="label">{t('deploy.port')}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input className="field" value={deployPgPort} onChange={e => setDeployPgPort(e.target.value)} placeholder="5432"
                          style={{ width: '90px' }} />
                        <button type="button" className="btn ghost" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => checkPort(deployPgPort, 'pg-existing')}>
                          {portStatus['pg-existing'] === 'checking' ? '...' : portStatus['pg-existing'] === 'free' ? t('deploy.free') : portStatus['pg-existing'] === 'busy' ? t('deploy.busy') : t('deploy.check')}
                        </button>
                      </div></label>
                    <label className="form-field"><span className="label">{t('deploy.user')}</span>
                      <input className="field" value={deployPgUser} onChange={e => setDeployPgUser(e.target.value)} placeholder="postgres" /></label>
                    <label className="form-field"><span className="label">{t('deploy.password')}</span>
                      <input className="field" type="password" value={deployPgPass} onChange={e => setDeployPgPass(e.target.value)} /></label>
                    <label className="form-field" style={{ gridColumn: 'span 2' }}><span className="label">{t('deploy.database')}</span>
                      <input className="field" value={deployPgDb} onChange={e => setDeployPgDb(e.target.value)} placeholder="api_deploy" /></label>
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', background: 'var(--bg-hover)', border: '1px solid var(--accent-green)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}> {t('deploy.newPgContainerTitle')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.75rem', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('deploy.port')}:</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input className="field" type="number" value={containerPgPort} onChange={e => setContainerPgPort(e.target.value)} placeholder="5432"
                          style={{ width: '90px', fontSize: '0.78rem', padding: '0.2rem 0.4rem' }} />
                        <button type="button" className="btn ghost" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => checkPort(containerPgPort, 'pg')}>
                          {portStatus.pg === 'checking' ? '...' : portStatus.pg === 'free' ? t('deploy.free') : portStatus.pg === 'busy' ? t('deploy.busy') : t('deploy.check')}
                        </button>
                      </div>
                      <span style={{ color: '#4b5563' }}>{t('deploy.user')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgUser}</span>
                      <span style={{ color: '#4b5563' }}>{t('deploy.password')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgPass}</span>
                      <span style={{ color: '#4b5563' }}>{t('deploy.database')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgDb}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {deployDbType === 'mysql' && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="msmode" checked={deployMySqlMode === 'existing'} onChange={() => setDeployMySqlMode('existing')} />
                    {t('deploy.connectExistingMySql')}
                  </label>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="msmode" checked={deployMySqlMode === 'new_container'} onChange={() => setDeployMySqlMode('new_container')} />
                    {t('deploy.newMySqlContainer')}
                  </label>
                </div>
                {deployMySqlMode === 'existing' ? (
                  <div className="form-grid" style={{ gap: '0.4rem' }}>
                    <label className="form-field"><span className="label">{t('deploy.host')}</span>
                      <input className="field" value={deployMySqlHost} onChange={e => setDeployMySqlHost(e.target.value)} placeholder="localhost" /></label>
                    <label className="form-field"><span className="label">{t('deploy.port')}</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input className="field" value={deployMySqlPort} onChange={e => setDeployMySqlPort(e.target.value)} placeholder="3306"
                          style={{ width: '90px' }} />
                        <button type="button" className="btn ghost" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => checkPort(deployMySqlPort, 'mysql-existing')}>
                          {portStatus['mysql-existing'] === 'checking' ? '...' : portStatus['mysql-existing'] === 'free' ? t('deploy.free') : portStatus['mysql-existing'] === 'busy' ? t('deploy.busy') : t('deploy.check')}
                        </button>
                      </div></label>
                    <label className="form-field"><span className="label">{t('deploy.user')}</span>
                      <input className="field" value={deployMySqlUser} onChange={e => setDeployMySqlUser(e.target.value)} placeholder="root" /></label>
                    <label className="form-field"><span className="label">{t('deploy.password')}</span>
                      <input className="field" type="password" value={deployMySqlPass} onChange={e => setDeployMySqlPass(e.target.value)} /></label>
                    <label className="form-field" style={{ gridColumn: 'span 2' }}><span className="label">{t('deploy.database')}</span>
                      <input className="field" value={deployMySqlDb} onChange={e => setDeployMySqlDb(e.target.value)} placeholder="api_deploy" /></label>
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', background: 'var(--bg-hover)', border: '1px solid var(--accent-sky)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}> {t('deploy.newMySqlContainerTitle')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.75rem', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{t('deploy.port')}:</span>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input className="field" type="number" value={containerMySqlPort} onChange={e => setContainerMySqlPort(e.target.value)} placeholder="3306"
                          style={{ width: '90px', fontSize: '0.78rem', padding: '0.2rem 0.4rem' }} />
                        <button type="button" className="btn ghost" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => checkPort(containerMySqlPort, 'mysql')}>
                          {portStatus.mysql === 'checking' ? '...' : portStatus.mysql === 'free' ? t('deploy.free') : portStatus.mysql === 'busy' ? t('deploy.busy') : t('deploy.check')}
                        </button>
                      </div>
                      <span style={{ color: '#4b5563' }}>{t('deploy.user')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerMySqlUser}</span>
                      <span style={{ color: '#4b5563' }}>{t('deploy.password')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerMySqlPass}</span>
                      <span style={{ color: '#4b5563' }}>{t('deploy.database')}:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerMySqlDb}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className="form-grid" style={{ gap: '0.6rem' }}>
            <label className="form-field"><span className="label">{t('deploy.user')}</span>
              <input className="field" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" /></label>
            <label className="form-field"><span className="label">{t('deploy.hostIp')}</span>
              <input className="field" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="midominio.com" /></label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label className="form-field" style={{ flex: 1 }}><span className="label">{t('deploy.sshPort')}</span>
                <input className="field" value={sshPort} onChange={e => setSshPort(e.target.value)} placeholder="22" /></label>
              <label className="form-field" style={{ flex: 1 }}><span className="label">{t('deploy.apiPort')}</span>
                <input className="field" value={apiPort} onChange={e => setApiPort(e.target.value)} placeholder="8080" /></label>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">{t('deploy.authentication')}</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="radio" name="a" checked={sshAuthType === 'password'} onChange={() => setSshAuthType('password')} /> {t('deploy.password')}
                </label>
                <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="radio" name="a" checked={sshAuthType === 'key'} onChange={() => setSshAuthType('key')} /> {t('deploy.sshKey')}
                </label>
              </div>
              {sshAuthType === 'password'
                ? <input className="field" type="password" value={sshPassword} onChange={e => setSshPassword(e.target.value)} placeholder={t('deploy.passwordPlaceholder')} />
                : <textarea className="field" style={{ minHeight: '70px', fontFamily: 'monospace', fontSize: '0.78rem' }}
                    value={sshKey} onChange={e => setSshKey(e.target.value)}
                    placeholder={t('deploy.sshKeyPlaceholder')} />}
            </div>
          </div>
        )}

        <button type="button" className="btn" style={{ width: '100%', padding: '0.6rem', fontWeight: 600, marginTop: '0.75rem' }}
          onClick={handleDeploy} disabled={deploying}>
          {deploying ? t('deploy.deploying') : deployDone ? t('deploy.deployed') : deployType === 'local' ? t('deploy.deployLocal') : t('deploy.deployRemote')}
        </button>

        {deployLog.length > 0 && (
          <pre className="docs-code" style={{ marginTop: '0.75rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
            {deployLog.join('\n')}
          </pre>
        )}
      </div>
    </div>
  )
}

/* ========== PASSWORD DISPLAY ========== */
function PasswordDisplay({ value }: { value: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'monospace' }}>
      {visible ? value : '\u2022'.repeat(value.length > 20 ? 20 : value.length)}
      <button type="button" onClick={() => setVisible(!visible)}
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0.15rem', fontSize: '0.85rem', lineHeight: 1, color: '#64748b' }}
        title={visible ? t('deploy.hide') : t('deploy.show')}>
        {visible ? '' : ''}
      </button>
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0.15rem', fontSize: '0.75rem', lineHeight: 1, color: copied ? '#16a34a' : '#64748b' }}>
        {copied ? '\u2713' : ''}
      </button>
    </span>
  )
}

/* ========== CLI PANEL ========== */
function DeployLogViewer({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/deploy/${slug}/logs?limit=50`)
      const data = await res.json()
      setLogs(data)
    } catch { setLogs([]) }
    setLoading(false)
  }, [slug])

  useEffect(() => { if (open) loadLogs() }, [open, loadLogs])

  return (
    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
      <button
        type="button"
        className="btn ghost"
        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#6366f1' }}
        onClick={() => setOpen(!open)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        {open ? t('deploy.hideLogs') : t('deploy.viewLogs')}
        {logs.length > 0 && !open && <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', color: '#94a3b8' }}>({logs.length})</span>}
      </button>
      {open && (
        <div style={{
          marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto',
          background: '#0a0f1c', borderRadius: '6px', padding: '0.5rem',
          fontSize: '0.7rem', fontFamily: 'monospace', color: '#e2e8f0',
        }}>
          {loading ? (
            <span style={{ color: '#94a3b8' }}>{t('deploy.loading')}</span>
          ) : logs.length === 0 ? (
            <span style={{ color: '#94a3b8' }}>{t('deploy.noLogs')}</span>
          ) : (
            logs.map((log: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem', lineHeight: '1.4' }}>
                <span style={{
                  color: log.status_code && log.status_code < 400 ? '#22c55e' : '#ef4444',
                  flexShrink: 0, width: '2rem',
                }}>{log.status_code || '???'}</span>
                <span style={{ color: '#93c5fd', flexShrink: 0, width: '0.5rem' }}>{log.method}</span>
                <span style={{ color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.path}</span>
                <span style={{ color: '#94a3b8', flexShrink: 0 }}>{log.latency_ms}ms</span>
              </div>
            ))
          )}
          {logs.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', marginTop: '0.3rem', color: '#94a3b8' }}
              onClick={loadLogs}
            >{t('deploy.refresh')}</button>
          )}
        </div>
      )}
    </div>
  )
}

function CliDeployPanel({ project }: any) {
  const { t } = useTranslation()
  const steps = [
    { title: t('deploy.cliExport'), desc: t('deploy.cliExportDesc'), code: `doapi init ${project.slug || '<slug>'} -o mi-api.json` },
    { title: t('deploy.cliLocal'), desc: t('deploy.cliLocalDesc'), code: 'doapi deploy mi-api.json --port 8080' },
    { title: t('deploy.cliVps'), desc: t('deploy.cliVpsDesc'), code: 'doapi deploy mi-api.json --ssh user@host --port 80' },
    { title: t('deploy.cliServe'), desc: t('deploy.cliServeDesc'), code: `doapi serve ${project.slug || '<slug>'} --port 8081` },
  ]
  return (
    <div>
      <div className="info-card" style={{ marginBottom: '0.75rem' }}>
        <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0 }}>
          {t('deploy.cliHelp')} <code className="docs-code--inline">doapi --help</code> {t('deploy.cliHelpEnd')}
        </p>
      </div>
      {steps.map((s, i) => (
        <div key={i} className="info-step" style={{ marginBottom: '0.6rem' }}>
          <span className="info-step__num" style={{ background: '#6366f1' }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <strong>{s.title}</strong>
            <p>{s.desc}</p>
            <pre className="docs-code" style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{s.code}</pre>
          </div>
        </div>
      ))}
      <div className="docs-checklist" style={{ marginTop: '1rem' }}>
        <h3>{t('deploy.cliRequirements')}</h3>
        <ul>
          <li><span className="docs-checkmark">{'\u2713'}</span> {t('deploy.cliReqDocker')}</li>
          <li><span className="docs-checkmark">{'\u2713'}</span> {t('deploy.cliReqSsh')}</li>
          <li><span className="docs-checkmark">{'\u2713'}</span> {t('deploy.cliReqFirewall')}</li>
        </ul>
      </div>
    </div>
  )
}
