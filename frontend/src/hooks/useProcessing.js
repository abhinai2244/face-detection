import { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createProcessingWS, uploadVideo } from '../services/api'

/**
 * Encapsulates the full upload → process lifecycle.
 *
 * Returns:
 *   phase          'idle' | 'uploading' | 'connecting' | 'processing' | 'done' | 'error'
 *   uploadProgress 0–100
 *   jobInfo        { videoId, videoPath, srcFps, targetFps, totalFrames, width, height }
 *   currentFrame   { idx, timestamp, timestampStr, progress, frameData (base64) }
 *   stats          { processedFrames, detectionCount, blacklistedCount, elapsedSec }
 *   detections     Detection[]
 *   alerts         Alert[]       (blacklisted-only subset, newest first)
 *   error          string | null
 *   startJob(file) async function
 *   reset()
 */
export function useProcessing() {
  const [phase, setPhase] = useState('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobInfo, setJobInfo] = useState(null)
  const [currentFrame, setCurrentFrame] = useState(null)
  const [stats, setStats] = useState({ processedFrames: 0, detectionCount: 0, blacklistedCount: 0, elapsedSec: 0 })
  const [detections, setDetections] = useState([])
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const startTimeRef = useRef(null)
  const statsRef = useRef({ processedFrames: 0, detectionCount: 0, blacklistedCount: 0 })

  const reset = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setPhase('idle')
    setUploadProgress(0)
    setJobInfo(null)
    setCurrentFrame(null)
    setStats({ processedFrames: 0, detectionCount: 0, blacklistedCount: 0, elapsedSec: 0 })
    setDetections([])
    setAlerts([])
    setError(null)
    statsRef.current = { processedFrames: 0, detectionCount: 0, blacklistedCount: 0 }
  }, [])

  const startJob = useCallback(async (file) => {
    reset()

    // 1. Upload
    setPhase('uploading')
    let uploadResult
    try {
      uploadResult = await uploadVideo(file, setUploadProgress)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed'
      setError(msg)
      setPhase('error')
      toast.error(`Upload failed: ${msg}`)
      return
    }

    const { video_id: videoId, path: videoPath } = uploadResult

    // 2. Connect WebSocket
    setPhase('connecting')
    setJobInfo(prev => ({ ...prev, videoId, videoPath }))

    const ws = createProcessingWS(videoId)
    wsRef.current = ws
    startTimeRef.current = Date.now()

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'start', video_path: videoPath }))
    }

    ws.onmessage = (evt) => {
      let msg
      try { msg = JSON.parse(evt.data) } catch { return }

      switch (msg.type) {
        case 'start':
          setPhase('processing')
          setJobInfo({
            videoId,
            videoPath,
            srcFps: msg.src_fps,
            targetFps: msg.target_fps,
            totalFrames: msg.total_frames,
            width: msg.width,
            height: msg.height,
          })
          break

        case 'frame': {
          const s = statsRef.current
          s.processedFrames++
          s.detectionCount += msg.face_count || 0
          s.blacklistedCount += msg.blacklisted_count || 0

          const elapsed = (Date.now() - startTimeRef.current) / 1000
          setStats({ ...s, elapsedSec: Math.round(elapsed) })

          setCurrentFrame({
            idx: msg.frame_idx,
            timestamp: msg.timestamp,
            timestampStr: msg.timestamp_str,
            progress: msg.progress,
            frameData: msg.frame_data,
            detections: msg.detections || [],
          })

          if (msg.detections?.length) {
            setDetections(prev => [...prev, ...msg.detections].slice(-500))
          }
          break
        }

        case 'alert':
          setAlerts(prev => [msg, ...prev].slice(0, 200))
          toast.error(`🚨 ${msg.person_name} detected! (${msg.confidence}%)`, {
            duration: 5000,
            style: {
              background: '#450a0a',
              color: '#fca5a5',
              border: '1px solid #dc2626',
            },
          })
          break

        case 'complete':
          setPhase('done')
          toast.success(`Processing complete! ${msg.total_detections} detections found.`)
          break

        case 'error':
          setError(msg.message)
          setPhase('error')
          toast.error(msg.message)
          break

        default:
          break
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
      setPhase('error')
    }

    ws.onclose = (e) => {
      if (e.code !== 1000 && phase !== 'done') {
        setPhase(prev => prev === 'processing' ? 'done' : prev)
      }
    }
  }, [reset]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    phase, uploadProgress, jobInfo,
    currentFrame, stats, detections, alerts,
    error, startJob, reset,
  }
}
