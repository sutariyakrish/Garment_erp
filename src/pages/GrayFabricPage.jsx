import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput } from '../components/ui'
import { Plus, Layers, Edit2, Trash2, ChevronUp, ChevronDown, Filter } from 'lucide-react'
import { format } from 'date-fns'

const EMPTY_FORM = {
  fabric_name: '',
  lot_number: '',
  total_meters: '',
  construction_notes: '',
  date: new Date().toISOString().split('T')[0],
}

export default function GrayFabricPage() {
  const [fabrics, setFabrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchFabrics() }, [])

  const fetchFabrics = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gray_fabrics')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load fabrics')
    else setFabrics(data || [])
    setLoading(false)
  }

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setShowModal(true) }
  const openEdit = (f) => {
    setForm({
      fabric_name: f.fabric_name,
      lot_number: f.lot_number,
      total_meters: f.total_meters,
      construction_notes: f.construction_notes || '',
      date: f.date,
    })
    setEditItem(f)
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditItem(null) }

  const handleSave = async () => {
    if (!form.fabric_name || !form.lot_number || !form.total_meters) {
      toast.error('Fill all required fields.'); return
    }
    if (Number(form.total_meters) <= 0) { toast.error('Meters must be positive.'); return }
    setSaving(true)
    if (editItem) {
      const { error } = await supabase.from('gray_fabrics').update({
        fabric_name: form.fabric_name,
        lot_number: form.lot_number,
        total_meters: Number(form.total_meters),
        construction_notes: form.construction_notes,
        date: form.date,
      }).eq('id', editItem.id)
      if (error) toast.error(error.message)
      else { toast.success('Fabric updated!'); closeModal(); fetchFabrics() }
    } else {
      const { error } = await supabase.from('gray_fabrics').insert({
        fabric_name: form.fabric_name,
        lot_number: form.lot_number,
        total_meters: Number(form.total_meters),
        available_meters: Number(form.total_meters),
        construction_notes: form.construction_notes,
        date: form.date,
      })
      if (error) toast.error(
        error.message === 'duplicate key value violates unique constraint "gray_fabrics_lot_number_key"'
          ? 'Lot number already exists.'
          : error.message
      )
      else { toast.success('Fabric added!'); closeModal(); fetchFabrics() }
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('gray_fabrics').delete().eq('id', deleteId)
    if (error) toast.error('Cannot delete — fabric is in use.')
    else { toast.success('Fabric deleted.'); fetchFabrics() }
    setDeleteId(null)
  }

  const f = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))

  const sortedFiltered = [...fabrics]
    .filter(f =>
      !search ||
      f.fabric_name.toLowerCase().includes(search.toLowerCase()) ||
      f.lot_number.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const v =
        sort.col === 'total_meters' || sort.col === 'available_meters'
          ? Number(a[sort.col]) - Number(b[sort.col])
          : (a[sort.col] || '').localeCompare(b[sort.col] || '')
      return sort.dir === 'asc' ? v : -v
    })

  const toggleSort = (col) =>
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })

  const SortIcon = ({ col }) =>
    sort.col !== col ? null : sort.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 inline" />

  // Summary stats
  const totalM   = fabrics.reduce((s, f) => s + Number(f.total_meters), 0)
  const availM   = fabrics.reduce((s, f) => s + Number(f.available_meters), 0)
  const utilPct  = totalM > 0 ? Math.round(((totalM - availM) / totalM) * 100) : 0

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Gray Fabric"
        subtitle="Manage and track raw textile inventory before processing."
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Fabric
          </button>
        }
      />

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: 'Total Lots', value: fabrics.length },
          { label: 'Total Meters', value: `${totalM.toLocaleString()} m` },
          { label: 'Available', value: `${availM.toLocaleString()} m`, green: true },
          { label: 'Utilization', value: `${utilPct}%`, amber: utilPct > 70 },
        ].map(chip => (
          <div key={chip.label} className="flex items-center gap-2 bg-white border border-surface-high rounded px-3 py-1.5 shadow-indigo-sm">
            <span className="text-xs text-ink-soft font-medium">{chip.label}</span>
            <span className={`text-sm font-bold ${chip.green ? 'text-emerald-600' : chip.amber ? 'text-amber-600' : 'text-ink'}`}>
              {chip.value}
            </span>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card p-0 overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-surface-high">
          <div className="flex-1 max-w-xs">
            <SearchInput value={search} onChange={setSearch} placeholder="Search lot no. or fabric name..." />
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-outline font-medium">
            <Filter className="w-3.5 h-3.5" />
            {sortedFiltered.length} result{sortedFiltered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="py-10">
            <Spinner />
          </div>
        ) : sortedFiltered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No fabrics yet"
            description="Add your first gray fabric lot to get started."
            action={
              <button onClick={openAdd} className="btn-primary mx-auto">
                <Plus className="w-4 h-4" />
                Add Fabric
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    ['lot_number', 'Lot No'],
                    ['fabric_name', 'Fabric Name'],
                    ['total_meters', 'Total (m)'],
                    ['available_meters', 'Available (m)'],
                    ['date', 'Date'],
                  ].map(([col, label]) => (
                    <th
                      key={col}
                      className="table-head cursor-pointer select-none hover:text-ink transition-colors"
                      onClick={() => toggleSort(col)}
                    >
                      {label}
                      <SortIcon col={col} />
                    </th>
                  ))}
                  <th className="table-head">Notes</th>
                  <th className="table-head text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map(fabric => {
                  const used = Number(fabric.total_meters) - Number(fabric.available_meters)
                  const pct = Number(fabric.total_meters) > 0
                    ? (used / Number(fabric.total_meters)) * 100
                    : 0
                  return (
                    <tr key={fabric.id} className="table-row group">
                      <td className="table-cell">
                        <span className="font-mono text-brand-700 font-semibold text-xs bg-brand-50 px-2 py-0.5 rounded">
                          {fabric.lot_number}
                        </span>
                      </td>
                      <td className="table-cell font-medium text-ink">{fabric.fabric_name}</td>
                      <td className="table-cell text-ink-soft">{Number(fabric.total_meters).toLocaleString()}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-emerald-600 tabular-nums">
                            {Number(fabric.available_meters).toLocaleString()}
                          </span>
                          <div className="flex-1 h-1.5 bg-surface-base rounded-full min-w-[50px] overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-ink-soft">
                        {fabric.date ? format(new Date(fabric.date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="table-cell text-ink-soft max-w-[160px]">
                        <span className="truncate block">{fabric.construction_notes || '—'}</span>
                      </td>
                      <td className="table-cell text-right pr-5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(fabric)}
                            className="btn-icon text-brand-500 hover:bg-brand-50"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(fabric.id)}
                            className="btn-icon text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editItem ? 'Edit Fabric Lot' : 'Add Gray Fabric'} onClose={closeModal}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fabric Name *</label>
                <input className="input" placeholder="e.g. Cotton Slub" value={form.fabric_name} onChange={f('fabric_name')} />
              </div>
              <div>
                <label className="label">Lot Number *</label>
                <input className="input" placeholder="e.g. LOT-001" value={form.lot_number} onChange={f('lot_number')} disabled={!!editItem} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Total Meters *</label>
                <input className="input" type="number" min="1" placeholder="e.g. 500" value={form.total_meters} onChange={f('total_meters')} />
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={f('date')} />
              </div>
            </div>
            <div>
              <label className="label">Construction Notes</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="e.g. 60s count, plain weave..."
                value={form.construction_notes}
                onChange={f('construction_notes')}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1 border-t border-surface-high">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : editItem ? 'Update Fabric' : 'Add Fabric'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Fabric Lot?"
          message="This will permanently delete this fabric lot. This cannot be undone if it has associated dispatches."
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
