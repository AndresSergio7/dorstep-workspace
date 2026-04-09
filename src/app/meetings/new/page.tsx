'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

function NewMeetingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  type PendingItem = { text: string; due_date: string; priority: 'baja' | 'media' | 'alta' }
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<PendingItem[]>([{ text: '', due_date: '', priority: 'media' }])
  const [form, setForm] = useState({ client_id: searchParams.get('client') ?? '', title: '', date: new Date().toISOString().split('T')[0], attendees: '', content: '' })

  useEffect(() => { supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients(data ?? [])) }, [])
  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }
  function setItemField<K extends keyof PendingItem>(i: number, field: K, v: PendingItem[K]) {
    setActionItems(prev => prev.map((x, j) => j === i ? { ...x, [field]: v } : x))
  }
  function addItem() { setActionItems(prev => [...prev, { text: '', due_date: '', priority: 'media' }]) }
  function removeItem(i: number) { setActionItems(prev => prev.filter((_, j) => j !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: meeting, error } = await supabase.from('meetings').insert({ client_id: form.client_id || null, title: form.title, date: form.date, attendees: form.attendees || null, content: form.content || null }).select().single()
    if (!error && meeting) {
      const items = actionItems.filter(t => t.text.trim())
      if (items.length) await supabase.from('action_items').insert(items.map(({ text, due_date, priority }) => ({ meeting_id: meeting.id, client_id: form.client_id || null, text: text.trim(), due_date: due_date || null, priority })))
      router.push(`/meetings/${meeting.id}`)
    }
    setLoading(false)
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8"><Link href="/meetings" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Volver</Link><h1 className="page-title">Nueva reunión</h1></div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Título *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Revisión mensual" /></div>
              <div><label className="label">Cliente</label><select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label">Fecha *</label><input className="input" type="date" required value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Asistentes</label><input className="input" value={form.attendees} onChange={e => set('attendees', e.target.value)} placeholder="Sergio, Carlos, Ana" /></div>
            </div>
          </div>
          <div className="card"><label className="label">Notas de la reunión</label><textarea className="input min-h-[160px] resize-y mt-1.5" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Puntos tratados, decisiones..." /></div>
          <div className="card space-y-4">
            <div className="flex items-center justify-between"><label className="label">Pendientes</label><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={13} />Agregar</button></div>
            {actionItems.map((item, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/60">
                <div className="flex gap-2">
                  <input className="input text-sm flex-1" value={item.text} onChange={e => setItemField(idx, 'text', e.target.value)} placeholder={`Pendiente ${idx + 1}`} />
                  {actionItems.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 size={15} /></button>}
                </div>
                <div className="flex gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                    <label className="text-xs font-medium text-slate-500">Fecha límite</label>
                    <input type="date" className="input text-sm" value={item.due_date} onChange={e => setItemField(idx, 'due_date', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Prioridad</label>
                    <div className="flex gap-1.5">
                      {(['baja', 'media', 'alta'] as const).map(p => (
                        <button key={p} type="button" onClick={() => setItemField(idx, 'priority', p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            item.priority === p
                              ? p === 'baja' ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : p === 'media' ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-red-100 border-red-300 text-red-800'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                          {p === 'baja' ? 'Baja' : p === 'media' ? 'Media' : 'Alta'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Link href="/meetings" className="btn-secondary">Cancelar</Link>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Crear reunión'}</button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default function NewMeetingPage() { return <Suspense><NewMeetingForm /></Suspense> }
