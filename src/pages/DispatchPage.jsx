import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput, StatusBadge } from '../components/ui'
import { Plus, Send, Edit2, Trash2, Filter } from 'lucide-react'
import { format } from 'date-fns'

const QUALITY_OPTIONS = ['A Grade', 'B Grade', 'Dyeing', 'Printing', 'Washing', 'Finishing']
const EMPTY_FORM = {
  fabric_id: '',
  party_id: '',
  quantity_sent: '',
  quality: '',
  dispatch_date: new Date().toISOString().split('T')[0],
  notes: '',
}

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState([])
  const [fabrics, setFabrics] = useState([])
  const [mills, setMills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: d }, { data: f }, { data: m }] = await Promise.all([
      supabase.from('mill_dispatches').select('*, gray_fabrics(fabric_name, lot_number, available_meters), parties(name)').order('dispatch_date', { ascending: false }),
      supabase.from('gray_fabrics').select('id, fabric_name, lot_number, available_meters').order('lot_number'),
      supabase.from('parties').select('id, name').eq('type', 'mill').order('name'),
    ])
    setDispatches(d || [])
    setFabrics(f || [])
    setMills(m || [])
    setLoading(false)
  }

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setShowModal(true) }
  const openEdit = (d) => {
    setForm({ fabric_id: d.fabric_id, party_id: d.party_id, quantity_sent: d.quantity_sent, quality: d.quality || '', dispatch_date: d.dispatch_date, notes: d.notes || '' })
    setEditItem(d); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditItem(null) }

  const selectedFabric = fabrics.find(f => f.id === form.fabric_id)
  const maxQty = editItem
    ? Number(editItem.quantity_sent) + Number(selectedFabric?.available_meters || 0)
    : Number(selectedFabric?.available_meters || 0)

  const handleSave = async () => {
    if (!form.fabric_id || !form.party_id || !form.quantity_sent) { toast.error('Fill all required fields.'); return }
    const qty = Number(form.quantity_sent)
    if (qty <= 0) { toast.error('Quantity must be positive.'); return }
    if (qty > maxQty) { toast.error(`Only ${maxQty}m available for this lot.`); return }

    setSaving(true)
    if (editItem) {
      const diff = qty - Number(editItem.quantity_sent)
      const { error } = await supabase.from('mill_dispatches').update({
        fabric_id: form.fabric_id, party_id: form.party_id, quantity_sent: qty,
        quality: form.quality, dispatch_date: form.dispatch_date, notes: form.notes,
      }).eq('id', editItem.id)
      if (!error && diff !== 0) {
        await supabase.from('gray_fabrics').update({ available_meters: Number(selectedFabric.available_meters) - diff }).eq('id', form.fabric_id)
      }
      if (error) toast.error(error.message)
      else { toast.success('Dispatch updated!'); closeModal(); fetchAll() }
    } else {
      const { error } = await supabase.from('mill_dispatches').insert({
        fabric_id: form.fabric_id, party_id: form.party_id, quantity_sent: qty,
        quality: form.quality, dispatch_date: form.dispatch_date, notes: form.notes, status: 'sent',
      })
      if (!error) {
        await supabase.from('gray_fabrics').update({ available_meters: Number(selectedFabric.available_meters) - qty }).eq('id', form.fabric_id)
      }
      if (error) toast.error(error.message)
      else { toast.success('Dispatch created!'); closeModal(); fetchAll() }
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    const dispatch = dispatches.find(d => d.id === deleteId)
    const { error } = await supabase.from('mill_dispatches').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else {
      if (dispatch && dispatch.status === 'sent') {
        await supabase.from('gray_fabrics').update({
          available_meters: Number(dispatch.gray_fabrics?.available_meters) + Number(dispatch.quantity_sent)
        }).eq('id', dispatch.fabric_id)
      }
      toast.success('Dispatch deleted.')
      fetchAll()
    }
    setDeleteId(null)
  }

  const f = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))

  const filtered = dispatches
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .filter(d => !search || d.gray_fabrics?.lot_number?.toLowerCase().includes(search.toLowerCase()) || d.parties?.name?.toLowerCase().includes(search.toLowerCase()))

  const statusPillClass = (s) =>
    statusFilter === s
      ? 'bg-brand-600 text-white border-brand-600'
      : 'bg-white text-ink-soft border-surface-high hover:border-brand-300'

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Mill Dispatch"
        subtitle="Send gray fabric to mills for processing"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />New Dispatch</button>}
      />

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['all', 'sent', 'partial', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border capitalize transition-all ${statusPillClass(s)}`}
          >
            {s === 'all' ? `All (${dispatches.length})` : `${s} (${dispatches.filter(d => d.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-surface-high">
          <div className="flex-1 max-w-xs">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by lot or mill name..." />
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-outline font-medium">
            <Filter className="w-3.5 h-3.5" />
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No dispatches"
            description="Create your first dispatch to send fabric to a mill."
            action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />New Dispatch</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="table-head">Lot / Fabric</th>
                  <th className="table-head">Mill</th>
                  <th className="table-head text-right">Qty (m)</th>
                  <th className="table-head">Quality</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Notes</th>
                  <th className="table-head text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="table-row group">
                    <td className="table-cell">
                      <p className="font-mono text-brand-700 font-semibold text-xs">{d.gray_fabrics?.lot_number}</p>
                      <p className="text-xs text-ink-soft">{d.gray_fabrics?.fabric_name}</p>
                    </td>
                    <td className="table-cell font-medium text-ink">{d.parties?.name}</td>
                    <td className="table-cell text-right font-semibold tabular-nums">{Number(d.quantity_sent).toLocaleString()}</td>
                    <td className="table-cell text-ink-soft">{d.quality || '—'}</td>
                    <td className="table-cell text-ink-soft">{d.dispatch_date ? format(new Date(d.dispatch_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="table-cell"><StatusBadge status={d.status} /></td>
                    <td className="table-cell text-ink-soft max-w-[140px]">
                      <span className="truncate block">{d.notes || '—'}</span>
                    </td>
                    <td className="table-cell text-right pr-5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.status === 'sent' && (
                          <button onClick={() => openEdit(d)} className="btn-icon text-brand-500 hover:bg-brand-50">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => setDeleteId(d.id)} className="btn-icon text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editItem ? 'Edit Dispatch' : 'New Dispatch'} onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="label">Gray Fabric (Lot) *</label>
              <select className="input" value={form.fabric_id} onChange={f('fabric_id')}>
                <option value="">Select fabric lot...</option>
                {fabrics.map(fab => (
                  <option key={fab.id} value={fab.id}>
                    {fab.lot_number} — {fab.fabric_name} ({Number(fab.available_meters).toLocaleString()}m available)
                  </option>
                ))}
              </select>
              {selectedFabric && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">Available: {Number(selectedFabric.available_meters).toLocaleString()} m</p>
              )}
            </div>
            <div>
              <label className="label">Mill / Party *</label>
              <select className="input" value={form.party_id} onChange={f('party_id')}>
                <option value="">Select mill...</option>
                {mills.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {mills.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No mills added yet. Go to Parties → Add a mill first.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Quantity (meters) *</label>
                <input className="input" type="number" min="1" max={maxQty} placeholder={`Max: ${maxQty}`} value={form.quantity_sent} onChange={f('quantity_sent')} />
              </div>
              <div>
                <label className="label">Quality / Process</label>
                <select className="input" value={form.quality} onChange={f('quality')}>
                  <option value="">Select...</option>
                  {QUALITY_OPTIONS.map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Dispatch Date</label>
              <input className="input" type="date" value={form.dispatch_date} onChange={f('dispatch_date')} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Color instructions, special requirements..." value={form.notes} onChange={f('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-1 border-t border-surface-high">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                  : editItem ? 'Update' : 'Create Dispatch'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Dispatch?"
          message="This will delete the dispatch record. Fabric quantity will be restored if status is 'sent'."
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
