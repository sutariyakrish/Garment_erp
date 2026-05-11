import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatCard, Spinner, PageHeader } from '../components/ui'
import { Layers, Send, PackageCheck, Clock, TrendingUp, AlertCircle, ArrowUpRight, Activity } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts'

// Design-system color tokens for charts
const CHART_COLORS = ['#3949ab', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

const STATUS_LABELS = { sent: 'Sent', partial: 'Partial', completed: 'Completed' }
const STATUS_COLORS = { sent: '#3949ab', partial: '#f59e0b', completed: '#10b981' }

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [recentDispatches, setRecentDispatches] = useState([])
  const [pieData, setPieData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const [{ data: fabrics }, { data: dispatches }, { data: receipts }] = await Promise.all([
        supabase.from('gray_fabrics').select('total_meters, available_meters'),
        supabase.from('mill_dispatches').select('*, gray_fabrics(fabric_name, lot_number), parties(name)').order('dispatch_date', { ascending: false }),
        supabase.from('fabric_receipts').select('received_quantity'),
      ])

      const totalFabric    = fabrics?.reduce((s, f) => s + Number(f.total_meters), 0) || 0
      const availFabric    = fabrics?.reduce((s, f) => s + Number(f.available_meters), 0) || 0
      const totalDispatched = dispatches?.reduce((s, d) => s + Number(d.quantity_sent), 0) || 0
      const totalReceived  = receipts?.reduce((s, r) => s + Number(r.received_quantity), 0) || 0
      const pendingAt      = dispatches?.filter(d => d.status !== 'completed').reduce((s, d) => s + Number(d.quantity_sent), 0) || 0

      setStats({ totalFabric, availFabric, totalDispatched, totalReceived, pendingAt })
      setRecentDispatches(dispatches?.slice(0, 8) || [])

      // Pie: dispatch status
      const statusCounts = { sent: 0, partial: 0, completed: 0 }
      dispatches?.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1 })
      setPieData(
        Object.entries(statusCounts)
          .map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value, key: name }))
          .filter(d => d.value > 0)
      )
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner />

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const statusBadgeClass = {
    sent: 'badge-sent',
    partial: 'badge-partial',
    completed: 'badge-completed',
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${greeting}! Here's your business overview.`}
        action={
          <button
            onClick={fetchDashboard}
            className="btn-secondary text-xs gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Gray Fabric"
          value={`${stats?.totalFabric?.toLocaleString()} m`}
          icon={Layers}
          color="brand"
        />
        <StatCard
          label="Available Fabric"
          value={`${stats?.availFabric?.toLocaleString()} m`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          label="Total Dispatched"
          value={`${stats?.totalDispatched?.toLocaleString()} m`}
          icon={Send}
          color="blue"
        />
        <StatCard
          label="Pending at Mills"
          value={`${stats?.pendingAt?.toLocaleString()} m`}
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Charts + Table row */}
      <div className="grid lg:grid-cols-5 gap-4 mb-6">

        {/* Recent Dispatches Table */}
        <div className="card lg:col-span-3 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-high">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-brand-500" />
              <h3 className="font-display font-semibold text-ink text-[15px]">Recent Dispatches</h3>
            </div>
            <span className="text-xs text-ink-outline font-medium">{recentDispatches.length} entries</span>
          </div>

          {recentDispatches.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-ink-soft text-sm">
              No dispatches yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="table-head">Lot</th>
                    <th className="table-head">Mill</th>
                    <th className="table-head text-right">Qty (m)</th>
                    <th className="table-head">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDispatches.map(d => (
                    <tr key={d.id} className="table-row">
                      <td className="table-cell font-mono text-brand-700 font-semibold text-xs">
                        {d.gray_fabrics?.lot_number}
                      </td>
                      <td className="table-cell text-ink-soft">{d.parties?.name}</td>
                      <td className="table-cell text-right font-medium">
                        {Number(d.quantity_sent).toLocaleString()}
                      </td>
                      <td className="table-cell">
                        <span className={statusBadgeClass[d.status] || 'badge-draft'}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dispatch Status Pie */}
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="w-4 h-4 text-brand-500" />
            <h3 className="font-display font-semibold text-ink text-[15px]">Dispatch Status</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  dataKey="value"
                  paddingAngle={3}
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={STATUS_COLORS[entry.key] || CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e6e8ea',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#191c1e',
                    boxShadow: '0 4px 24px rgba(26,35,126,0.08)',
                  }}
                />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: '#454652' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-ink-soft text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* System Flow Guide */}
      <div className="card bg-brand-50 border-brand-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="font-semibold text-brand-700 text-sm mb-1">System Flow</p>
            <p className="text-brand-600/80 text-xs leading-relaxed">
              Start by adding{' '}
              <strong className="text-brand-700">Gray Fabric</strong>
              {' '}→ Add{' '}
              <strong className="text-brand-700">Mill Parties</strong>
              {' '}→ Create a{' '}
              <strong className="text-brand-700">Dispatch</strong>
              {' '}→ When fabric returns, mark as{' '}
              <strong className="text-brand-700">Received</strong>
              {' '}→ Track everything in{' '}
              <strong className="text-brand-700">Reports</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
