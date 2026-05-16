import { Component, type ErrorInfo, type ReactNode } from 'react'
import { withTranslation, type WithTranslation } from 'react-i18next'

interface Props extends WithTranslation {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { t } = this.props
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h2>{t('error.title')}</h2>
            <p className="muted-text">
              {t('error.description')}
            </p>
            {this.state.error && (
              <pre className="error-boundary__detail">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              className="btn primary"
              onClick={() => window.location.reload()}
            >
              {t('error.reload')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryClass)
