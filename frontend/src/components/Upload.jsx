import React, { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || '/api'

export default function Upload({ onIndexed }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const addFiles = useCallback((newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))]
    })
    setResult(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const upload = async () => {
    if (!files.length) return
    setUploading(true)
    setProgress(0)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    try {
      const res = await axios.post(`${API}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded / e.total) * 100))
      })
      setResult(res.data)
      setFiles([])
      if (onIndexed) onIndexed(res.data.files)
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message })
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload PDFs</div>

      {/* Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-white/5'
        }`}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        <div className="text-2xl mb-1">📂</div>
        <div className="text-xs text-slate-400">
          {dragOver ? 'Drop PDFs here' : 'Click or drag PDFs here'}
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">Max 50MB per file</div>
      </div>

      {/* File List */}
      <AnimatePresence>
        {files.map((f, i) => (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-2.5 bg-slate-800 rounded-lg border border-slate-700/50"
          >
            <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px]">PDF</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{f.name}</div>
              <div className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(0)} KB</div>
            </div>
            <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-red-400 transition-colors text-xs p-1">✕</button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload Button + Progress */}
      {files.length > 0 && (
        <div className="space-y-2">
          {uploading && (
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
          <button
            onClick={upload}
            disabled={uploading}
            className="btn-primary w-full text-sm py-2"
          >
            {uploading ? `Processing... ${progress}%` : `Upload & Index ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3 rounded-lg text-xs ${result.error ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}
          >
            {result.error ? (
              <span>❌ {result.error}</span>
            ) : (
              <div className="space-y-1">
                <div className="font-medium">✅ Indexed successfully</div>
                {(result.files || []).map((f, i) => (
                  <div key={i} className="text-green-500/80">
                    {f.document}: {f.pages}p, {f.chunks} chunks
                    {f.error && <span className="text-red-400"> — {f.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
