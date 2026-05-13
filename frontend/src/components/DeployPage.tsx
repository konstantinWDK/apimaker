import { useState, useEffect, useCallback } from 'react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { apiFetch } from '../lib/api'

export function DeployPage() {
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
          <h1 className="info-hero__title">Despliegue</h1>
          <p className="info-hero__subtitle">
            Gestiona tus APIs desplegadas y despliega nuevas.
          </p>
        </div>
      </div>

      <div className="docs-tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`docs-tab ${activeTab === 'desplegar' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('desplegar')}>
          <span className="docs-tab__icon">▲</span> Gestionar despliegues
        </button>
        <button className={`docs-tab ${activeTab === 'cli' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('cli')}>
          <span className="docs-tab__icon">⌘</span> CLI / Terminal
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
  const [deployType, setDeployType] = useState<'local' | 'remote'>('local')
  const [localPort, setLocalPort] = useState('8080')
  const [deployDbType, setDeployDbType] = useState<'sqlite' | 'postgresql'>('sqlite')
  const [deployPgMode, setDeployPgMode] = useState<'existing' | 'new_container'>('existing')
  const [deployPgHost, setDeployPgHost] = useState('localhost')
  const [deployPgPort, setDeployPgPort] = useState('5432')
  const [deployPgUser, setDeployPgUser] = useState('postgres')
  const [deployPgPass, setDeployPgPass] = useState('')
  const [deployPgDb, setDeployPgDb] = useState('api_deploy')
  const [containerPgUser] = useState('apimaker')
  const [containerPgPass] = useState(generatePassword)
  const [containerPgDb] = useState('api_deploy')
  const [sshHost, setSshHost] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [sshAuthType, setSshAuthType] = useState<'password' | 'key'>('password')
  const [sshPassword, setSshPassword] = useState('')
  const [sshKey, setSshKey] = useState('')
  const [apiPort, setApiPort] = useState('8080')
  const [deployLog, setDeployLog] = useState<string[]>([])
  const [deploying, setDeploying] = useState(false)
  const [deployDone, setDeployDone] = useState(false)
  const [dockerAvail, setDockerAvail] = useState<{ available: boolean; version?: string; containers_running?: number; error?: string } | null>(null)

  useEffect(() => {
    apiFetch('/api/deploy/docker-status').then(r => r.json()).then(setDockerAvail).catch(() => setDockerAvail({ available: false }))
  }, [])

  const log = useCallback((msg: string) => setDeployLog((prev: string[]) => [...prev, msg]), [])

  const handleAction = async (slug: string, action: 'stop' | 'delete' | 'restart' | 'start') => {
    if (action === 'delete' && !window.confirm('¿Eliminar deployment?\n\nSe detendrá el contenedor, se borrará la imagen Docker, los archivos y el registro.\nLos datos de la BD se perderán.')) return
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

  const handleDeploy = async () => {
    setDeploying(true); setDeployDone(false); setDeployLog([])
    try {
      const pid = await saveProject()
      if (!pid) { log('❌ Error al guardar proyecto'); setDeploying(false); return }
      log(`✅ Proyecto guardado`)

      if (deployType === 'local') {
        log(`🐳 Desplegando local en puerto ${localPort}...`)
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
            deployBody.db_user = containerPgUser
            deployBody.db_password = containerPgPass
            deployBody.db_name = containerPgDb
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
        } else if (result.status === 'no_docker') {
          log('⚠️ Docker no disponible. Sigue instrucciones manuales.')
        }
      } else {
        log('📦 Exportando proyecto...')
        const exportRes = await apiFetch(`/projects/${pid}/export`)
        const projectData = await exportRes.json()
        log(`✅ "${projectData.name}" exportado`)
        const sshCmd = sshAuthType === 'key' && sshKey.trim() ? `ssh -i ~/.ssh/deploy_key -p ${sshPort} ${sshUser}@${sshHost}` : `ssh ${sshUser}@${sshHost} -p ${sshPort}`
        const scpCmd = sshAuthType === 'key' && sshKey.trim() ? `scp -P ${sshPort} -i ~/.ssh/deploy_key proyecto.json ${sshUser}@${sshHost}:/tmp/` : `scp -P ${sshPort} proyecto.json ${sshUser}@${sshHost}:/tmp/`
        log(`📌 Despliegue manual:`)
        log(`   1. apimaker init ${project.slug || project.id} -o proyecto.json`)
        log(`   2. ${scpCmd}`)
        log(`   3. ${sshCmd}`)
        log(`   4. apimaker deploy /tmp/proyecto.json --port ${apiPort}`)
        setDeployDone(true)
      }
    } catch (e: any) { log(`❌ ${e.message || e}`) }
    setDeploying(false)
  }

  const statusColor = (s: string) => s === 'running' ? '#22c55e' : s === 'stopped' ? '#ef4444' : '#94a3b8'
  const statusLabel = (s: string) => s === 'running' ? 'Corriendo' : s === 'stopped' ? 'Detenido' : 'Desconocido'

  return (
    <div>
      {/* Deployments list */}
      <div className="info-card" style={{ marginBottom: '1rem' }}>
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>
          APIs desplegadas ({loading ? '...' : deployments.length})
        </h3>
        {loading ? (
          <p className="muted-text">Cargando despliegues...</p>
        ) : deployments.length === 0 ? (
          <p className="muted-text">No hay APIs desplegadas aún. Usa el formulario de abajo para desplegar una.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {deployments.map((dep: any) => (
              <div key={dep.slug} style={{
                padding: '0.75rem 1rem',
                border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(dep.docker_status), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{dep.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {dep.url} · {dep.stack} · {statusLabel(dep.docker_status)}
                    </div>
                  </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      {dep.docker_status === 'running' ? (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                        onClick={() => handleAction(dep.slug, 'stop')}>Detener</button>
                    ) : (
                      <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#166534' }}
                        onClick={() => handleAction(dep.slug, 'start')}>Iniciar</button>
                    )}
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleAction(dep.slug, 'restart')}>Reconstruir</button>
                    <button type="button" className="btn ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                      onClick={() => handleAction(dep.slug, 'delete')}>Eliminar</button>
                  </div>
                </div>
                {dep.endpoints && dep.endpoints.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                    <div style={{ color: '#64748b', marginBottom: '0.3rem' }}>Ejemplos:</div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deploy form */}
      <div className="info-card">
        <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Nuevo despliegue</h3>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" name="dt" checked={deployType === 'local'} onChange={() => setDeployType('local')} />
            🖥️ Local (Docker)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" name="dt" checked={deployType === 'remote'} onChange={() => setDeployType('remote')} />
            ☁️ Remoto (SSH)
          </label>
        </div>

        {deployType === 'local' ? (
          <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              background: dockerAvail === null ? '#94a3b8' : dockerAvail?.available ? '#22c55e' : '#ef4444',
            }} />
            {dockerAvail === null ? 'Verificando Docker...' : dockerAvail?.available
              ? `Docker disponible (v${dockerAvail.version}, ${dockerAvail.containers_running} contenedores activos)`
              : `Docker no disponible - ${dockerAvail?.error || 'desconocido'}`}
            {dockerAvail?.available && (
              <button type="button" className="btn ghost" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={async () => {
                  log('🔄 Reconstruyendo imagen Docker local...')
                  try {
                    const res = await apiFetch('/api/deploy/local/rebuild-image', { method: 'POST' })
                    const data = await res.json()
                    data.logs?.forEach((l: string) => log(l))
                  } catch (e: any) { log(`❌ ${e.message}`) }
                }}>
                Reconstruir imagen
              </button>
            )}
          </div>
          <p className="muted-text" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
            Despliega en el mismo servidor (requiere Docker). Si el puerto está ocupado, se asigna el siguiente disponible.
          </p>
          <label className="form-field" style={{ maxWidth: '200px' }}>
            <span className="label">Puerto preferido</span>
            <input className="field" type="number" value={localPort} onChange={e => setLocalPort(e.target.value)} placeholder="8080" />
          </label>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
              Base de datos de la API desplegada
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input type="radio" name="ddb" checked={deployDbType === 'sqlite'} onChange={() => setDeployDbType('sqlite')} />
                SQLite (embebida)
              </label>
              <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input type="radio" name="ddb" checked={deployDbType === 'postgresql'} onChange={() => setDeployDbType('postgresql')} />
                PostgreSQL (externa)
              </label>
            </div>
            {deployDbType === 'postgresql' && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="pgmode" checked={deployPgMode === 'existing'} onChange={() => setDeployPgMode('existing')} />
                    Conectar a PostgreSQL existente
                  </label>
                  <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="radio" name="pgmode" checked={deployPgMode === 'new_container'} onChange={() => setDeployPgMode('new_container')} />
                    Nuevo contenedor PostgreSQL
                  </label>
                </div>
                {deployPgMode === 'existing' ? (
                  <div className="form-grid" style={{ gap: '0.4rem' }}>
                    <label className="form-field"><span className="label">Host</span>
                      <input className="field" value={deployPgHost} onChange={e => setDeployPgHost(e.target.value)} placeholder="localhost" /></label>
                    <label className="form-field"><span className="label">Puerto</span>
                      <input className="field" value={deployPgPort} onChange={e => setDeployPgPort(e.target.value)} placeholder="5432" /></label>
                    <label className="form-field"><span className="label">Usuario</span>
                      <input className="field" value={deployPgUser} onChange={e => setDeployPgUser(e.target.value)} placeholder="postgres" /></label>
                    <label className="form-field"><span className="label">Contraseña</span>
                      <input className="field" type="password" value={deployPgPass} onChange={e => setDeployPgPass(e.target.value)} /></label>
                    <label className="form-field" style={{ gridColumn: 'span 2' }}><span className="label">Base de datos</span>
                      <input className="field" value={deployPgDb} onChange={e => setDeployPgDb(e.target.value)} placeholder="api_deploy" /></label>
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.82rem', color: '#166534' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📦 Nuevo contenedor PostgreSQL 16</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.75rem', fontSize: '0.78rem' }}>
                      <span style={{ color: '#4b5563' }}>Usuario:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgUser}</span>
                      <span style={{ color: '#4b5563' }}>Contraseña:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgPass}</span>
                      <span style={{ color: '#4b5563' }}>Base de datos:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{containerPgDb}</span>
                      <span style={{ color: '#4b5563' }}>Volumen:</span>
                      <span style={{ fontFamily: 'monospace' }}>pgdata</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        ) : (
          <div className="form-grid" style={{ gap: '0.6rem' }}>
            <label className="form-field"><span className="label">Usuario</span>
              <input className="field" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" /></label>
            <label className="form-field"><span className="label">Host / IP</span>
              <input className="field" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="midominio.com" /></label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label className="form-field" style={{ flex: 1 }}><span className="label">Puerto SSH</span>
                <input className="field" value={sshPort} onChange={e => setSshPort(e.target.value)} placeholder="22" /></label>
              <label className="form-field" style={{ flex: 1 }}><span className="label">Puerto API</span>
                <input className="field" value={apiPort} onChange={e => setApiPort(e.target.value)} placeholder="8080" /></label>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Autenticación</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="radio" name="a" checked={sshAuthType === 'password'} onChange={() => setSshAuthType('password')} /> Contraseña
                </label>
                <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="radio" name="a" checked={sshAuthType === 'key'} onChange={() => setSshAuthType('key')} /> Clave SSH
                </label>
              </div>
              {sshAuthType === 'password'
                ? <input className="field" type="password" value={sshPassword} onChange={e => setSshPassword(e.target.value)} placeholder="Contraseña" />
                : <textarea className="field" style={{ minHeight: '70px', fontFamily: 'monospace', fontSize: '0.78rem' }}
                    value={sshKey} onChange={e => setSshKey(e.target.value)}
                    placeholder="Pega tu clave privada (~/.ssh/id_rsa)" />}
            </div>
          </div>
        )}

        <button type="button" className="btn" style={{ width: '100%', padding: '0.6rem', fontWeight: 600, marginTop: '0.75rem' }}
          onClick={handleDeploy} disabled={deploying}>
          {deploying ? 'Desplegando...' : deployDone ? '✅ Desplegado' : deployType === 'local' ? '🐳 Desplegar Local' : '🚀 Desplegar Remoto'}
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

/* ========== CLI PANEL ========== */
function CliDeployPanel({ project }: any) {
  const steps = [
    { title: 'Exportar proyecto', desc: 'Exporta a JSON portátil.', code: `apimaker init ${project.slug || '<slug>'} -o mi-api.json` },
    { title: 'Desplegar localmente', desc: 'API independiente sin Docker.', code: 'apimaker deploy mi-api.json --port 8080' },
    { title: 'Desplegar en VPS (SSH)', desc: 'Requiere Docker en el servidor.', code: 'apimaker deploy mi-api.json --ssh user@host --port 80' },
    { title: 'Servir desde DB', desc: 'Mock en otro puerto desde la DB del builder.', code: `apimaker serve ${project.slug || '<slug>'} --port 8081` },
  ]
  return (
    <div>
      <div className="info-card" style={{ marginBottom: '0.75rem' }}>
        <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0 }}>
          Usa <code className="docs-code--inline">apimaker --help</code> para ver todos los comandos.
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
        <h3>Requisitos deploy remoto</h3>
        <ul>
          <li><span className="docs-checkmark">✓</span> Servidor con Docker y docker compose</li>
          <li><span className="docs-checkmark">✓</span> Conexión SSH configurada</li>
          <li><span className="docs-checkmark">✓</span> Puerto API abierto en firewall</li>
        </ul>
      </div>
    </div>
  )
}
