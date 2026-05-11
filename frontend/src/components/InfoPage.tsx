/**
 * InfoPage — Extracted from App.tsx
 * Shows the "About API Maker" landing page with features, stacks, and quick start.
 */
export function InfoPage() {
  return (
    <div className="info-page">
      {/* Hero */}
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">API Maker</h1>
          <p className="info-hero__subtitle">
            Constructor de APIs visual y open source. Define datasets, disena endpoints y genera codigo listo para produccion en FastAPI, Express o NestJS.
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
              <span className="info-hero__stat-value">3</span>
              <span className="info-hero__stat-label">SDKs</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">6</span>
              <span className="info-hero__stat-label">Templates</span>
            </div>
          </div>
        </div>
        <div className="info-hero__graphic">
          <svg viewBox="0 0 200 160" className="info-hero__svg">
            <rect x="10" y="20" width="180" height="40" rx="8" fill="#e0e7ff" />
            <rect x="20" y="30" width="60" height="6" rx="3" fill="#6366f1" />
            <rect x="20" y="42" width="100" height="4" rx="2" fill="#a5b4fc" />
            <rect x="10" y="80" width="180" height="40" rx="8" fill="#dbeafe" />
            <rect x="20" y="90" width="50" height="6" rx="3" fill="#3b82f6" />
            <rect x="20" y="102" width="80" height="4" rx="2" fill="#93c5fd" />
            <rect x="10" y="140" width="180" height="15" rx="8" fill="#f0fdf4" />
            <circle cx="30" cy="148" r="4" fill="#22c55e" />
            <text x="40" y="151" fontSize="8" fill="#166534">docker compose up -d</text>
          </svg>
        </div>
      </div>

      {/* Features grid */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16"/></svg>
          </div>
          <h3 className="info-card__title">Datasets</h3>
          <p className="info-card__desc">Define esquemas con tipos, relaciones y datos de ejemplo. Importa desde CSV o base de datos externa.</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <h3 className="info-card__title">Endpoints REST</h3>
          <p className="info-card__desc">Crea rutas CRUD automaticas o personalizadas. Cada endpoint se vincula a un dataset.</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 className="info-card__title">Generacion de codigo</h3>
          <p className="info-card__desc">Codigo listo para produccion con modelos, seguridad, Docker y SDK en TypeScript y Python.</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M14.7 6.3a1 1 0 00 0 1.4l1.6 1.6a1 1 0 00 1.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <h3 className="info-card__title">Mock server</h3>
          <p className="info-card__desc">Simula tu API en tiempo real con datos de prueba, filtros y autenticacion. Ideal para frontends.</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          </div>
          <h3 className="info-card__title">Compartir</h3>
          <p className="info-card__desc">Snapshots con proteccion por contrasena, expiracion y vistas. Comparte tu API sin dar acceso al builder.</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h3 className="info-card__title">Webhooks</h3>
          <p className="info-card__desc">Notifica a URLs externas cuando los datos cambian en el mock server. Ideal para integraciones.</p>
        </div>
      </div>

      {/* Stacks */}
      <div className="info-section">
        <h2 className="info-section__title">Stacks disponibles</h2>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
              <strong>FastAPI</strong>
              <span className="info-stack__badge">Completo</span>
            </div>
            <p className="info-stack__desc">SQLAlchemy, Pydantic, JWT, rate limiting, Docker multi-stage, seeds automaticos.</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Express</strong>
              <span className="info-stack__badge">Completo</span>
            </div>
            <p className="info-stack__desc">Sequelize, rate limiting, Swagger automatico, JWT, Docker Compose con PostgreSQL.</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#8b5cf6' }} />
              <strong>NestJS</strong>
              <span className="info-stack__badge">Completo</span>
            </div>
            <p className="info-stack__desc">TypeORM, Swagger decorators, AuthGuard, DTOs, estructura modular, Docker.</p>
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="info-section">
        <h2 className="info-section__title">Inicio rapido</h2>
        <div className="info-steps">
          <div className="info-step">
            <span className="info-step__num">1</span>
            <div>
              <strong>Crea un dataset</strong>
              <p>Define los campos de tu modelo de datos con tipos, restricciones y datos de ejemplo.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">2</span>
            <div>
              <strong>Disena endpoints</strong>
              <p>Selecciona el dataset y elige operaciones CRUD o rutas personalizadas.</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">3</span>
            <div>
              <strong>Genera y descarga</strong>
              <p>Pulsa "Guardar y lanzar API" y descarga el bundle con codigo listo para desplegar.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
