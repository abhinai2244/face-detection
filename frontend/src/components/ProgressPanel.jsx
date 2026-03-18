import { Loader2, Upload, Wifi, Cpu, CheckCircle2, AlertCircle } from 'lucide-react'
import { fmtTime } from '../utils/helpers'

const PHASES = {
  uploading:   { icon: Upload,        label: 'Uploading video…',           color: 'bg-brand-500' },
  connecting:  { icon: Wifi,          label: 'Connecting to AI engine…',   color: 'bg-yellow-500' },
  processing:  { icon: Cpu,           label: 'Processing frames…',          color: 'bg-brand-500' },
  done:        { icon: CheckCircle2,  label: 'Analysis complete',           color: 'bg-success-500' },
  error:       { icon: AlertCircle,   label: 'Processing error',            color: 'bg-danger-500' },
}

export default function ProgressPanel({ phase, uploadProgress, currentFrame, stats, jobInfo, error }) {
  const meta = PHASES[phase] || PHASES.processing
  const Icon = meta.icon

  const progress = phase === 'uploading'
    ? uploadProgress
    : currentFrame?.progress ?? 0

  return (
    <div className="card p-5 space-y-4">
      {/* Phase header */}
      <div className="flex items-center gap-3">
        {phase !== 'done' && phase !== 'error'
          ? <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
          : <Icon className={`w-5 h-5 ${phase === 'done' ? 'text-success-400' : 'text-danger-400'}`} />
        }
        <span className="font-semibold text-white">{meta.label}</span>
        <span className="ml-auto text-slate-400 text-sm tabular-nums">{progress.toFixed(1)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${meta.color}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {error && (
        <p className="text-danger-400 text-xs bg-danger-600/10 border border-danger-500/30 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Stats grid */}
      {(phase === 'processing' || phase === 'done') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Frames processed', value: stats.processedFrames.toLocaleString() },
            { label: 'Faces detected',   value: stats.detectionCount.toLocaleString() },
            { label: 'Blacklist hits',   value: stats.blacklistedCount.toLocaleString(), highlight: stats.blacklistedCount > 0 },
            { label: 'Elapsed',          value: fmtTime(stats.elapsedSec) },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-dark-800/60 rounded-xl p-3 border border-slate-800">
              <p className="text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">{label}</p>
              <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-danger-400' : 'text-white'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Job meta */}
      {jobInfo && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {jobInfo.srcFps    && <span>Source: {jobInfo.srcFps} FPS</span>}
          {jobInfo.targetFps && <span>Target: {jobInfo.targetFps} FPS</span>}
          {jobInfo.width     && <span>Resolution: {jobInfo.width}×{jobInfo.height}</span>}
          {currentFrame      && <span>Frame: {currentFrame.idx} / {jobInfo.totalFrames} — {currentFrame.timestampStr}</span>}
        </div>
      )}
    </div>
  )
}
