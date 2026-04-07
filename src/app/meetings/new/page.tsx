'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { dbFieldsForStatus } from '@/lib/action-items'

function NewMeetingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<any[]>([])
  const [actionItems, setActionItems] = useState<string[]>([''])
  const [form, setForm] = useState({ client_id: searchParams.get('client') ?? '', title: '', date: new Date().toISOString().split('T')[0], attendees: '', content: '' })

  useEffect(() => { supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients(data ?? [])) }, [])
  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }
  function setItem(i: number, v: string) { setActionItems(prev => prev.map((x, j) => j === i ? v : x)) }
  function addItem() { setActionItems(prev => [...prev, '']) }
  function removeItem(i: number) { setActionItems(prev => prev.filter((_, j) => j !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data: meeting, error: insertError } = await supabase.from('meetings').insert({ 
        client_id: form.client_id || null, 
        title: form.title.trim(), 
        date: form.date, 
        attendees: form.attendees.trim() || null, 
        content: form.content.trim() || null 
      }).select().single()
      
      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
      
      if (!meeting) {
        setError('No se pudo crear la reunión. Verifica las políticas RLS en Supabase.')
        setLoading(false)
        return
      }
      
      const items = actionItems.filter(t => t.trim())
      if (items.length) {
        const { error: itemsError } = await supabase.from('action_items').insert(
          items.map(text => ({
            meeting_id: meeting.id,
            client_id: form.client_id || null,
            text: text.trim(),
            ...dbFieldsForStatus('todo'),
          })),
        )
        if (itemsError) {
          console.error('Error al guardar pendientes:', itemsError)
        }
      }
      router.push(`/meetings/${meeting.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al crear la reunión')
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8"><Link href="/meetings" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Volver</Link><h1 className="page-title">Nueva reunión</h1></div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3" role="alert">
              {error}
            </div>
          )}
          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Título *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Revisión mensual" /></div>
              <div><label className="label">Cliente</label><select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label">Fecha *</label><input className="input" type="date" required value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Asistentes</label><input className="input" value={form.attendees} onChange={e => set('attendees', e.target.value)} placeholder="Sergio, Carlos, Ana" /></div>
            </div>
          </div>
          <div className="card"><label className="label">Notas de la reunión</label><textarea className="input min-h-[160px] resize-y mt-1.5" value={form.content} onChange={e => set('content', e.target.value)} placeholder="Puntos tratados, decisiones..." /></div>
          <div className="card space-y-3">
            <div className="flex items-center justify-between"><label className="label">Pendientes</label><button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={13} />Agregar</button></div>
            {actionItems.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input className="input" value={item} onChange={e => setItem(idx, e.target.value)} placeholder={`Pendiente ${idx + 1}`} />
                {actionItems.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
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
