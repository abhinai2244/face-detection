import { useState } from 'react'
import { List, Download, ChevronUp, ChevronDown, User, Clock, Activity, Filter } from 'lucide-react'
import { confColor } from '../utils/helpers'

function downloadCSV(detections) {
  const rows = [
    ['Frame', 'Timestamp', 'Person', 'Confidence %', 'BBox x1', 'y1', 'x2', 'y2', 'Det Score'],
    ...detections.map(d => [
      d.frame_idx, d.timestamp_str, d.person_name, d.confidence,
      ...d.bbox, d.det_score,
    ]),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'detections.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function DetectionLog({ detections }) {
  const [filter, setFilter] = useState('all')  // 'all' | 'blacklisted'
  const [sortDesc, setSortDesc] = useState(true)

  const visible = detections
    .filter(d => filter === 'all' || d.person_name !== 'Unknown')
    .sort((a, b) => sortDesc ? b.frame_idx - a.frame_idx : a.frame_idx - b.frame_idx)

  return (
    <div className="card">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 flex-wrap">
        <List className="w-4 h-4 text-brand-400" />
        <span className="font-semibold text-slate-300 text-sm">Detection Log</span>
        <span className="text-xs text-slate-500 bg-dark-800 px-2 py-0.5 rounded-full border border-slate-700">
          {detections.length.toLocaleString()} records
        </span>

        {/* Filter toggle */}
        <div className="flex gap-1 bg-dark-800 rounded-lg p-0.5 border border-slate-800 ml-auto">
          {[['all', 'All Faces'], ['blacklisted', 'Blacklisted Only']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors
                ${filter === v ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>

        {detections.length > 0 && (
          <button onClick={() => downloadCSV(detections)} className="btn-ghost py-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-slate-600">
          <Filter className="w-8 h-8" />
          <p className="text-sm">No detections recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                {[
                  { key: 'frame', label: 'Frame', icon: null },
                  { key: 'time',  label: 'Timestamp', icon: Clock },
                  { key: 'name',  label: 'Person', icon: User },
                  { key: 'conf',  label: 'Confidence', icon: Activity },
                  { key: 'bbox',  label: 'Bounding Box', icon: null },
                ].map(({ key, label, icon: Icon }) => (
                  <th key={key}
                    onClick={key === 'frame' ? () => setSortDesc(p => !p) : undefined}
                    className={`px-4 py-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider
                      ${key === 'frame' ? 'cursor-pointer hover:text-white select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {Icon && <Icon className="w-3 h-3" />}
                      {label}
                      {key === 'frame' && (sortDesc
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronUp   className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 200).map((d, i) => (
                <tr key={i}
                  className={`border-b border-slate-800/50 hover:bg-dark-800/40 transition-colors
                    ${d.person_name !== 'Unknown' ? 'bg-danger-600/5' : ''}`}
                >
                  <td className="px-4 py-2.5 tabular-nums text-slate-400">{d.frame_idx}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-400 font-mono text-xs">{d.timestamp_str}</td>
                  <td className="px-4 py-2.5">
                    {d.person_name === 'Unknown'
                      ? <span className="badge-safe">Unknown</span>
                      : <span className="badge-blacklisted">⚠ {d.person_name}</span>
                    }
                  </td>
                  <td className={`px-4 py-2.5 font-bold tabular-nums ${confColor(d.confidence)}`}>
                    {d.confidence?.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">
                    [{d.bbox?.join(', ')}]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 200 && (
            <p className="text-center text-xs text-slate-600 py-3">
              Showing 200 of {visible.length} rows. Export CSV for full log.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
