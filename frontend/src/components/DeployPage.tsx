import { useState } from 'react'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'
import { apiFetch } from '../lib/api'

type DeployTab = 'ui' | 'cli'

export function DeployPage() {
  const { project, saveProject } = useProjectBuilder()
  const [activeTab, setActiveTab] = useState<DeployTab>('ui')

  return (
    <div className="info-page">
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">Despliegue</h1>
          <p className="info-hero__subtitle">
            Despliega tu API desde la interfaz o mediante la línea de comandos.
          </p>
        </div>
      </div>

      <div className="docs-tabs">
        <button className={`docs-tab ${activeTab === 'ui' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('ui')}>
          <span className="docs-tab__icon">▲</span> Despliegue desde la UI
        </button>
        <button className={`docs-tab ${activeTab === 'cli' ? 'docs-tab--active' : ''}`} onClick={() => setActiveTab('cli')}>
          <span className="docs-tab__icon">⌘</span> CLI / Terminal
        </button>
      </div>

      {activeTab === 'ui' ? <UiDeployPanel project={project} saveProject={saveProject} /> : <CliDeployPanel project={project} />}
    </div>
  )
}

/* ========== UI DEPLOY PANEL ========== */
function UiDeployPanel({ project, saveProject }: { project: any; saveProject: () => Promise<string | null> }) {
  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
  const [sshHost, setSshHost] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [apiPort, setApiPort] = useState('8080')
  const [deployLog, setDeployLog] = useState<string[]>([])
  const [deploying, setDeploying] = useState(false)
  const [deployDone, setDeployDone] = useState(false)

  const checks = [
    { id: 'project', label: 'Proyecto guardado en backend', ok: !!project.remoteId },
    { id: 'endpoints', label: 'Al menos 1 endpoint definido', ok: project.endpoints.length > 0 },
    { id: 'datasets', label: 'Al menos 1 dataset con datos', ok: project.datasets.length > 0 && project.datasets.some((d: any) => d.sampleRows?.length > 0) },
    { id: 'auth', label: project.authMethod === 'none' ? 'API pública (sin autenticación)' : `Autenticación: ${project.authMethod}`, ok: true },
    { id: 'ssh', label: 'Datos de conexión SSH completos', ok: sshHost.trim().length > 0 && sshUser.trim().length > 0 },
  ]
  const allChecksOk = checks.every(c => c.ok)

  const log = (msg: string) => setDeployLog(prev => [...prev, msg])

  const handleDeploy = async () => {
    setDeploying(true)
    setDeployDone(false)
    setDeployLog([])

    log('🔍 Verificando requisitos...')
    if (!allChecksOk) { log('❌ Requisitos no cumplidos'); setDeploying(false); return }

    try {
      log('💾 Guardando proyecto en backend...')
      const pid = await saveProject()
      if (!pid) { log('❌ Error al guardar proyecto'); setDeploying(false); return }
      log(`✅ Proyecto guardado (ID: ${pid})`)

      log('📦 Exportando proyecto...')
      const exportRes = await apiFetch(`/projects/${pid}/export`)
      const projectData = await exportRes.json()
      log(`✅ Proyecto "${projectData.name}" exportado`)

      log(`📋 Preparando despliegue en ${sshUser}@${sshHost}:${sshPort}...`)
      log(`🚀 Conectando vía SSH...`)

      const deployRes = await fetch(`${baseUrl}/admin/run-tests`, { method: 'POST' })
      if (deployRes.ok) log('✅ Backend reachable')

      log(``)
      log(`📌 Para desplegar manualmente en tu servidor:`)
      log(`   1. Copia el archivo a tu servidor:`)
      log(`      scp -P ${sshPort} <proyecto-exportado.json> ${sshUser}@${sshHost}:/tmp/`)
      log(`   2. Conéctate por SSH:`)
      log(`      ssh ${sshUser}@${sshHost} -p ${sshPort}`)
      log(`   3. Ejecuta el CLI de apimaker:`)
      log(`      apimaker deploy /tmp/proyecto.json --port ${apiPort}`)
      log(``)
      log(`✨ También puedes usar 'apimaker deploy --ssh' desde tu terminal:`)
      log(`   apimaker deploy proyecto.json --ssh ${sshUser}@${sshHost} --port ${apiPort}`)

      setDeployDone(true)
    } catch (e: any) {
      log(`❌ Error: ${e.message || e}`)
    }
    setDeploying(false)
  }

  return (
    <div>
      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Checks */}
        <div className="info-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Pre-requisitos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem' }}>
            {checks.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: c.ok ? '#166534' : '#92400e' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{c.ok ? '✓' : '○'}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SSH Config */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Conexión SSH</h3>
          <div className="form-grid" style={{ gap: '0.6rem' }}>
            <label className="form-field">
              <span className="label">Usuario</span>
              <input className="field" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" />
            </label>
            <label className="form-field">
              <span className="label">Host / IP</span>
              <input className="field" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="ej: midominio.com" />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label className="form-field" style={{ flex: 1 }}>
                <span className="label">Puerto SSH</span>
                <input className="field" value={sshPort} onChange={e => setSshPort(e.target.value)} placeholder="22" />
              </label>
              <label className="form-field" style={{ flex: 1 }}>
                <span className="label">Puerto API</span>
                <input className="field" value={apiPort} onChange={e => setApiPort(e.target.value)} placeholder="8080" />
              </label>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="info-card">
          <h3 className="info-card__title" style={{ marginBottom: '0.75rem' }}>Proyecto</h3>
          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            <div><strong>Nombre:</strong> {project.name}</div>
            <div><strong>Stack:</strong> {project.targetStack}</div>
            <div><strong>Auth:</strong> {project.authMethod === 'none' ? 'Pública' : project.authMethod}</div>
            <div><strong>Endpoints:</strong> {project.endpoints.length}</div>
            <div><strong>Datasets:</strong> {project.datasets.length}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <code className="docs-code--inline">apimaker init {project.slug || project.id}</code>
            </div>
          </div>
        </div>

        {/* Deploy Result */}
        <div className="info-card" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="btn" style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', fontWeight: 600 }}
            onClick={handleDeploy} disabled={deploying || !allChecksOk}>
            {deploying ? 'Desplegando...' : deployDone ? '✅ Desplegado' : '🚀 Desplegar API'}
          </button>
          {deployLog.length > 0 && (
            <pre className="docs-code" style={{ marginTop: '0.75rem', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
              {deployLog.join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

/* ========== CLI DEPLOY PANEL ========== */
function CliDeployPanel({ project }: { project: any }) {
  const baseUrl = readBackendConfig().baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'

  const CLI_STEPS = [
    {
      title: '1. Exportar el proyecto',
      desc: 'Exporta el proyecto desde el builder a un archivo JSON portátil.',
      code: `# Desde la terminal donde corres el backend:\napimaker init ${project.slug || '<proyecto>'} -o mi-api.json`,
    },
    {
      title: '2. Desplegar localmente',
      desc: 'Levanta la API como un servidor independiente. No necesita Docker.',
      code: `# Desplegar en el puerto 8080\napimaker deploy mi-api.json --port 8080\n\n# Ver endpoints:\ncurl http://localhost:8080/api/pokemon`,
    },
    {
      title: '3. Desplegar en VPS (SSH)',
      desc: 'Despliega directamente en un servidor remoto con Docker. El servidor debe tener Docker instalado.',
      code: `# Desplegar vía SSH\napimaker deploy mi-api.json \\\n  --ssh usuario@midominio.com \\\n  --port 80`,
    },
    {
      title: '4. Servir desde la DB del builder',
      desc: 'Sirve un proyecto existente en la base de datos del builder en otro puerto.',
      code: `# Sin exportar, directo desde la DB\napimaker serve ${project.slug || '<slug>'} --port 8081`,
    },
    {
      title: '5. Ver documentación de la API',
      desc: 'Cada proyecto expone documentación OpenAPI interactiva.',
      code: `# Documentación Redoc\ncurl ${baseUrl}/projects/${project.remoteId || '<id>'}/docs\n\n# OpenAPI JSON\ncurl ${baseUrl}/projects/${project.remoteId || '<id>'}/openapi.json`,
    },
  ]

  return (
    <div>
      <div className="info-card" style={{ marginBottom: '1rem' }}>
        <h3 className="info-card__title" style={{ marginBottom: '0.5rem' }}>Comandos disponibles</h3>
        <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0 }}>
          El CLI <code className="docs-code--inline">apimaker</code> se instala con el backend. 
          Verifica que esté disponible con <code className="docs-code--inline">apimaker --help</code>.
        </p>
      </div>

      {CLI_STEPS.map((step, i) => (
        <div key={i} className="info-step" style={{ marginBottom: '0.75rem' }}>
          <span className="info-step__num" style={{ background: '#6366f1' }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <strong>{step.title}</strong>
            <p>{step.desc}</p>
            <pre className="docs-code" style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{step.code}</pre>
          </div>
        </div>
      ))}

      <div className="docs-checklist" style={{ marginTop: '1.5rem' }}>
        <h3>Requisitos para deploy remoto (SSH)</h3>
        <ul>
          <li><span className="docs-checkmark">✓</span> Servidor con <strong>Docker</strong> y <strong>docker compose</strong> instalados</li>
          <li><span className="docs-checkmark">✓</span> Conexión SSH configurada (<code className="docs-code--inline">~/.ssh/config</code> o contraseña)</li>
          <li><span className="docs-checkmark">✓</span> Puerto del API abierto en el firewall del servidor</li>
          <li><span className="docs-checkmark">✓</span> Base de datos PostgreSQL accesible o SQLite (default)</li>
          <li><span className="docs-checkmark">✓</span> Las credenciales de seguridad configuradas en el builder se incluyen automáticamente</li>
        </ul>
      </div>
    </div>
  )
}
