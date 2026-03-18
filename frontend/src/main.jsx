import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #334155',
          borderRadius: '12px',
          fontSize: '13px',
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#fff' },
          duration: 6000,
        },
        success: {
          iconTheme: { primary: '#22c55e', secondary: '#fff' },
        },
      }}
    />
  </React.StrictMode>
)
