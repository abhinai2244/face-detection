import { AlertTriangle, X, Clock, User, Percent } from 'lucide-react'
import { confColor } from '../utils/helpers'

export default function AlertPanel({ alerts, onDismiss }) {
  if (!alerts.length) return null

  const latest = alerts[0]

  return (
    <div className="space-y-3">
      {/* Flashing banner for latest alert */}
      <div className="flex items-center gap-4 bg-danger-600/20 border border-danger-500/50
                      rounded-2xl px-5 py-4 animate-pulse-red">
        <AlertTriangle className="w-6 h-6 text-danger-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-danger-300 text-sm tracking-wide uppercase">
            ⚠ Blacklisted Person Detected
          </p>
          <p className="text-white text-base font-semibold truncate mt-0.5">
            {latest.person_name}
            <span className={`ml-2 text-sm font-bold ${confColor(latest.confidence)}`}>
              {latest.confidence}% match
            </span>
          </p>
          <p className="text-slate-400 text-xs mt-0.5">@ {latest.timestamp_str}</p>
        </div>
        <button onClick={onDismiss} className="shrink-0 p-1.5 rounded-lg hover:bg-danger-500/20 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Alert log (up to 8 visible, scrollable) */}
      {alerts.length > 1 && (
        <div className="card">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-400" />
            <span className="text-sm font-semibold text-slate-300">Alert History</span>
            <span className="ml-auto text-xs text-slate-500">{alerts.length} total</span>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/50">
            {alerts.slice(0, 50).map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-dark-800/50 transition-colors">
                <User className="w-3.5 h-3.5 text-danger-400 shrink-0" />
                <span className="text-sm text-white font-medium flex-1 truncate">{a.person_name}</span>
                <span className={`text-xs font-bold tabular-nums ${confColor(a.confidence)}`}>
                  {a.confidence}%
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.timestamp_str}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
