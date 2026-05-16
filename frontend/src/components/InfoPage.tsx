import { useTranslation } from 'react-i18next'

export function InfoPage() {
  const { t } = useTranslation()
  return (
    <div className="info-page">
      {/* Hero */}
      <div className="info-hero">
        <div className="info-hero__content">
          <h1 className="info-hero__title">DoApi</h1>
          <p className="info-hero__subtitle">
            {t('info.heroSubtitle')}
          </p>
          <div className="info-hero__stats">
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">3</span>
              <span className="info-hero__stat-label">{t('info.stacks')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">30+</span>
              <span className="info-hero__stat-label">{t('info.endpointsApi')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">2</span>
              <span className="info-hero__stat-label">{t('info.sdks')}</span>
            </div>
            <div className="info-hero__stat">
              <span className="info-hero__stat-value">1</span>
              <span className="info-hero__stat-label">{t('info.command')}</span>
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
            <text x="40" y="151" fontSize="8" fill="#166534">./install.sh</text>
          </svg>
        </div>
      </div>

      {/* Features grid */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.datasetsTitle')}</h3>
          <p className="info-card__desc">{t('info.datasetsDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.endpointsRestTitle')}</h3>
          <p className="info-card__desc">{t('info.endpointsRestDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.codeGenTitle')}</h3>
          <p className="info-card__desc">{t('info.codeGenDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M14.7 6.3a1 1 0 00 0 1.4l1.6 1.6a1 1 0 00 1.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.mockServerTitle')}</h3>
          <p className="info-card__desc">{t('info.mockServerDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.shareLinksTitle')}</h3>
          <p className="info-card__desc">{t('info.shareLinksDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.webhooksTitle')}</h3>
          <p className="info-card__desc">{t('info.webhooksDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#84cc16" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.versioningTitle')}</h3>
          <p className="info-card__desc">{t('info.versioningDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#d946ef" strokeWidth="2"><path d="M4 4h16v16H4V4zm4 4h8v8H8V8z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.mappingsTitle')}</h3>
          <p className="info-card__desc">{t('info.mappingsDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#f43f5e" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4.04a2 2 0 00-2 0l-7 4.04A2 2 0 003 8v8a2 2 0 001 1.73l7 4.04a2 2 0 002 0l7-4.04A2 2 0 0021 16z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.dockerTitle')}</h3>
          <p className="info-card__desc">{t('info.dockerDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.openapiTitle')}</h3>
          <p className="info-card__desc">{t('info.openapiDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#14b8a6" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.securityTitle')}</h3>
          <p className="info-card__desc">{t('info.securityDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#eab308" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.proStartTitle')}</h3>
          <p className="info-card__desc">{t('info.proStartDesc')}</p>
        </div>
        <div className="info-card">
          <div className="info-card__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ec4899" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <h3 className="info-card__title">{t('info.importDbTitle')}</h3>
          <p className="info-card__desc">{t('info.importDbDesc')}</p>
        </div>
      </div>

      {/* Stacks */}
      <div className="info-section">
        <h2 className="info-section__title">{t('info.availableStacks')}</h2>
        <div className="info-stacks">
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#3b82f6' }} />
              <strong>FastAPI</strong>
              <span className="info-stack__badge">{t('info.complete')}</span>
            </div>
            <p className="info-stack__desc">{t('info.fastapiDesc')}</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#10b981' }} />
              <strong>Express</strong>
              <span className="info-stack__badge">{t('info.complete')}</span>
            </div>
            <p className="info-stack__desc">{t('info.expressDesc')}</p>
          </div>
          <div className="info-stack">
            <div className="info-stack__head">
              <span className="info-stack__dot" style={{ background: '#8b5cf6' }} />
              <strong>NestJS</strong>
              <span className="info-stack__badge">{t('info.complete')}</span>
            </div>
            <p className="info-stack__desc">{t('info.nestjsDesc')}</p>
          </div>
        </div>
      </div>

      {/* Quick start */}
      <div className="info-section">
        <h2 className="info-section__title">{t('info.quickStart')}</h2>
        <div className="info-steps">
          <div className="info-step">
            <span className="info-step__num">1</span>
            <div>
              <strong>{t('info.step1Title')}</strong>
              <p>{t('info.step1Desc')}</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">2</span>
            <div>
              <strong>{t('info.step2Title')}</strong>
              <p>{t('info.step2Desc')}</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">3</span>
            <div>
              <strong>{t('info.step3Title')}</strong>
              <p>{t('info.step3Desc')}</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">4</span>
            <div>
              <strong>{t('info.step4Title')}</strong>
              <p>{t('info.step4Desc')}</p>
            </div>
          </div>
          <div className="info-step">
            <span className="info-step__num">5</span>
            <div>
              <strong>{t('info.step5Title')}</strong>
              <p>{t('info.step5Desc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
