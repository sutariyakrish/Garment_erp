import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Layers, Users, Send, PackageCheck,
  BarChart3, LogOut, Scissors, Menu, X, Palette,
  ChevronRight, Settings
} from 'lucide-react'
import { useState } from 'react'

const NAV_SECTIONS = [
  {
    label: 'Core Modules',
    items: [
      { to: '/',          label: 'Dashboard',      icon: LayoutDashboard, exact: true },
      { to: '/fabric',    label: 'Gray Fabric',    icon: Layers },
      { to: '/parties',   label: 'Parties',        icon: Users },
      { to: '/dispatch',  label: 'Mill Dispatch',  icon: Send },
      { to: '/receiving', label: 'Receiving',      icon: PackageCheck },
      { to: '/reports',   label: 'Reports',        icon: BarChart3 },
    ],
  },
  {
    label: 'Design & QC',
    items: [
      { to: '/sampling', label: 'Sampling & Design', icon: Palette },
    ],
  },
]

function NavItem({ to, label, icon: Icon, exact, onClick }) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      className={({ isActive }) =>
        isActive
          ? 'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-white bg-white/20 transition-all duration-150'
          : 'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-white/65 hover:text-white hover:bg-white/10 transition-all duration-150'
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} />
          <span className="flex-1 truncate">{label}</span>
          {isActive && <ChevronRight className="w-3 h-3 text-white/50 flex-shrink-0" />}
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const close = () => setSidebarOpen(false)

  // User initials
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U'

  const SidebarContent = () => (
    <div className="flex flex-col h-full sidebar-texture">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3 border-b border-white/10">
        <div className="w-9 h-9 bg-white/20 rounded flex items-center justify-center flex-shrink-0">
          <Scissors className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold text-white leading-tight">Garment ERP</p>
          <p className="text-[11px] text-white/45 font-medium tracking-wide">Fabric to Finish</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-[0.1em] px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.to} {...item} onClick={close} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user?.email}</p>
            <p className="text-[10px] text-white/45 mt-0.5">Staff</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded w-full text-sm font-medium text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #1a237e 0%, #000666 100%)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <aside
            className="absolute left-0 top-0 h-full w-60 flex flex-col shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #1a237e 0%, #000666 100%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-white" />
                <span className="font-display font-bold text-white text-[15px]">Garment ERP</span>
              </div>
              <button onClick={close} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-high shadow-indigo-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-ink-soft hover:text-ink transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#1a237e' }}>
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-ink text-[15px]">Garment ERP</span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-2xl mx-auto p-5 lg:p-7 fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
