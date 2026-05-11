import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import GrayFabricPage from './pages/GrayFabricPage'
import PartiesPage from './pages/PartiesPage'
import DispatchPage from './pages/DispatchPage'
import ReceivingPage from './pages/ReceivingPage'
import ReportsPage from './pages/ReportsPage'
import SamplingPage from './pages/SamplingPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-surface-high border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-ink-soft text-sm font-medium">Loading...</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="fabric" element={<GrayFabricPage />} />
        <Route path="parties" element={<PartiesPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="receiving" element={<ReceivingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="sampling" element={<SamplingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
