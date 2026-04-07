'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Check, Building2, Calendar, Users } from 'lucide-react'
import { dbFieldsForStatus } from '@/lib/action-items'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [meeting, setMeeting] = useState<any>(null)
  const [actionItems, setActionItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')

  async function load() {
    const [{ data: m }, { data: items }] = await Promise.all([
      supabase.from('meetings').select('*, client:clients(id, name, company)').eq('id', id).single(),
      supabase.from('action_items').select('*').eq('meeting_id', id).order('created_at'),
    ])
    if (m) { setMeeting(m); setContent(m.content ?? '') }
    setActionItems(items ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveContent() {
    await supabase.from('meetings').update({ content }).eq('id', id)
    setEditing(false)
  }

  async function addItem() {
    if (!newItem.trim()) return
    const { data } = await supabase.from('action_items').insert({
      meeting_id: id,
      client_id: meeting?.client?.id ?? null,
      text: newItem.trim(),
      ...dbFieldsForStatus('todo'),
    }).select().single()
    if (data) { setActionItems(prev => [...prev, data]); setNewItem('') }
  }

  async function toggleItem(itemId: string, done: boolean) {
    const next = dbFieldsForStatus(!done ? 'done' : 'todo')
    await supabase.from('action_items').update(next).eq('id', itemId)
    setActionItems(prev => prev.map(i => (i.id === itemId ? { ...i, ...next } : i)))
  }

  async function deleteItem(itemId: string) {
    await supabase.from('action_items').delete().eq('id', itemId)
    setActionItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function deleteMeeting() {
    if (!confirm('¿Eliminar esta reunión?')) return
    await supabase.from('meetings').delete().eq('id', id)
    router.push('/meetings')
  }

  if (loading) return <AppLayout><div className="text-slate-400 p-8">Cargando...</div></AppLayout>
  if (!meeting) return <AppLayout><div className="text-slate-400 p-8">No encontrada</div></AppLayout>

  const done = actionItems.filter(i => i.done).length
  const total = actionItems.length

  return (
    <AppLayout>
      <div className="max-w-3xl">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/meetings" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Reuniones</Link>
            <div>
              <h1 className="page-title">{meeting.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Calendar size={13} />{format(new Date(meeting.date), 'd MMMM yyyy', { locale: es })}</span>
                {meeting.client && <Link href={`/clients/${meeting.client.id}`} className="flex items-center gap-1 hover:text-blue-600"><Building2 size={13} />{meeting.client.name}</Link>}
                {meeting.attendees && <span className="flex items-center gap-1"><Users size={13} />{meeting.attendees}</span>}
              </div>
            </div>
          </div>
          <button onClick={deleteMeeting} className="btn-danger flex items-center gap-2"><Trash2 size={15} />Eliminar</button>
        </div>
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Notas</h2>
              {!editing
                ? <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Editar</button>
                : <div className="flex gap-2"><button onClick={() => setEditing(false)} className="text-xs text-slate-400">Cancelar</button><button onClick={saveContent} className="text-xs text-blue-600 font-medium">Guardar</button></div>
              }
            </div>
            {editing
              ? <textarea className="input min-h-[200px] resize-y w-full" value={content} onChange={e => setContent(e.target.value)} autoFocus />
              : <div className="min-h-[80px]">{content ? <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{content}</p> : <p className="text-slate-400 text-sm italic">Sin notas. Haz clic en Editar para agregar.</p>}</div>
            }
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="section-title">Pendientes</h2>{total > 0 && <p className="text-xs text-slate-400 mt-0.5">{done} de {total} completados</p>}</div>
            </div>
            {total > 0 && <div className="h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden"><div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${(done/total)*100}%` }} /></div>}
            <ul className="space-y-2 mb-4">
              {actionItems.map(item => (
                <li key={item.id} className="flex items-center gap-3 group">
                  <button onClick={() => toggleItem(item.id, item.done)} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300 hover:border-teal-400'}`}>
                    {item.done && <Check size={11} />}
                  </button>
                  <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <input className="input text-sm" placeholder="Agregar pendiente..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())} />
              <button onClick={addItem} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3 whitespace-nowrap"><Plus size={14} />Agregar</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
