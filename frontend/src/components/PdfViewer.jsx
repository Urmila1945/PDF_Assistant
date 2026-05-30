import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { motion } from 'framer-motion'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

export default function PdfViewer({ fileUrl, page = 1, matchText, documents, onSelectDoc }) {
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(page)
  const [scale, setScale] = useState(1.0)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightBoxes, setHighlightBoxes] = useState([])
  const [pageFlash, setPageFlash] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => { setCurrentPage(page || 1) }, [page, fileUrl])

  useEffect(() => {
    if (matchText) {
      setSearchTerm(matchText.slice(0, 60))
      setPageFlash(true)
      setTimeout(() => setPageFlash(false), 1500)
    }
  }, [matchText, page])

  // Find and highlight text spans
  const findHighlights = useCallback(() => {
    if (!searchTerm || !containerRef.current) return
    const needle = searchTerm.trim().toLowerCase()
    if (!needle) { setHighlightBoxes([]); return }
    const container = containerRef.current
    const cRect = container.getBoundingClientRect()
    const spans = container.querySelectorAll('.react-pdf__Page__textContent span')
    const boxes = []
    spans.forEach(span => {
      if ((span.textContent || '').toLowerCase().includes(needle)) {
        const r = span.getBoundingClientRect()
        boxes.push({ left: r.left - cRect.left, top: r.top - cRect.top, width: r.width, height: r.height })
      }
    })
    setHighlightBoxes(boxes)
  }, [searchTerm])

  useEffect(() => {
    setHighlightBoxes([])
    if (!searchTerm) return
    const timers = [300, 700, 1200].map(d => setTimeout(findHighlights, d))
    return () => timers.forEach(clearTimeout)
  }, [searchTerm, currentPage, fileUrl, findHighlights])

  const goTo = (p) => setCurrentPage(Math.max(1, Math.min(numPages || 1, p)))

  if (!fileUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="text-6xl opacity-20">📄</div>
        <div className="text-slate-500 text-sm">No PDF selected</div>
        {documents && documents.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-w-md w-full">
            {documents.map(doc => (
              <button
                key={doc.name}
                onClick={() => onSelectDoc && onSelectDoc(doc)}
                className="flex items-center gap-2 p-3 card hover:border-indigo-500/50 transition-all text-left"
              >
                <span className="text-xl">📕</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{doc.name}</div>
                  <div className="text-[10px] text-slate-500">{doc.pages} pages</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search in PDF..."
            className="input-dark text-sm py-2 pl-8 pr-3"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          {highlightBoxes.length > 0 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-medium">
              {highlightBoxes.length} match{highlightBoxes.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(1)} className="btn-ghost text-xs px-2">⏮</button>
          <button onClick={() => goTo(currentPage - 1)} className="btn-ghost text-xs px-2">◀</button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={currentPage}
              onChange={e => goTo(parseInt(e.target.value) || 1)}
              className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-center text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-slate-500">/ {numPages || '?'}</span>
          </div>
          <button onClick={() => goTo(currentPage + 1)} className="btn-ghost text-xs px-2">▶</button>
          <button onClick={() => goTo(numPages || 1)} className="btn-ghost text-xs px-2">⏭</button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="btn-ghost text-xs px-2">−</button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="btn-ghost text-xs px-2">+</button>
          <button onClick={() => setScale(1.0)} className="btn-ghost text-xs px-2">↺</button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex justify-center bg-slate-950 rounded-xl border border-slate-700/50">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => { setNumPages(numPages); setCurrentPage(p => Math.min(p, numPages)) }}
          onLoadError={e => console.error('PDF load error:', e)}
          loading={
            <div className="flex items-center justify-center h-64 text-slate-500">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mr-2" />
              Loading PDF...
            </div>
          }
        >
          <div className="relative inline-block m-4" ref={containerRef}>
            <motion.div
              animate={pageFlash ? { boxShadow: '0 0 0 3px rgba(99,102,241,0.6)' } : { boxShadow: '0 0 0 0px rgba(99,102,241,0)' }}
              transition={{ duration: 0.3 }}
              className="rounded-lg overflow-hidden"
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </motion.div>

            {/* Highlight overlays */}
            {highlightBoxes.map((b, i) => (
              <div
                key={i}
                className="absolute pointer-events-none rounded"
                style={{
                  left: b.left, top: b.top, width: b.width, height: b.height,
                  background: 'rgba(250, 204, 21, 0.4)',
                  mixBlendMode: 'multiply',
                  border: '1px solid rgba(250, 204, 21, 0.6)'
                }}
              />
            ))}
          </div>
        </Document>
      </div>
    </div>
  )
}
