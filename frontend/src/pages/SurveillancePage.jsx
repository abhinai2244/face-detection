import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import VideoUpload from '../components/VideoUpload'
import ProgressPanel from '../components/ProgressPanel'
import DualVideoPanel from '../components/DualVideoPanel'
import AlertPanel from '../components/AlertPanel'
import DetectionLog from '../components/DetectionLog'
import { useProcessing } from '../hooks/useProcessing'

export default function SurveillancePage() {
  const {
    phase, uploadProgress, jobInfo,
    currentFrame, stats, detections, alerts,
    error, startJob, reset,
  } = useProcessing()

  const [alertDismissed, setAlertDismissed] = useState(false)
  const isIdle = phase === 'idle'

  const handleStart = async (file) => {
    setAlertDismissed(false)
    await startJob(file)
  }

  const handleReset = () => {
    setAlertDismissed(false)
    reset()
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-5">

      {/* Upload panel (always shown when idle) */}
      {isIdle && (
        <VideoUpload onStart={handleStart} disabled={false} />
      )}

      {/* Reset button when processing/done */}
      {!isIdle && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Analysis Session</h2>
          <button onClick={handleReset} className="btn-ghost">
            <RotateCcw className="w-4 h-4" />
            New Video
          </button>
        </div>
      )}

      {/* Progress panel */}
      {!isIdle && (
        <ProgressPanel
          phase={phase}
          uploadProgress={uploadProgress}
          currentFrame={currentFrame}
          stats={stats}
          jobInfo={jobInfo}
          error={error}
        />
      )}

      {/* Alert banner */}
      {alerts.length > 0 && !alertDismissed && (
        <AlertPanel alerts={alerts} onDismiss={() => setAlertDismissed(true)} />
      )}

      {/* Dual video panel */}
      {(phase === 'processing' || phase === 'done') && (
        <DualVideoPanel
          jobInfo={jobInfo}
          currentFrame={currentFrame}
          phase={phase}
        />
      )}

      {/* Detection log */}
      {detections.length > 0 && (
        <DetectionLog detections={detections} />
      )}
    </div>
  )
}
