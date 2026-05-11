import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput, StatCard } from '../components/ui'
import { Plus, Package, Edit2, Trash2, Filter } from 'lucide-react'

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free']
const EMPTY_FORM = { design_id: '', lot_id: '', sku: '', color: '', size: 'M', quantity: '', mrp: '', cost_price: '', location: '' }

export default function FinishedGoodsPage() {
  const [goods, setGoods] = useState([])
  const [designs, setDesigns] = useState([])
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: g }, { data: d }, { data: l }] = await Promise.all([
      supabase.from('finished_goods').select('*, designs(design_code, design_name), production_lots(lot_number)').order('created_at', { ascending: false }),
      supabase.from('designs').select('id, design_code, design_name').eq('status', 'production').order('design_code'),
      supabase.from('production_lots').select('id, lot_number').order('lot_number'),
    ])
    setGoods(g || [])
    setDesigns(d || [])
    setLots(l || [])
    setLoading(false)
  }

  const f = k => e => setForm(x => ({ ...x, [k]: e.target.value }))

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setShowModal(true) }
  const openEdit = item => { setForm({ design_id: item.design_id || '', lot_id: item.lot_id || '', sku: item.sku || '', color: item.color, size: item.size, quantity: item.quantity, mrp: item.mrp || '', cost_price: item.cost_price || '', location: item.location || '' }); setEditItem(item); setShowModal(true) }

  const handleSave = async () => {
    if (!form.color || !form.size || form.quantity === '') { toast.error('Color, size and quantity are required.'); return }
    if (parseInt(form.quantity) < 0) { toast.error('Quantity cannot be negative.'); return }
    setSaving(true)
    const payload = { ...form, design_id: form.design_id || null, lot_id: form.lot_id || null, quantity: parseInt(form.quantity), mrp: form.mrp || null, cost_price: form.cost_price || null }
    const { error } = editItem
      ? await supabase.from('finished_goods').update(payload).eq('id', editItem.id)
      : await supabase.from('finished_goods').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItem ? 'Item updated!' : 'Item added!'); setShowModal(false); fetchAll() }
    setSaving(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('finished_goods').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Item deleted.'); fetchAll() }
    setDeleteId(null)
  }

  const colors = [...new Set(goods.map(g => g.color).filter(Boolean))].sort()
  const totalQty = goods.reduce((s, g) => s + Number(g.quantity), 0)
  const totalValue = goods.reduce((s, g) => s + (Number(g.quantity) * Number(g.cost_price || 0)), 0)

  const filtered = goods
    .filter(g => sizeFilter === 'all' || g.size === sizeFilter)
    .filter(g => !colorFilter || g.color.toLowerCase().includes(colorFilter.toLowerCase()))
    .filter(g => !search || g.designs?.design_code?.toLowerCase().includes(search.toLowerCase()) || g.designs?.design_name?.toLowerCase().includes(search.toLowerCase()) || g.sku?.toLowerCase().includes(search.toLowerCase()) || g.color.toLowerCase().includes(search.toLowerCase()))

  // Group by design for display
  const grouped = {}
  filtered.forEach(g => {
    const key = g.designs?.design_code || 'Unassigned'
    if (!grouped[key]) grouped[key] = { label: g.designs ? `${g.designs.design_code} — ${g.designs.design_name}` : 'Unassigned', items: [] }
    grouped[key].items.push(g)
  })

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Finished Goods"
        subtitle="Inventory of ready kurtis by size and colour"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />Add Stock</button>}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total SKUs" value={goods.length} icon={Package} color="brand" />
        <StatCard label="Total Pieces" value={totalQty.toLocaleString()} icon={Package} color="blue" />
        <StatCard label="Stock Value" value={`₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={Package} color="emerald" />
        <StatCard label="Colours" value={colors.length} icon={Filter} color="purple" />
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search design, SKU, colour..." />
          <input className="input" placeholder="Filter by colour..." value={colorFilter} onChange={e => setColorFilter(e.target.value)} />
          <select className="input" value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}>
            <option value="all">All Sizes</option>
            {SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No finished goods" description="Add stock entries for ready kurtis by size and colour." action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />Add Stock</button>} />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key} className="card">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-400" />
                {group.label}
                <span className="text-slate-500 font-normal">({group.items.reduce((s, g) => s + Number(g.quantity), 0)} pcs)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr>
                    <th className="table-head">Colour</th><th className="table-head">Size</th>
                    <th className="table-head">Qty</th><th className="table-head">Cost</th>
                    <th className="table-head">MRP</th><th className="table-head">Location</th>
                    <th className="table-head">SKU</th><th className="table-head">Lot</th>
                    <th className="table-head">Actions</th>
                  </tr></thead>
                  <tbody>
                    {group.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-700/20 transition-colors group">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-brand-500/40 border border-brand-500/60" style={{ background: `hsl(${item.color.length * 37 % 360},60%,45%)` }} />
                            {item.color}
                          </div>
                        </td>
                        <td className="table-cell"><span className="font-mono font-semibold text-brand-300">{item.size}</span></td>
                        <td className="table-cell">
                          <span className={`font-bold text-base ${item.quantity === 0 ? 'text-red-400' : item.quantity <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{item.quantity}</span>
                        </td>
                        <td className="table-cell">{item.cost_price ? `₹${Number(item.cost_price).toFixed(2)}` : '—'}</td>
                        <td className="table-cell">{item.mrp ? `₹${Number(item.mrp).toFixed(2)}` : '—'}</td>
                        <td className="table-cell text-slate-400">{item.location || '—'}</td>
                        <td className="table-cell text-slate-400 font-mono text-xs">{item.sku || '—'}</td>
                        <td className="table-cell text-slate-400">{item.production_lots?.lot_number || '—'}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(item)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(item.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Stock' : 'Add Finished Goods'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Design</label><select className="input" value={form.design_id} onChange={f('design_id')}><option value="">Select design...</option>{designs.map(d => <option key={d.id} value={d.id}>{d.design_code} — {d.design_name}</option>)}</select></div>
              <div><label className="label">Production Lot</label><select className="input" value={form.lot_id} onChange={f('lot_id')}><option value="">Select lot...</option>{lots.map(l => <option key={l.id} value={l.id}>{l.lot_number}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Colour *</label><input className="input" placeholder="e.g. Royal Blue" value={form.color} onChange={f('color')} /></div>
              <div><label className="label">Size *</label><select className="input" value={form.size} onChange={f('size')}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Quantity *</label><input className="input" type="number" min="0" placeholder="0" value={form.quantity} onChange={f('quantity')} /></div>
              <div><label className="label">Cost Price (₹)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost_price} onChange={f('cost_price')} /></div>
              <div><label className="label">MRP (₹)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.mrp} onChange={f('mrp')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">SKU</label><input className="input" placeholder="e.g. KRT-BLU-M" value={form.sku} onChange={f('sku')} /></div>
              <div><label className="label">Location</label><input className="input" placeholder="e.g. Shelf A2" value={form.location} onChange={f('location')} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editItem ? 'Update' : 'Add Stock'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && <ConfirmDialog title="Delete Stock Entry?" message="This stock record will be permanently removed." danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}
