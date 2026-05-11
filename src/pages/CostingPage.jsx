import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Toast, useToast, EmptyState, Spinner, PageHeader, StatCard } from '../components/ui'
import { Plus, DollarSign, TrendingUp, TrendingDown, Edit2, Calculator } from 'lucide-react'

const EMPTY_COSTING = { lot_id: '', fabric_cost_per_m: '', fabric_meters_used: '', embroidery_cost: '0', stitching_cost: '0', finishing_cost: '0', other_cost: '0', overhead_pct: '10', selling_price_avg: '', notes: '' }

export default function CostingPage() {
  const [costings, setCostings] = useState([])
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_COSTING)
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from('lot_costing').select('*, production_lots(lot_number, total_pieces, designs(design_code, design_name))').order('created_at', { ascending: false }),
      supabase.from('production_lots').select('id, lot_number, total_pieces, designs(design_code, design_name)').order('lot_number'),
    ])
    setCostings(c || [])
    setLots(l || [])
    setLoading(false)
  }

  const f = k => e => setForm(x => ({ ...x, [k]: e.target.value }))

  const openAdd = () => { setForm(EMPTY_COSTING); setEditItem(null); setShowModal(true) }
  const openEdit = item => {
    setForm({ lot_id: item.lot_id, fabric_cost_per_m: item.fabric_cost_per_m || '', fabric_meters_used: item.fabric_meters_used || '', embroidery_cost: item.embroidery_cost || '0', stitching_cost: item.stitching_cost || '0', finishing_cost: item.finishing_cost || '0', other_cost: item.other_cost || '0', overhead_pct: item.overhead_pct || '10', selling_price_avg: item.selling_price_avg || '', notes: item.notes || '' })
    setEditItem(item); setShowModal(true)
  }

  // Real-time costing calculations
  const calcCosts = (f) => {
    const fabricCost = Number(f.fabric_cost_per_m || 0) * Number(f.fabric_meters_used || 0)
    const embCost = Number(f.embroidery_cost || 0)
    const stitchCost = Number(f.stitching_cost || 0)
    const finishCost = Number(f.finishing_cost || 0)
    const otherCost = Number(f.other_cost || 0)
    const directCost = fabricCost + embCost + stitchCost + finishCost + otherCost
    const overhead = directCost * (Number(f.overhead_pct || 0) / 100)
    const totalCost = directCost + overhead
    return { fabricCost, directCost, overhead, totalCost }
  }

  const getCostPerPiece = (costing) => {
    const pieces = costing.production_lots?.total_pieces || 1
    const { totalCost } = calcCosts(costing)
    return pieces > 0 ? totalCost / pieces : 0
  }

  const handleSave = async () => {
    if (!form.lot_id) { toast.error('Production lot is required.'); return }
    setSaving(true)
    const payload = { lot_id: form.lot_id, fabric_cost_per_m: form.fabric_cost_per_m || null, fabric_meters_used: form.fabric_meters_used || null, embroidery_cost: Number(form.embroidery_cost) || 0, stitching_cost: Number(form.stitching_cost) || 0, finishing_cost: Number(form.finishing_cost) || 0, other_cost: Number(form.other_cost) || 0, overhead_pct: Number(form.overhead_pct) || 10, selling_price_avg: form.selling_price_avg || null, notes: form.notes || null }
    const { error } = editItem
      ? await supabase.from('lot_costing').update(payload).eq('id', editItem.id)
      : await supabase.from('lot_costing').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItem ? 'Costing updated!' : 'Costing saved!'); setShowModal(false); fetchAll() }
    setSaving(false)
  }

  // Summary stats
  const totalRevenue = costings.reduce((s, c) => s + (Number(c.selling_price_avg || 0) * (c.production_lots?.total_pieces || 0)), 0)
  const totalCostSum = costings.reduce((s, c) => s + calcCosts(c).totalCost, 0)
  const totalPnL = totalRevenue - totalCostSum

  const liveCalc = calcCosts(form)
  const selectedLot = lots.find(l => l.id === form.lot_id)
  const livePerPiece = selectedLot?.total_pieces ? liveCalc.totalCost / selectedLot.total_pieces : 0
  const livePnL = selectedLot?.total_pieces && form.selling_price_avg ? (Number(form.selling_price_avg) - livePerPiece) * selectedLot.total_pieces : null

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Costing & Profit"
        subtitle="Cost per meter, per garment, and P&L per production lot"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />Add Costing</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Lots Costed" value={costings.length} icon={Calculator} color="brand" />
        <StatCard label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={TrendingUp} color="emerald" />
        <StatCard label="Total Cost" value={`₹${totalCostSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={DollarSign} color="amber" />
        <StatCard label="Net P&L" value={`₹${totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={totalPnL >= 0 ? TrendingUp : TrendingDown} color={totalPnL >= 0 ? 'emerald' : 'rose'} />
      </div>

      {loading ? <Spinner /> : costings.length === 0 ? (
        <EmptyState icon={Calculator} title="No costing entries" description="Add costing data for production lots to track profitability." action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />Add Costing</button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>
              <th className="table-head">Lot</th><th className="table-head">Design</th>
              <th className="table-head">Pieces</th><th className="table-head">Fabric Cost</th>
              <th className="table-head">Work Costs</th><th className="table-head">Overhead</th>
              <th className="table-head">Total Cost</th><th className="table-head">Per Piece</th>
              <th className="table-head">Avg Selling</th><th className="table-head">P&L/Piece</th>
              <th className="table-head">Total P&L</th><th className="table-head">Actions</th>
            </tr></thead>
            <tbody>
              {costings.map(c => {
                const { fabricCost, directCost, overhead, totalCost } = calcCosts(c)
                const pieces = c.production_lots?.total_pieces || 1
                const perPiece = pieces > 0 ? totalCost / pieces : 0
                const sellingAvg = Number(c.selling_price_avg || 0)
                const pnlPiece = sellingAvg - perPiece
                const totalPnL = pnlPiece * pieces
                return (
                  <tr key={c.id} className="hover:bg-slate-700/20 transition-colors group">
                    <td className="table-cell font-mono text-brand-400 font-semibold">{c.production_lots?.lot_number || '—'}</td>
                    <td className="table-cell text-slate-300">{c.production_lots?.designs?.design_code || '—'}</td>
                    <td className="table-cell font-semibold">{pieces.toLocaleString()}</td>
                    <td className="table-cell">₹{fabricCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="table-cell">₹{(directCost - fabricCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="table-cell text-slate-400">₹{overhead.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="table-cell font-semibold">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="table-cell font-semibold text-amber-400">₹{perPiece.toFixed(2)}</td>
                    <td className="table-cell">{sellingAvg ? `₹${sellingAvg.toFixed(2)}` : '—'}</td>
                    <td className="table-cell">
                      {sellingAvg ? <span className={pnlPiece >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>₹{pnlPiece.toFixed(2)}</span> : '—'}
                    </td>
                    <td className="table-cell">
                      {sellingAvg ? <span className={`font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span> : '—'}
                    </td>
                    <td className="table-cell">
                      <button onClick={() => openEdit(c)} className="btn-ghost p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Costing' : 'Add Lot Costing'} onClose={() => setShowModal(false)} size="xl">
          <div className="space-y-4">
            <div>
              <label className="label">Production Lot *</label>
              <select className="input" value={form.lot_id} onChange={f('lot_id')}>
                <option value="">Select production lot...</option>
                {lots.map(l => <option key={l.id} value={l.id}>{l.lot_number} ({l.total_pieces} pcs) {l.designs ? `— ${l.designs.design_code}` : ''}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Fabric Cost / Meter (₹)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.fabric_cost_per_m} onChange={f('fabric_cost_per_m')} /></div>
              <div><label className="label">Fabric Meters Used</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.fabric_meters_used} onChange={f('fabric_meters_used')} /></div>
            </div>

            {/* Live fabric cost */}
            {form.fabric_cost_per_m && form.fabric_meters_used && (
              <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                Fabric Cost = ₹{form.fabric_cost_per_m} × {form.fabric_meters_used}m = <span className="font-bold">₹{(Number(form.fabric_cost_per_m) * Number(form.fabric_meters_used)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            )}

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Work / Process Costs (₹)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Embroidery / Khatli</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.embroidery_cost} onChange={f('embroidery_cost')} /></div>
              <div><label className="label">Stitching</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.stitching_cost} onChange={f('stitching_cost')} /></div>
              <div><label className="label">Finishing / Packing</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.finishing_cost} onChange={f('finishing_cost')} /></div>
              <div><label className="label">Other Costs</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.other_cost} onChange={f('other_cost')} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Overhead %</label><input className="input" type="number" min="0" max="100" step="0.5" placeholder="10" value={form.overhead_pct} onChange={f('overhead_pct')} /></div>
              <div><label className="label">Avg Selling Price / Piece (₹)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.selling_price_avg} onChange={f('selling_price_avg')} /></div>
            </div>

            {/* Live P&L summary */}
            {liveCalc.totalCost > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Total Cost</p>
                  <p className="font-bold text-slate-100">₹{liveCalc.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Cost / Piece</p>
                  <p className="font-bold text-amber-400">₹{livePerPiece.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">P&L / Piece</p>
                  <p className={`font-bold ${livePnL !== null ? (livePnL >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>{livePnL !== null ? `₹${(livePnL - livePerPiece + Number(form.selling_price_avg || 0)).toFixed(2) !== '0.00' ? (Number(form.selling_price_avg) - livePerPiece).toFixed(2) : '—'}` : '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Total P&L</p>
                  <p className={`font-bold ${livePnL !== null ? (livePnL >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>{livePnL !== null ? `₹${livePnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</p>
                </div>
              </div>
            )}

            <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={f('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editItem ? 'Update' : 'Save Costing'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
