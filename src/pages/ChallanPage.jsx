import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput } from '../components/ui'
import { Plus, FileText, Edit2, Trash2, Printer, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'

const CHALLAN_TYPES = ['dispatch', 'receipt', 'return']
const EMPTY_CHALLAN = { challan_number: '', challan_type: 'dispatch', dispatch_id: '', order_id: '', party_id: '', buyer_id: '', challan_date: new Date().toISOString().split('T')[0], vehicle_number: '', driver_name: '', notes: '' }
const EMPTY_ITEM = { description: '', quantity: '', unit: 'meters', rate: '', amount: '' }

const TYPE_COLORS = {
  dispatch: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  receipt: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  return: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}

export default function ChallanPage() {
  const [challans, setChallans] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [orders, setOrders] = useState([])
  const [parties, setParties] = useState([])
  const [buyers, setBuyers] = useState([])
  const [challanItems, setChallanItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_CHALLAN)
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemChallanId, setItemChallanId] = useState(null)
  const [editItemRow, setEditItemRow] = useState(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [deleteId, setDeleteId] = useState(null)
  const [deleteItemId, setDeleteItemId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [printId, setPrintId] = useState(null)
  const printRef = useRef()
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: ch }, { data: di }, { data: or }, { data: pa }, { data: bu }, { data: ci }] = await Promise.all([
      supabase.from('challans').select('*, parties(name), buyers(name), mill_dispatches(quantity_sent, gray_fabrics(lot_number)), orders(order_number)').order('challan_date', { ascending: false }),
      supabase.from('mill_dispatches').select('id, quantity_sent, gray_fabrics(lot_number, fabric_name), parties(name)').order('dispatch_date', { ascending: false }),
      supabase.from('orders').select('id, order_number, buyers(name)').order('order_date', { ascending: false }),
      supabase.from('parties').select('id, name, type').order('name'),
      supabase.from('buyers').select('id, name, phone, address, gst_number').order('name'),
      supabase.from('challan_items').select('*').order('created_at'),
    ])
    setChallans(ch || [])
    setDispatches(di || [])
    setOrders(or || [])
    setParties(pa || [])
    setBuyers(bu || [])
    const grouped = {}
    ;(ci || []).forEach(i => {
      if (!grouped[i.challan_id]) grouped[i.challan_id] = []
      grouped[i.challan_id].push(i)
    })
    setChallanItems(grouped)
    setLoading(false)
  }

  const genNum = () => `CH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
  const fc = k => e => setForm(x => ({ ...x, [k]: e.target.value }))
  const fi = k => e => setItemForm(x => ({ ...x, [k]: e.target.value }))

  const openAdd = () => { setForm({ ...EMPTY_CHALLAN, challan_number: genNum() }); setEditItem(null); setShowModal(true) }
  const openEdit = c => { setForm({ challan_number: c.challan_number, challan_type: c.challan_type, dispatch_id: c.dispatch_id || '', order_id: c.order_id || '', party_id: c.party_id || '', buyer_id: c.buyer_id || '', challan_date: c.challan_date, vehicle_number: c.vehicle_number || '', driver_name: c.driver_name || '', notes: c.notes || '' }); setEditItem(c); setShowModal(true) }

  const saveChallan = async () => {
    if (!form.challan_number) { toast.error('Challan number is required.'); return }
    setSaving(true)
    const payload = { ...form, dispatch_id: form.dispatch_id || null, order_id: form.order_id || null, party_id: form.party_id || null, buyer_id: form.buyer_id || null }
    const { error } = editItem
      ? await supabase.from('challans').update(payload).eq('id', editItem.id)
      : await supabase.from('challans').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItem ? 'Challan updated!' : 'Challan created!'); setShowModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteChallan = async () => {
    const { error } = await supabase.from('challans').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Challan deleted.'); fetchAll() }
    setDeleteId(null)
  }

  const openAddItem = cid => { setItemForm(EMPTY_ITEM); setEditItemRow(null); setItemChallanId(cid); setShowItemModal(true) }
  const openEditItem = (cid, item) => { setItemForm({ description: item.description, quantity: item.quantity, unit: item.unit || 'meters', rate: item.rate || '', amount: item.amount || '' }); setEditItemRow(item); setItemChallanId(cid); setShowItemModal(true) }

  const saveItem = async () => {
    if (!itemForm.description || !itemForm.quantity) { toast.error('Description and quantity required.'); return }
    setSaving(true)
    const amount = itemForm.rate && itemForm.quantity ? Number(itemForm.quantity) * Number(itemForm.rate) : itemForm.amount || null
    const payload = { ...itemForm, challan_id: itemChallanId, quantity: Number(itemForm.quantity), rate: itemForm.rate || null, amount }
    const { error } = editItemRow
      ? await supabase.from('challan_items').update(payload).eq('id', editItemRow.id)
      : await supabase.from('challan_items').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItemRow ? 'Item updated!' : 'Item added!'); setShowItemModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteItemFn = async () => {
    const { error } = await supabase.from('challan_items').delete().eq('id', deleteItemId)
    if (error) toast.error(error.message)
    else { toast.success('Item removed.'); fetchAll() }
    setDeleteItemId(null)
  }

  const handlePrint = (challanId) => {
    setPrintId(challanId)
    setTimeout(() => window.print(), 300)
  }

  const filtered = challans
    .filter(c => typeFilter === 'all' || c.challan_type === typeFilter)
    .filter(c => !search || c.challan_number.toLowerCase().includes(search.toLowerCase()) || c.parties?.name?.toLowerCase().includes(search.toLowerCase()) || c.buyers?.name?.toLowerCase().includes(search.toLowerCase()))

  const printChallan = challans.find(c => c.id === printId)
  const printItems = printId ? (challanItems[printId] || []) : []
  const printTotal = printItems.reduce((s, i) => s + Number(i.amount || 0), 0)

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />

      {/* Print stylesheet */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #challan-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; background: white; color: black; padding: 24px; font-family: sans-serif; font-size: 13px; }
        }
        #challan-print-area { display: none; }
      `}</style>

      {/* Print Area */}
      {printChallan && (
        <div id="challan-print-area" ref={printRef}>
          <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>DELIVERY CHALLAN</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#555' }}>Garment ERP — Fabric to Finish</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <p><strong>Challan No:</strong> {printChallan.challan_number}</p>
              <p><strong>Type:</strong> {printChallan.challan_type}</p>
              <p><strong>Date:</strong> {format(new Date(printChallan.challan_date), 'dd MMM yyyy')}</p>
            </div>
            <div>
              {printChallan.parties && <p><strong>Party:</strong> {printChallan.parties.name}</p>}
              {printChallan.buyers && <p><strong>Buyer:</strong> {printChallan.buyers.name}</p>}
              {printChallan.vehicle_number && <p><strong>Vehicle:</strong> {printChallan.vehicle_number}</p>}
              {printChallan.driver_name && <p><strong>Driver:</strong> {printChallan.driver_name}</p>}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>#</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Description</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Qty</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Unit</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Rate</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {printItems.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.description}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{Number(item.quantity).toLocaleString()}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.unit}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{item.rate ? `₹${Number(item.rate).toFixed(2)}` : '—'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{item.amount ? `₹${Number(item.amount).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                <td colSpan={5} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Total</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>₹{printTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          {printChallan.notes && <p><strong>Notes:</strong> {printChallan.notes}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 48 }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: 8 }}>Authorised Signatory</div>
            <div style={{ borderTop: '1px solid #000', paddingTop: 8 }}>Receiver's Signature</div>
          </div>
        </div>
      )}

      <PageHeader
        title="Challan & Invoice"
        subtitle="Generate printable challans for mill dispatches and order deliveries"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />New Challan</button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...CHALLAN_TYPES].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${typeFilter === t ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
            {t === 'all' ? `All (${challans.length})` : `${t} (${challans.filter(c => c.challan_type === t).length})`}
          </button>
        ))}
      </div>

      <div className="card mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by challan number, party or buyer..." />
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No challans" description="Create a challan for mill dispatches or order deliveries." action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />New Challan</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(ch => {
            const items = challanItems[ch.id] || []
            const total = items.reduce((s, i) => s + Number(i.amount || 0), 0)
            return (
              <div key={ch.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-brand-400 font-bold text-sm">{ch.challan_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${TYPE_COLORS[ch.challan_type]}`}>{ch.challan_type}</span>
                        {ch.parties && <span className="text-slate-300 text-sm">{ch.parties.name}</span>}
                        {ch.buyers && <span className="text-slate-300 text-sm">{ch.buyers.name}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{format(new Date(ch.challan_date), 'dd MMM yyyy')}</span>
                        {ch.vehicle_number && <span>Vehicle: {ch.vehicle_number}</span>}
                        {ch.driver_name && <span>Driver: {ch.driver_name}</span>}
                        <span>Items: <span className="text-slate-300">{items.length}</span></span>
                        {total > 0 && <span className="text-emerald-400 font-semibold">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => handlePrint(ch.id)} className="btn-ghost p-1.5 text-slate-400" title="Print"><Printer className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(ch)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteId(ch.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)} className="btn-ghost p-1.5 text-slate-400 ml-1">
                      {expandedId === ch.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === ch.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300">Challan Items ({items.length})</h4>
                      <div className="flex gap-2">
                        <button onClick={() => handlePrint(ch.id)} className="btn-secondary text-xs py-1 px-3"><Printer className="w-3 h-3" />Print</button>
                        <button onClick={() => openAddItem(ch.id)} className="btn-secondary text-xs py-1 px-3"><Plus className="w-3 h-3" />Add Item</button>
                      </div>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-4">No items. Click "Add Item" to add fabric or garment entries.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr>
                            <th className="table-head">Description</th><th className="table-head">Qty</th>
                            <th className="table-head">Unit</th><th className="table-head">Rate</th>
                            <th className="table-head">Amount</th><th className="table-head">Actions</th>
                          </tr></thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="hover:bg-slate-700/20 transition-colors group">
                                <td className="table-cell font-medium">{item.description}</td>
                                <td className="table-cell">{Number(item.quantity).toLocaleString()}</td>
                                <td className="table-cell text-slate-400">{item.unit}</td>
                                <td className="table-cell">{item.rate ? `₹${Number(item.rate).toFixed(2)}` : '—'}</td>
                                <td className="table-cell font-semibold text-emerald-400">{item.amount ? `₹${Number(item.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</td>
                                <td className="table-cell">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditItem(ch.id, item)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => setDeleteItemId(item.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {total > 0 && (
                              <tr className="bg-slate-700/30">
                                <td colSpan={4} className="table-cell text-right font-semibold text-slate-300">Total</td>
                                <td className="table-cell font-bold text-emerald-400">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                <td className="table-cell" />
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Challan' : 'New Challan'} onClose={() => setShowModal(false)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Challan Number *</label><input className="input" value={form.challan_number} onChange={fc('challan_number')} /></div>
              <div><label className="label">Type</label><select className="input" value={form.challan_type} onChange={fc('challan_type')}>{CHALLAN_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Party</label><select className="input" value={form.party_id} onChange={fc('party_id')}><option value="">Select party...</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}</select></div>
              <div><label className="label">Buyer</label><select className="input" value={form.buyer_id} onChange={fc('buyer_id')}><option value="">Select buyer...</option>{buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Link Dispatch</label><select className="input" value={form.dispatch_id} onChange={fc('dispatch_id')}><option value="">None</option>{dispatches.map(d => <option key={d.id} value={d.id}>{d.gray_fabrics?.lot_number} — {d.parties?.name} ({Number(d.quantity_sent)}m)</option>)}</select></div>
              <div><label className="label">Link Order</label><select className="input" value={form.order_id} onChange={fc('order_id')}><option value="">None</option>{orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.buyers?.name}</option>)}</select></div>
            </div>
            <div><label className="label">Challan Date</label><input className="input" type="date" value={form.challan_date} onChange={fc('challan_date')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Vehicle Number</label><input className="input" placeholder="e.g. GJ01AB1234" value={form.vehicle_number} onChange={fc('vehicle_number')} /></div>
              <div><label className="label">Driver Name</label><input className="input" placeholder="Driver name" value={form.driver_name} onChange={fc('driver_name')} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={fc('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveChallan} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editItem ? 'Update' : 'Create Challan'}</button>
            </div>
          </div>
        </Modal>
      )}

      {showItemModal && (
        <Modal title={editItemRow ? 'Edit Item' : 'Add Challan Item'} onClose={() => setShowItemModal(false)}>
          <div className="space-y-4">
            <div><label className="label">Description *</label><input className="input" placeholder="e.g. Gray Fabric — Lot GF-001" value={itemForm.description} onChange={fi('description')} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Quantity *</label><input className="input" type="number" min="0" step="0.01" value={itemForm.quantity} onChange={fi('quantity')} /></div>
              <div><label className="label">Unit</label><select className="input" value={itemForm.unit} onChange={fi('unit')}><option value="meters">Meters</option><option value="pieces">Pieces</option><option value="sets">Sets</option><option value="kg">KG</option></select></div>
              <div><label className="label">Rate (₹)</label><input className="input" type="number" min="0" step="0.01" value={itemForm.rate} onChange={fi('rate')} /></div>
            </div>
            {itemForm.quantity && itemForm.rate && (
              <p className="text-sm text-emerald-400 font-semibold">Amount: ₹{(Number(itemForm.quantity) * Number(itemForm.rate)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveItem} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editItemRow ? 'Update' : 'Add Item'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && <ConfirmDialog title="Delete Challan?" message="This challan and all its items will be permanently deleted." danger onConfirm={deleteChallan} onCancel={() => setDeleteId(null)} />}
      {deleteItemId && <ConfirmDialog title="Remove Item?" message="This item will be removed from the challan." danger onConfirm={deleteItemFn} onCancel={() => setDeleteItemId(null)} />}
    </div>
  )
}
