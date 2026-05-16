import { useTranslation } from 'react-i18next'

interface Props {
  docsUrl: string
  sandboxUrl: string
}

export function SecurityOptions({ docsUrl, sandboxUrl }: Props) {
  const { t } = useTranslation()

  const securityTips = [
    t('securityOptions.tip1'),
    t('securityOptions.tip2'),
    t('securityOptions.tip3'),
    t('securityOptions.tip4'),
  ]

  return (
    <div className="security-panel">
      <h4>{t('securityOptions.title')}</h4>
      <ul>
        {securityTips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {docsUrl ? (
        <p>
          {t('securityOptions.currentDocsUrl')}: <code>{docsUrl}</code>
        </p>
      ) : null}
      {sandboxUrl ? (
        <p>
          {t('securityOptions.suggestedSandbox')}: <code>{sandboxUrl}</code>
        </p>
      ) : null}
    </div>
  )
}
