import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput } from '../components/ui'
import { Plus, Users, Edit2, Trash2, Phone, MapPin, Building2 } from 'lucide-react'

const PARTY_TYPES = ['mill', 'embroidery', 'handwork', 'khatli', 'stitching', 'other']
const EMPTY_FORM = { name: '', type: 'mill', contact_person: '', phone: '', address: '', notes: '' }

const typeColors = {
  mill:       'bg-brand-50 text-brand-700 border-brand-200',
  embroidery: 'bg-purple-50 text-purple-700 border-purple-200',
  handwork:   'bg-amber-50 text-amber-700 border-amber-200',
  khatli:     'bg-rose-50 text-rose-700 border-rose-200',
  stitching:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  other:      'bg-surface-base text-ink-soft border-surface-high',
}

export default function PartiesPage() {
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchParties() }, [])

  const fetchParties = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('parties').select('*').order('name')
    if (error) toast.error('Failed to load parties')
    else setParties(data || [])
    setLoading(false)
  }

  const openAdd = () => { setForm(EMPTY_FORM); setEditItem(null); setShowModal(true) }
  const openEdit = (p) => {
    setForm({ name: p.name, type: p.type, contact_person: p.contact_person || '', phone: p.phone || '', address: p.address || '', notes: p.notes || '' })
    setEditItem(p); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditItem(null) }

  const handleSave = async () => {
    if (!form.name || !form.type) { toast.error('Name and type are required.'); return }
    setSaving(true)
    const payload = { name: form.name, type: form.type, contact_person: form.contact_person, phone: form.phone, address: form.address, notes: form.notes }
    const { error } = editItem
      ? await supabase.from('parties').update(payload).eq('id', editItem.id)
      : await supabase.from('parties').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editItem ? 'Party updated!' : 'Party added!'); closeModal(); fetchParties() }
    setSaving(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('parties').delete().eq('id', deleteId)
    if (error) toast.error('Cannot delete — party is in use.')
    else { toast.success('Party deleted.'); fetchParties() }
    setDeleteId(null)
  }

  const f = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))

  const filtered = parties
    .filter(p => typeFilter === 'all' || p.type === typeFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.contact_person?.toLowerCase().includes(search.toLowerCase()))

  const typeCounts = PARTY_TYPES.reduce((acc, t) => ({ ...acc, [t]: parties.filter(p => p.type === t).length }), {})

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Parties"
        subtitle="Manage mills, workers, and vendors"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />Add Party</button>}
      />

      {/* Type Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
            typeFilter === 'all'
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-ink-soft border-surface-high hover:border-brand-300'
          }`}
        >
          All ({parties.length})
        </button>
        {PARTY_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border capitalize transition-all ${
              typeFilter === t
                ? `${typeColors[t]} border`
                : 'bg-white text-ink-soft border-surface-high hover:border-brand-300'
            }`}
          >
            {t} ({typeCounts[t] || 0})
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-high">
          <div className="max-w-xs">
            <SearchInput value={search} onChange={setSearch} placeholder="Search parties..." />
          </div>
        </div>

        {loading ? (
          <div className="py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={Users}
              title="No parties found"
              description="Add mills, embroidery workers, and other vendors."
              action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />Add Party</button>}
            />
          </div>
        ) : (
          <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => (
              <div
                key={p.id}
                className="bg-white border border-surface-high rounded-lg p-4 hover:border-brand-300 hover:shadow-indigo-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-ink text-[15px]">{p.name}</p>
                    <span className={`text-xs font-semibold capitalize border px-2 py-0.5 rounded mt-1.5 inline-block ${typeColors[p.type] || typeColors.other}`}>
                      {p.type}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="btn-icon text-brand-500 hover:bg-brand-50">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="btn-icon text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {p.contact_person && (
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Building2 className="w-3.5 h-3.5 text-ink-outline flex-shrink-0" />
                      {p.contact_person}
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <Phone className="w-3.5 h-3.5 text-ink-outline flex-shrink-0" />
                      {p.phone}
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-2 text-xs text-ink-soft">
                      <MapPin className="w-3.5 h-3.5 text-ink-outline flex-shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editItem ? 'Edit Party' : 'Add Party'} onClose={closeModal}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Party Name *</label>
                <input className="input" placeholder="e.g. Rahul Dyeing Works" value={form.name} onChange={f('name')} />
              </div>
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={f('type')}>
                  {PARTY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Contact Person</label>
                <input className="input" placeholder="e.g. Rahul Shah" value={form.contact_person} onChange={f('contact_person')} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="e.g. 9876543210" value={form.phone} onChange={f('phone')} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" placeholder="e.g. Ring Road, Surat" value={form.address} onChange={f('address')} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Any additional info..." value={form.notes} onChange={f('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-1 border-t border-surface-high">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                  : editItem ? 'Update' : 'Add Party'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Party?"
          message="This will remove the party. It cannot be deleted if it has associated dispatches."
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
