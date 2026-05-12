import { useState } from 'react'

const METHOD_COLORS: Record<string, string> = {
  GET: '#0ea5e9', POST: '#10b981', PUT: '#f59e0b', PATCH: '#a855f7', DELETE: '#f43f5e',
}

type DocTab = 'overview' | 'tutorial' | 'cli' | 'codigo' | 'desplegar'

const TABS: { id: DocTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visión General', icon: '★' },
  { id: 'tutorial', label: 'Tutorial', icon: '✓' },
  { id: 'cli', label: 'CLI', icon: '⌘' },
  { id: 'codigo', label: 'Código', icon: '</>' },
  { id: 'desplegar', label: 'Desplegar', icon: '▲' },
]

const CLI_SECTIONS = [
  { id: 'cli-install', label: 'Instalación' },
  { id: 'cli-deploy', label: 'apimaker deploy' },
  { id: 'cli-serve', label: 'apimaker serve' },
  { id: 'cli-init', label: 'apimaker init' },
  { id: 'cli-ssh', label: 'Deploy remoto (SSH)' },
]

export function DocsPage() {
  const [activeTab, setActiveTab] = useState<DocTab>('overview')
  const [activeSection, setActiveSection] = useState('')

  const renderOverview = () => (
    <div>
      <div className="info-hero" style={{ marginBottom: '1.5rem' }}>
        <div className="info-hero__content">
          <h1 className="info-hero__title">API Maker</h1>
          <p className="info-hero__subtitle">
            Constructor de APIs visual y open source. Define datasets, diseña endpoints y genera código
            listo para producción en FastAPI, Express o NestJS.
          </p>
          <div className="info-hero__stats">
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">3</span>
              <span className="info-hero__stat-label">Stacks</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">30+</span>
              <span className="info-hero__stat-label">Endpoints API</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">2</span>
              <span className="info-hero__stat-label">SDKs</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">1</span>
              <span className="info-hero__stat-label">Comando</span>
            </div>
          </div>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-card">
          <h3 className="info-card__title">Datasets</h3>
          <p className="info-card__desc">Define esquemas con tipos, relaciones y datos de ejemplo. Importa desde CSV, Excel o base de datos externa.</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">Endpoints REST</h3>
          <p className="info-card__desc">CRUD automático + rutas personalizadas vinculadas a datasets. GET, POST, PUT, PATCH y DELETE.</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">Generación de código</h3>
          <p className="info-card__desc">Bundle listo para producción con modelos, controladores, seguridad, Docker y SDKs en TypeScript y Python.</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">Mock server</h3>
          <p className="info-card__desc">Simula tu API en tiempo real con datos persistentes en base de datos, filtros y autenticación.</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">CLI Deploy</h3>
          <p className="info-card__desc">Despliega tu API en cualquier servidor con un solo comando. Exporta, sirve o despliega vía SSH sin depender de la UI.</p>
        </div>
        <div className="info-card">
          <h3 className="info-card__title">Share Links</h3>
          <p className="info-card__desc">Snapshots de solo lectura con contraseña y expiración. Comparte tu API documentada sin exponer el editor.</p>
        </div>
      </div>

      <div className="docs-section" id="arquitectura">
        <h2 className="docs-section__title">Arquitectura</h2>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#6366f1' }} />
              <strong>Modelos / Schemas</strong>
            </div>
            <p className="info-stack__desc">Define datasets con tipos, validaciones y relaciones. Se traducen a SQLModel, Sequelize o TypeORM según el stack.</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#0ea5e9' }} />
              <strong>Controladores / Routers</strong>
            </div>
            <p className="info-stack__desc">Endpoints REST con CRUD completo y rutas personalizadas. Parámetros dinámicos {'{id}'} y vinculación directa a datasets.</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Seguridad</strong>
            </div>
            <p className="info-stack__desc">JWT con tokens de acceso (24h) y refresh (7 días). API Key opcional. Rate limiting configurable.</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#f59e0b' }} />
              <strong>Despliegue</strong>
            </div>
            <p className="info-stack__desc">Docker Compose multi-etapa, seeds automáticos, health checks y CI/CD incluidos en el bundle generado.</p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTutorial = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">Tutorial paso a paso</h1>
        <p className="docs-header__desc">Crea tu primera API en 10 pasos. Ejemplo práctico: API de usuarios de un banco.</p>
      </div>

      {[
        {
          num: 1, title: 'Instala API Maker',
          desc: 'Ejecuta el instalador desde la terminal. Crea el admin, elige base de datos y carga datos demo:',
          code: './install.sh\n\n# El Setup Wizard te guía:\n# - Usuario admin (por defecto: admin / admin)\n# - BD: SQLite (sin config) o PostgreSQL\n# - Datos demo: proyecto Pokedex',
        },
        {
          num: 2, title: 'Inicia sesión',
          desc: 'Accede a http://localhost:5173 con las credenciales que configuraste en el wizard.',
          code: 'Usuario: admin\nContraseña: admin',
        },
        {
          num: 3, title: 'Configura tu proyecto',
          desc: 'Define nombre, descripción y stack tecnológico desde el panel Editor.',
          fields: [
            { label: 'Nombre', value: 'API Usuarios Banco' },
            { label: 'Descripción', value: 'API REST para gestión de clientes bancarios' },
            { label: 'Stack', value: 'fastapi' },
          ],
        },
        {
          num: 4, title: 'Define el dataset',
          desc: 'Ve a la pestaña "Datasets" y añade los campos del modelo. Puedes importar desde CSV, Excel o una BD externa:',
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
          num: 5, title: 'Diseña los endpoints',
          desc: 'En la pestaña "Endpoints" añade las rutas REST. Cada endpoint se vincula a un dataset:',
          endpoints: [
            { method: 'GET', path: '/clientes', summary: 'Listar todos los clientes' },
            { method: 'GET', path: '/clientes/{id}', summary: 'Obtener un cliente por ID' },
            { method: 'POST', path: '/clientes', summary: 'Crear un nuevo cliente' },
            { method: 'PUT', path: '/clientes/{id}', summary: 'Actualizar un cliente' },
            { method: 'DELETE', path: '/clientes/{id}', summary: 'Eliminar un cliente' },
          ],
        },
        {
          num: 6, title: 'Prueba en el Simulador',
          desc: 'En la pestaña "Simulador", lanza el mock server y prueba tus endpoints con datos realistas generados automáticamente.',
        },
        {
          num: 7, title: 'Configura Seguridad',
          desc: 'Elige autenticación (JWT, API Key), rate limiting y configura secretos. Todo se incluye en el código generado.',
        },
        {
          num: 8, title: 'Genera la API',
          desc: 'Pulsa "Guardar y lanzar API" para sincronizar con el backend y obtener URL del sandbox, docs Redoc y share link.',
        },
        {
          num: 9, title: 'Descarga el bundle',
          desc: 'En la pestaña "API generada" encontrarás el bundle .zip con código listo para producción: modelos, controladores, Docker, seeds, tests y SDKs.',
        },
        {
          num: 10, title: 'Despliega a producción',
          desc: 'Usa el CLI, Docker o tu plataforma favorita para poner tu API en producción.',
          code: '# Docker (recomendado)\ndocker compose up -d --build\n\n# CLI Deploy\napimaker deploy proyecto.json --port 80\n\n# O manual\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000',
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
                <thead><tr><th>Campo</th><th>Tipo</th><th>Requerido</th></tr></thead>
                <tbody>
                  {step.table.map((f) => (
                    <tr key={f.name}>
                      <td><code>{f.name}</code></td><td>{f.type}</td><td>{f.req ? 'Sí' : '—'}</td>
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
        <h1 className="docs-header__title">CLI — Apimaker</h1>
        <p className="docs-header__desc">
          La interfaz de línea de comandos permite desplegar, servir y exportar proyectos de API Maker
          desde cualquier entorno, sin depender de la interfaz gráfica.
        </p>
      </div>

      <div className="docs-section" id="cli-install">
        <h2 className="docs-section__title">Instalación</h2>
        <p className="docs-section__text">
          El CLI viene incluido en el paquete <code className="docs-code--inline">apimaker-backend</code>.
        </p>
        <div className="docs-code">pip install apimaker-backend</div>
        <div className="docs-code">apimaker --help</div>
      </div>

      <div className="docs-section" id="cli-deploy">
        <h2 className="docs-section__title">apimaker deploy</h2>
        <p className="docs-section__text">Despliega un proyecto exportado como API independiente. Lee el JSON, crea la DB, importa datos y levanta el servidor.</p>
        <div className="docs-code">apimaker deploy &lt;archivo.json&gt; [opciones]</div>
        <table className="docs-table">
          <thead><tr><th>Opción</th><th>Default</th><th>Descripción</th></tr></thead>
          <tbody>
            <tr><td><code className="docs-code--inline">--port</code></td><td>8080</td><td>Puerto del servidor</td></tr>
            <tr><td><code className="docs-code--inline">--host</code></td><td>0.0.0.0</td><td>Host de escucha</td></tr>
            <tr><td><code className="docs-code--inline">--db</code></td><td>SQLite</td><td>URL de base de datos</td></tr>
            <tr><td><code className="docs-code--inline">--ssh</code></td><td>-</td><td>Destino SSH para deploy remoto</td></tr>
          </tbody>
        </table>
        <div className="docs-code"><span className="comment"># Exportar y desplegar</span>
apimaker init pokedex-demo
apimaker deploy pokedex-demo.json --port 8080

<span className="comment"># URLs limpias:</span>
GET    /api/pokemon          <span className="comment"># Listar</span>
GET    /api/pokemon/25       <span className="comment"># Detalle</span>
POST   /api/pokemon          <span className="comment"># Crear</span></div>
      </div>

      <div className="docs-section" id="cli-serve">
        <h2 className="docs-section__title">apimaker serve</h2>
        <p className="docs-section__text">Sirve un proyecto existente de la DB del builder como API independiente en un puerto separado.</p>
        <div className="docs-code">apimaker serve &lt;slug&gt; --port 8081</div>
      </div>

      <div className="docs-section" id="cli-init">
        <h2 className="docs-section__title">apimaker init</h2>
        <p className="docs-section__text">Exporta un proyecto de la DB a JSON para desplegar con <code className="docs-code--inline">apimaker deploy</code>.</p>
        <div className="docs-code">apimaker init pokedex-demo -o mi-api.json</div>
      </div>

      <div className="docs-section" id="cli-ssh">
        <h2 className="docs-section__title">Deploy remoto (SSH)</h2>
        <p className="docs-section__text">Despliega directamente en un VPS vía SSH + Docker. El CLI copia el archivo, genera docker-compose y levanta los contenedores.</p>
        <div className="docs-code">apimaker deploy proyecto.json --ssh usuario@midominio.com --port 80</div>
      </div>
    </div>
  )

  const renderCodigo = () => (
    <div>
      <div className="docs-header">
        <h1 className="docs-header__title">Ejemplos de código</h1>
        <p className="docs-header__desc">Ejemplos en múltiples lenguajes para consumir tu API. Los endpoints se generan dinámicamente desde tu proyecto.</p>
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
        <h1 className="docs-header__title">Despliegue</h1>
        <p className="docs-header__desc">Todas las formas de llevar tu API a producción.</p>
      </div>

      <div className="docs-deploy-grid">
        <div className="docs-deploy-card docs-deploy-card--recommended">
          <div className="docs-deploy-header">
            <span className="docs-recommended-badge">Recomendado</span>
            <h3>CLI Deploy</h3>
          </div>
          <p>Despliega tu API exportada con un solo comando. El CLI crea la base de datos, importa los datos del proyecto y levanta el servidor con URLs limpias. No necesitas Docker ni configurar nada.</p>
          <pre className="docs-deploy-code">apimaker deploy proyecto.json --port 8080</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Docker</h3>
          </div>
          <p>El bundle generado incluye un Dockerfile listo para producción. Construye la imagen y ejecuta el contenedor en cualquier servidor con Docker instalado.</p>
          <pre className="docs-deploy-code">docker build -t my-api .
docker run -p 8000:8000 my-api</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Docker Compose</h3>
          </div>
          <p>El bundle incluye docker-compose.yml con API + PostgreSQL configurado. Es la opción más completa para entornos de producción.</p>
          <pre className="docs-deploy-code">docker compose up -d --build
# API en http://localhost:8000
# Docs en http://localhost:8000/docs</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Railway</h3>
          </div>
          <p>Railway detecta automáticamente el proyecto. El bundle incluye <code className="docs-code--inline">deploy/railway.json</code> con la configuración. Conecta tu repositorio de GitHub y Railway lo despliega solo.</p>
          <pre className="docs-deploy-code">railway login
railway up</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>Render</h3>
          </div>
          <p>Render despliega desde GitHub. El bundle incluye <code className="docs-code--inline">deploy/render.yaml</code> con la configuración del servicio. Sube el proyecto a GitHub y conéctalo desde el dashboard de Render.</p>
          <pre className="docs-deploy-code">1. Sube el proyecto a GitHub
2. Ve a render.com
3. Nuevo Blueprint {'>'} conecta tu repo</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>CI/CD (GitHub Actions)</h3>
          </div>
          <p>Automatiza el despliegue en tu VPS al hacer push a main. El bundle incluye un workflow en <code className="docs-code--inline">.github/workflows/deploy.yml</code> que se conecta por SSH y ejecuta docker compose.</p>
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
            <h3>SSH Remoto</h3>
          </div>
          <p>Usa <code className="docs-code--inline">apimaker deploy --ssh</code> para desplegar directamente en cualquier VPS con Docker. El CLI copia el archivo, genera el docker-compose y levanta los contenedores automáticamente.</p>
          <pre className="docs-deploy-code">apimaker deploy proyecto.json \
  --ssh usuario@midominio.com \
  --port 80</pre>
        </div>

        <div className="docs-deploy-card">
          <div className="docs-deploy-header">
            <h3>VPS Manual</h3>
          </div>
          <p>Instalación directa en tu servidor. Para FastAPI necesitas Python 3.11+, para Express/NestJS necesitas Node.js 18+.</p>
          <pre className="docs-deploy-code"># FastAPI (Python)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Express / NestJS (Node.js)
npm install && npm start</pre>
        </div>
      </div>

      <div className="docs-checklist">
        <h3>Checklist de Producción</h3>
        <ul>
          <li><span className="docs-checkmark">✓</span> <strong>Base de Datos:</strong> Usa PostgreSQL persistente en lugar de SQLite.</li>
          <li><span className="docs-checkmark">✓</span> <strong>Seguridad:</strong> Cambia las claves secretas en el archivo <code className="docs-code--inline">.env</code>.</li>
          <li><span className="docs-checkmark">✓</span> <strong>HTTPS:</strong> Obligatorio en producción. Usa Certbot o Cloudflare.</li>
          <li><span className="docs-checkmark">✓</span> <strong>Workers:</strong> Usa múltiples workers (gunicorn, pm2).</li>
          <li><span className="docs-checkmark">✓</span> <strong>CORS:</strong> Restringe orígenes permitidos en producción.</li>
          <li><span className="docs-checkmark">✓</span> <strong>SDK:</strong> Los bundles incluyen clientes TypeScript y Python en <code className="docs-code--inline">sdks/</code>.</li>
        </ul>
      </div>
    </div>
  )

  const sidebarSections: Record<DocTab, { id: string; label: string }[]> = {
    overview: [
      { id: 'overview', label: 'Visión General' },
      { id: 'arquitectura', label: 'Arquitectura' },
    ],
    tutorial: [
      { id: 'tutorial', label: 'Tutorial' },
    ],
    cli: CLI_SECTIONS,
    codigo: [
      { id: 'codigo', label: 'Ejemplos de código' },
    ],
    desplegar: [
      { id: 'desplegar', label: 'Despliegue' },
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
          {TABS.find(t => t.id === activeTab)?.label || 'Secciones'}
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
