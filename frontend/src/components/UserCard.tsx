import { useTranslation } from 'react-i18next'

interface Props {
  username: string
  mustChange?: boolean
  onOpenSettings: () => void
  onLogout: () => void
}

export function UserCard({ username, mustChange = false, onOpenSettings, onLogout }: Props) {
  const { t } = useTranslation()
  return (
    <div className="user-card">
      <div className="user-card__info">
        <p className="user-card__label">{t('userCard.activeSession')}</p>
        <p className="user-card__name">{username}</p>
        {mustChange ? <p className="user-card__warning">{t('userCard.changeCredentials')}</p> : null}
      </div>
      <div className="user-card__actions">
        <button type="button" className="user-card__link" onClick={onOpenSettings}>
          {t('userCard.settings')}
        </button>
        <span className="user-card__dot">•</span>
        <button type="button" className="user-card__link" onClick={onLogout}>
          {t('userCard.logout')}
        </button>
      </div>
    </div>
  )
}
