import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, ConfirmDialog, Toast, useToast, EmptyState, Spinner, PageHeader, SearchInput } from '../components/ui'
import { Plus, Factory, Edit2, Trash2, ChevronDown, ChevronUp, Scissors, Shirt, CheckSquare, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const LOT_STATUSES = ['cutting', 'stitching', 'finishing', 'qc', 'completed']
const STAGES = ['cutting', 'stitching', 'finishing', 'qc']

const STATUS_COLORS = {
  cutting: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  stitching: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  finishing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  qc: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  pending: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

const STAGE_ICONS = { cutting: Scissors, stitching: Shirt, finishing: CheckSquare, qc: AlertTriangle }

const EMPTY_LOT = { lot_number: '', design_id: '', fabric_id: '', total_pieces: '', status: 'cutting', start_date: new Date().toISOString().split('T')[0], target_date: '', notes: '' }
const EMPTY_STAGE = { stage: 'cutting', party_id: '', pieces_in: '', pieces_out: '', pieces_rejected: '0', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' }

export default function ProductionPage() {
  const [lots, setLots] = useState([])
  const [designs, setDesigns] = useState([])
  const [fabrics, setFabrics] = useState([])
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [lotStages, setLotStages] = useState({})

  const [showLotModal, setShowLotModal] = useState(false)
  const [editLot, setEditLot] = useState(null)
  const [lotForm, setLotForm] = useState(EMPTY_LOT)

  const [showStageModal, setShowStageModal] = useState(false)
  const [stageLotId, setStageLotId] = useState(null)
  const [editStage, setEditStage] = useState(null)
  const [stageForm, setStageForm] = useState(EMPTY_STAGE)

  const [deleteLotId, setDeleteLotId] = useState(null)
  const [deleteStageId, setDeleteStageId] = useState(null)
  const [saving, setSaving] = useState(false)
  const { toasts, toast, dismiss } = useToast()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: l }, { data: d }, { data: f }, { data: p }, { data: s }] = await Promise.all([
      supabase.from('production_lots').select('*, designs(design_code, design_name), gray_fabrics(lot_number, fabric_name)').order('created_at', { ascending: false }),
      supabase.from('designs').select('id, design_code, design_name').order('design_code'),
      supabase.from('gray_fabrics').select('id, lot_number, fabric_name').order('lot_number'),
      supabase.from('parties').select('id, name, type').order('name'),
      supabase.from('production_stages').select('*, parties(name)').order('created_at'),
    ])
    setLots(l || [])
    setDesigns(d || [])
    setFabrics(f || [])
    setParties(p || [])
    const grouped = {}
    ;(s || []).forEach(item => {
      if (!grouped[item.lot_id]) grouped[item.lot_id] = []
      grouped[item.lot_id].push(item)
    })
    setLotStages(grouped)
    setLoading(false)
  }

  const fl = k => e => setLotForm(x => ({ ...x, [k]: e.target.value }))
  const fs = k => e => setStageForm(x => ({ ...x, [k]: e.target.value }))

  const openAddLot = () => { setLotForm(EMPTY_LOT); setEditLot(null); setShowLotModal(true) }
  const openEditLot = l => { setLotForm({ lot_number: l.lot_number, design_id: l.design_id || '', fabric_id: l.fabric_id || '', total_pieces: l.total_pieces, status: l.status, start_date: l.start_date || '', target_date: l.target_date || '', notes: l.notes || '' }); setEditLot(l); setShowLotModal(true) }

  const saveLot = async () => {
    if (!lotForm.lot_number || !lotForm.total_pieces) { toast.error('Lot number and total pieces are required.'); return }
    setSaving(true)
    const payload = { ...lotForm, design_id: lotForm.design_id || null, fabric_id: lotForm.fabric_id || null, total_pieces: parseInt(lotForm.total_pieces), target_date: lotForm.target_date || null }
    const { error } = editLot
      ? await supabase.from('production_lots').update(payload).eq('id', editLot.id)
      : await supabase.from('production_lots').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editLot ? 'Lot updated!' : 'Production lot created!'); setShowLotModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteLot = async () => {
    const { error } = await supabase.from('production_lots').delete().eq('id', deleteLotId)
    if (error) toast.error(error.message)
    else { toast.success('Lot deleted.'); fetchAll() }
    setDeleteLotId(null)
  }

  const openAddStage = lotId => { setStageForm(EMPTY_STAGE); setEditStage(null); setStageLotId(lotId); setShowStageModal(true) }
  const openEditStage = (lotId, s) => { setStageForm({ stage: s.stage, party_id: s.party_id || '', pieces_in: s.pieces_in || '', pieces_out: s.pieces_out || '', pieces_rejected: s.pieces_rejected || '0', start_date: s.start_date || '', end_date: s.end_date || '', notes: s.notes || '' }); setEditStage(s); setStageLotId(lotId); setShowStageModal(true) }

  const saveStage = async () => {
    if (!stageForm.stage) { toast.error('Stage is required.'); return }
    setSaving(true)
    const payload = { ...stageForm, lot_id: stageLotId, party_id: stageForm.party_id || null, pieces_in: stageForm.pieces_in || null, pieces_out: stageForm.pieces_out || null, pieces_rejected: parseInt(stageForm.pieces_rejected) || 0, end_date: stageForm.end_date || null }
    const { error } = editStage
      ? await supabase.from('production_stages').update(payload).eq('id', editStage.id)
      : await supabase.from('production_stages').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editStage ? 'Stage updated!' : 'Stage added!'); setShowStageModal(false); fetchAll() }
    setSaving(false)
  }

  const deleteStage = async () => {
    const { error } = await supabase.from('production_stages').delete().eq('id', deleteStageId)
    if (error) toast.error(error.message)
    else { toast.success('Stage deleted.'); fetchAll() }
    setDeleteStageId(null)
  }

  const filtered = lots
    .filter(l => statusFilter === 'all' || l.status === statusFilter)
    .filter(l => !search || l.lot_number.toLowerCase().includes(search.toLowerCase()) || l.designs?.design_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Toast toasts={toasts} dismiss={dismiss} />
      <PageHeader
        title="Production Tracking"
        subtitle="Track cutting → stitching → finishing with piece counts per lot"
        action={<button onClick={openAddLot} className="btn-primary"><Plus className="w-4 h-4" />New Production Lot</button>}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', ...LOT_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${statusFilter === s ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
            {s === 'all' ? `All (${lots.length})` : `${s} (${lots.filter(l => l.status === s).length})`}
          </button>
        ))}
      </div>
      <div className="card mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by lot number or design..." />
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState icon={Factory} title="No production lots" description="Create a production lot to start tracking cutting, stitching and finishing." action={<button onClick={openAddLot} className="btn-primary mx-auto"><Plus className="w-4 h-4" />New Lot</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(lot => {
            const stages = lotStages[lot.id] || []
            const stageMap = {}
            stages.forEach(s => { stageMap[s.stage] = s })
            return (
              <div key={lot.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Factory className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-brand-400 font-bold text-sm">{lot.lot_number}</span>
                        {lot.designs && <span className="text-slate-100 font-medium">{lot.designs.design_code} — {lot.designs.design_name}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[lot.status]}`}>{lot.status}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Total: <span className="text-slate-300 font-semibold">{lot.total_pieces} pcs</span></span>
                        {lot.gray_fabrics && <span>Fabric: {lot.gray_fabrics.lot_number}</span>}
                        {lot.start_date && <span>Started: {format(new Date(lot.start_date), 'dd MMM yyyy')}</span>}
                        {lot.target_date && <span className="text-amber-400">Target: {format(new Date(lot.target_date), 'dd MMM yyyy')}</span>}
                      </div>
                      {/* Stage progress pills */}
                      <div className="flex items-center gap-2 mt-2">
                        {STAGES.map(stage => {
                          const StageIcon = STAGE_ICONS[stage]
                          const hasStage = !!stageMap[stage]
                          return (
                            <div key={stage} className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${hasStage ? STATUS_COLORS[stage] : 'bg-slate-800 text-slate-600 border-slate-700'}`}>
                              <StageIcon className="w-3 h-3" />
                              <span className="capitalize">{stage}</span>
                              {hasStage && stageMap[stage].pieces_out && <span className="font-semibold ml-1">{stageMap[stage].pieces_out}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => openEditLot(lot)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteLotId(lot.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setExpandedId(expandedId === lot.id ? null : lot.id)} className="btn-ghost p-1.5 text-slate-400 ml-1">
                      {expandedId === lot.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === lot.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-300">Production Stages</h4>
                      <button onClick={() => openAddStage(lot.id)} className="btn-secondary text-xs py-1 px-3"><Plus className="w-3 h-3" />Add Stage</button>
                    </div>
                    {stages.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-4">No stages logged. Click "Add Stage" to track cutting, stitching, or finishing.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr>
                            <th className="table-head">Stage</th><th className="table-head">Party</th>
                            <th className="table-head">Pieces In</th><th className="table-head">Pieces Out</th>
                            <th className="table-head">Rejected</th><th className="table-head">Start</th>
                            <th className="table-head">End</th><th className="table-head">Notes</th>
                            <th className="table-head">Actions</th>
                          </tr></thead>
                          <tbody>
                            {stages.map(s => (
                              <tr key={s.id} className="hover:bg-slate-700/20 transition-colors group">
                                <td className="table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[s.stage]}`}>{s.stage}</span></td>
                                <td className="table-cell text-slate-300">{s.parties?.name || '—'}</td>
                                <td className="table-cell font-semibold">{s.pieces_in || '—'}</td>
                                <td className="table-cell font-semibold text-emerald-400">{s.pieces_out || '—'}</td>
                                <td className="table-cell text-red-400">{s.pieces_rejected || 0}</td>
                                <td className="table-cell text-slate-400 text-xs">{s.start_date ? format(new Date(s.start_date), 'dd MMM') : '—'}</td>
                                <td className="table-cell text-slate-400 text-xs">{s.end_date ? format(new Date(s.end_date), 'dd MMM') : '—'}</td>
                                <td className="table-cell text-slate-400 max-w-[100px] truncate">{s.notes || '—'}</td>
                                <td className="table-cell">
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditStage(lot.id, s)} className="btn-ghost p-1.5 text-slate-400"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => setDeleteStageId(s.id)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
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

      {showLotModal && (
        <Modal title={editLot ? 'Edit Production Lot' : 'New Production Lot'} onClose={() => setShowLotModal(false)} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Lot Number *</label><input className="input" placeholder="e.g. PL-2024-001" value={lotForm.lot_number} onChange={fl('lot_number')} /></div>
              <div><label className="label">Total Pieces *</label><input className="input" type="number" min="1" placeholder="0" value={lotForm.total_pieces} onChange={fl('total_pieces')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Design</label><select className="input" value={lotForm.design_id} onChange={fl('design_id')}><option value="">Select design...</option>{designs.map(d => <option key={d.id} value={d.id}>{d.design_code} — {d.design_name}</option>)}</select></div>
              <div><label className="label">Gray Fabric</label><select className="input" value={lotForm.fabric_id} onChange={fl('fabric_id')}><option value="">Select fabric...</option>{fabrics.map(f => <option key={f.id} value={f.id}>{f.lot_number} — {f.fabric_name}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Status</label><select className="input" value={lotForm.status} onChange={fl('status')}>{LOT_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
              <div><label className="label">Start Date</label><input className="input" type="date" value={lotForm.start_date} onChange={fl('start_date')} /></div>
              <div><label className="label">Target Date</label><input className="input" type="date" value={lotForm.target_date} onChange={fl('target_date')} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={lotForm.notes} onChange={fl('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowLotModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveLot} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editLot ? 'Update' : 'Create Lot'}</button>
            </div>
          </div>
        </Modal>
      )}

      {showStageModal && (
        <Modal title={editStage ? 'Edit Stage' : 'Add Production Stage'} onClose={() => setShowStageModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Stage *</label><select className="input" value={stageForm.stage} onChange={fs('stage')}>{STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
              <div><label className="label">Outsource Party</label><select className="input" value={stageForm.party_id} onChange={fs('party_id')}><option value="">In-house</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Pieces In</label><input className="input" type="number" min="0" placeholder="0" value={stageForm.pieces_in} onChange={fs('pieces_in')} /></div>
              <div><label className="label">Pieces Out</label><input className="input" type="number" min="0" placeholder="0" value={stageForm.pieces_out} onChange={fs('pieces_out')} /></div>
              <div><label className="label">Rejected</label><input className="input" type="number" min="0" placeholder="0" value={stageForm.pieces_rejected} onChange={fs('pieces_rejected')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Start Date</label><input className="input" type="date" value={stageForm.start_date} onChange={fs('start_date')} /></div>
              <div><label className="label">End Date</label><input className="input" type="date" value={stageForm.end_date} onChange={fs('end_date')} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={stageForm.notes} onChange={fs('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowStageModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveStage} disabled={saving} className="btn-primary">{saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editStage ? 'Update' : 'Add Stage'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteLotId && <ConfirmDialog title="Delete Production Lot?" message="All stages for this lot will be deleted." danger onConfirm={deleteLot} onCancel={() => setDeleteLotId(null)} />}
      {deleteStageId && <ConfirmDialog title="Delete Stage?" message="This stage record will be permanently removed." danger onConfirm={deleteStage} onCancel={() => setDeleteStageId(null)} />}
    </div>
  )
}
