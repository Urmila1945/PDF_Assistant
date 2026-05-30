import React, { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || '/api'

const MODELS = [
  { id: 'gemini-flash',   label: 'Gemini 2.5 Flash', icon: '⚡', color: 'text-blue-400',   disabled: false },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro',   icon: '✨', color: 'text-purple-400', disabled: false }
]

const ACTIONS = [
  { id: 'ask',       label: 'Ask',       icon: '💬' },
  { id: 'summarize', label: 'Summarize', icon: '📝' },
  { id: 'compare',   label: 'Compare',   icon: '⚖️' },
  { id: 'search',    label: 'Search',    icon: '🔍' }
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1 bg-slate-800 rounded-2xl px-4 py-3">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="btn-ghost text-xs py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

function SourceCard({ source, onJump }) {
  const confidence = Math.round((source.score || 0) * 100)
  return (
    <button
      onClick={() => onJump && onJump(source)}
      className="flex items-start gap-2 p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-lg text-left transition-all duration-200 w-full"
    >
      <span className="text-base mt-0.5">📄</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-200 truncate">{source.document}</div>
        {source.page && <div className="text-[10px] text-slate-500">Page {source.page}</div>}
        {source.text && <div className="text-[10px] text-slate-600 truncate mt-0.5">{source.text}</div>}
      </div>
      <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
        confidence >= 80 ? 'bg-green-500/20 text-green-400' :
        confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-slate-700 text-slate-400'
      }`}>
        {confidence}%
      </div>
    </button>
  )
}

function Message({ msg, onJumpToSource }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
        isUser ? 'bg-indigo-600' : 'bg-gradient-to-br from-purple-600 to-indigo-600'
      }`}>
        {isUser ? '👤' : '🧠'}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`relative px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-slate-800 border border-slate-700/50 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="text-sm">{msg.text}</p>
          ) : (
            <div className="prose-dark text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    )
                  }
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          )}
          {!isUser && <CopyButton text={msg.text} />}
        </div>

        {msg.sources && msg.sources.length > 0 && (
          <div className="w-full space-y-1 mt-1">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
              Sources ({msg.sources.length})
            </div>
            <div className="grid grid-cols-1 gap-1">
              {msg.sources.slice(0, 4).map((s, si) => (
                <SourceCard
                  key={si}
                  source={s}
                  onJump={(src) => {
                    if (onJumpToSource) {
                      const url = `/uploads/${encodeURIComponent(src.document)}`
                      onJumpToSource(url, src.page, src.text)
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function Chat({ documents, onJumpToSource, saveHistory }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '👋 Hello! Upload PDFs and ask me anything. Use **Ask** to query, **Summarize** to summarize a doc, **Compare** to compare two docs, or **Search** to find keywords.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState('gemini-flash')
  const [action, setAction] = useState('ask')
  const [summarizeDoc, setSummarizeDoc] = useState('')
  const [summarizeType, setSummarizeType] = useState('short')
  const [compareDoc1, setCompareDoc1] = useState('')
  const [compareDoc2, setCompareDoc2] = useState('')
  const [filterDocs, setFilterDocs] = useState([])
  const bottomRef = useRef(null)

  // Auto-select first doc when documents load
  useEffect(() => {
    if (documents?.length > 0) {
      if (!summarizeDoc) setSummarizeDoc(documents[0].name)
      if (!compareDoc1) setCompareDoc1(documents[0].name)
      if (documents.length > 1 && !compareDoc2) setCompareDoc2(documents[1].name)
    }
  }, [documents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Whether send button should be enabled
  const canSend = !loading && (
    action === 'summarize' ? !!summarizeDoc :
    action === 'compare'   ? (!!compareDoc1 && !!compareDoc2 && compareDoc1 !== compareDoc2) :
    input.trim().length > 0
  )

  const send = useCallback(async () => {
    if (!canSend) return
    setLoading(true)

    try {
      if (action === 'summarize') {
        const label = `Summarize (${summarizeType}): ${summarizeDoc}`
        setMessages(prev => [...prev, { role: 'user', text: label }])
        const res = await axios.post(`${API}/query/summarize`, {
          documentName: summarizeDoc, type: summarizeType, model
        })
        setMessages(prev => [...prev, { role: 'assistant', text: res.data.summary, sources: [] }])

      } else if (action === 'compare') {
        const aspect = input.trim() || 'general similarities and differences'
        setMessages(prev => [...prev, { role: 'user', text: `Compare: ${compareDoc1} vs ${compareDoc2} — ${aspect}` }])
        setInput('')
        const res = await axios.post(`${API}/query/compare`, {
          doc1: compareDoc1, doc2: compareDoc2, aspect, model
        })
        setMessages(prev => [...prev, { role: 'assistant', text: res.data.comparison, sources: [] }])

      } else if (action === 'search') {
        const q = input.trim()
        setMessages(prev => [...prev, { role: 'user', text: `Search: "${q}"` }])
        setInput('')
        const res = await axios.post(`${API}/query/search`, { keyword: q })
        const hits = res.data.hits || []
        const text = hits.length
          ? `Found **${hits.length}** matches for "${q}":\n\n` +
            hits.map(h => `**${h.document}** (Page ${h.page || '?'})\n> ${h.preview}`).join('\n\n')
          : `No matches found for "${q}"`
        const sources = hits.map(h => ({ document: h.document, page: h.page, score: 1, text: h.preview }))
        setMessages(prev => [...prev, { role: 'assistant', text, sources }])

      } else {
        const q = input.trim()
        setMessages(prev => [...prev, { role: 'user', text: q }])
        setInput('')
        const res = await axios.post(`${API}/query`, {
          question: q, top_k: 8, model,
          documents: filterDocs.length ? filterDocs : undefined,
          saveHistory
        })
        setMessages(prev => [...prev, { role: 'assistant', text: res.data.answer, sources: res.data.sources }])
      }
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || 'Something went wrong'
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }, [canSend, action, input, model, summarizeDoc, summarizeType, compareDoc1, compareDoc2, filterDocs])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const exportChat = () => {
    const text = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.text}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'chat-export.txt'
    a.click()
  }

  const selectedModel = MODELS.find(m => m.id === model)
  const docNames = (documents || []).map(d => d.name)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/50 bg-slate-900 flex-shrink-0 flex-wrap gap-y-2">
        {/* Action Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => setAction(a.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                action === a.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{a.icon}</span><span>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Model Selector */}
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {MODELS.map(m => <option key={m.id} value={m.id} disabled={m.disabled}>{m.icon} {m.label}</option>)}
        </select>

        {/* Summarize controls */}
        {action === 'summarize' && (
          <>
            <select value={summarizeDoc} onChange={e => setSummarizeDoc(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[180px]">
              {docNames.length === 0 && <option value="">No documents</option>}
              {docNames.map(n => <option key={n} value={n}>{n.length > 25 ? n.slice(0,23)+'…' : n}</option>)}
            </select>
            <select value={summarizeType} onChange={e => setSummarizeType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
              <option value="short">Short</option>
              <option value="detailed">Detailed</option>
              <option value="keypoints">Key Points</option>
            </select>
          </>
        )}

        {/* Compare controls */}
        {action === 'compare' && (
          <>
            <select value={compareDoc1} onChange={e => setCompareDoc1(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[160px]">
              {docNames.map(n => <option key={n} value={n}>{n.length > 20 ? n.slice(0,18)+'…' : n}</option>)}
            </select>
            <span className="text-slate-500 text-xs">vs</span>
            <select value={compareDoc2} onChange={e => setCompareDoc2(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[160px]">
              {docNames.map(n => <option key={n} value={n}>{n.length > 20 ? n.slice(0,18)+'…' : n}</option>)}
            </select>
          </>
        )}

        {/* Ask: doc filter chips */}
        {action === 'ask' && docNames.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {docNames.map(n => (
              <button key={n}
                onClick={() => setFilterDocs(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n])}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all border ${
                  filterDocs.includes(n)
                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}>
                {n.length > 18 ? n.slice(0,16)+'…' : n}
              </button>
            ))}
          </div>
        )}

        <button onClick={exportChat} className="ml-auto btn-ghost text-xs py-1">⬇ Export</button>
        <button onClick={() => setMessages([messages[0]])} className="btn-ghost text-xs py-1">🗑 Clear</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onJumpToSource={onJumpToSource} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-900">
        {/* Summarize: just a button, no text needed */}
        {action === 'summarize' ? (
          <button onClick={send} disabled={!canSend}
            className="btn-primary w-full py-3 text-sm">
            {loading
              ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Summarizing...</span>
              : `📝 Summarize "${summarizeDoc || 'select a doc above'}"`}
          </button>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  action === 'compare' ? 'Optional: describe what aspect to compare (Enter to run)...' :
                  action === 'search'  ? 'Enter keyword to search across all PDFs...' :
                  'Ask a question about your PDFs... (Enter to send)'
                }
                className="input-dark resize-none min-h-[44px] max-h-32 py-3 pr-10 text-sm"
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
              />
              <div className="absolute right-3 bottom-2.5 text-[10px] text-slate-600">{selectedModel?.icon}</div>
            </div>
            <button onClick={send} disabled={!canSend}
              className="btn-primary h-11 px-5 flex items-center gap-2 flex-shrink-0">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>}
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-slate-600">
            {action === 'ask' ? 'Shift+Enter for new line' :
             action === 'compare' ? `Comparing ${compareDoc1 || '?'} vs ${compareDoc2 || '?'}` :
             action === 'search' ? 'Searches all indexed chunks' : ''}
          </span>
          <span className={`text-[10px] font-medium ${selectedModel?.color}`}>{selectedModel?.icon} {selectedModel?.label}</span>
        </div>
      </div>
    </div>
  )
}
