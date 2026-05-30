import React from 'react'
import { motion } from 'framer-motion'

const StatCard = ({ icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="card p-5 flex items-center gap-4"
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>{icon}</div>
    <div>
      <div className="text-2xl font-bold text-white">{value ?? 0}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  </motion.div>
)

export default function Dashboard({ statusData, documents }) {
  const stats = statusData?.stats || {}
  const queue = statusData?.counts || {}

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of your RAG pipeline</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📄" label="PDFs Indexed"     value={stats.totalDocs}      color="bg-blue-500/10" />
        <StatCard icon="📑" label="Pages Processed"  value={stats.totalPages}     color="bg-purple-500/10" />
        <StatCard icon="🧩" label="Chunks Generated" value={stats.totalChunks}    color="bg-indigo-500/10" />
        <StatCard icon="💬" label="Questions Asked"  value={stats.totalQuestions} color="bg-green-500/10" />
      </div>

      {/* Queue Status */}
      <div className="card p-5">
        <div className="text-sm font-semibold text-slate-300 mb-3">Processing Queue</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Waiting',   value: queue.waiting,   color: 'text-yellow-400' },
            { label: 'Active',    value: queue.active,    color: 'text-blue-400' },
            { label: 'Completed', value: queue.completed, color: 'text-green-400' },
            { label: 'Failed',    value: queue.failed,    color: 'text-red-400' }
          ].map(q => (
            <div key={q.label} className="bg-slate-950 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${q.color}`}>{q.value ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{q.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      {documents && documents.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50">
            <div className="text-sm font-semibold text-slate-300">Indexed Documents</div>
          </div>
          <div className="divide-y divide-slate-700/30">
            {documents.map((doc, i) => (
              <motion.div
                key={doc.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-sm flex-shrink-0">📕</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{doc.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                  <span className="px-2 py-0.5 bg-slate-900 rounded">{doc.pages ?? 0} pages</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded">{doc.chunks ?? 0} chunks</span>
                  <span className="w-2 h-2 bg-green-400 rounded-full" title="Indexed" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {(!documents || documents.length === 0) && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl opacity-20">📂</div>
          <div className="text-slate-500 text-sm">No documents indexed yet.<br />Upload PDFs from the sidebar to get started.</div>
        </div>
      )}
    </div>
  )
}
