import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { ToastProvider } from './components/Toast'
import './styles.css'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
