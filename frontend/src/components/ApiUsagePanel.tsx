import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
        title: t('usage.tutorial.step1.title'),
        desc: t('usage.tutorial.step1.desc'),
        code: './install.sh\n\n# El Setup Wizard te guía:\n# - Usuario admin (por defecto: admin / admin)\n# - BD: SQLite o PostgreSQL (con gestión de puertos)\n# - Generación automática de start.sh / start.bat',
      },
      {
        num: 2,
        title: t('usage.tutorial.step2.title'),
        desc: t('usage.tutorial.step2.desc'),
        code: './start.sh\n\n# Frontend: http://localhost:5173\n# Backend:  http://localhost:8000',
      },
      {
        num: 3,
        title: t('usage.tutorial.step3.title'),
        desc: t('usage.tutorial.step3.desc'),
        code: t('usage.tutorial.step3.code'),
      },
      {
        num: 4,
        title: t('usage.tutorial.step4.title'),
        desc: t('usage.tutorial.step4.desc'),
        fields: [
          { label: t('usage.tutorial.step4.fieldName'), value: 'API Usuarios Banco' },
          { label: t('usage.tutorial.step4.fieldDesc'), value: 'API REST para gestion de clientes bancarios' },
          { label: t('usage.tutorial.step4.fieldStack'), value: 'fastapi' },
        ],
      },
      {
        num: 5,
        title: t('usage.tutorial.step5.title'),
        desc: t('usage.tutorial.step5.desc'),
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
        title: t('usage.tutorial.step6.title'),
        desc: t('usage.tutorial.step6.desc'),
        endpoints: [
          { method: 'GET', path: '/clientes', summary: t('usage.tutorial.step6.epList') },
          { method: 'GET', path: '/clientes/{id}', summary: t('usage.tutorial.step6.epGet') },
          { method: 'POST', path: '/clientes', summary: t('usage.tutorial.step6.epCreate') },
          { method: 'PUT', path: '/clientes/{id}', summary: t('usage.tutorial.step6.epUpdate') },
          { method: 'DELETE', path: '/clientes/{id}', summary: t('usage.tutorial.step6.epDelete') },
        ],
      },
      {
        num: 7,
        title: t('usage.tutorial.step7.title'),
        desc: t('usage.tutorial.step7.desc'),
      },
      {
        num: 8,
        title: t('usage.tutorial.step8.title'),
        desc: t('usage.tutorial.step8.desc'),
      },
      {
        num: 9,
        title: t('usage.tutorial.step9.title'),
        desc: t('usage.tutorial.step9.desc'),
        action: { label: t('usage.tutorial.step9.action'), tab: 'codigo' as UsageTab }
      },
      {
        num: 10,
        title: t('usage.tutorial.step10.title'),
        desc: t('usage.tutorial.step10.desc'),
        action: { label: t('usage.tutorial.step10.action'), tab: 'desplegar' as UsageTab }
      },
      {
        num: 11,
        title: t('usage.tutorial.step11.title'),
        desc: t('usage.tutorial.step11.desc'),
      },
      {
        num: 12,
        title: t('usage.tutorial.step12.title'),
        desc: t('usage.tutorial.step12.desc'),
        code: '# Docker\ncd bundle && docker compose up -d --build\n\n# Railway\nrailway up\n\n# VPS manual\npip install -r requirements.txt\nuvicorn main:app --host 0.0.0.0 --port 8000',
      },
    ]

    return (
      <div className="tutorial">
        <div className="tutorial__header">
          <svg viewBox="0 0 24 24" fill="currentColor" className="tutorial__header-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <div>
            <h2 className="tutorial__title">{t('usage.tutorial.title')}</h2>
            <p className="tutorial__subtitle">{t('usage.tutorial.subtitle')}</p>
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
                        <th>{t('usage.tutorial.tableField')}</th>
                        <th>{t('usage.tutorial.tableType')}</th>
                        <th>{t('usage.tutorial.tableRequired')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.table.map((f) => (
                        <tr key={f.name}>
                          <td><code>{f.name}</code></td>
                          <td>{f.type}</td>
                          <td>{f.req ? t('usage.tutorial.yes') : '\u2014'}</td>
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
        <h2>{t('usage.code.quickStart')}</h2>
        <p className="muted-text">{t('usage.code.quickStartDesc')}</p>
        <div className="api-usage__quick-grid">
          <div className="api-usage__quick-card">
            <span className="api-usage__quick-label">
              <span className="api-usage__quick-badge" style={{ backgroundColor: METHOD_COLORS.GET }}>GET</span>
              {t('usage.code.listItems')}
            </span>
            <pre className="api-usage__quick-code"><code>{getExample('GET')?.code || t('usage.code.noGetEndpoint')}</code></pre>
          </div>
          <div className="api-usage__quick-card">
            <span className="api-usage__quick-label">
              <span className="api-usage__quick-badge" style={{ backgroundColor: METHOD_COLORS.POST }}>POST</span>
              {t('usage.code.createItem')}
            </span>
            <pre className="api-usage__quick-code"><code>{getExample('POST')?.code || t('usage.code.noPostEndpoint')}</code></pre>
          </div>
        </div>
      </div>

      <div className="api-usage__endpoints" style={{ marginTop: '1.5rem' }}>
        <h2>{t('usage.code.allEndpoints')}</h2>
        <p className="muted-text">{t('usage.code.allEndpointsDesc')}</p>
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
                  {copiedCode === ex.id ? t('usage.code.copied') : t('usage.code.copy')}
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
            <span className="api-usage__recommended-badge">{t('usage.deploy.recommended')}</span>
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 3.5h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm-4-4h-3v3h3v-3zm0 4h-3v3h3v-3zm12 7.5c0 1.4-1.1 2.5-2.5 2.5h-10c-1.4 0-2.5-1.1-2.5-2.5V14h15v1zm-15-2h15v-1h-15v1zm15 3H1.5c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.5 1.5h21c.8 0 1.5-.7 1.5-1.5v-2c0-.8-.7-1.5-1.5-1.5z"/></svg>
            <h3>Docker</h3>
          </div>
          <p className="muted-text">{t('usage.deploy.dockerDesc')}</p>
          <pre className="api-usage__deploy-code"><code>{`# Desde el bundle descomprimido
docker build -t my-api .
docker run -p 8000:8000 my-api`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <h3>Docker Compose</h3>
          </div>
          <p className="muted-text">{t('usage.deploy.composeDesc')}</p>
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
          <p className="muted-text">{t('usage.deploy.railwayDesc')}</p>
          <pre className="api-usage__deploy-code"><code>{`railway login
railway up`}</code></pre>
        </div>
        <div className="api-usage__deploy-card">
          <div className="api-usage__deploy-header">
            <svg className="api-usage__deploy-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>Render</h3>
          </div>
          <p className="muted-text">{t('usage.deploy.renderDesc')}</p>
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
          <p className="muted-text">{t('usage.deploy.cicdDesc')}</p>
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
          <p className="muted-text">{t('usage.deploy.vpsDesc')}</p>
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
        <h3>{t('usage.deploy.checklistTitle')}</h3>
        <ul className="api-usage__checklist">
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistDb')}</strong> {t('usage.deploy.checklistDbDesc')}</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistSecurity')}</strong> {t('usage.deploy.checklistSecurityDesc')}</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistHttps')}</strong> {t('usage.deploy.checklistHttpsDesc')}</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistWorkers')}</strong> {t('usage.deploy.checklistWorkersDesc')}</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistCors')}</strong> {t('usage.deploy.checklistCorsDesc')}</li>
          <li><span className="api-usage__checkmark">[X]</span> <strong>{t('usage.deploy.checklistSdk')}</strong> {t('usage.deploy.checklistSdkDesc')}</li>
        </ul>
      </div>
    </div>
  )

  const tabItems: { id: UsageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tutorial', label: t('usage.tabTutorial'), icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> },
    { id: 'codigo', label: t('usage.tabCode'), icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg> },
    { id: 'desplegar', label: t('usage.tabDeploy'), icon: <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M5 4h2l5 7V5h6v6h-6.2l-5-7H5v14h6v2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm14 8h-6l5 7h-5v2h7c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2h-1z"/></svg> },
  ]

  return (
    <div className="api-usage-panel">
      <header className="api-usage__header">
        <div>
          <p className="api-usage__eyebrow">{t('usage.eyebrow')}</p>
          <h1 className="api-usage__title">{t('usage.title')} <span>{project.name}</span></h1>
          <p className="api-usage__copy">{t('usage.description')}</p>
        </div>
        <div className="api-usage__meta">
          <div className="api-usage__meta-item">
            <p className="label">Base URL</p>
            <code className="api-usage__base">{mockBaseUrl}</code>
          </div>
          <div className="api-usage__meta-item">
            <p className="label">{t('usage.endpoints')}</p>
            <p className="api-usage__count">{endpoints.length}</p>
          </div>
          <div className="api-usage__meta-item">
            <p className="label">Docs</p>
            <a href={`${baseUrl}/projects/${project.id}/docs`} target="_blank" rel="noreferrer" className="api-usage__docs-link">{t('usage.openDocs')}</a>
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
