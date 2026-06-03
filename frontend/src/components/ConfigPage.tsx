/**
 * ConfigPage — Extracted from App.tsx
 * Shows system configuration: credential management and reset.
 */
import { useTranslation } from 'react-i18next'
import { SectionCard } from './SectionCard'
import { ConfigPanel } from './ConfigPanel'
import { readToken, apiFetch } from '../lib/api'

interface ConfigPageProps {
  authStatus: { username: string; mustChange?: boolean }
  onLogout: () => void
}

export function ConfigPage({ authStatus, onLogout }: ConfigPageProps) {
  const { t } = useTranslation()

  const resetCredentials = async () => {
    const token = readToken()
    if (!token) return
    await apiFetch('/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  }

  return (
    <SectionCard title={t('config.title')} subtitle={t('config.subtitle')} fullWidth>
      <ConfigPanel
        currentUsername={authStatus.username}
        onUpdateCredentials={async (newUsername, newPassword, currentPassword) => {
          const token = readToken()
          if (!token) throw new Error(t('config.notAuthenticated'))
          if (newUsername !== authStatus.username) {
            await apiFetch('/auth/change-username', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ new_username: newUsername, current_password: currentPassword }),
            })
          }
          if (newPassword) {
            await apiFetch('/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            })
          }
          onLogout()
        }}
        onResetCredentials={async () => {
          await resetCredentials()
          onLogout()
        }}
      />
    </SectionCard>
  )
}
