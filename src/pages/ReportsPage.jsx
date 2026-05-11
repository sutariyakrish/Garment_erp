import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner, PageHeader, StatusBadge } from '../components/ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart3, Package, Send, PackageCheck, TrendingDown, Palette, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

export default function ReportsPage() {
  const [fabrics, setFabrics] = useState([])
  const [selectedFabric, setSelectedFabric] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fabricsLoading, setFabricsLoading] = useState(true)
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    supabase.from('gray_fabrics').select('id, lot_number, fabric_name, total_meters, available_meters').order('lot_number')
      .then(({ data }) => { setFabrics(data || []); setFabricsLoading(false) })
  }, [])

  useEffect(() => {
    if (selectedFabric) fetchReport(selectedFabric)
    else setReport(null)
  }, [selectedFabric])

  const fetchReport = async (fabricId) => {
    setLoading(true)
    const fabric = fabrics.find(f => f.id === fabricId)
    const { data: dispatches } = await supabase.from('mill_dispatches')
      .select('*, parties(name), fabric_receipts(id, received_quantity, received_date, quality_notes, receipt_colors(*))')
      .eq('fabric_id', fabricId).order('dispatch_date', { ascending: false })
    const totalSent = dispatches?.reduce((s, d) => s + Number(d.quantity_sent), 0) || 0
    const totalReceived = dispatches?.reduce((s, d) => s + (d.fabric_receipts?.reduce((rs, r) => rs + Number(r.received_quantity), 0) || 0), 0) || 0
    const colorMap = {}
    dispatches?.forEach(d => { d.fabric_receipts?.forEach(r => { r.receipt_colors?.forEach(c => { colorMap[c.color_name] = (colorMap[c.color_name] || 0) + Number(c.quantity) }) }) })
    const cData = dispatches?.map(d => ({ mill: d.parties?.name?.split(' ')[0] || 'Mill', Sent: Number(d.quantity_sent), Received: d.fabric_receipts?.reduce((s, r) => s + Number(r.received_quantity), 0) || 0 })) || []
    setReport({ fabric, dispatches, totalSent, totalReceived, colorMap, loss: totalSent - totalReceived })
    setChartData(cData)
    setLoading(false)
  }

  const summaryCards = report ? [
    { label: 'Total Sent', value: report.totalSent, icon: Send, color: 'text-brand-600', bg: 'bg-brand-50 border-brand-100' },
    { label: 'Total Received', value: report.totalReceived, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    { label: 'Still at Mills', value: Math.max(0, report.totalSent - report.totalReceived), icon: Package, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { label: 'Loss / Wastage', value: report.loss < 0 ? 0 : report.loss, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 border-red-100', sub: report.totalSent > 0 ? `${((Math.max(0, report.loss) / report.totalSent) * 100).toFixed(1)}%` : '0%' },
  ] : []

  return (
    <div>
      <PageHeader title="Fabric Tracking Report" subtitle="Full lifecycle view of any fabric lot" />

      {/* Fabric Selector */}
      <div className="card mb-5">
        <label className="label">Select Fabric Lot</label>
        <div className="relative max-w-md">
          {fabricsLoading ? (
            <div className="input text-ink-soft">Loading lots...</div>
          ) : (
            <select className="input appearance-none pr-8" value={selectedFabric} onChange={e => setSelectedFabric(e.target.value)}>
              <option value="">— Choose a fabric lot —</option>
              {fabrics.map(f => (
                <option key={f.id} value={f.id}>{f.lot_number} · {f.fabric_name} ({Number(f.total_meters).toLocaleString()}m total)</option>
              ))}
            </select>
          )}
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-outline pointer-events-none" />
        </div>
      </div>

      {loading && <Spinner />}

      {report && !loading && (
        <div className="space-y-5 fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(card => (
              <div key={card.label} className={`card border ${card.bg}`}>
                <card.icon className={`w-5 h-5 mb-2 ${card.color}`} />
                <p className="text-xs text-ink-soft uppercase tracking-wider font-semibold mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-ink font-display">
                  {card.value.toLocaleString()}<span className="text-sm text-ink-soft font-normal ml-1">m</span>
                </p>
                {card.sub && <p className="text-xs text-ink-outline mt-0.5">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-brand-500" />
                <h3 className="font-display font-semibold text-ink text-[15px]">Sent vs Received by Mill</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="mill" tick={{ fill: '#454652', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#454652', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e6e8ea', borderRadius: 6, fontSize: 12, color: '#191c1e', boxShadow: '0 4px 24px rgba(26,35,126,0.08)' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12, color: '#454652' }} />
                  <Bar dataKey="Sent" fill="#3949ab" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Dispatch History */}
            <div className="card lg:col-span-2 p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-high">
                <h3 className="font-display font-semibold text-ink text-[15px]">Dispatch & Receipt History</h3>
              </div>
              <div className="p-5">
                {report.dispatches?.length === 0 ? (
                  <p className="text-ink-soft text-sm text-center py-6">No dispatches for this lot.</p>
                ) : (
                  <div className="space-y-4">
                    {report.dispatches.map(d => {
                      const received = d.fabric_receipts?.reduce((s, r) => s + Number(r.received_quantity), 0) || 0
                      return (
                        <div key={d.id} className="border border-surface-high rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-ink">{d.parties?.name}</p>
                              <p className="text-xs text-ink-soft">Dispatched: {d.dispatch_date ? format(new Date(d.dispatch_date), 'dd MMM yyyy') : '—'}</p>
                            </div>
                            <StatusBadge status={d.status} />
                          </div>
                          <div className="flex items-center gap-4 text-sm mb-3">
                            <span className="text-ink-soft">Sent: <strong className="text-brand-700">{Number(d.quantity_sent).toLocaleString()}m</strong></span>
                            <span className="text-ink-soft">Received: <strong className="text-emerald-600">{received.toLocaleString()}m</strong></span>
                            <span className="text-ink-soft">Pending: <strong className="text-amber-600">{Math.max(0, Number(d.quantity_sent) - received).toLocaleString()}m</strong></span>
                          </div>
                          {d.fabric_receipts?.length > 0 && (
                            <div className="border-t border-surface-high pt-3 space-y-2">
                              <p className="text-xs text-ink-outline uppercase tracking-wider font-semibold">Receipts</p>
                              {d.fabric_receipts.map(r => (
                                <div key={r.id} className="bg-surface-low rounded p-3">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-ink">{r.received_date ? format(new Date(r.received_date), 'dd MMM yyyy') : '—'}</span>
                                    <span className="text-emerald-600 font-semibold">{Number(r.received_quantity).toLocaleString()}m</span>
                                  </div>
                                  {r.quality_notes && <p className="text-xs text-ink-soft mb-2">{r.quality_notes}</p>}
                                  {r.receipt_colors?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {r.receipt_colors.map(c => (
                                        <span key={c.id} className="bg-white border border-surface-high px-2 py-0.5 rounded text-xs text-ink-soft">
                                          {c.color_name}: {Number(c.quantity).toLocaleString()}m
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Color Summary */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-brand-500" />
                <h3 className="font-display font-semibold text-ink text-[15px]">Color Summary</h3>
              </div>
              {Object.keys(report.colorMap).length === 0 ? (
                <p className="text-ink-soft text-sm text-center py-8">No color data recorded.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(report.colorMap).map(([color, qty]) => {
                    const pct = report.totalReceived > 0 ? (qty / report.totalReceived) * 100 : 0
                    return (
                      <div key={color}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-ink font-medium">{color}</span>
                          <span className="text-ink-soft tabular-nums">{qty.toLocaleString()}m</span>
                        </div>
                        <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-ink-outline mt-0.5">{pct.toFixed(1)}%</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedFabric && !loading && (
        <div className="card text-center py-16">
          <div className="w-14 h-14 bg-surface-base rounded-lg flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-7 h-7 text-ink-outline" />
          </div>
          <p className="font-display font-semibold text-ink mb-1">Select a fabric lot above</p>
          <p className="text-ink-soft text-sm max-w-xs mx-auto">Get a full lifecycle view including dispatches, receipts, colors, and losses.</p>
        </div>
      )}
    </div>
  )
}
