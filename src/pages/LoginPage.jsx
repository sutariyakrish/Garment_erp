import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Scissors, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    setError('')
    const { error } = await signIn(form.email, form.password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/')
  }

  const features = [
    'Real-time fabric inventory tracking',
    'Mill dispatch & receiving workflow',
    'Sampling & design management',
    'Production & costing reports',
  ]

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9fb' }}>
      {/* Left Panel — Brand */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #1a237e 0%, #000666 60%, #000454 100%)' }}
      >
        {/* Texture overlay */}
        <div className="absolute inset-0 sidebar-texture opacity-60 pointer-events-none" />

        {/* Top */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display text-white font-bold text-lg leading-tight">Garment ERP</p>
              <p className="text-white/45 text-xs font-medium">v2.0 · Production Release</p>
            </div>
          </div>

          <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-[1.15] mb-5">
            Smart Garment<br />Manufacturing ERP
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            Streamlining production from thread to shipment. One platform for your entire fabric supply chain.
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10">
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">
            What's included
          </p>
          <ul className="space-y-3">
            {features.map(f => (
              <li key={f} className="flex items-center gap-3 text-white/80 text-sm">
                <CheckCircle className="w-4 h-4 text-brand-300 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-white/25 text-xs">
            © 2025 Garment ERP · Enterprise Edition
          </p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-10">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-indigo-md"
            style={{ background: 'linear-gradient(145deg, #1a237e, #000666)' }}
          >
            <Scissors className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Garment ERP</h1>
          <p className="text-ink-soft text-sm mt-1">Fabric to Finish Management</p>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-ink mb-1">Welcome Back</h2>
            <p className="text-ink-soft text-sm">Please enter your credentials to access the ERP.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded px-3.5 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                  onClick={() => {}}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-outline hover:text-ink-soft transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2 text-base"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-ink-outline mt-6">
            Having trouble?{' '}
            <span className="text-brand-600 font-medium cursor-pointer hover:underline">
              Contact IT Support
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
