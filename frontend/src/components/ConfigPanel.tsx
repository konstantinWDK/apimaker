import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseConfigPanel } from './DatabaseConfigPanel'
import { CredentialPanel } from './CredentialPanel'


interface Props {
  currentUsername: string
  onUpdateCredentials: (newUsername: string, newPassword: string, currentPassword: string) => Promise<void>
  onResetCredentials: () => Promise<void>
}

export function ConfigPanel({ currentUsername, onUpdateCredentials, onResetCredentials }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'database' | 'admin'>('database')

  return (
    <div className="config-panel">
      <div className="config-panel__tabs">
        <button
          type="button"
          className={activeTab === 'database' ? 'active' : ''}
          onClick={() => setActiveTab('database')}
        >
          {t('configPanel.database')}
        </button>
        <button
          type="button"
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
        >
          {t('configPanel.admin')}
        </button>
      </div>

      <div className="config-panel__content">
        {activeTab === 'database' && (
          <div className="config-section">
            <p className="config-section__desc">{t('configPanel.databaseDesc')}</p>
            <DatabaseConfigPanel />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="config-section">
            <p className="config-section__desc">
              {t('configPanel.adminDesc')}
            </p>
            <CredentialPanel
              currentUsername={currentUsername}
              onUpdate={onUpdateCredentials}
              onReset={onResetCredentials}
            />
            <p className="muted-text" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              {t('configPanel.tip')}
            </p>
          </div>
        )}


      </div>

      <style>{`
        .config-panel { }
        .config-panel__tabs {
          display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem;
        }
        .config-panel__tabs button {
          padding: 0.6rem 1.2rem; border: none; background: none;
          font-size: 0.9rem; color: #64748b; cursor: pointer;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: all 0.15s;
        }
        .config-panel__tabs button:hover { color: #1e293b; }
        .config-panel__tabs button.active {
          color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600;
        }
        .config-section__desc {
          color: #64748b; font-size: 0.85rem; margin-bottom: 1.25rem;
        }
      `}</style>
    </div>
  )
}
