import { useState } from 'react'
import Header from './components/Header'
import SurveillancePage from './pages/SurveillancePage'
import BlacklistManager from './components/BlacklistManager'

export default function App() {
  const [activeTab, setActiveTab] = useState('surveillance')
  const [alertCount, setAlertCount] = useState(0)

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <Header activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />
      <main className="flex-1">
        {activeTab === 'surveillance'
          ? <SurveillancePage onAlertCount={setAlertCount} />
          : <BlacklistManager />
        }
      </main>
      <footer className="text-center text-xs text-slate-700 py-4 border-t border-slate-900">
        FaceGuard Surveillance System · Built with InsightFace + FAISS + FastAPI + React
      </footer>
    </div>
  )
}
