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
  const mockBaseUrl = `${baseUrl}/api/mock/${project.id}`

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
        title: 'Inicia sesión',
        desc: 'Accede con las credenciales por defecto:',
        code: 'Usuario: admin\nContraseña: admin',
      },
      {
        num: 2,
        title: 'Configura tu proyecto',
        desc: 'Define nombre, descripción y stack tecnológico:',
        fields: [
          { label: 'Nombre', value: 'API Usuarios Banco' },
          { label: 'Descripción', value: 'API REST para gestión de clientes bancarios' },
          { label: 'Stack', value: 'fastapi' },
        ],
      },
      {
        num: 3,
        title: 'Define el dataset',
        desc: 'Ve a "Dataset & Vista previa" y añade los campos de tu modelo:',
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
        num: 4,
        title: 'Diseña los endpoints',
        desc: 'En "Endpoints & Simulador" añade las rutas REST:',
        endpoints: [
          { method: 'GET', path: '/clientes', summary: 'Listar todos los clientes' },
          { method: 'GET', path: '/clientes/{id}', summary: 'Obtener un cliente por ID' },
          { method: 'POST', path: '/clientes', summary: 'Crear un nuevo cliente' },
          { method: 'PUT', path: '/clientes/{id}', summary: 'Actualizar un cliente' },
          { method: 'DELETE', path: '/clientes/{id}', summary: 'Eliminar un cliente' },
        ],
      },
      {
        num: 5,
        title: 'Prueba en el simulador',
        desc: 'Selecciona un endpoint y pulsa "Probar API local" para ver datos de ejemplo generados automáticamente. No necesitas backend.',
      },
      {
        num: 6,
        title: 'Genera la API',
        desc: 'Pulsa el botón azul "Actualizar API" para generar sandbox URL, documentación Redoc y enlace compartible.',
      },
      {
        num: 7,
        title: 'Sincroniza y descarga',
        desc: 'En "Payload & Entrega", sincroniza con el backend y descarga el bundle.zip con código listo para desplegar.',
      },
      {
        num: 8,
        title: 'Despliega',
        desc: 'Descomprime el bundle y despliega:',
        code: 'docker build -t api-usuarios-banco .\ndocker run -p 8000:8000 api-usuarios-banco',
      },
    ]

    return (
      <div className="tutorial">
        <div className="tutorial__header">
          <svg viewBox="0 0 24 24" fill="currentColor" className="tutorial__header-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <div>
            <h2 className="tutorial__title">Guía paso a paso</h2>
            <p className="tutorial__subtitle">Crea tu primera API en 8 pasos. Ejemplo práctico: API de usuarios de un banco.</p>
          </div>
        </div>

        <div className="tutorial__steps">
          {steps.map((step, i) => (
            <div key={step.num} className={`tutorial__step ${i === 0 ? 'active' : ''}`}>
              <span className="tutorial__step-num">{step.num}</span>
              <div className="tutorial__step-content">
                <h3>{step.title}</h3>
                <p className="muted-text">{step.desc}</p>

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
                          <td>{f.req ? '✓' : '—'}</td>
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
                  {copiedCode === ex.id ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="api-usage__card-code"><code>{ex.code}</code></pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  /* ---- TAB: Guía ---- */
  const renderGuia = () => (
    <div className="api-usage__guia">
      <div className="api-usage__guia-step">
        <span className="api-usage__guia-number">1</span>
        <div>
          <h3>Define tu dataset</h3>
          <p className="muted-text">Ve al <strong>Editor</strong> → pestaña <strong>"Dataset & Vista previa"</strong>. Carga un CSV/Excel o añade campos manualmente.</p>
        </div>
      </div>
      <div className="api-usage__guia-step">
        <span className="api-usage__guia-number">2</span>
        <div>
          <h3>Diseña los endpoints</h3>
          <p className="muted-text">En <strong>"Endpoints & Simulador"</strong> añade las rutas REST. Pulsa <strong>"Probar API local"</strong> — funciona con datos de ejemplo incluso sin backend.</p>
        </div>
      </div>
      <div className="api-usage__guia-step">
        <span className="api-usage__guia-number">3</span>
        <div>
          <h3>Genera y comparte</h3>
          <p className="muted-text">Pulsa <strong>"Actualizar API"</strong> para ver la Sandbox URL, documentación Redoc y enlaces compartibles. Descarga el bundle para desplegar en producción.</p>
        </div>
      </div>
      <div className="api-usage__guia-example">
        <h4>Ejemplo: API de productos</h4>
        <p>Dataset: <code>sku</code>, <code>name</code>, <code>category</code>, <code>stock</code>, <code>price</code></p>
        <p>Endpoints:</p>
        <ul>
          <li><code>GET /products</code> → lista todos</li>
          <li><code>POST /products</code> → crea un producto</li>
          <li><code>{`PUT /products/:id`}</code> → actualiza</li>
        </ul>
        <p>Resultado: tu API responde con JSON real que puedes consumir desde cualquier cliente HTTP.</p>
      </div>
    </div>
  )

  /* ---- TAB: Desplegar ---- */
  const renderDesplegar = () => (
    <div>
      <div className="api-usage__deploy-grid">
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 3.5h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm12 7.5c0 1.4-1.1 2.5-2.5 2.5h-10c-1.4 0-2.5-1.1-2.5-2.5V14h15v1zm-15-2h15v-1h-15v1zm15 3H1.5c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.5 1.5h21c.8 0 1.5-.7 1.5-1.5v-2c0-.8-.7-1.5-1.5-1.5z"/></svg>
            <h3>Docker</h3>
          </div>
          <p className="muted-text">El bundle incluye un Dockerfile listo.</p>
          <pre className="api-usage__deploy-code"><code>{`# Desde el bundle descomprimido\ndocker build -t ${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')} .\ndocker run -p 8000:8000 ${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <h3>Docker Compose</h3>
          </div>
          <p className="muted-text">API + PostgreSQL persistente.</p>
          <pre className="api-usage__deploy-code"><code>{`version: "3.8"
services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/apimaker
    depends_on: [db]
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: apimaker
    volumes: [pgdata:/var/lib/postgresql/data]
volumes: {pgdata:}`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
            <h3>VPS / Cloud</h3>
          </div>
          <p className="muted-text">Directo con uvicorn o gunicorn.</p>
          <pre className="api-usage__deploy-code"><code>{`# Setup
python3 -m venv /opt/apimaker && source /opt/apimaker/bin/activate
pip install -r requirements.txt

# Dev
uvicorn main:app --host 0.0.0.0 --port 8000

# Prod
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker \\
  --bind 0.0.0.0:8000`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>PaaS</h3>
          </div>
          <p className="muted-text">Render, Railway, Fly.io — sube y listo.</p>
          <pre className="api-usage__deploy-code"><code>{`# Render: pip install -r requirements.txt
# Start: uvicorn main:app --host 0.0.0.0 --port $PORT

# Railway: auto-detecta requirements.txt

# Fly.io
fly launch && fly deploy`}</code></pre>
        </div>
      </div>
      <div className="api-usage__deploy-checklist">
        <h3>Checklist antes de desplegar</h3>
        <ul className="api-usage__checklist">
          <li><span className="api-usage__checkmark">✓</span> Genera el bundle desde <strong>"API generada"</strong></li>
          <li><span className="api-usage__checkmark">✓</span> Configura env vars: <code>DATABASE_URL</code>, <code>SECRET_KEY</code>, <code>DEBUG=false</code></li>
          <li><span className="api-usage__checkmark">✓</span> Usa <strong>HTTPS</strong> (Let's Encrypt / Cloudflare)</li>
          <li><span className="api-usage__checkmark">✓</span> Añade autenticación (JWT, API keys, OAuth)</li>
          <li><span className="api-usage__checkmark">✓</span> Configura rate limiting y CORS</li>
          <li><span className="api-usage__checkmark">✓</span> Usa <strong>gunicorn</strong> en producción</li>
        </ul>
      </div>
    </div>
  )

  const tabItems: { id: UsageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tutorial', label: 'Tutorial', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> },
    { id: 'codigo', label: 'Código', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg> },
    { id: 'guia', label: 'Guía paso a paso', icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg> },
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
        {activeTab === 'guia' && renderGuia()}
        {activeTab === 'desplegar' && renderDesplegar()}
      </div>
    </div>
  )
}
