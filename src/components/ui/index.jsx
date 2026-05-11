import { useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, XCircle, Info, Search } from 'lucide-react'
import { useState } from 'react'

// ── Modal ──────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, size = 'md' }) {
  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative bg-white rounded-lg w-full ${sizeClass} shadow-indigo-lg fade-in max-h-[92vh] flex flex-col border border-surface-high`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-high flex-shrink-0">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="btn-icon text-ink-soft hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Confirm Dialog ─────────────────────────────────────────────────
export function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-lg w-full max-w-sm shadow-indigo-lg fade-in p-6 border border-surface-high">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4 ${
            danger ? 'bg-red-50' : 'bg-amber-50'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 ${danger ? 'text-red-500' : 'text-amber-500'}`}
          />
        </div>
        <h3 className="font-display font-semibold text-ink text-center mb-2">{title}</h3>
        <p className="text-ink-soft text-sm text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1 justify-center`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────────
export function Toast({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2 pointer-events-none">
      {toasts.map(t => {
        const icons = {
          success: CheckCircle,
          error: XCircle,
          info: Info,
          warning: AlertTriangle,
        }
        const styles = {
          success: 'bg-white border-emerald-200 text-ink shadow-indigo-md',
          error:   'bg-white border-red-200 text-ink shadow-indigo-md',
          info:    'bg-white border-brand-100 text-ink shadow-indigo-md',
          warning: 'bg-white border-amber-200 text-ink shadow-indigo-md',
        }
        const iconColors = {
          success: 'text-emerald-500',
          error:   'text-red-500',
          info:    'text-brand-500',
          warning: 'text-amber-500',
        }
        const Icon = icons[t.type] || Info
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-xs slide-in ${styles[t.type]}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColors[t.type]}`} />
            <p className="text-sm flex-1 font-medium">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-outline hover:text-ink transition-colors ml-1 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── useToast hook ──────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([])
  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id))
  const toast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => dismiss(id), 4000)
    return id
  }
  toast.success = (m) => toast(m, 'success')
  toast.error   = (m) => toast(m, 'error')
  toast.warning = (m) => toast(m, 'warning')
  return { toasts, toast, dismiss }
}

// ── Empty State ────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 bg-surface-base rounded-lg flex items-center justify-center mx-auto mb-4">
        {Icon && <Icon className="w-7 h-7 text-ink-outline" />}
      </div>
      <h3 className="font-display font-semibold text-ink mb-1">{title}</h3>
      <p className="text-ink-soft text-sm mb-5 max-w-xs mx-auto leading-relaxed">{description}</p>
      {action}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const palette = {
    brand:   { bg: 'bg-brand-50',   icon: 'text-brand-600',   bar: 'bg-brand-500' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    bar: 'bg-blue-500'  },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   bar: 'bg-amber-500'  },
    rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    bar: 'bg-rose-500'   },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  bar: 'bg-purple-500' },
  }
  const c = palette[color] || palette.brand
  return (
    <div className="card-compact flex items-center gap-4">
      {Icon && (
        <div className={`w-11 h-11 rounded flex items-center justify-center flex-shrink-0 ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider truncate">{label}</p>
        <p className="text-xl font-bold text-ink font-display leading-tight">{value}</p>
        {sub && <p className="text-xs text-ink-outline mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Loading Spinner ────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div
        className={`${sizes[size]} border-2 border-surface-high border-t-brand-500 rounded-full animate-spin`}
      />
      <p className="text-xs text-ink-outline font-medium">Loading...</p>
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    sent:       'badge-sent',
    partial:    'badge-partial',
    completed:  'badge-completed',
    'in-stock': 'badge-in-stock',
    pending:    'badge-pending',
    approved:   'badge-approved',
    rejected:   'badge-rejected',
    draft:      'badge-draft',
  }
  return (
    <span className={map[status] || 'badge-draft'}>
      {status?.replace(/-/g, ' ')}
    </span>
  )
}

// ── Search Input ───────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-outline pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 bg-surface-low"
      />
    </div>
  )
}

// ── Page Header ────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="text-ink-soft text-sm mt-1 font-medium">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}
