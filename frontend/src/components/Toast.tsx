import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Listen for toast events from non-React code (zustand store)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      if (detail?.message) {
        addToast(detail.message, detail.type || 'info')
      }
    }
    window.addEventListener('doapi-toast', handler)
    return () => window.removeEventListener('doapi-toast', handler)
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.addToast
}

/** Dispatch a toast event from non-React code (zustand store, etc.) */
export function fireToast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent('doapi-toast', { detail: { message, type } }))
}

function ToastContainer() {
  const { t } = useTranslation()
  const ctx = useContext(ToastContext)
  if (!ctx) return null
  const { toasts, removeToast } = ctx

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => removeToast(toast.id)}>
            {t('toast.close')}
          </button>
        </div>
      ))}
    </div>
  )
}
