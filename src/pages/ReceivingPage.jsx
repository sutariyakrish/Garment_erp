import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Toast, useToast, EmptyState, Spinner, PageHeader, StatusBadge } from '../components/ui'
import { PackageCheck, Plus, Minus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'

export default function ReceivingPage() {
  const [pendingDispatches, setPendingDispatches] = useState([])
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDispatch, setActiveDispatch] = useState(null)
  const [receiveForm, setReceiveForm] = useState({ received_quantity: '', quality_notes: '', received_date: new Date().toISOString().split('T')[0], colors: [{ color_name: '', quantity: '' }], is_completed: false })
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: dispatches }, { data: recs }] = await Promise.all([
      supabase.from('mill_dispatches').select('*, gray_fabrics(fabric_name, lot_number), parties(name), fabric_receipts(received_quantity)').in('status', ['sent', 'partial']).order('dispatch_date', { ascending: false }),
      supabase.from('fabric_receipts').select('*, mill_dispatches(gray_fabrics(lot_number, fabric_name), parties(name)), receipt_colors(*)').order('received_date', { ascending: false }).limit(20),
    ])
    const computedDispatches = (dispatches || []).map(d => {
      const total_received = (d.fabric_receipts || []).reduce((sum, r) => sum + Number(r.received_quantity || 0), 0)
      return { ...d, total_received, remaining_quantity: Number(d.quantity_sent) - total_received }
    }).filter(d => d.remaining_quantity > 0)
    setPendingDispatches(computedDispatches)
    setReceipts(recs || [])
    setLoading(false)
  }

  const openReceive = (dispatch) => {
    setActiveDispatch(dispatch)
    setReceiveForm({ received_quantity: '', quality_notes: '', received_date: new Date().toISOString().split('T')[0], colors: [{ color_name: '', quantity: '' }], is_completed: false })
  }

  const addColor = () => setReceiveForm(f => ({ ...f, colors: [...f.colors, { color_name: '', quantity: '' }] }))
  const removeColor = (i) => setReceiveForm(f => ({ ...f, colors: f.colors.filter((_, idx) => idx !== i) }))
  const updateColor = (i, k, v) => setReceiveForm(f => ({ ...f, colors: f.colors.map((c, idx) => idx === i ? { ...c, [k]: v } : c) }))
  const colorTotal = receiveForm.colors.reduce((s, c) => s + Number(c.quantity || 0), 0)

  const handleReceive = async () => {
    const qty = Number(receiveForm.received_quantity)
    if (!qty || qty <= 0) { toast.error('Enter received quantity.'); return }
    if (qty > activeDispatch.remaining_quantity) { toast.error(`Cannot receive more than remaining (${activeDispatch.remaining_quantity}m).`); return }
    const filledColors = receiveForm.colors.filter(c => c.color_name && c.quantity)
    if (filledColors.length > 0 && colorTotal !== qty) { toast.error(`Color totals (${colorTotal}m) must equal received quantity (${qty}m).`); return }
    setSaving(true)
    const { data: receipt, error: rErr } = await supabase.from('fabric_receipts').insert({ dispatch_id: activeDispatch.id, received_quantity: qty, quality_notes: receiveForm.quality_notes, received_date: receiveForm.received_date }).select().single()
    if (rErr) { toast.error(rErr.message); setSaving(false); return }
    if (filledColors.length > 0) {
      await supabase.from('receipt_colors').insert(filledColors.map(c => ({ receipt_id: receipt.id, color_name: c.color_name, quantity: Number(c.quantity) })))
    }
    const newTotalReceived = qty + activeDispatch.total_received
    let newStatus = newTotalReceived >= Number(activeDispatch.quantity_sent) ? 'completed' : 'partial'
    if (receiveForm.is_completed) newStatus = 'completed'
    await supabase.from('mill_dispatches').update({ status: newStatus }).eq('id', activeDispatch.id)
    toast.success(`Received ${qty}m — Dispatch marked as ${newStatus}.`)
    setActiveDispatch(null)
    fetchAll()
    setSaving(false)
  }

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader title="Fabric Receiving" subtitle="Record fabric received back from mills" />
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pending Dispatches */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-high">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-semibold text-ink text-[15px]">Pending Dispatches</h3>
            {pendingDispatches.length > 0 && <span className="badge-pending ml-1">{pendingDispatches.length}</span>}
          </div>
          <div className="p-4">
            {loading ? <Spinner /> : pendingDispatches.length === 0 ? (
              <EmptyState icon={PackageCheck} title="All caught up!" description="No pending dispatches at the moment." />
            ) : (
              <div className="space-y-3">
                {pendingDispatches.map(d => (
                  <div key={d.id} className={`border rounded-lg p-4 transition-all cursor-pointer ${activeDispatch?.id === d.id ? 'border-brand-400 bg-brand-50 shadow-indigo-sm' : 'border-surface-high bg-white hover:border-brand-300 hover:shadow-indigo-sm'}`} onClick={() => openReceive(d)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-ink">{d.parties?.name}</p>
                        <p className="text-xs text-ink-soft mt-0.5">{d.gray_fabrics?.lot_number} — {d.gray_fabrics?.fabric_name}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-soft">
                      <span>Remaining: <strong className="text-brand-600">{d.remaining_quantity.toLocaleString()}m</strong> <span className="text-ink-outline">(of {Number(d.quantity_sent).toLocaleString()}m)</span></span>
                      <span>{d.dispatch_date ? format(new Date(d.dispatch_date), 'dd MMM') : '—'}</span>
                    </div>
                    {activeDispatch?.id !== d.id && (
                      <button className="btn-primary mt-3 w-full justify-center text-xs py-1.5" onClick={(e) => { e.stopPropagation(); openReceive(d) }}>
                        <PackageCheck className="w-3.5 h-3.5" /> Record Receipt
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Receive Form */}
        <div className="space-y-4">
          {activeDispatch ? (
            <div className="card border-brand-300">
              <div className="flex items-center gap-2 mb-4">
                <PackageCheck className="w-4 h-4 text-brand-500" />
                <h3 className="font-display font-semibold text-ink text-[15px]">Recording Receipt</h3>
              </div>
              <div className="bg-brand-50 border border-brand-100 rounded px-4 py-3 mb-4">
                <p className="font-semibold text-brand-800 text-sm">{activeDispatch.parties?.name}</p>
                <p className="text-brand-600/80 text-xs mt-0.5">{activeDispatch.gray_fabrics?.lot_number} · {activeDispatch.remaining_quantity.toLocaleString()}m remaining (of {Number(activeDispatch.quantity_sent).toLocaleString()}m sent)</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Received Quantity (m) *</label>
                    <input className="input" type="number" min="1" max={activeDispatch.remaining_quantity} value={receiveForm.received_quantity} onChange={e => setReceiveForm(f => ({ ...f, received_quantity: e.target.value }))} placeholder={`Max: ${activeDispatch.remaining_quantity}`} />
                  </div>
                  <div>
                    <label className="label">Received Date</label>
                    <input className="input" type="date" value={receiveForm.received_date} onChange={e => setReceiveForm(f => ({ ...f, received_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Quality Notes</label>
                  <textarea className="input resize-none" rows={2} value={receiveForm.quality_notes} onChange={e => setReceiveForm(f => ({ ...f, quality_notes: e.target.value }))} placeholder="Color quality, defects, observations..." />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label mb-0">Colors (Optional)</label>
                    <button onClick={addColor} className="btn-ghost py-1 px-2 text-xs text-brand-600"><Plus className="w-3 h-3" />Add Color</button>
                  </div>
                  <div className="space-y-2">
                    {receiveForm.colors.map((c, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input className="input flex-1" placeholder="Color name (e.g. Red)" value={c.color_name} onChange={e => updateColor(i, 'color_name', e.target.value)} />
                        <input className="input w-24" type="number" placeholder="Meters" value={c.quantity} onChange={e => updateColor(i, 'quantity', e.target.value)} />
                        {receiveForm.colors.length > 1 && <button onClick={() => removeColor(i)} className="text-red-500 hover:text-red-600 p-1 flex-shrink-0"><Minus className="w-4 h-4" /></button>}
                      </div>
                    ))}
                  </div>
                  {receiveForm.colors.some(c => c.quantity) && (
                    <div className={`text-xs mt-2 flex items-center gap-1.5 ${colorTotal === Number(receiveForm.received_quantity) && receiveForm.received_quantity ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {colorTotal === Number(receiveForm.received_quantity) && receiveForm.received_quantity ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      Color total: {colorTotal}m {receiveForm.received_quantity ? `/ ${receiveForm.received_quantity}m` : ''}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer select-none">
                  <input type="checkbox" className="w-4 h-4 rounded border-surface-high text-brand-500 focus:ring-brand-400" checked={receiveForm.is_completed} onChange={e => setReceiveForm(f => ({ ...f, is_completed: e.target.checked }))} />
                  Will not receive further from this lot (mark as completed)
                </label>
                <div className="flex gap-3 pt-1 border-t border-surface-high">
                  <button onClick={() => setActiveDispatch(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                  <button onClick={handleReceive} disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</> : 'Confirm Receipt'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card h-48 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-surface-base rounded-lg flex items-center justify-center mb-3">
                <PackageCheck className="w-6 h-6 text-ink-outline" />
              </div>
              <p className="font-semibold text-ink mb-1">Select a dispatch</p>
              <p className="text-ink-soft text-sm">Click a pending dispatch to record fabric receipt</p>
            </div>
          )}
          {receipts.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-surface-high">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="font-display font-semibold text-ink text-[15px]">Recent Receipts</h3>
              </div>
              <div className="divide-y divide-surface-low">
                {receipts.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-ink font-medium">{r.mill_dispatches?.gray_fabrics?.lot_number} → {r.mill_dispatches?.parties?.name}</p>
                      <p className="text-xs text-ink-soft">{r.received_date ? format(new Date(r.received_date), 'dd MMM yyyy') : ''}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{Number(r.received_quantity).toLocaleString()}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
