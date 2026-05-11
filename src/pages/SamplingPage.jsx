import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput } from '../components/ui'
import { Plus, Palette, Edit2, Trash2, Image, CheckSquare, Square, Tag, Calendar, Layers, Users } from 'lucide-react'
import { format } from 'date-fns'

// Work categories the user can pick (multi-select)
const WORK_CATEGORIES = [
  { key: 'embroidery', label: 'Embroidery', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'handwork',   label: 'Hand Work',  color: 'bg-amber-50 text-amber-700 border-amber-200'   },
  { key: 'khatli',    label: 'Khatli Work', color: 'bg-rose-50 text-rose-700 border-rose-200'      },
]

// Maps work category → party type(s) to filter parties dropdown
const WORK_TO_PARTY_TYPE = {
  embroidery: 'embroidery',
  handwork:   'handwork',
  khatli:     'khatli',
}

const EMPTY_FORM = {
  sample_number: '',
  sample_date: new Date().toISOString().split('T')[0],
  combined_fabric: '',
  color_breakdown: [{ color: '', meters: '' }],
  category: '',
  has_work: false,
  work_types: [],          // array of keys from WORK_CATEGORIES
  work_party_ids: {},      // { embroidery: '', handwork: '', khatli: '' }
  photo_url: '',
}

export default function SamplingPage() {
  const [samples, setSamples]           = useState([])
  const [fabricReceipts, setFabricReceipts] = useState([])  // finished fabrics received from mill
  const [grayFabrics, setGrayFabrics]   = useState([])      // all available fabrics
  const [parties, setParties]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [newCategory, setNewCategory]   = useState('')
  const [deletingId, setDeletingId]     = useState(null)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const fileRef                         = useRef(null)
  const { toasts, toast, dismiss }      = useToast()

  useEffect(() => { fetchAll() }, [])

  // ─── Data fetching ────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true)
    const [{ data: s }, { data: r }, { data: p }, { data: gf }] = await Promise.all([
      supabase.from('samples')
        .select('*, fabric_receipts(id, received_quantity, received_date, mill_dispatches(gray_fabrics(fabric_name, lot_number), parties(name))), gray_fabrics(id, fabric_name, lot_number)')
        .order('created_at', { ascending: false }),
      supabase.from('fabric_receipts')
        .select('id, received_quantity, available_quantity, received_date, mill_dispatches(gray_fabrics(fabric_name, lot_number), parties(name))')
        .order('received_date', { ascending: false }),
      supabase.from('parties')
        .select('id, name, type')
        .order('name'),
      supabase.from('gray_fabrics')
        .select('id, fabric_name, lot_number, available_meters')
        .order('fabric_name'),
    ])
    setSamples(s || [])
    setFabricReceipts(r || [])
    setParties(p || [])
    setGrayFabrics(gf || [])
    setLoading(false)
  }

  // ─── Form helpers ────────────────────────────────────────────────────────
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleWorkType = (key) => {
    setForm(f => {
      const already = f.work_types.includes(key)
      const next = already ? f.work_types.filter(k => k !== key) : [...f.work_types, key]
      // Clear the party for removed work type
      const nextParties = { ...f.work_party_ids }
      if (already) delete nextParties[key]
      return { ...f, work_types: next, work_party_ids: nextParties }
    })
  }

  const setWorkParty = (workKey, partyId) => {
    setForm(f => ({ ...f, work_party_ids: { ...f.work_party_ids, [workKey]: partyId } }))
  }

  const existingCategories = [...new Set(samples.map(s => s.category).filter(Boolean))]
  const allCategories = [...new Set([...existingCategories, form.category])].filter(c => c && c !== 'NEW').sort()

  const autoGenerateId = (cat) => {
    if (!cat || cat === 'NEW') return ''
    const code = cat.substring(0, 3).toUpperCase()
    const prefix = `SMP-${new Date().getFullYear()}-${code}-`
    const maxNum = samples
      .filter(s => s.sample_number?.startsWith(prefix))
      .reduce((max, s) => {
        const num = parseInt(s.sample_number.replace(prefix, ''), 10)
        return !isNaN(num) && num > max ? num : max
      }, 0)
    return prefix + String(maxNum + 1).padStart(3, '0')
  }

  const handleColorChange = (index, field, value) => {
    setForm(f => {
      const newBreakdown = [...f.color_breakdown]
      newBreakdown[index] = { ...newBreakdown[index], [field]: value }
      return { ...f, color_breakdown: newBreakdown }
    })
  }

  const addColorRow = () => {
    setForm(f => ({ ...f, color_breakdown: [...f.color_breakdown, { color: '', meters: '' }] }))
  }

  const removeColorRow = (index) => {
    setForm(f => {
      const newBreakdown = f.color_breakdown.filter((_, i) => i !== index)
      // Keep at least one empty row
      return { ...f, color_breakdown: newBreakdown.length ? newBreakdown : [{ color: '', meters: '' }] }
    })
  }

  const handleCategoryChange = (e) => {
    const val = e.target.value
    setField('category', val)
    if (!editItem && val && val !== 'NEW') {
      setField('sample_number', autoGenerateId(val))
    }
  }

  const handleNewCategorySubmit = () => {
    if (newCategory.trim()) {
      const cat = newCategory.trim()
      const existing = allCategories.find(c => c.toLowerCase() === cat.toLowerCase())
      
      if (existing) {
        toast.error(`Category "${existing}" already exists and was selected.`)
        setField('category', existing)
        if (!editItem) setField('sample_number', autoGenerateId(existing))
      } else {
        setField('category', cat)
        if (!editItem) setField('sample_number', autoGenerateId(cat))
      }
      setNewCategory('')
    }
  }

  // ─── Photo upload ─────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `samples/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('sample-photos').upload(path, file, { upsert: true })
    if (error) {
      toast.error('Photo upload failed: ' + error.message)
    } else {
      const { data: { publicUrl } } = supabase.storage.from('sample-photos').getPublicUrl(path)
      setField('photo_url', publicUrl)
      toast.success('Photo uploaded!')
    }
    setUploading(false)
  }

  // ─── Open/close modal ────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditItem(null)
    setShowModal(true)
  }

  const openEdit = (s) => {
    // If we have color_breakdown in DB, use it. Otherwise migrate legacy meters/colors.
    let breakdown = s.color_breakdown && s.color_breakdown.length > 0 
      ? s.color_breakdown 
      : [{ color: s.colors || '', meters: s.meters || '' }]

    setForm({
      sample_number:     s.sample_number,
      sample_date:       s.sample_date || new Date().toISOString().split('T')[0],
      combined_fabric:   s.fabric_id ? `gray|${s.fabric_id}` : (s.fabric_receipt_id ? `receipt|${s.fabric_receipt_id}` : ''),
      color_breakdown:   breakdown,
      category:          s.category || '',
      has_work:          s.has_work || false,
      work_types:        s.work_types || [],
      work_party_ids:    s.work_party_ids || {},
      photo_url:         s.photo_url || '',
    })
    setEditItem(s)
    setShowModal(true)
  }

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.sample_number.trim()) { toast.error('Sample number is required.'); return }
    if (!form.sample_date) { toast.error('Date is required.'); return }
    setSaving(true)

    const cleanedPartyIds = {}
    if (form.has_work) {
      for (const wt of form.work_types) {
        if (form.work_party_ids[wt]) {
          cleanedPartyIds[wt] = form.work_party_ids[wt]
        }
      }
    }

    const adjustFabricMeters = async (type, id, diff) => {
      if (!id || diff === 0) return
      if (type === 'gray') {
        const { data: gf } = await supabase.from('gray_fabrics').select('available_meters').eq('id', id).single()
        if (gf) await supabase.from('gray_fabrics').update({ available_meters: Number(gf.available_meters) + diff }).eq('id', id)
      } else if (type === 'receipt') {
        const { data: fr } = await supabase.from('fabric_receipts').select('available_quantity, received_quantity').eq('id', id).single()
        if (fr) {
          const current = fr.available_quantity ?? fr.received_quantity
          await supabase.from('fabric_receipts').update({ available_quantity: Number(current) + diff }).eq('id', id)
        }
      }
    }

    const cleanedBreakdown = form.color_breakdown.filter(c => c.color.trim() || c.meters)
    const totalMeters = cleanedBreakdown.reduce((sum, item) => sum + (Number(item.meters) || 0), 0)
    const allColors = cleanedBreakdown.map(c => c.color.trim()).filter(Boolean).join(', ')

    const payload = {
      sample_number:     form.sample_number.trim(),
      sample_date:       form.sample_date,
      fabric_receipt_id: form.combined_fabric?.startsWith('receipt|') ? form.combined_fabric.split('|')[1] : null,
      fabric_id:         form.combined_fabric?.startsWith('gray|') ? form.combined_fabric.split('|')[1] : null,
      meters:            totalMeters > 0 ? totalMeters : null,
      colors:            allColors || null,
      color_breakdown:   cleanedBreakdown,
      category:          form.category === 'NEW' ? '' : form.category,
      has_work:          form.has_work,
      work_types:        form.has_work ? form.work_types : [],
      work_party_ids:    cleanedPartyIds,
      photo_url:         form.photo_url || null,
    }

    // Fabric meters deduction logic
    const oldFabricType = editItem ? (editItem.fabric_id ? 'gray' : (editItem.fabric_receipt_id ? 'receipt' : null)) : null
    const oldFabricId = editItem ? (editItem.fabric_id || editItem.fabric_receipt_id) : null
    const newFabricType = form.combined_fabric?.split('|')[0]
    const newFabricId = form.combined_fabric?.split('|')[1]
    const oldMeters = parseFloat(editItem?.meters) || 0
    const newMeters = totalMeters

    if (oldFabricId === newFabricId) {
      await adjustFabricMeters(newFabricType, newFabricId, -(newMeters - oldMeters))
    } else {
      if (oldFabricId && oldMeters > 0) await adjustFabricMeters(oldFabricType, oldFabricId, oldMeters)
      if (newFabricId && newMeters > 0) await adjustFabricMeters(newFabricType, newFabricId, -newMeters)
    }

    const { error } = editItem
      ? await supabase.from('samples').update(payload).eq('id', editItem.id)
      : await supabase.from('samples').insert(payload)

    if (error) toast.error(error.message)
    else { toast.success(editItem ? 'Sample updated!' : 'Sample created!'); setShowModal(false); fetchAll() }
    setSaving(false)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    const { error } = await supabase.from('samples').delete().eq('id', deletingId)
    if (error) toast.error(error.message)
    else { toast.success('Sample deleted.'); fetchAll() }
    setDeletingId(null)
  }

  // ─── Filtered list ───────────────────────────────────────────────────────
  const filtered = samples.filter(s =>
    !search ||
    s.sample_number?.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fabricLabel = (receipt) => {
    if (!receipt) return '—'
    const md = receipt.mill_dispatches
    if (!md) return `Receipt #${receipt.id?.slice(0,6)}`
    const fabric = md.gray_fabrics
    const party  = md.parties
    return `${fabric?.lot_number || ''} — ${fabric?.fabric_name || ''} (${party?.name || ''})`
  }

  const combinedFabrics = [
    ...grayFabrics
      .filter(gf => gf.available_meters > 0)
      .map(gf => ({ value: `gray|${gf.id}`, label: `${gf.fabric_name} (${gf.lot_number}) [Gray] - ${gf.available_meters}m available`, lot: gf.lot_number })),
    ...fabricReceipts
      .filter(r => (r.available_quantity ?? r.received_quantity) > 0)
      .map(r => {
        const md = r.mill_dispatches
        const lot = md?.gray_fabrics?.lot_number || ''
        const name = md?.gray_fabrics?.fabric_name || `Receipt #${r.id.slice(0,6)}`
        const avail = r.available_quantity ?? r.received_quantity
        return { value: `receipt|${r.id}`, label: `${name} (${lot}) [Finished] - ${avail}m available`, lot }
      })
  ].sort((a, b) => a.lot.localeCompare(b.lot))

  const partiesForWork = (workKey) =>
    parties.filter(p => p.type === WORK_TO_PARTY_TYPE[workKey])

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Sampling & Design"
        subtitle="Manage fabric samples and design work assignments"
        action={<button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" />New Sample</button>}
      />

      {/* Search */}
      <div className="card mb-4 p-3">
        <div className="max-w-xs">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by sample number..." />
        </div>
      </div>

      {/* Sample cards */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No samples yet"
          description="Add your first sample to get started."
          action={<button onClick={openAdd} className="btn-primary mx-auto"><Plus className="w-4 h-4" />New Sample</button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const receipt = s.fabric_receipts
            return (
              <div key={s.id} className="card hover:border-brand-300 hover:shadow-indigo-sm transition-all group flex flex-col gap-0 p-0 overflow-hidden">
                {/* Photo */}
                <div className="relative h-44 bg-surface-base flex items-center justify-center flex-shrink-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.sample_number} className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-10 h-10 text-ink-outline" />
                  )}
                  {/* Action buttons on hover */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(s)} className="btn-icon text-brand-500 bg-white/90 shadow hover:bg-brand-50">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeletingId(s.id)} className="btn-icon text-red-500 bg-white/90 shadow hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <span className="font-bold text-ink font-mono tracking-wide">{s.sample_number}</span>
                    {s.category && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{s.category}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-soft">
                    <Calendar className="w-3.5 h-3.5 text-ink-outline" />
                    {s.sample_date ? format(new Date(s.sample_date), 'dd MMM yyyy') : '—'}
                  </div>
                  {s.gray_fabrics && (
                    <div className="flex items-start gap-2 text-xs text-ink-soft">
                      <Layers className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-400" />
                      <span className="leading-snug">Fabric: {s.gray_fabrics.fabric_name} ({s.gray_fabrics.lot_number})</span>
                    </div>
                  )}
                  {receipt && (
                    <div className="flex items-start gap-2 text-xs text-ink-soft">
                      <Layers className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-400" />
                      <span className="leading-snug">{fabricLabel(receipt)}</span>
                    </div>
                  )}
                  
                  {/* Total meters */}
                  {s.meters > 0 && (
                    <div className="flex items-start gap-2 text-xs text-ink-soft">
                      <Tag className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-400" />
                      <span className="leading-snug">Total: {s.meters} meters</span>
                    </div>
                  )}
                  
                  {/* Detailed Color Breakdown */}
                  {s.color_breakdown && s.color_breakdown.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {s.color_breakdown.map((cb, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-ink-soft bg-surface-low px-2 py-1 rounded">
                          <Palette className="w-3 h-3 text-ink-outline" />
                          <span className="flex-1 font-medium">{cb.color || 'Unspecified color'}</span>
                          <span className="font-mono">{cb.meters || 0}m</span>
                        </div>
                      ))}
                    </div>
                  ) : s.colors && (
                    <div className="flex items-start gap-2 text-xs text-ink-soft">
                      <Palette className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-brand-400" />
                      <span className="leading-snug">Colors: {s.colors}</span>
                    </div>
                  )}

                  {/* Work badges */}
                  {s.has_work && (s.work_types || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(s.work_types || []).map(wt => {
                        const cat = WORK_CATEGORIES.find(c => c.key === wt)
                        return cat ? (
                          <span key={wt} className={`px-2 py-0.5 rounded text-xs font-semibold border ${cat.color}`}>
                            {cat.label}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  {/* Party assignments for work */}
                  {s.has_work && s.work_party_ids && Object.keys(s.work_party_ids).length > 0 && (
                    <div className="space-y-1 mt-1">
                      {Object.entries(s.work_party_ids).map(([wt, pid]) => {
                        if (!pid) return null
                        const party = parties.find(p => p.id === pid)
                        if (!party) return null
                        const cat = WORK_CATEGORIES.find(c => c.key === wt)
                        return (
                          <div key={wt} className="flex items-center gap-1.5 text-xs text-ink-soft">
                            <Users className="w-3 h-3 text-ink-outline" />
                            <span className="text-ink-outline">{cat?.label}:</span>
                            <span className="text-ink font-medium">{party.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── New / Edit Sample Modal ───────────────────────────────────────── */}
      {showModal && (
        <Modal title={editItem ? 'Edit Sample' : 'New Sample'} onClose={() => setShowModal(false)} size="lg">
          <div className="space-y-5">

            {/* Category */}
            <div>
              <label className="label">Category</label>
              {form.category === 'NEW' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Enter new category (e.g. Kurti)"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      autoFocus
                    />
                    <button className="btn-primary whitespace-nowrap" onClick={handleNewCategorySubmit}>Add Category</button>
                    <button className="btn-secondary" onClick={() => { setField('category', ''); setNewCategory(''); }}>Cancel</button>
                  </div>
                  {existingCategories.length > 0 && (
                    <div className="text-xs text-ink-soft">
                      Existing categories: {existingCategories.sort().join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <select
                  className="input"
                  value={form.category}
                  onChange={handleCategoryChange}
                >
                  <option value="">— Select Category —</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="NEW">+ Add New Category</option>
                </select>
              )}
            </div>

            {/* Sample Number + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sample Number *</label>
                <input
                  className={`input ${!editItem ? 'bg-surface-base text-ink-soft' : ''}`}
                  placeholder={editItem ? "e.g. SMP-2026-KRT-001" : "Auto-generated upon Category selection"}
                  value={form.sample_number}
                  onChange={e => setField('sample_number', e.target.value)}
                  readOnly={!editItem}
                />
              </div>
              <div>
                <label className="label">Date *</label>
                <input
                  className="input"
                  type="date"
                  value={form.sample_date}
                  onChange={e => setField('sample_date', e.target.value)}
                />
              </div>
            </div>

            {/* Fabric Selection */}
            <div>
              <label className="label">Select Fabric</label>
              <select
                className="input"
                value={form.combined_fabric}
                onChange={e => setField('combined_fabric', e.target.value)}
              >
                <option value="">— Select a fabric —</option>
                {combinedFabrics.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Color & Meter Breakdown */}
            <div className="bg-surface-low border border-surface-high rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Colors & Meters Used</label>
                <div className="text-xs text-ink-soft font-medium">
                  Total: <span className="text-brand-600 font-bold">{form.color_breakdown.reduce((sum, item) => sum + (Number(item.meters) || 0), 0)}</span> m
                </div>
              </div>
              <div className="space-y-2">
                {form.color_breakdown.map((cb, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="Color (e.g. Red, Print A)"
                      value={cb.color}
                      onChange={e => handleColorChange(idx, 'color', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="input w-32 text-right"
                      placeholder="Meters"
                      value={cb.meters}
                      onChange={e => handleColorChange(idx, 'meters', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 bg-white"
                      onClick={() => removeColorRow(idx)}
                      title="Remove Color"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost text-brand-600 hover:bg-brand-50 hover:text-brand-700 font-medium text-sm w-full py-2 border border-dashed border-brand-200"
                onClick={addColorRow}
              >
                + Add Another Color
              </button>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="label">Sample Photo</label>
              <div
                className="border-2 border-dashed border-surface-high rounded-lg p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-400 transition-colors bg-surface-low"
                onClick={() => fileRef.current?.click()}
              >
                {form.photo_url ? (
                  <img src={form.photo_url} alt="sample" className="h-32 object-contain rounded-lg" />
                ) : (
                  <>
                    <Image className="w-8 h-8 text-ink-outline" />
                    <p className="text-ink-soft text-sm">Click to upload photo</p>
                    <p className="text-ink-outline text-xs">PNG, JPG, WEBP accepted</p>
                  </>
                )}
                {uploading && (
                  <div className="flex items-center gap-2 text-brand-600 text-sm">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {form.photo_url && (
                <button
                  className="btn-ghost text-xs text-red-400 hover:bg-red-500/10 mt-1"
                  onClick={() => setField('photo_url', '')}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Work Toggle */}
            <div>
              <label className="label">Work on this sample?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setField('has_work', true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded border text-sm font-medium transition-all ${
                    form.has_work
                      ? 'bg-brand-50 border-brand-400 text-brand-700'
                      : 'border-surface-high text-ink-soft hover:border-brand-300'
                  }`}
                >
                  {form.has_work ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  Yes, work is present
                </button>
                <button
                  onClick={() => { setField('has_work', false); setForm(f => ({ ...f, work_types: [], work_party_ids: {} })) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded border text-sm font-medium transition-all ${
                    !form.has_work
                      ? 'bg-surface-base border-surface-high text-ink'
                      : 'border-surface-high text-ink-soft hover:border-brand-300'
                  }`}
                >
                  <Square className="w-4 h-4" />
                  No work
                </button>
              </div>
            </div>

            {/* Work Categories + Party Selection (only if has_work) */}
            {form.has_work && (
              <div className="space-y-4 bg-surface-low rounded-lg p-4 border border-surface-high">
                <div>
                  <label className="label mb-2">Type of Work (select one or more)</label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_CATEGORIES.map(cat => {
                      const active = form.work_types.includes(cat.key)
                      return (
                        <button
                          key={cat.key}
                          onClick={() => toggleWorkType(cat.key)}
                          className={`px-4 py-2 rounded text-sm font-semibold border transition-all flex items-center gap-2 ${
                            active ? cat.color : 'border-surface-high text-ink-soft hover:border-brand-300'
                          }`}
                        >
                          {active ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                  {form.work_types.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">Please select at least one work type.</p>
                  )}
                </div>

                {/* Party for each selected work type */}
                {form.work_types.map(wt => {
                  const cat = WORK_CATEGORIES.find(c => c.key === wt)
                  const available = partiesForWork(wt)
                  return (
                    <div key={wt}>
                      <label className="label">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border mr-2 ${cat?.color}`}>{cat?.label}</span>
                        Party
                      </label>
                      <select
                        className="input"
                        value={form.work_party_ids[wt] || ''}
                        onChange={e => setWorkParty(wt, e.target.value)}
                      >
                        <option value="">— Select party —</option>
                        {available.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {available.length === 0 && (
                        <p className="text-xs text-ink-outline mt-1">
                          No {wt} parties found. Add one in the Parties page.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1 border-t border-surface-high">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving || uploading} className="btn-primary">
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                  : editItem ? 'Update Sample' : 'Create Sample'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <ConfirmDialog
          title="Delete Sample?"
          message="This sample will be permanently deleted."
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
