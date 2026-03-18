import { Eye, Shield, Activity } from 'lucide-react'

export default function Header({ activeTab, onTabChange, alertCount }) {
  const tabs = [
    { id: 'surveillance', label: 'Surveillance', icon: Eye },
    { id: 'blacklist',    label: 'Blacklist',    icon: Shield },
  ]

  return (
    <header className="sticky top-0 z-50 bg-dark-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight tracking-wide">FaceGuard</p>
            <p className="text-[10px] text-slate-500 leading-tight uppercase tracking-widest">Surveillance System</p>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="flex gap-1 bg-dark-900 p-1 rounded-xl border border-slate-800">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`
                relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold
                transition-all duration-200
                ${activeTab === id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-dark-800'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'surveillance' && alertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1
                                 bg-danger-500 text-white text-[10px] font-bold rounded-full
                                 flex items-center justify-center animate-pulse-red">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-3.5 h-3.5 text-success-500" />
          <span>System Online</span>
        </div>
      </div>
    </header>
  )
}
