import { useRef, useState } from 'react'

import type { ApiEndpoint } from '../types/schemas'
import { useProjectBuilder } from '../hooks/useProjectBuilder'
import { readBackendConfig } from '../lib/backendConfig'

interface CodeExample {
  id: string
  method: string
  path: string
  summary: string
  code: string
}

type Lang = 'curl' | 'javascript' | 'python' | 'go'
type UsageTab = 'tutorial' | 'codigo' | 'guia' | 'desplegar'

const METHOD_COLORS: Record<string, string> = {
  GET: '#0ea5e9',
  POST: '#10b981',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#f43f5e',
}

function getBaseUrl(): string {
  const config = readBackendConfig()
  return config.baseUrl?.replace(/\/$/, '') || 'http://localhost:8000'
}

function buildCurlExamples(endpoints: ApiEndpoint[], mockBaseUrl: string): CodeExample[] {
  return endpoints.map((ep) => {
    const url = `${mockBaseUrl}${ep.path}`
    if (ep.method === 'GET') return { id: `curl-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `curl "${url}"` }
    if (ep.method === 'POST') return { id: `curl-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Nuevo item"}'` }
    if (ep.method === 'PUT' || ep.method === 'PATCH') return { id: `curl-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `curl -X ${ep.method} "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Item actualizado"}'` }
    if (ep.method === 'DELETE') return { id: `curl-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `curl -X DELETE "${url}"` }
    return { id: `curl-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `curl "${url}"` }
  })
}

function buildJsExamples(endpoints: ApiEndpoint[], mockBaseUrl: string): CodeExample[] {
  return endpoints.map((ep) => {
    if (ep.method === 'GET') return { id: `js-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `const BASE = "${mockBaseUrl}"\n\nconst response = await fetch(\`\${BASE}${ep.path}\`)\nconst data = await response.json()\nconsole.log(data)` }
    if (ep.method === 'POST') return { id: `js-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `const BASE = "${mockBaseUrl}"\n\nconst response = await fetch(\`\${BASE}${ep.path}\`, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ name: 'Nuevo item' })\n})\nconst data = await response.json()` }
    if (ep.method === 'PUT' || ep.method === 'PATCH') return { id: `js-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `const BASE = "${mockBaseUrl}"\n\nawait fetch(\`\${BASE}${ep.path}\`, {\n  method: '${ep.method}',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ name: 'Editado' })\n})` }
    if (ep.method === 'DELETE') return { id: `js-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `const BASE = "${mockBaseUrl}"\n\nawait fetch(\`\${BASE}${ep.path}\`, { method: 'DELETE' })` }
    return { id: `js-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `fetch(\`\${BASE}${ep.path}\`)` }
  })
}

function buildPythonExamples(endpoints: ApiEndpoint[], mockBaseUrl: string): CodeExample[] {
  return endpoints.map((ep) => {
    if (ep.method === 'GET') return { id: `py-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `import requests\n\nBASE = "${mockBaseUrl}"\n\nresponse = requests.get(f"{BASE}${ep.path}")\nprint(response.json())` }
    if (ep.method === 'POST') return { id: `py-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `import requests\n\nBASE = "${mockBaseUrl}"\n\nresponse = requests.post(\n    f"{BASE}${ep.path}",\n    json={"name": "Nuevo item"}\n)\nprint(response.json())` }
    if (ep.method === 'PUT' || ep.method === 'PATCH') return { id: `py-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `import requests\n\nBASE = "${mockBaseUrl}"\n\nrequests.${ep.method.toLowerCase()}(\n    f"{BASE}${ep.path}",\n    json={"name": "Editado"}\n)` }
    if (ep.method === 'DELETE') return { id: `py-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `import requests\n\nBASE = "${mockBaseUrl}"\n\nrequests.delete(f"{BASE}${ep.path}")` }
    return { id: `py-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `requests.get(f"{BASE}${ep.path}")` }
  })
}

function buildGoExamples(endpoints: ApiEndpoint[], mockBaseUrl: string): CodeExample[] {
  return endpoints.map((ep) => {
    if (ep.method === 'GET') return { id: `go-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `package main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\tres, err := http.Get("${mockBaseUrl}${ep.path}")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tvar data []map[string]any\n\tjson.NewDecoder(res.Body).Decode(&data)\n\tfmt.Println(data)\n}` }
    if (ep.method === 'POST') return { id: `go-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `package main\n\nimport (\n\t"bytes"\n\t"encoding/json"\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\tbody, _ := json.Marshal(map[string]string{"name": "Nuevo item"})\n\tres, err := http.Post("${mockBaseUrl}${ep.path}", "application/json", bytes.NewBuffer(body))\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tfmt.Println(res.Status)\n}` }
    if (ep.method === 'DELETE') return { id: `go-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\treq, _ := http.NewRequest("DELETE", "${mockBaseUrl}${ep.path}", nil)\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tfmt.Println(res.Status)\n}` }
    return { id: `go-${ep.method}-${ep.path}`, method: ep.method, path: ep.path, summary: ep.summary || ep.name, code: `// ${ep.method} ${ep.path}` }
  })
}

export function ApiUsagePanel() {
  const { project } = useProjectBuilder()
  const [activeTab, setActiveTab] = useState<UsageTab>('codigo')
  const [lang, setLang] = useState<Lang>('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseUrl = getBaseUrl()
  const effectiveId = project.slug || project.id
  const mockBaseUrl = `${baseUrl}/api/mock/${effectiveId}`

  const endpoints = project.endpoints.length > 0
    ? project.endpoints
    : [
        { id: 'demo-get', name: 'List items', method: 'GET' as const, path: `/items`, summary: 'List all items' },
        { id: 'demo-post', name: 'Create item', method: 'POST' as const, path: `/items`, summary: 'Create a new item' },
      ]

  const examples = lang === 'curl'
    ? buildCurlExamples(endpoints, mockBaseUrl)
    : lang === 'javascript'
      ? buildJsExamples(endpoints, mockBaseUrl)
      : lang === 'python'
        ? buildPythonExamples(endpoints, mockBaseUrl)
        : buildGoExamples(endpoints, mockBaseUrl)

  const copyCode = async (code: string, id: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(id)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setCopiedCode(null)
    }
  }

  const getExample = (method: string) => examples.find((e) => e.method === method)

  const langLabel: Record<Lang, string> = {
    curl: 'cURL',
    javascript: 'JavaScript (fetch)',
    python: 'Python (requests)',
    go: 'Go (net/http)',
  }

  /* ---- TAB: Tutorial ---- */
  const renderTutorial = () => {
    const steps = [
      {
        num: 1,
        title: 'Instala API Maker',
        desc: 'Ejecuta el instalador desde la terminal. Detectará conflictos de puertos y generará scripts de arranque personalizados:',
        code: './install.sh\n\n# El Setup Wizard te guía:\n# - Usuario admin (por defecto: admin / admin)\n# - BD: SQLite o PostgreSQL (con gestión de puertos)\n# - Generación automática de start.sh / start.bat',
      },
      {
        num: 2,
        title: 'Arranca la aplicación',
        desc: 'Usa el script generado para iniciar el Backend y Frontend de forma unificada con logs profesionales:',
        code: './start.sh\n\n# Frontend: http://localhost:5173\n# Backend:  http://localhost:8000',
      },
      {
        num: 3,
        title: 'Inicia sesion',
        desc: 'Accede a http://localhost:5173 con las credenciales configuradas en el wizard:',
        code: 'Usuario: admin\nContrasena: admin',
      },
      {
        num: 4,
        title: 'Configura tu proyecto',
        desc: 'Define nombre, descripcion y stack tecnologico:',
        fields: [
          { label: 'Nombre', value: 'API Usuarios Banco' },
          { label: 'Descripcion', value: 'API REST para gestion de clientes bancarios' },
          { label: 'Stack', value: 'fastapi' },
        ],
      },
      {
        num: 5,
        title: 'Define el dataset',
        desc: 'Ve a la pestana "Datasets" y anade los campos de tu modelo. Puedes importar desde CSV, Excel o una BD externa:',
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
        num: 6,
        title: 'Disena los endpoints',
        desc: 'En la pestana "Endpoints" anade las rutas REST. Cada endpoint se vincula a un dataset:',
        endpoints: [
          { method: 'GET', path: '/clientes', summary: 'Listar todos los clientes' },
          { method: 'GET', path: '/clientes/{id}', summary: 'Obtener un cliente por ID' },
          { method: 'POST', path: '/clientes', summary: 'Crear un nuevo cliente' },
          { method: 'PUT', path: '/clientes/{id}', summary: 'Actualizar un cliente' },
          { method: 'DELETE', path: '/clientes/{id}', summary: 'Eliminar un cliente' },
        ],
      },
      {
        num: 7,
        title: 'Prueba en el Simulador',
        desc: 'En la pestana "Simulador", lanza el mock server y prueba tus endpoints con datos realistas generados automaticamente. No necesitas backend externo.',
      },
      {
        num: 8,
        title: 'Configura Seguridad',
        desc: 'En la pestana "Seguridad" elige autenticacion (JWT, API Key), rate limiting y configura secretos. Todo se incluye en el codigo generado.',
      },
      {
        num: 9,
        title: 'Genera la API',
        desc: 'Pulsa el boton "Guardar y lanzar API" para sincronizar con el backend y generar el bundle. Obtendras URL del sandbox, docs Redoc y share link.',
        action: { label: 'Ver ejemplos de codigo', tab: 'codigo' as UsageTab }
      },
      {
        num: 10,
        title: 'Descarga el bundle',
        desc: 'En la pestana "API generada" encontraras el bundle .zip con codigo listo para produccion: modelos, controladores, Docker, seeds, tests y SDKs.',
        action: { label: 'Ver guia de Despliegue', tab: 'desplegar' as UsageTab }
      },
      {
        num: 11,
        title: 'Comparte y versiona',
        desc: 'Usa el panel de Versiones para guardar snapshots del proyecto. Genera Share Links con contrasena y expiracion para compartir sin exponer el editor.',
      },
      {
        num: 12,
        title: 'Despliega a produccion',
        desc: 'Descomprime el bundle y elige tu plataforma:',
        code: '# Docker\ncd bundle && docker compose up -d --build\n\n# Railway\nrailway up\n\n# VPS manual\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000',
      },
    ]

    return (
      <div className="tutorial">
        <div className="tutorial__header">
          <svg viewBox="0 0 24 24" fill="currentColor" className="tutorial__header-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <div>
            <h2 className="tutorial__title">Guía paso a paso</h2>
            <p className="tutorial__subtitle">Crea tu primera API en 10 pasos. Ejemplo práctico: API de usuarios de un banco.</p>
          </div>
        </div>

        <div className="tutorial__steps">
          {steps.map((step, i) => (
            <div key={step.num} className={`tutorial__step ${i === 0 ? 'active' : ''}`}>
              <span className="tutorial__step-num">{step.num}</span>
              <div className="tutorial__step-content">
                <h3>{step.title}</h3>
                <p className="muted-text">{step.desc}</p>

                {step.action && (
                  <button 
                    className="tutorial__step-action-btn"
                    onClick={() => setActiveTab(step.action.tab)}
                  >
                    {step.action.label} →
                  </button>
                )}

                {/* Inline code block */}
                {step.code && (
                  <pre className="tutorial__step-code"><code>{step.code}</code></pre>
                )}

                {/* Field list */}
                {step.fields && (
                  <div className="tutorial__step-fields">
                    {step.fields.map((f) => (
                      <div key={f.label} className="tutorial__field">
                        <span className="tutorial__field-label">{f.label}</span>
                        <span className="tutorial__field-value">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dataset table */}
                {step.table && (
                  <table className="tutorial__table">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Tipo</th>
                        <th>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.table.map((f) => (
                        <tr key={f.name}>
                          <td><code>{f.name}</code></td>
                          <td>{f.type}</td>
                          <td>{f.req ? 'Si' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Endpoints list */}
                {step.endpoints && (
                  <div className="tutorial__step-endpoints">
                    {step.endpoints.map((ep) => (
                      <div key={`${ep.method}-${ep.path}`} className="tutorial__endpoint">
                        <span className="tutorial__endpoint-method" style={{ backgroundColor: METHOD_COLORS[ep.method] }}>{ep.method}</span>
                        <code className="tutorial__endpoint-path">{ep.path}</code>
                        <span className="tutorial__endpoint-summary">{ep.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ---- TAB: Código ---- */
  const renderCodigo = () => (
    <div>
      <div className="api-usage__lang-bar">
        {(Object.keys(langLabel) as Lang[]).map((l) => (
          <button key={l} type="button" className={`api-usage__lang-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
            {langLabel[l]}
          </button>
        ))}
      </div>

      <div className="api-usage__quick">
        <h2>Inicio rápido</h2>
        <p className="muted-text">Empieza aquí para probar tu API en menos de 1 minuto:</p>
        <div className="api-usage__quick-grid">
          <div className="api-usage__quick-card">
            <span className="api-usage__quick-label">
              <span className="api-usage__quick-badge" style={{ backgroundColor: METHOD_COLORS.GET }}>GET</span>
              Listar items
            </span>
            <pre className="api-usage__quick-code"><code>{getExample('GET')?.code || '// No hay endpoint GET definido'}</code></pre>
          </div>
          <div className="api-usage__quick-card">
            <span className="api-usage__quick-label">
              <span className="api-usage__quick-badge" style={{ backgroundColor: METHOD_COLORS.POST }}>POST</span>
              Crear item
            </span>
            <pre className="api-usage__quick-code"><code>{getExample('POST')?.code || '// No hay endpoint POST definido'}</code></pre>
          </div>
        </div>
      </div>

      <div className="api-usage__endpoints" style={{ marginTop: '1.5rem' }}>
        <h2>Todos los endpoints</h2>
        <p className="muted-text">Ejemplos individuales para cada ruta:</p>
        <div className="api-usage__list">
          {examples.map((ex) => (
            <div key={ex.id} className="api-usage__card">
              <div className="api-usage__card-header">
                <div className="api-usage__card-endpoint">
                  <span className="api-usage__card-method" style={{ backgroundColor: METHOD_COLORS[ex.method] || '#64748b' }}>{ex.method}</span>
                  <code className="api-usage__card-path">{ex.path}</code>
                  <span className="api-usage__card-summary">— {ex.summary}</span>
                </div>
                <button type="button" className="btn ghost btn-small api-usage__card-copy" onClick={() => copyCode(ex.code, ex.id)}>
                  {copiedCode === ex.id ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="api-usage__card-code"><code>{ex.code}</code></pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  /* ---- TAB: Desplegar ---- */
  const renderDesplegar = () => (
    <div>
      <div className="api-usage__deploy-grid">
        <div className="api-usage__deploy-card api-usage__deploy-card--recommended">
          <div className="api-usage__deploy-header">
            <span className="api-usage__recommended-badge">Recomendado</span>
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 3.5h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm12 7.5c0 1.4-1.1 2.5-2.5 2.5h-10c-1.4 0-2.5-1.1-2.5-2.5V14h15v1zm-15-2h15v-1h-15v1zm15 3H1.5c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.5 1.5h21c.8 0 1.5-.7 1.5-1.5v-2c0-.8-.7-1.5-1.5-1.5z"/></svg>
            <h3>Docker</h3>
          </div>
          <p className="muted-text">El bundle incluye un Dockerfile listo para produccion. Es la opcion mas sencilla y portable.</p>
          <pre className="api-usage__deploy-code"><code>{`# Desde el bundle descomprimido
docker build -t my-api .
docker run -p 8000:8000 my-api`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <h3>Docker Compose</h3>
          </div>
          <p className="muted-text">El bundle incluye <code>docker-compose.yml</code> con API + PostgreSQL.</p>
          <pre className="api-usage__deploy-code"><code>{`# Desde la carpeta del bundle
docker compose up -d --build

# La API estara en http://localhost:8000
# Documentacion en http://localhost:8000/docs`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
            <h3>Railway</h3>
          </div>
          <p className="muted-text">El bundle incluye <code>deploy/railway.json</code>. Conecta tu repo y Railway lo detecta automaticamente.</p>
          <pre className="api-usage__deploy-code"><code>{`railway login
railway up`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>Render</h3>
          </div>
          <p className="muted-text">El bundle incluye <code>deploy/render.yaml</code>. Sube el repo a GitHub y conectalo en Render.</p>
          <pre className="api-usage__deploy-code"><code>{`1. Sube el proyecto a GitHub
2. Ve a https://render.com
3. Nuevo Blueprint > conecta tu repo
4. Render detecta deploy/render.yaml`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>CI/CD (GitHub Actions)</h3>
          </div>
          <p className="muted-text">Automatiza el despliegue en tu VPS al hacer push a main.</p>
          <pre className="api-usage__deploy-code"><code>{`# .github/workflows/deploy.yml
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        run: ssh user@host "cd /app && docker compose up -d --build"`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <h3>VPS / Manual</h3>
          </div>
          <p className="muted-text">Instalacion directa con Python/Node en tu servidor.</p>
          <pre className="api-usage__deploy-code"><code>{`# FastAPI
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Express / NestJS
npm install
npm start`}</code></pre>
        </div>
      </div>
      <div className="api-usage__deploy-checklist">
        <h3>Checklist de Produccion</h3>
        <ul className="api-usage__checklist">
          <li><span className="api-usage__checkmark">[X]</span> <strong>Base de Datos:</strong> Usa PostgreSQL persistente en lugar de SQLite.</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>Seguridad:</strong> Cambia las claves secretas en el archivo <code>.env</code>.</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>HTTPS:</strong> Obligatorio en produccion. Usa Certbot o Cloudflare.</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>Workers:</strong> Usa multiples workers para produccion (gunicorn, pm2).</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>CORS:</strong> Restringe origenes permitidos en produccion.</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>SDK:</strong> Si marcaste "Generar SDK", el bundle incluye clientes TypeScript y Python en <code>sdks/</code>.</li>
        </ul>
      </div>
    </div>
  )

  const tabItems: { id: UsageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tutorial', label: 'Tutorial', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> },
    { id: 'codigo', label: 'Código', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg> },
    { id: 'desplegar', label: 'Desplegar', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M5 4h2l5 7V5h6v6h-6.2l-5-7H5v14h6v2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm14 8h-6l5 7h-5v2h7c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2h-1z"/></svg> },
  ]

  return (
    <div className="api-usage-panel">
      <header className="api-usage__header">
        <div>
          <p className="api-usage__eyebrow">Consumo de tu API</p>
          <h1 className="api-usage__title">Cómo consumir <span>{project.name}</span></h1>
          <p className="api-usage__copy">Ejemplos de código, guía de uso y despliegue. Todo generado dinámicamente desde tus endpoints.</p>
        </div>
        <div className="api-usage__meta">
          <div className="api-usage__meta-item">
            <p className="label">Base URL</p>
            <code className="api-usage__base">{mockBaseUrl}</code>
          </div>
          <div className="api-usage__meta-item">
            <p className="label">Endpoints</p>
            <p className="api-usage__count">{endpoints.length}</p>
          </div>
          <div className="api-usage__meta-item">
            <p className="label">Docs</p>
            <a href={`${baseUrl}/projects/${project.id}/docs`} target="_blank" rel="noreferrer" className="api-usage__docs-link">Abrir Redoc →</a>
          </div>
        </div>
      </header>

      <div className="api-usage__main-tabs">
        {tabItems.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`api-usage__main-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="api-usage__tab-content">
        {activeTab === 'tutorial' && renderTutorial()}
        {activeTab === 'codigo' && renderCodigo()}
        {activeTab === 'desplegar' && renderDesplegar()}
      </div>
    </div>
  )
}
