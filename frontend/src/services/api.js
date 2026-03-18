import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

const http = axios.create({ baseURL: BASE, timeout: 30_000 })

// ─── Video ─────────────────────────────────────────────────────────────────
export const uploadVideo = (file, onProgress) =>
  http.post('/api/video/upload', (() => {
    const fd = new FormData()
    fd.append('file', file)
    return fd
  })(), {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress?.(Math.round((e.loaded / e.total) * 100)),
  }).then(r => r.data)

export const getJobStatus = videoId =>
  http.get(`/api/video/status/${videoId}`).then(r => r.data)

export const downloadProcessedVideo = videoId =>
  `${BASE}/api/video/download/${videoId}`

export const originalVideoUrl = videoId =>
  `${BASE}/api/video/stream-original/${videoId}`

export const processedVideoUrl = videoId =>
  `${BASE}/processed/${videoId}_processed.mp4`

// ─── Blacklist ─────────────────────────────────────────────────────────────
export const listPersons = () =>
  http.get('/api/blacklist/').then(r => r.data)

export const addPerson = (name, files, onProgress) => {
  const fd = new FormData()
  fd.append('name', name)
  files.forEach(f => fd.append('images', f))
  return http.post('/api/blacklist/add', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress?.(Math.round((e.loaded / e.total) * 100)),
  }).then(r => r.data)
}

export const deletePerson = name =>
  http.delete(`/api/blacklist/${name}`).then(r => r.data)

export const rebuildIndex = () =>
  http.post('/api/blacklist/rebuild').then(r => r.data)

export const blacklistImageUrl = (name, filename) =>
  `${BASE}/api/blacklist/image/${name}/${filename}`

export const getStats = () =>
  http.get('/api/blacklist/stats').then(r => r.data)

// ─── Health ────────────────────────────────────────────────────────────────
export const healthCheck = () =>
  http.get('/health').then(r => r.data)

// ─── WebSocket factory ─────────────────────────────────────────────────────
export const createProcessingWS = videoId =>
  new WebSocket(`${WS_BASE}/ws/process/${videoId}`)
