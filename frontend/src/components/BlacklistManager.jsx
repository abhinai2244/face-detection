import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Shield, UserPlus, Trash2, RefreshCw,
  Users, Image, Layers, Upload, X, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { useBlacklist } from '../hooks/useBlacklist'
import { blacklistImageUrl } from '../services/api'
import { slugify } from '../utils/helpers'

// ─── Add Person Form ────────────────────────────────────────────────────────
function AddPersonForm({ onAdd, loading }) {
  const [name, setName]   = useState('')
  const [files, setFiles] = useState([])
  const [adding, setAdding] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(accepted => {
    setFiles(prev => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.webp'] },
    multiple: true,
  })

  const handleSubmit = async () => {
    const safeName = slugify(name)
    if (!safeName) { toast.error('Enter a valid name'); return }
    if (!files.length) { toast.error('Add at least one image'); return }
    setAdding(true)
    setProgress(0)
    try {
      const result = await onAdd(safeName, files, setProgress)
      toast.success(`Added ${safeName}: ${result.extracted_embeddings} embeddings extracted`)
      setName('')
      setFiles([])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add person')
    } finally {
      setAdding(false)
      setProgress(0)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-brand-400" />
        <h3 className="font-bold text-white">Add to Blacklist</h3>
      </div>

      <input
        type="text"
        placeholder="Person name or ID (e.g. John_Doe)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-2.5
                   text-white placeholder-slate-500 text-sm focus:outline-none
                   focus:border-brand-500 transition-colors"
      />

      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-brand-500 bg-brand-600/10' : 'border-slate-700 hover:border-brand-500/50'}`}>
        <input {...getInputProps()} />
        <Upload className="w-6 h-6 mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-400">
          {isDragActive ? 'Drop images…' : 'Drag face images or click to browse'}
        </p>
        <p className="text-xs text-slate-600 mt-1">Multiple angles recommended</p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="w-16 h-16 object-cover rounded-lg border border-slate-700"
              />
              <button
                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger-600 rounded-full
                           flex items-center justify-center opacity-0 group-hover:opacity-100
                           transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Extracting embeddings…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={adding || !name || !files.length}
        className="btn-primary w-full justify-center"
      >
        {adding ? 'Processing…' : 'Add Person'}
      </button>
    </div>
  )
}

// ─── Person card ───────────────────────────────────────────────────────────
function PersonCard({ person, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Remove "${person.name}" from blacklist?`)) return
    setDeleting(true)
    try { await onDelete(person.name) }
    finally { setDeleting(false) }
  }

  return (
    <div className="bg-dark-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 bg-danger-600/20 border border-danger-500/30 rounded-full
                        flex items-center justify-center">
          <Shield className="w-4 h-4 text-danger-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{person.name}</p>
          <p className="text-xs text-slate-500">
            {person.image_count} image{person.image_count !== 1 ? 's' : ''} · {person.embedding_count} embeddings
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-danger-400 hover:bg-danger-600/10 transition-colors"
          >
            {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && person.images?.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-slate-700/50 pt-3">
          {person.images.map(img => (
            <img
              key={img}
              src={blacklistImageUrl(person.name, img)}
              alt={img}
              className="w-14 h-14 object-cover rounded-lg border border-slate-700"
              onError={e => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function BlacklistManager() {
  const { persons, loading, totalEmbeddings, addNew, remove, rebuild, refresh } = useBlacklist()
  const [rebuilding, setRebuilding] = useState(false)

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const r = await rebuild()
      toast.success(`Index rebuilt: ${r.persons} persons, ${r.total_embeddings} embeddings`)
    } catch {
      toast.error('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users,  label: 'Persons',    value: persons.length },
          { icon: Layers, label: 'Embeddings', value: totalEmbeddings },
          { icon: Image,  label: 'Images',     value: persons.reduce((s, p) => s + p.image_count, 0) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon className="w-5 h-5 text-brand-400" />
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Add form */}
        <div className="lg:col-span-1 space-y-3">
          <AddPersonForm onAdd={addNew} />

          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="btn-ghost w-full justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Rebuilding FAISS index…' : 'Rebuild Embedding Index'}
          </button>
        </div>

        {/* Person list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-danger-400" />
              Blacklisted Persons
            </h3>
            <button onClick={refresh} className="btn-ghost py-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : persons.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 py-14 text-slate-600">
              <Shield className="w-10 h-10" />
              <p className="text-sm">No persons in blacklist yet.</p>
              <p className="text-xs text-slate-700">Add persons using the form on the left.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {persons.map(p => (
                <PersonCard key={p.name} person={p} onDelete={remove} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
