import { useEffect, useRef } from 'react'
import { Download, Film, Cpu } from 'lucide-react'
import { downloadProcessedVideo, originalVideoUrl } from '../services/api'

/**
 * Left:  HTML5 <video> serving the original uploaded file
 * Right: Live canvas updated with the base64-encoded annotated frames from WS
 */
export default function DualVideoPanel({ jobInfo, currentFrame, phase }) {
  const canvasRef = useRef(null)
  const imgRef   = useRef(new Image())

  // Paint annotated frames onto the right canvas as they arrive
  useEffect(() => {
    if (!currentFrame?.frameData || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const img    = imgRef.current

    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = `data:image/jpeg;base64,${currentFrame.frameData}`
  }, [currentFrame?.frameData])

  const hasVideo = !!jobInfo?.videoId

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Left: Original ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-dark-950">
          <Film className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Original Video</span>
        </div>
        <div className="bg-black flex items-center justify-center min-h-[240px]">
          {hasVideo ? (
            <video
              key={jobInfo.videoId}
              src={originalVideoUrl(jobInfo.videoId)}
              controls
              className="w-full max-h-[420px] object-contain"
              muted
            />
          ) : (
            <Placeholder label="Original video will appear here" icon={Film} />
          )}
        </div>
      </div>

      {/* ── Right: AI Processed ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-dark-950">
          <Cpu className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-semibold text-slate-300">AI Detection Feed</span>
          {(phase === 'processing') && (
            <span className="ml-1 flex items-center gap-1 text-xs text-success-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" />
              LIVE
            </span>
          )}
          {phase === 'done' && jobInfo?.videoId && (
            <a
              href={downloadProcessedVideo(jobInfo.videoId)}
              download
              className="ml-auto flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
        </div>

        <div className="relative bg-black flex items-center justify-center min-h-[240px]">
          {phase === 'done' && jobInfo?.videoId ? (
            /* Show the saved processed video once done */
            <video
              key={`proc-${jobInfo.videoId}`}
              src={`/processed/${jobInfo.videoId}_processed.mp4`}
              controls
              className="w-full max-h-[420px] object-contain"
              muted
            />
          ) : currentFrame?.frameData ? (
            <canvas
              ref={canvasRef}
              className="w-full max-h-[420px] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className={`relative w-full min-h-[240px] ${phase === 'processing' ? 'scan-line' : ''}`}>
              <Placeholder
                label={phase === 'processing' ? 'Waiting for first frame…' : 'Processed video will appear here'}
                icon={Cpu}
                dim={phase === 'processing'}
              />
            </div>
          )}

          {/* Blacklisted overlay flash */}
          {currentFrame?.detections?.some(d => d.person_name !== 'Unknown') && (
            <div className="absolute inset-0 border-4 border-danger-500 rounded-b-2xl pointer-events-none alert-flash" />
          )}
        </div>
      </div>
    </div>
  )
}

function Placeholder({ label, icon: Icon, dim }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-10 ${dim ? 'opacity-40' : 'opacity-30'}`}>
      <Icon className="w-12 h-12 text-slate-600" />
      <p className="text-slate-500 text-sm text-center">{label}</p>
    </div>
  )
}
