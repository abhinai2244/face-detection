import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Film, X, Play } from 'lucide-react'
import { fmtBytes } from '../utils/helpers'

const ACCEPTED = { 'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.mpeg'] }
const MAX_SIZE = 2 * 1024 * 1024 * 1024  // 2 GB

export default function VideoUpload({ onStart, disabled }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted, rejected) => {
    setError('')
    if (rejected.length) {
      const r = rejected[0]
      if (r.errors[0]?.code === 'file-too-large') setError('File exceeds 2 GB limit.')
      else setError('Invalid file type. Accepted: MP4, AVI, MOV, MKV, WEBM.')
      return
    }
    setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled,
  })

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Film className="w-5 h-5 text-brand-500" />
        <h2 className="font-bold text-white text-lg">Upload Surveillance Video</h2>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
          transition-all duration-200 group
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
          ${isDragActive
            ? 'border-brand-500 bg-brand-600/10'
            : 'border-slate-700 hover:border-brand-500/60 hover:bg-dark-800/50'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
            ${isDragActive ? 'bg-brand-600/30' : 'bg-dark-800 group-hover:bg-dark-700'}`}>
            <Upload className={`w-7 h-7 ${isDragActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400'}`} />
          </div>
          <div>
            <p className="text-white font-semibold">
              {isDragActive ? 'Drop video here…' : 'Drag & drop a video file'}
            </p>
            <p className="text-slate-500 text-sm mt-1">or click to browse • MP4, AVI, MOV, MKV up to 2 GB</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-danger-400 text-sm bg-danger-600/10 border border-danger-500/30 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* File preview row */}
      {file && (
        <div className="flex items-center justify-between bg-dark-800 border border-slate-700 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Film className="w-5 h-5 text-brand-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{file.name}</p>
              <p className="text-slate-500 text-xs">{fmtBytes(file.size)}</p>
            </div>
          </div>
          <div className="flex gap-2 ml-4 shrink-0">
            <button onClick={() => setFile(null)} className="btn-ghost p-2">
              <X className="w-4 h-4" />
            </button>
            <button onClick={() => onStart(file)} className="btn-primary">
              <Play className="w-4 h-4" />
              Analyse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
