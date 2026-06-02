import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const METHOD_COLORS: Record<string, string> = {
  GET: '#0ea5e9', POST: '#10b981', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#f43f5e',
}

type DocTab = 'overview' | 'instalacion' | 'tutorial' | 'cli' | 'codigo' | 'desplegar'

interface TocItem { id: string; label: string; tab: DocTab }

export function DocsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<DocTab>('overview')

  const TABLE_OF_CONTENTS: TocItem[] = [
    { id: 'overview', label: t('docs.tabOverview'), tab: 'overview' },
    { id: 'features', label: t('docs.features'), tab: 'overview' },
    { id: 'arquitectura', label: t('docs.architecture'), tab: 'overview' },
    { id: 'stacks', label: t('info.availableStacks'), tab: 'overview' },
    { id: 'quickstart', label: t('info.quickStart'), tab: 'overview' },
    { id: 'instalacion', label: t('docs.tabInstall'), tab: 'instalacion' },
    { id: 'install-reqs', label: t('docs.installReqs'), tab: 'instalacion' },
    { id: 'install-linux', label: t('docs.installLinux'), tab: 'instalacion' },
    { id: 'install-windows', label: t('docs.installWindows'), tab: 'instalacion' },
    { id: 'install-docker', label: t('docs.installDocker'), tab: 'instalacion' },
    { id: 'install-after', label: t('docs.installAfter'), tab: 'instalacion' },
    { id: 'tutorial', label: t('docs.tabTutorial'), tab: 'tutorial' },
    { id: 'cli', label: t('docs.tabCli'), tab: 'cli' },
    { id: 'codigo', label: t('docs.tabCode'), tab: 'codigo' },
    { id: 'desplegar', label: t('docs.tabDeploy'), tab: 'desplegar' },
    { id: 'vps-arch', label: t('docs.vpsArchTitle'), tab: 'desplegar' },
    { id: 'vps-harden', label: t('docs.vpsHardeningTitle'), tab: 'desplegar' },
    { id: 'vps-telemetry', label: t('docs.telemetryTitle'), tab: 'desplegar' },
    { id: 'vps-secrets', label: t('docs.vpsSecretsTitle'), tab: 'desplegar' },
  ]

  const scrollTo = (id: string, tab: DocTab) => {
    setActiveTab(tab)
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const renderOverview = () => (
    <div>
      <div className="info-hero" style={{ marginBottom: '1.5rem' }}>
        <div className="info-hero__content">
          <h1 className="info-hero__title">DoApi</h1>
          <p className="info-hero__subtitle">{t('docs.overviewSubtitle')}</p>
          <div className="info-hero__stats">
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">3</span>
              <span className="info-hero__stat-label">{t('docs.stacks')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">30+</span>
              <span className="info-hero__stat-label">{t('docs.endpointsApi')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">2</span>
              <span className="info-hero__stat-label">{t('docs.sdks')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">1</span>
              <span className="info-hero__stat-label">{t('docs.command')}</span>
            </div>
          </div>
        </div>
      </div>

      <div id="features" className="docs-section">
        <h2 className="docs-section__title">{t('docs.features')}</h2>
        <div className="info-grid">
          <div className="info-card"><h3 className="info-card__title">{t('docs.datasetsTitle')}</h3><p className="info-card__desc">{t('docs.datasetsDesc')}</p></div>
          <div className="info-card"><h3 className="info-card__title">{t('docs.endpointsRestTitle')}</h3><p className="info-card__desc">{t('docs.endpointsRestDesc')}</p></div>
          <div className="info-card"><h3 className="info-card__title">{t('docs.codeGenTitle')}</h3><p className="info-card__desc">{t('docs.codeGenDesc')}</p></div>
          <div className="info-card"><h3 className="info-card__title">{t('docs.mockServerTitle')}</h3><p className="info-card__desc">{t('docs.mockServerDesc')}</p></div>
          <div className="info-card"><h3 className="info-card__title">{t('docs.cliDeployTitle')}</h3><p className="info-card__desc">{t('docs.cliDeployDesc')}</p></div>
          <div className="info-card"><h3 className="info-card__title">{t('docs.shareLinksTitle')}</h3><p className="info-card__desc">{t('docs.shareLinksDesc')}</p></div>
        </div>
      </div>

      <div id="arquitectura" className="docs-section">
        <h2 className="docs-section__title">{t('docs.architecture')}</h2>
        <div className="info-stacks">
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#6366f1' }} /><strong>{t('docs.modelsSchemas')}</strong></div><p className="info-stack__desc">{t('docs.modelsSchemasDesc')}</p></div>
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#0ea5e9' }} /><strong>{t('docs.controllers')}</strong></div><p className="info-stack__desc">{t('docs.controllersDesc')}</p></div>
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#10b981' }} /><strong>{t('docs.security')}</strong></div><p className="info-stack__desc">{t('docs.securityDesc')}</p></div>
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#f59e0b' }} /><strong>{t('docs.deployment')}</strong></div><p className="info-stack__desc">{t('docs.deploymentDesc')}</p></div>
        </div>
      </div>

      <div id="stacks" className="docs-section">
        <h2 className="docs-section__title">{t('info.availableStacks')}</h2>
        <div className="info-stacks">
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#3b82f6' }} /><strong>FastAPI</strong><span className="info-stack__badge">{t('info.complete')}</span></div><p className="info-stack__desc">{t('info.fastapiDesc')}</p></div>
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#10b981' }} /><strong>Express</strong><span className="info-stack__badge">{t('info.complete')}</span></div><p className="info-stack__desc">{t('info.expressDesc')}</p></div>
          <div className="info-stack"><div className="info-stack__head"><span className="info-stack__dot" style={{ background: '#8b5cf6' }} /><strong>NestJS</strong><span className="info-stack__badge">{t('info.complete')}</span></div><p className="info-stack__desc">{t('info.nestjsDesc')}</p></div>
        </div>
      </div>

      <div id="quickstart" className="docs-section">
        <h2 className="docs-section__title">{t('info.quickStart')}</h2>
        <div className="info-steps">
          <div className="info-step"><span className="info-step__num">1</span><div><strong>{t('info.installAndStart')}</strong><p>{t('info.installDesc')}</p></div></div>
          <div className="info-step"><span className="info-step__num">2</span><div><strong>{t('info.createDataset')}</strong><p>{t('info.createDatasetDesc')}</p></div></div>
          <div className="info-step"><span className="info-step__num">3</span><div><strong>{t('info.designEndpoints')}</strong><p>{t('info.designEndpointsDesc')}</p></div></div>
          <div className="info-step"><span className="info-step__num">4</span><div><strong>{t('info.testSimulator')}</strong><p>{t('info.testSimulatorDesc')}</p></div></div>
          <div className="info-step"><span className="info-step__num">5</span><div><strong>{t('info.generateDeploy')}</strong><p>{t('info.generateDeployDesc')}</p></div></div>
        </div>
      </div>
    </div>
  )

  const renderInstalacion = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.tabInstall')}</h1>
        <p className="docs-header__desc">{t('docs.installDesc')}</p>
      </div>

      <div id="install-reqs" className="docs-section">
        <h2 className="docs-section__title">{t('docs.installReqs')}</h2>
        <p className="docs-section__text">{t('docs.installReqsDesc')}</p>
        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.2rem' }}>
          <li><strong>Python 3.11+</strong> — {t('docs.installReqPython')}</li>
          <li><strong>Node.js 18+</strong> — {t('docs.installReqNode')}</li>
          <li><strong>Docker</strong> — {t('docs.installReqDocker')} ({t('docs.optional')})</li>
          <li><strong>PostgreSQL / MySQL</strong> — {t('docs.installReqDb')} ({t('docs.optional')})</li>
        </ul>
      </div>

      <div id="install-linux" className="docs-section">
        <h2 className="docs-section__title">{t('docs.installLinux')}</h2>
        <p className="docs-section__text">{t('docs.installLinuxDesc')}</p>
        <pre className="docs-code">{`# 1. Clonar el repositorio
git clone https://github.com/tuusuario/doapi.git
cd doapi

# 2. Ejecutar el instalador interactivo
chmod +x install.sh
./install.sh

# 3. El instalador te guiará por:
#    - Credenciales de admin
#    - Base de datos (SQLite / PostgreSQL / MySQL)
#    - Configuración de Docker (opcional)

# 4. Iniciar la aplicación
./start.sh

# Backend: http://localhost:8000
# Frontend: http://localhost:5173`}</pre>
      </div>

      <div id="install-windows" className="docs-section">
        <h2 className="docs-section__title">{t('docs.installWindows')}</h2>
        <p className="docs-section__text">{t('docs.installWindowsDesc')}</p>
        <pre className="docs-code">{`# 1. Clonar el repositorio
git clone https://github.com/tuusuario/doapi.git
cd doapi

# 2. Ejecutar el instalador (doble clic o desde terminal)
install.bat

# 3. El instalador te guiará por:
#    - Credenciales de admin
#    - Base de datos (SQLite / PostgreSQL / MySQL)
#    - Configuración de Docker (opcional)

# 4. Iniciar la aplicación
start.bat`}</pre>
      </div>

      <div id="install-docker" className="docs-section">
        <h2 className="docs-section__title">{t('docs.installDocker')}</h2>
        <p className="docs-section__text">{t('docs.installDockerDesc')}</p>
        <pre className="docs-code">{`# Usar Docker Compose (requiere Docker instalado)
docker compose up -d --build

# Esto levanta:
#   - Backend en http://localhost:8000
#   - Frontend en http://localhost:5173
#   - PostgreSQL en puerto 5432 (opcional)
#   - MySQL en puerto 3306 (opcional)

# Ver logs
docker compose logs -f`}</pre>
        <div className="docs-checklist" style={{ marginTop: '0.75rem' }}>
          <h3>{t('docs.installDockerEnv')}</h3>
          <ul>
            <li><span className="docs-checkmark">✓</span> <code>APIMAKER_DATABASE_URL</code> — {t('docs.envDbUrl')}</li>
            <li><span className="docs-checkmark">✓</span> <code>APIMAKER_JWT_SECRET_KEY</code> — {t('docs.envJwt')}</li>
            <li><span className="docs-checkmark">✓</span> <code>APIMAKER_ENCRYPTION_KEY</code> — {t('docs.envEncryption')}</li>
            <li><span className="docs-checkmark">✓</span> <code>APIMAKER_DEPLOY_HOST_PATH</code> — {t('docs.envDeployPath')}</li>
          </ul>
        </div>
      </div>

      <div id="install-after" className="docs-section">
        <h2 className="docs-section__title">{t('docs.installAfter')}</h2>
        <p className="docs-section__text">{t('docs.installAfterDesc')}</p>
        <ol style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '1.2rem' }}>
          <li><strong>{t('docs.installAfter1')}</strong> — {t('docs.installAfter1Desc')}</li>
          <li><strong>{t('docs.installAfter2')}</strong> — {t('docs.installAfter2Desc')}</li>
          <li><strong>{t('docs.installAfter3')}</strong> — {t('docs.installAfter3Desc')}</li>
          <li><strong>{t('docs.installAfter4')}</strong> — {t('docs.installAfter4Desc')}</li>
        </ol>
      </div>
    </div>
  )

  const renderTutorial = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.tutorialTitle')}</h1>
        <p className="docs-header__desc">{t('docs.tutorialDesc')}</p>
      </div>
      {[
        { num: 1, title: t('docs.tutorialStep1Title'), desc: t('docs.tutorialStep1Desc'), code: t('docs.tutorialStep1Code') },
        { num: 2, title: t('docs.tutorialStep2Title'), desc: t('docs.tutorialStep2Desc'), code: t('docs.tutorialStep2Code') },
        { num: 3, title: t('docs.tutorialStep3Title'), desc: t('docs.tutorialStep3Desc'), code: t('docs.tutorialStep3Code') },
        {
          num: 4, title: t('docs.tutorialStep4Title'), desc: t('docs.tutorialStep4Desc'),
          fields: [
            { label: t('docs.tutorialFieldName'), value: 'API Usuarios Banco' },
            { label: t('docs.tutorialFieldDesc'), value: t('docs.tutorialFieldDescValue') },
            { label: t('docs.tutorialFieldStack'), value: 'fastapi' },
          ],
        },
        {
          num: 5, title: t('docs.tutorialStep5Title'), desc: t('docs.tutorialStep5Desc'),
          table: [
            { name: 'id_cliente', type: 'integer', req: true },
            { name: 'nombre', type: 'string', req: true },
            { name: 'email', type: 'string', req: true },
            { name: 'fecha_registro', type: 'datetime', req: false },
          ],
        },
        {
          num: 6, title: t('docs.tutorialStep6Title'), desc: t('docs.tutorialStep6Desc'),
          endpoints: [
            { method: 'GET', path: '/clientes', summary: t('docs.tutorialEpList') },
            { method: 'GET', path: '/clientes/{id}', summary: t('docs.tutorialEpGet') },
            { method: 'POST', path: '/clientes', summary: t('docs.tutorialEpCreate') },
            { method: 'PUT', path: '/clientes/{id}', summary: t('docs.tutorialEpUpdate') },
            { method: 'DELETE', path: '/clientes/{id}', summary: t('docs.tutorialEpDelete') },
          ],
        },
        { num: 7, title: t('docs.tutorialStep7Title'), desc: t('docs.tutorialStep7Desc'), code: t('docs.tutorialStep7Code') },
      ].map((step) => (
        <div key={step.num} className="docs-section">
          <h2 className="docs-section__title" style={{ fontSize: '1.1rem' }}>{t('docs.step')} {step.num}: {step.title}</h2>
          <p className="docs-section__text">{step.desc}</p>
          {'code' in step && step.code && <pre className="docs-code">{step.code}</pre>}
          {'fields' in step && step.fields && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              {step.fields.map((f) => (
                <label key={f.label} className="form-field" style={{ flex: 1, minWidth: '180px' }}>
                  <span className="label">{f.label}</span>
                  <input className="field" value={f.value} readOnly style={{ fontSize: '0.85rem' }} />
                </label>
              ))}
            </div>
          )}
          {'table' in step && step.table && (
            <table className="docs-table">
              <thead><tr><th>{t('docs.tutorialFieldName')}</th><th>{t('docs.tutorialFieldType')}</th><th>{t('docs.tutorialFieldRequired')}</th></tr></thead>
              <tbody>{step.table.map((row) => (<tr key={row.name}><td><code>{row.name}</code></td><td>{row.type}</td><td>{row.req ? '✓' : ''}</td></tr>))}</tbody>
            </table>
          )}
          {'endpoints' in step && step.endpoints && (
            <div style={{ marginTop: '0.5rem' }}>
              {step.endpoints.map((ep) => (
                <div key={`${ep.method}-${ep.path}`} className="docs-endpoint-row">
                  <span className="docs-endpoint-method" style={{ backgroundColor: METHOD_COLORS[ep.method] }}>{ep.method}</span>
                  <span className="docs-endpoint-path">{ep.path}</span>
                  <span className="docs-endpoint-summary">{ep.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const renderCli = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.cliTitle')}</h1>
        <p className="docs-header__desc">{t('docs.cliDesc')}</p>
      </div>
      <div className="docs-cmd">
        <span className="docs-cmd__name">doapi init</span><span className="docs-cmd__desc">{t('docs.cliInitDesc')} <code className="docs-code--inline">doapi deploy</code>.</span>
        <span className="docs-cmd__name">doapi deploy</span><span className="docs-cmd__desc">{t('docs.cliDeployDesc')}</span>
        <span className="docs-cmd__name">doapi serve</span><span className="docs-cmd__desc">{t('docs.cliServeDesc')}</span>
      </div>
    </div>
  )

  const renderCodigo = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.tabCode')}</h1>
        <p className="docs-header__desc">{t('docs.codeDesc')}</p>
      </div>
    </div>
  )

  const renderDesplegar = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.deployPageTitle')}</h1>
        <p className="docs-header__desc">{t('docs.deployPageDesc')}</p>
      </div>

      <div className="docs-deploy-grid">
        <div className="docs-deploy-card docs-deploy-card--recommended">
          <div className="docs-deploy-header"><h3>{t('docs.deployCli')}</h3></div>
          <p>{t('docs.deployCliDesc')}</p>
          <pre className="docs-deploy-code">doapi deploy proyecto.json --port 8080</pre>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployDocker')}</h3></div>
          <p>{t('docs.deployDockerDesc')}</p>
          <pre className="docs-deploy-code">docker build -t my-api .</pre>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployCompose')}</h3></div>
          <p>{t('docs.deployComposeDesc')}</p>
          <pre className="docs-deploy-code">docker compose up -d --build</pre>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployRailway')}</h3></div>
          <p>{t('docs.deployRailwayDesc')}</p>
          <pre className="docs-deploy-code">{`railway login
railway up`}</pre>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployRender')}</h3></div>
          <p>{t('docs.deployRenderDesc')}</p>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployCiCd')}</h3></div>
          <p>{t('docs.deployCiCdDesc')}</p>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deploySshRemote')}</h3></div>
          <p>{t('docs.deploySshRemoteDesc')}</p>
          <pre className="docs-deploy-code">doapi deploy proyecto.json \  --ssh user@host --port 80</pre>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployVpsManual')}</h3></div>
          <p>{t('docs.deployVpsManualDesc')}</p>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployTracking')}</h3></div>
          <p>{t('docs.deployTrackingDesc')}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            {t('docs.deployLogsDesc')}
          </p>
        </div>
        <div className="docs-deploy-card">
          <div className="docs-deploy-header"><h3>{t('docs.deployCustomDomain')}</h3></div>
          <p>{t('docs.deployCustomDomainDesc')}</p>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.6, margin: '0.5rem 0' }}>
            <strong>{t('docs.dnsFlow')}</strong>
            <pre className="docs-code" style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.75rem', whiteSpace: 'pre' }}>{`tudominio.com  ──CNAME──►  api.tudominio.com
                                      │
                              Tu Servidor (IP)
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                      Puerto 80                Puerto 443
                          │                       │
                          └─────── Caddy ─────────┘
                                   │
                                   ▼ api:8000 (contenedor)`}</pre>
          </div>
          <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', margin: '0.3rem 0' }}>
            <li>{t('docs.dnsStep1')}</li>
            <li>{t('docs.dnsStep2')}</li>
            <li>{t('docs.dnsStep3')}</li>
          </ol>
        </div>
      </div>

      <div className="docs-checklist">
        <h3>{t('docs.checklistTitle')}</h3>
        <ul>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistDb')}:</strong> {t('docs.checklistDbDesc')}</li>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistSecurity')}:</strong> {t('docs.checklistSecurityDesc')}</li>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistHttps')}:</strong> {t('docs.checklistHttpsDesc')}</li>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistWorkers')}:</strong> {t('docs.checklistWorkersDesc')}</li>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistCors')}:</strong> {t('docs.checklistCorsDesc')}</li>
          <li><span className="docs-checkmark">✓</span> <strong>{t('docs.checklistSdk')}:</strong> {t('docs.checklistSdkDesc')}</li>
        </ul>
      </div>

      <div id="vps-arch" className="docs-section">
        <h2 className="docs-section__title">{t('docs.vpsArchTitle')}</h2>
        <p className="docs-section__text">{t('docs.vpsArchDesc')}</p>
        <pre className="docs-code">{`┌───── LOCAL ─────┐        ┌───── VPS PROD ─────┐
│  DoApi Builder   │        │  Nginx/Caddy (SSL)  │
│  - Editor UI     │  SSH   │  → API Docker       │
│  - Mock server   │──────→ │  → PostgreSQL       │
│  - Monitor       │  SCP   │  → Sin panel        │
│  - SQLite local  │        │  → Firewall estricto│
└──────────────────┘        └─────────────────────┘`}</pre>
        <p className="docs-section__text">{t('docs.vpsArchTip')}</p>
      </div>

      <div id="vps-harden" className="docs-section">
        <h2 className="docs-section__title">{t('docs.vpsHardeningTitle')}</h2>
        <p className="docs-section__text">{t('docs.vpsHardeningDesc')}</p>
        <div className="docs-section__subtitle">{t('docs.vpsHardenSsh')}</div>
        <pre className="docs-code">sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd</pre>
        <div className="docs-section__subtitle">{t('docs.vpsHardenFirewall')}</div>
        <pre className="docs-code">sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable</pre>
        <div className="docs-section__subtitle">{t('docs.vpsHardenDocker')}</div>
        <pre className="docs-code">sudo useradd -m doapi-deploy && sudo usermod -aG docker doapi-deploy</pre>
      </div>

      <div id="vps-telemetry" className="docs-section">
        <h2 className="docs-section__title">{t('docs.telemetryTitle')}</h2>
        <p className="docs-section__text">{t('docs.telemetryDesc')}</p>
      </div>

      <div id="vps-secrets" className="docs-section">
        <h2 className="docs-section__title">{t('docs.vpsSecretsTitle')}</h2>
        <p className="docs-section__text">{t('docs.vpsSecretsDesc')}</p>
        <pre className="docs-code">python -c "import secrets; print('JWT_SECRET:', secrets.token_hex(32))"
python -c "import secrets; print('ENCRYPTION_KEY:', secrets.token_urlsafe(32))"</pre>
      </div>
    </div>
  )

  return (
    <div className="docs-layout">
      <div className="docs-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'instalacion' && renderInstalacion()}
        {activeTab === 'tutorial' && renderTutorial()}
        {activeTab === 'cli' && renderCli()}
        {activeTab === 'codigo' && renderCodigo()}
        {activeTab === 'desplegar' && renderDesplegar()}
      </div>

      <aside className="docs-sidebar">
        <div className="docs-sidebar__title">{t('docs.sections')}</div>
        <ul className="docs-toc">
          {TABLE_OF_CONTENTS.map((item) => (
            <li key={item.id} className="docs-toc__item">
              <button
                className={`docs-toc__link ${activeTab === item.tab ? 'docs-toc__link--active' : ''}`}
                onClick={() => scrollTo(item.id, item.tab)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
