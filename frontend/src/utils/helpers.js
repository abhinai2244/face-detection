/** Format seconds → HH:MM:SS or MM:SS */
export function fmtTime(secs) {
  const s = Math.floor(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Human-readable file size */
export function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

/** Confidence colour class */
export function confColor(conf) {
  if (conf >= 85) return 'text-danger-400'
  if (conf >= 70) return 'text-orange-400'
  return 'text-yellow-400'
}

/** Download a blob as a file */
export function downloadBlob(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

/** Slugify a display name for safe use as folder key */
export function slugify(str) {
  return str.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
}
