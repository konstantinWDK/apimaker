import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const METHOD_COLORS: Record<string, string> = {
  GET: '#0ea5e9', POST: '#10b981', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#f43f5e',
}

type DocTab = 'overview' | 'tutorial' | 'cli' | 'codigo' | 'desplegar'

export function DocsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<DocTab>('overview')
  const [activeSection, setActiveSection] = useState('')

  const TABS: { id: DocTab; label: string; icon: string }[] = [
    { id: 'overview', label: t('docs.tabOverview'), icon: '★' },
    { id: 'tutorial', label: t('docs.tabTutorial'), icon: '✓' },
    { id: 'cli', label: t('docs.tabCli'), icon: '⌘' },
    { id: 'codigo', label: t('docs.tabCode'), icon: '</>' },
    { id: 'desplegar', label: t('docs.tabDeploy'), icon: '▲' },
  ]

  const CLI_SECTIONS = [
    { id: 'cli-install', label: t('docs.cliInstall') },
    { id: 'cli-deploy', label: t('docs.cliDeploy') },
    { id: 'cli-serve', label: t('docs.cliServe') },
    { id: 'cli-init', label: t('docs.cliInit') },
    { id: 'cli-ssh', label: t('docs.cliSsh') },
  ]

  const renderOverview = () => (
    <div>
      <div className="info-hero" style={{ marginBottom: '1.5rem' }}>
        <div className="info-hero__content">
          <h1 className="info-hero__title">DoApi</h1>
          <p className="info-hero__subtitle">
            {t('docs.overviewSubtitle')}
          </p>
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

      <div className="info-grid">
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.datasetsTitle')}</h3>
          <p className="info-card__desc">{t('docs.datasetsDesc')}</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.endpointsRestTitle')}</h3>
          <p className="info-card__desc">{t('docs.endpointsRestDesc')}</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.codeGenTitle')}</h3>
          <p className="info-card__desc">{t('docs.codeGenDesc')}</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.mockServerTitle')}</h3>
          <p className="info-card__desc">{t('docs.mockServerDesc')}</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.cliDeployTitle')}</h3>
          <p className="info-card__desc">{t('docs.cliDeployDesc')}</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">{t('docs.shareLinksTitle')}</h3>
          <p className="info-card__desc">{t('docs.shareLinksDesc')}</p>
        </div>
      </div>

      <div className="docs-section" id="arquitectura">
        <h2 className="docs-section__title">{t('docs.architecture')}</h2>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#6366f1' }} />
              <strong>{t('docs.modelsSchemas')}</strong>
            </div>
            <p className="info-stack__desc">{t('docs.modelsSchemasDesc')}</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#0ea5e9' }} />
              <strong>{t('docs.controllers')}</strong>
            </div>
            <p className="info-stack__desc">{t('docs.controllersDesc')}</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>{t('docs.security')}</strong>
            </div>
            <p className="info-stack__desc">{t('docs.securityDesc')}</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#f59e0b' }} />
              <strong>{t('docs.deployment')}</strong>
            </div>
            <p className="info-stack__desc">{t('docs.deploymentDesc')}</p>
          </div>
        </div>
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
        {
          num: 1, title: t('docs.tutorialStep1Title'),
          desc: t('docs.tutorialStep1Desc'),
          code: t('docs.tutorialStep1Code'),
        },
        {
          num: 2, title: t('docs.tutorialStep2Title'),
          desc: t('docs.tutorialStep2Desc'),
          code: t('docs.tutorialStep2Code'),
        },
        {
          num: 3, title: t('docs.tutorialStep3Title'),
          desc: t('docs.tutorialStep3Desc'),
          code: t('docs.tutorialStep3Code'),
        },
        {
          num: 4, title: t('docs.tutorialStep4Title'),
          desc: t('docs.tutorialStep4Desc'),
          fields: [
            { label: t('docs.tutorialFieldName'), value: 'API Usuarios Banco' },
            { label: t('docs.tutorialFieldDesc'), value: t('docs.tutorialFieldDescValue') },
            { label: t('docs.tutorialFieldStack'), value: 'fastapi' },
          ],
        },
        {
          num: 5, title: t('docs.tutorialStep5Title'),
          desc: t('docs.tutorialStep5Desc'),
          table: [
            { name: 'id_cliente', type: 'integer', req: true },
            { name: 'nombre', type: 'string', req: true },
            { name: 'email', type: 'string', req: true },
            { name: 'tipo_cuenta', type: 'string', req: true },
            { name: 'saldo', type: 'float', req: true },
            { name: 'activo', type: 'boolean', req: true },
            { name: 'fecha_alta', type: 'datetime', req: true },
          ],
        },
        {
          num: 6, title: t('docs.tutorialStep6Title'),
          desc: t('docs.tutorialStep6Desc'),
          endpoints: [
            { method: 'GET', path: '/clientes', summary: t('docs.tutorialEpList') },
            { method: 'GET', path: '/clientes/{id}', summary: t('docs.tutorialEpGet') },
            { method: 'POST', path: '/clientes', summary: t('docs.tutorialEpCreate') },
            { method: 'PUT', path: '/clientes/{id}', summary: t('docs.tutorialEpUpdate') },
            { method: 'DELETE', path: '/clientes/{id}', summary: t('docs.tutorialEpDelete') },
          ],
        },
        {
          num: 7, title: t('docs.tutorialStep7Title'),
          desc: t('docs.tutorialStep7Desc'),
        },
        {
          num: 8, title: t('docs.tutorialStep8Title'),
          desc: t('docs.tutorialStep8Desc'),
        },
        {
          num: 9, title: t('docs.tutorialStep9Title'),
          desc: t('docs.tutorialStep9Desc'),
        },
        {
          num: 10, title: t('docs.tutorialStep10Title'),
          desc: t('docs.tutorialStep10Desc'),
        },
        {
          num: 11, title: t('docs.tutorialStep11Title'),
          desc: t('docs.tutorialStep11Desc'),
          code: '# Docker (recomendado)\ndocker compose up -d --build\n\n# CLI Deploy\ndoapi deploy proyecto.json --port 80\n\n# O manual\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000',
        },
      ].map((step) => (
        <div key={step.num} className="info-step" style={{ marginBottom: '0.75rem' }}>
          <span className="info-step__num">{step.num}</span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.desc}</p>
            {step.code && <div className="docs-tutorial-code">{step.code}</div>}
            {step.fields && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {step.fields.map((f) => (
                  <div key={f.label} style={{ fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b', marginRight: '0.3rem' }}>{f.label}:</span>
                    <code className="docs-code--inline">{f.value}</code>
                  </div>
                ))}
              </div>
            )}
            {step.table && (
              <table className="docs-tutorial-table">
                <thead><tr><th>{t('docs.tutorialTableField')}</th><th>{t('docs.tutorialTableType')}</th><th>{t('docs.tutorialTableRequired')}</th></tr></thead>
                <tbody>
                  {step.table.map((f) => (
                    <tr key={f.name}>
                      <td><code>{f.name}</code></td><td>{f.type}</td><td>{f.req ? t('docs.yes') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {step.endpoints && (
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
        </div>
      ))}
    </div>
  )

  const renderCli = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.cliPageTitle')}</h1>
        <p className="docs-header__desc">
          {t('docs.cliPageDesc')}
        </p>
      </div>

      <div className="docs-section" id="cli-install">
        <h2 className="docs-section__title">{t('docs.cliInstall')}</h2>
        <p className="docs-section__text">
          {t('docs.cliInstallDesc')} <code className="docs-code--inline">doapi-backend</code>.
        </p>
        <div className="docs-code">pip install doapi-backend</div>
        <div className="docs-code">doapi --help</div>
      </div>

      <div className="docs-section" id="cli-deploy">
        <h2 className="docs-section__title">{t('docs.cliDeploy')}</h2>
        <p className="docs-section__text">{t('docs.cliDeployDesc')}</p>
        <div className="docs-code">doapi deploy &lt;archivo.json&gt; [opciones]</div>
        <table className="docs-table">
          <thead><tr><th>{t('docs.cliOption')}</th><th>{t('docs.cliDefault')}</th><th>{t('docs.cliDescription')}</th></tr></thead>
          <tbody>
            <tr><td><code className="docs-code--inline">--port</code></td><td>8080</td><td>{t('docs.cliPortDesc')}</td></tr>
            <tr><td><code className="docs-code--inline">--host</code></td><td>0.0.0.0</td><td>{t('docs.cliHostDesc')}</td></tr>
            <tr><td><code className="docs-code--inline">--db</code></td><td>SQLite</td><td>{t('docs.cliDbDesc')}</td></tr>
            <tr><td><code className="docs-code--inline">--ssh</code></td><td>-</td><td>{t('docs.cliSshDesc')}</td></tr>
          </tbody>
        </table>
        <div className="docs-code"><span className="comment">{t('docs.cliExportDeploy')}</span>
doapi init pokedex-demo
doapi deploy pokedex-demo.json --port 8080

<span className="comment">{t('docs.cliCleanUrls')}</span>
GET    /api/pokemon          <span className="comment">{t('docs.cliList')}</span>
GET    /api/pokemon/25       <span className="comment">{t('docs.cliDetail')}</span>
POST   /api/pokemon          <span className="comment">{t('docs.cliCreate')}</span></div>
      </div>

      <div className="docs-section" id="cli-serve">
        <h2 className="docs-section__title">{t('docs.cliServe')}</h2>
        <p className="docs-section__text">{t('docs.cliServeDesc')}</p>
        <div className="docs-code">doapi serve &lt;slug&gt; --port 8081</div>
      </div>

      <div className="docs-section" id="cli-init">
        <h2 className="docs-section__title">{t('docs.cliInit')}</h2>
        <p className="docs-section__text">{t('docs.cliInitDesc')} <code className="docs-code--inline">doapi deploy</code>.</p>
        <div className="docs-code">doapi init pokedex-demo -o mi-api.json</div>
      </div>

      <div className="docs-section" id="cli-ssh">
        <h2 className="docs-section__title">{t('docs.cliSsh')}</h2>
        <p className="docs-section__text">{t('docs.cliSshDesc')}</p>
        <div className="docs-code">doapi deploy proyecto.json --ssh usuario@midominio.com --port 80</div>
      </div>
    </div>
  )

  const renderCodigo = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">{t('docs.codePageTitle')}</h1>
        <p className="docs-header__desc">{t('docs.codePageDesc')}</p>
      </div>

      <div className="docs-section">
        <h2 className="docs-section__title">cURL</h2>
        <div className="docs-code">curl http://localhost:8000/api/mock/pokedex-demo/pokemon</div>
        <div className="docs-code">{`curl -X POST http://localhost:8000/api/mock/pokedex-demo/pokemon \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Pikachu", "type": "electric", "pokedex_id": 25}'`}</div>
        <div className="docs-code">{`curl -X DELETE http://localhost:8000/api/mock/pokedex-demo/pokemon/25`}</div>
      </div>

      <div className="docs-section">
        <h2 className="docs-section__title">JavaScript (fetch)</h2>
        <div className="docs-code">{`const BASE = "http://localhost:8000/api/mock/pokedex-demo"

// Listar
const res = await fetch(BASE + "/pokemon")
const data = await res.json()

// Crear
await fetch(BASE + "/pokemon", {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Pikachu', type: 'electric' })
})`}</div>
      </div>

      <div className="docs-section">
        <h2 className="docs-section__title">Python (requests)</h2>
        <div className="docs-code">{`import requests

BASE = "http://localhost:8000/api/mock/pokedex-demo"

# Listar
res = requests.get(BASE + "/pokemon")
print(res.json())

# Crear
res = requests.post(BASE + "/pokemon", json={
    "name": "Pikachu",
    "type": "electric",
    "pokedex_id": 25,
})`}</div>
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
          <div className="docs-deploy-header">
            <span className="docs-recommended-badge">{t('docs.recommended')}</span>
            <h3>{t('docs.cliDeploy')}</h3>
          </div>
          <p>{t('docs.deployCliDesc')}</p>
          <pre className="docs-deploy-code">doapi deploy proyecto.json --port 8080</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Docker</h3>
          </div>
          <p>{t('docs.deployDockerDesc')}</p>
          <pre className="docs-deploy-code">docker build -t my-api .
docker run -p 8000:8000 my-api</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Docker Compose</h3>
          </div>
          <p>{t('docs.deployComposeDesc')}</p>
          <pre className="docs-deploy-code">docker compose up -d --build
# API en http://localhost:8000
# Docs en http://localhost:8000/docs</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Railway</h3>
          </div>
          <p>{t('docs.deployRailwayDesc')}</p>
          <pre className="docs-deploy-code">railway login
railway up</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Render</h3>
          </div>
          <p>{t('docs.deployRenderDesc')}</p>
          <pre className="docs-deploy-code">1. {t('docs.deployRenderStep1')}
2. {t('docs.deployRenderStep2')}
3. {t('docs.deployRenderStep3')}</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>{t('docs.deployCiCd')}</h3>
          </div>
          <p>{t('docs.deployCiCdDesc')}</p>
          <pre className="docs-deploy-code"># .github/workflows/deploy.yml
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ssh user@host "cd /app && docker compose up -d --build"</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>{t('docs.deploySshRemote')}</h3>
          </div>
          <p>{t('docs.deploySshRemoteDesc')}</p>
          <pre className="docs-deploy-code">doapi deploy proyecto.json \
  --ssh usuario@midominio.com \
  --port 80</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>{t('docs.deployVpsManual')}</h3>
          </div>
          <p>{t('docs.deployVpsManualDesc')}</p>
          <pre className="docs-deploy-code"># FastAPI (Python)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Express / NestJS (Node.js)
npm install && npm start</pre>
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
    </div>
  )

  const sidebarSections: Record<DocTab, { id: string; label: string }[]> = {
    overview: [
      { id: 'overview', label: t('docs.tabOverview') },
      { id: 'arquitectura', label: t('docs.architecture') },
    ],
    tutorial: [
      { id: 'tutorial', label: t('docs.tabTutorial') },
    ],
    cli: CLI_SECTIONS,
    codigo: [
      { id: 'codigo', label: t('docs.tabCode') },
    ],
    desplegar: [
      { id: 'desplegar', label: t('docs.tabDeploy') },
    ],
  }

  return (
    <div className="docs-layout">
      <div className="docs-content">
        <div className="docs-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`docs-tab ${activeTab === tab.id ? 'docs-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="docs-tab__icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tutorial' && renderTutorial()}
        {activeTab === 'cli' && renderCli()}
        {activeTab === 'codigo' && renderCodigo()}
        {activeTab === 'desplegar' && renderDesplegar()}
      </div>

      <aside className="docs-sidebar">
        <div className="docs-sidebar__title">
          {TABS.find(t => t.id === activeTab)?.label || t('docs.sections')}
        </div>
        <ul className="docs-toc">
          {sidebarSections[activeTab]?.map(s => (
            <li key={s.id} className="docs-toc__item">
              <button
                className={`docs-toc__link ${activeSection === s.id ? 'docs-toc__link--active' : ''}`}
                onClick={() => {
                  setActiveSection(s.id)
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
