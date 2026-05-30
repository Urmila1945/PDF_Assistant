import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Upload from './components/Upload'
import Chat from './components/Chat'
import PdfViewer from './components/PdfViewer'
import Dashboard from './components/Dashboard'
import { useQuery } from 'react-query'
import axios from 'axios'

let rawApi = import.meta.env.VITE_API_URL || '/api';
if (rawApi.endsWith('/')) rawApi = rawApi.slice(0, -1);
if (rawApi.startsWith('http') && !rawApi.endsWith('/api')) rawApi += '/api';
const API = rawApi;

const tabs = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'viewer', label: 'PDF Viewer', icon: '📄' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' }
]

export default function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null)
  const [selectedPage, setSelectedPage] = useState(1)
  const [matchText, setMatchText] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  // Auth state
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  
  // Auth forms state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const [saveHistory, setSaveHistory] = useState(() => {
    const saved = localStorage.getItem('saveHistory')
    return saved !== null ? JSON.parse(saved) : true
  })

  const handleSaveHistoryChange = (e) => {
    const val = e.target.checked;
    setSaveHistory(val);
    localStorage.setItem('saveHistory', JSON.stringify(val));
  }

  const { data: statusData, refetch: refetchStatus } = useQuery(
    'status',
    () => axios.get(`${API}/status?t=${Date.now()}`).then(r => r.data),
    { refetchInterval: 8000 }
  )

  const documents = statusData?.documents || []

  const handleJumpToSource = useCallback((url, page, snippet) => {
    setSelectedPdfUrl(url)
    setSelectedPage(page || 1)
    setMatchText(snippet || null)
    setActiveTab('viewer')
  }, [])

  const handleDocumentIndexed = useCallback(() => {
    refetchStatus()
  }, [refetchStatus])

  const handleOpenDoc = useCallback((doc) => {
    const baseUrl = API.replace('/api', '')
    const url = `${baseUrl}/uploads/${encodeURIComponent(doc.name)}`
    setSelectedPdfUrl(url)
    setSelectedPage(1)
    setMatchText(null)
    setActiveTab('viewer')
  }, [])

  const handleDeleteDoc = useCallback(async (docName, e) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${docName}"? This will remove it and all its vectors.`)) return
    try {
      await axios.delete(`${API}/upload/${encodeURIComponent(docName)}`)
      if (selectedPdfUrl && selectedPdfUrl.includes(encodeURIComponent(docName))) {
        setSelectedPdfUrl(null)
      }
      await refetchStatus()
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message))
    }
  }, [refetchStatus, selectedPdfUrl])

  // Auth Effects
  React.useEffect(() => {
    if (token) {
      axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        })
    }
  }, [token])

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await axios.post(`${API}/auth/login`, loginForm)
      const { token, user } = res.data
      localStorage.setItem('token', token)
      setToken(token)
      setUser(user)
      setActiveTab('chat')
      setLoginForm({ email: '', password: '' })
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await axios.post(`${API}/auth/signup`, signupForm)
      const { token, user } = res.data
      localStorage.setItem('token', token)
      setToken(token)
      setUser(user)
      setActiveTab('chat')
      setSignupForm({ name: '', email: '', password: '' })
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setActiveTab('login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-72 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-700/50 overflow-hidden"
          >
            {/* Logo */}
            <div 
              onClick={() => setActiveTab('account')}
              className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg shadow-lg shadow-indigo-500/20">🧠</div>
              <div>
                <div className="font-bold text-white text-sm tracking-wide">BrainHeaters</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">AI PDF Assistant</div>
              </div>
            </div>

            {/* Upload Section */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <Upload onIndexed={handleDocumentIndexed} />

              {/* Document List */}
              {documents.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Indexed Documents ({documents.length})
                  </div>
                  <div className="space-y-1">
                    {documents.map((doc, i) => (
                      <motion.div
                        key={doc.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group flex items-center gap-2 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => handleOpenDoc(doc)}
                      >
                        <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs">📕</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-200 truncate">{doc.name}</div>
                          <div className="text-[10px] text-slate-500">{doc.pages}p · {doc.chunks} chunks</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-slate-600 group-hover:text-slate-400 text-xs">→</span>
                          <button
                            onClick={(e) => handleDeleteDoc(doc.name, e)}
                            className="text-slate-600 hover:text-red-400 transition-colors text-xs p-0.5 rounded"
                            title="Delete document"
                          >🗑</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats Footer */}
            {statusData?.stats && (
              <div className="p-4 border-t border-slate-700/50">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Docs', value: statusData.stats.totalDocs || 0 },
                    { label: 'Pages', value: statusData.stats.totalPages || 0 },
                    { label: 'Chunks', value: statusData.stats.totalChunks || 0 },
                    { label: 'Queries', value: statusData.stats.totalQuestions || 0 }
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-indigo-400">{s.value}</div>
                      <div className="text-[10px] text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="btn-ghost p-2 rounded-lg"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {documents.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-400 font-medium">{documents.length} doc{documents.length !== 1 ? 's' : ''} ready</span>
              </div>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Chat
                  documents={documents}
                  onJumpToSource={handleJumpToSource}
                  saveHistory={saveHistory}
                />
              </motion.div>
            )}
            {activeTab === 'viewer' && (
              <motion.div
                key="viewer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full p-4 overflow-auto"
              >
                <PdfViewer
                  fileUrl={selectedPdfUrl}
                  page={selectedPage}
                  matchText={matchText}
                  documents={documents}
                  onSelectDoc={handleOpenDoc}
                />
              </motion.div>
            )}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-auto p-6"
              >
                <Dashboard statusData={statusData} documents={documents} />
              </motion.div>
            )}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-auto p-6 text-slate-200"
              >
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-white">Account Settings</h2>
                        <button onClick={() => setActiveTab('login')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 text-sm">
                            Log In
                        </button>
                    </div>
                    
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50 mb-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-2xl text-slate-400 border-2 border-slate-600">
                                👤
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-white">{user ? user.name : 'Guest User'}</h3>
                                <p className="text-sm text-slate-400">{user ? user.email : 'Log in to sync your data across devices.'}</p>
                            </div>
                        </div>
                        {user && (
                            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-red-500/20 text-sm">
                                Log Out
                            </button>
                        )}
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700/50">
                        <h3 className="text-lg font-medium text-white mb-4">Privacy & Data</h3>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-slate-200">Save Chat History</div>
                                <div className="text-sm text-slate-400 mt-1">When enabled, your conversations will be saved to the database.</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={saveHistory} onChange={handleSaveHistoryChange} />
                              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500 border border-slate-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="h-full flex items-center justify-center p-6 bg-slate-950/50"
              >
                <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl rounded-2xl p-8 border border-slate-800 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 mx-auto mb-4">🧠</div>
                        <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                        <p className="text-sm text-slate-400 mt-2">Sign in to continue to BrainHeaters</p>
                    </div>
                    {authError && <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm text-center">{authError}</div>}
                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                            <input type="email" required value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} placeholder="you@example.com" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500" />
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="rounded border-slate-700 bg-slate-800/50 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer" />
                                <span className="text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
                            </label>
                            <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                        </div>
                        <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 mt-6">
                            {authLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>
                    <div className="mt-6 text-center text-sm text-slate-400">
                        Don't have an account? <button onClick={() => { setActiveTab('signup'); setAuthError(''); }} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign up</button>
                    </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="h-full flex items-center justify-center p-6 bg-slate-950/50"
              >
                <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl rounded-2xl p-8 border border-slate-800 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 mx-auto mb-4">🧠</div>
                        <h2 className="text-2xl font-bold text-white">Create an Account</h2>
                        <p className="text-sm text-slate-400 mt-2">Join BrainHeaters to save your research</p>
                    </div>
                    {authError && <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm text-center">{authError}</div>}
                    <form className="space-y-4" onSubmit={handleSignup}>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                            <input type="text" required value={signupForm.name} onChange={e => setSignupForm({...signupForm, name: e.target.value})} placeholder="John Doe" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                            <input type="email" required value={signupForm.email} onChange={e => setSignupForm({...signupForm, email: e.target.value})} placeholder="you@example.com" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <input type="password" required value={signupForm.password} onChange={e => setSignupForm({...signupForm, password: e.target.value})} placeholder="••••••••" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500" />
                        </div>
                        <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 mt-6">
                            {authLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>
                    <div className="mt-6 text-center text-sm text-slate-400">
                        Already have an account? <button onClick={() => { setActiveTab('login'); setAuthError(''); }} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Log in</button>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
