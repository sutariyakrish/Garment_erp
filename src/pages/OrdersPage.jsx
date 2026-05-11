import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput, StatCard } from '../components/ui'
import { Plus, ShoppingBag, Edit2, Trash2, ChevronDown, ChevronUp, Calendar, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

const ORDER_STATUSES = ['draft', 'confirmed', 'in_production', 'ready', 'dispatched', 'completed', 'cancelled']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free']

const STATUS_COLORS = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  confirmed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_production: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  ready: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  dispatched: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
}

const EMPTY_ORDER = { order_number: '', buyer_id: '', order_date: new Date().toISOString().split('T')[0], delivery_date: '', status: 'confirmed', total_amount: '', advance_paid: '', notes: '' }
const EMPTY_ITEM = { design_id: '', color: '', size: 'M', quantity: '', rate: '' }

const EMPTY_BUYER = { name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', notes: '' }

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [buyers, setBuyers] = useState([])
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [orderItems, setOrderItems] = useState({})

  const [showOrderModal, setShowOrderModal] = useState(false)
  const [editOrder, setEditOrder] = useState(null)
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER)

  const [showItemModal, setShowItemModal] = useState(false)
  const [itemOrderId, setItemOrderId] = useState(null)
  const [editItemRow, setEditItemRow] = useState(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)

  const [showBuyerModal, setShowBuyerModal] = useState(false)
  const [buyerForm, setBuyerForm] = useState(EMPTY_BUYER)

  const [deleteOrderId, setDeleteOrderId] = useState(null)
  const [deleteItemId, setDeleteItemId] = useState(null)
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: o }, { data: b }, { data: d }, { data: items }] = await Promise.all([
      supabase.from('orders').select('*, buyers(name, phone)').order('order_date', { ascending: false }),
      supabase.from('buyers').select('*').order('name'),
      supabase.from('designs').select('id, design_code, design_name').order('design_code'),
      supabase.from('order_items').select('*, designs(design_code, design_name)').order('created_at'),
    ])
    setOrders(o || [])
    setBuyers(b || [])
    setDesigns(d || [])
    const grouped = {}
    ;(items || []).forEach(item => {
      if (!grouped[item.order_id]) grouped[item.order_id] = []
      grouped[item.order_id].push(item)
    })
    setOrderItems(grouped)
    setLoading(false)
  }

  const fo = k => e => setOrderForm(x => ({ ...x, [k]: e.target.value }))
  const fi = k => e => setItemForm(x => ({ ...x, [k]: e.target.value }))
  const fb = k => e => setBuyerForm(x => ({ ...x, [k]: e.target.value }))

  // Generate next order number
  const genOrderNum = () => `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

  const openAddOrder = () => { setOrderForm({ ...EMPTY_ORDER, order_number: genOrderNum() }); setEditOrder(null); setShowOrderModal(true) }
  const openEditOrder = o => { setOrderForm({ order_number: o.order_number, buyer_id: o.buyer_id || '', order_date: o.order_date, delivery_date: o.delivery_date || '', status: o.status, total_amount: o.total_amount || '', advance_paid: o.advance_paid || '', notes: o.notes || '' }); setEditOrder(o); setShowOrderModal(true) }

  const saveOrder = async () => {
    if (!orderForm.order_number || !orderForm.buyer_id) { toast.error('Order number and buyer are required.'); return }
    setSaving(true)
    const payload = { ...orderForm, buyer_id: orderForm.buyer_id || null, delivery_date: orderForm.delivery_date || null, total_amount: orderForm.total_amount || null, advance_paid: orderForm.advance_paid || 0 }
    const { error } = editOrder
      ? await supabase.from('orders').update(payload).eq('id', editOrder.id)
      : await supabase.from('orders').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editOrder ? 'Order updated!' : 'Order created!'); setShowOrderModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteOrder = async () => {
    const { error } = await supabase.from('orders').delete().eq('id', deleteOrderId)
    if (error) toast.error(error.message)
    else { toast.success('Order deleted.'); fetchAll() }
    setDeleteOrderId(null)
  }

  const openAddItem = orderId => { setItemForm(EMPTY_ITEM); setEditItemRow(null); setItemOrderId(orderId); setShowItemModal(true) }
  const openEditItem = (orderId, item) => { setItemForm({ design_id: item.design_id || '', color: item.color || '', size: item.size || 'M', quantity: item.quantity, rate: item.rate }); setEditItemRow(item); setItemOrderId(orderId); setShowItemModal(true) }

  const saveItem = async () => {
    if (!itemForm.quantity || !itemForm.rate) { toast.error('Quantity and rate are required.'); return }
    setSaving(true)
    const payload = { ...itemForm, order_id: itemOrderId, design_id: itemForm.design_id || null, quantity: parseInt(itemForm.quantity), rate: Number(itemForm.rate) }
    const { error } = editItemRow
      ? await supabase.from('order_items').update(payload).eq('id', editItemRow.id)
      : await supabase.from('order_items').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItemRow ? 'Item updated!' : 'Item added!'); setShowItemModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteOrderItem = async () => {
    const { error } = await supabase.from('order_items').delete().eq('id', deleteItemId)
    if (error) toast.error(error.message)
    else { toast.success('Item removed.'); fetchAll() }
    setDeleteItemId(null)
  }

  const saveBuyer = async () => {
    if (!buyerForm.name) { toast.error('Buyer name is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('buyers').insert(buyerForm)
    if (error) toast.error(error.message)
    else { toast.success('Buyer added!'); setShowBuyerModal(false); setBuyerForm(EMPTY_BUYER); fetchAll() }
    setSaving(false)
  }

  const pending = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
  const overdueOrders = orders.filter(o => o.delivery_date && differenceInDays(new Date(o.delivery_date), new Date()) < 0 && !['completed', 'cancelled'].includes(o.status)).length

  const filtered = orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .filter(o => !search || o.order_number.toLowerCase().includes(search.toLowerCase()) || o.buyers?.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Order Management"
        subtitle="Buyer orders with delivery deadlines and item tracking"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowBuyerModal(true)} className="btn-secondary"><Plus className="w-4 h-4" />Add Buyer</button>
            <button onClick={openAddOrder} className="btn-primary"><Plus className="w-4 h-4" />New Order</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingBag} color="brand" />
        <StatCard label="Pending" value={pending} icon={Clock} color="amber" />
        <StatCard label="Overdue" value={overdueOrders} icon={Calendar} color="rose" />
        <StatCard label="Completed" value={orders.filter(o => o.status === 'completed').length} icon={ShoppingBag} color="emerald" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...ORDER_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${statusFilter === s ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
            {s === 'all' ? `All (${orders.length})` : `${s.replace('_', ' ')} (${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="card mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by order number or buyer name..." />
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" description="Create your first buyer order to start tracking deliveries." action={<button onClick={openAddOrder} className="btn-primary mx-auto"><Plus className="w-4 h-4" />New Order</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const items = orderItems[order.id] || []
            const itemTotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0)
            const daysLeft = order.delivery_date ? differenceInDays(new Date(order.delivery_date), new Date()) : null
            const isOverdue = daysLeft !== null && daysLeft < 0 && !['completed', 'cancelled'].includes(order.status)
            return (
              <div key={order.id} className={`card ${isOverdue ? 'border-red-500/30 bg-red-500/5' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-5 h-5 text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-brand-400 font-bold text-sm">{order.order_number}</span>
                        <span className="text-slate-100 font-semibold">{order.buyers?.name || 'No buyer'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[order.status]}`}>{order.status.replace('_', ' ')}</span>
                        {isOverdue && <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-red-500/20 text-red-300 border-red-500/30">OVERDUE</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Order: {format(new Date(order.order_date), 'dd MMM yyyy')}</span>
                        {order.delivery_date && (
                          <span className={isOverdue ? 'text-red-400' : daysLeft <= 3 ? 'text-amber-400' : ''}>
                            Deliver by: {format(new Date(order.delivery_date), 'dd MMM yyyy')}
                            {daysLeft !== null && !['completed','cancelled'].includes(order.status) && ` (${isOverdue ? Math.abs(daysLeft) + ' days overdue' : daysLeft + ' days left'})`}
                          </span>
                        )}
                        {order.buyers?.phone && <span>{order.buyers.phone}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-slate-400">Items: <span className="text-slate-200 font-semibold">{items.length}</span></span>
                        <span className="text-slate-400">Total Qty: <span className="text-slate-200 font-semibold">{items.reduce((s, i) => s + Number(i.quantity), 0)}</span></span>
                        <span className="text-slate-400">Value: <span className="text-emerald-400 font-semibold">₹{itemTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></span>
                        {order.advance_paid > 0 && <span className="text-slate-400">Advance: <span className="text-brand-400 font-semibold">₹{Number(order.advance_paid).toLocaleString('en-IN')}</span></span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => openEditOrder(order)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteOrderId(order.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} className="btn-ghost p-1.5 text-slate-400 ml-1">
                      {expandedId === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === order.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300">Order Items ({items.length})</h4>
                      <button onClick={() => openAddItem(order.id)} className="btn-secondary text-xs py-1 px-3"><Plus className="w-3 h-3" />Add Item</button>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-4">No items added. Click "Add Item" to add designs to this order.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr>
                            <th className="table-head">Design</th><th className="table-head">Colour</th>
                            <th className="table-head">Size</th><th className="table-head">Qty</th>
                            <th className="table-head">Rate</th><th className="table-head">Amount</th>
                            <th className="table-head">Actions</th>
                          </tr></thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="hover:bg-slate-700/20 transition-colors group">
                                <td className="table-cell">{item.designs ? `${item.designs.design_code} — ${item.designs.design_name}` : '—'}</td>
                                <td className="table-cell text-slate-300">{item.color || '—'}</td>
                                <td className="table-cell"><span className="font-mono text-brand-300">{item.size || '—'}</span></td>
                                <td className="table-cell font-semibold">{item.quantity}</td>
                                <td className="table-cell">₹{Number(item.rate).toFixed(2)}</td>
                                <td className="table-cell font-semibold text-emerald-400">₹{(Number(item.quantity) * Number(item.rate)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                <td className="table-cell">
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditItem(order.id, item)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => setDeleteItemId(item.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-700/30">
                              <td colSpan={5} className="table-cell text-right font-semibold text-slate-300">Total</td>
                              <td className="table-cell font-bold text-emerald-400">₹{itemTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                              <td className="table-cell" />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                    {order.notes && <p className="mt-3 text-xs text-slate-400 border-t border-slate-700 pt-3">Notes: {order.notes}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <Modal title={editOrder ? 'Edit Order' : 'New Order'} onClose={() => setShowOrderModal(false)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Order Number *</label><input className="input" value={orderForm.order_number} onChange={fo('order_number')} /></div>
              <div>
                <label className="label">Buyer *</label>
                <select className="input" value={orderForm.buyer_id} onChange={fo('buyer_id')}>
                  <option value="">Select buyer...</option>
                  {buyers.map(b => <option key={b.id} value={b.id}>{b.name}{b.phone ? ` (${b.phone})` : ''}</option>)}
                </select>
                {buyers.length === 0 && <p className="text-xs text-amber-400 mt-1">No buyers. Click "Add Buyer" first.</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Order Date</label><input className="input" type="date" value={orderForm.order_date} onChange={fo('order_date')} /></div>
              <div><label className="label">Delivery Date</label><input className="input" type="date" value={orderForm.delivery_date} onChange={fo('delivery_date')} /></div>
            </div>
            <div><label className="label">Status</label><select className="input" value={orderForm.status} onChange={fo('status')}>{ORDER_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Total Amount (₹)</label><input className="input" type="number" min="0" step="0.01" value={orderForm.total_amount} onChange={fo('total_amount')} /></div>
              <div><label className="label">Advance Paid (₹)</label><input className="input" type="number" min="0" step="0.01" value={orderForm.advance_paid} onChange={fo('advance_paid')} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={orderForm.notes} onChange={fo('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowOrderModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveOrder} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editOrder ? 'Update' : 'Create Order'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <Modal title={editItemRow ? 'Edit Order Item' : 'Add Order Item'} onClose={() => setShowItemModal(false)}>
          <div className="space-y-4">
            <div><label className="label">Design</label><select className="input" value={itemForm.design_id} onChange={fi('design_id')}><option value="">Select design...</option>{designs.map(d => <option key={d.id} value={d.id}>{d.design_code} — {d.design_name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Colour</label><input className="input" placeholder="e.g. Royal Blue" value={itemForm.color} onChange={fi('color')} /></div>
              <div><label className="label">Size</label><select className="input" value={itemForm.size} onChange={fi('size')}>{SIZES.map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Quantity *</label><input className="input" type="number" min="1" placeholder="0" value={itemForm.quantity} onChange={fi('quantity')} /></div>
              <div><label className="label">Rate (₹) *</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={itemForm.rate} onChange={fi('rate')} /></div>
            </div>
            {itemForm.quantity && itemForm.rate && <p className="text-sm text-emerald-400 font-semibold">Amount: ₹{(Number(itemForm.quantity) * Number(itemForm.rate)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveItem} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editItemRow ? 'Update' : 'Add Item'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Buyer Modal */}
      {showBuyerModal && (
        <Modal title="Add Buyer" onClose={() => setShowBuyerModal(false)}>
          <div className="space-y-4">
            <div><label className="label">Buyer Name *</label><input className="input" placeholder="e.g. Meena Traders" value={buyerForm.name} onChange={fb('name')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Contact Person</label><input className="input" value={buyerForm.contact_person} onChange={fb('contact_person')} /></div>
              <div><label className="label">Phone</label><input className="input" value={buyerForm.phone} onChange={fb('phone')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Email</label><input className="input" type="email" value={buyerForm.email} onChange={fb('email')} /></div>
              <div><label className="label">GST Number</label><input className="input" placeholder="GST number" value={buyerForm.gst_number} onChange={fb('gst_number')} /></div>
            </div>
            <div><label className="label">Address</label><textarea className="input resize-none" rows={2} value={buyerForm.address} onChange={fb('address')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowBuyerModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveBuyer} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Add Buyer'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteOrderId && <ConfirmDialog title="Delete Order?" message="This will delete the order and all its items permanently." danger onConfirm={deleteOrder} onCancel={() => setDeleteOrderId(null)} />}
      {deleteItemId && <ConfirmDialog title="Remove Item?" message="This order item will be permanently removed." danger onConfirm={deleteOrderItem} onCancel={() => setDeleteItemId(null)} />}
    </div>
  )
}
