'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { LayoutList, GripVertical, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dbFieldsForStatus, statusFromRow, type TaskStatus } from '@/lib/action-items'

type Row = {
  id: string
  text: string
  status?: string | null
  done?: boolean
  meeting_id: string | null
  client_id: string | null
  due_date?: string | null
  priority?: string | null
  created_at: string
  client: { name: string } | null
  meeting: { id: string; title: string; date: string } | null
}

const COLUMNS: { status: TaskStatus; title: string; className: string }[] = [
  { status: 'todo',        title: 'To Do',       className: 'border-slate-200 bg-slate-50/80' },
  { status: 'in_progress', title: 'In progress',  className: 'border-amber-200 bg-amber-50/50' },
  { status: 'done',        title: 'Done',          className: 'border-emerald-200 bg-emerald-50/50' },
]

export default function TasksPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPriority, setNewPriority] = useState<'baja' | 'media' | 'alta'>('media')
  const [newClientId, setNewClientId] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    const [{ data, error }, { data: clientData }] = await Promise.all([
      supabase
        .from('action_items')
        .select('id, text, status, done, meeting_id, client_id, due_date, priority, created_at, client:clients(name), meeting:meetings(id, title, date)')
        .order('created_at', { ascending: true }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    if (error) {
      setLoadError(error.message)
      setItems([])
    } else {
      setItems((data as unknown as Row[]) ?? [])
    }
    setClients(clientData ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Row[]> = { todo: [], in_progress: [], done: [] }
    for (const row of items) map[statusFromRow(row)].push(row)
    return map
  }, [items])

  async function addTask() {
    if (!newText.trim()) return
    setAdding(true)
    const fields = dbFieldsForStatus('todo')
    const { data, error } = await supabase
      .from('action_items')
      .insert({ text: newText.trim(), meeting_id: null, client_id: newClientId || null, due_date: newDate || null, priority: newPriority, ...fields })
      .select('id, text, status, done, meeting_id, client_id, created_at, due_date, priority, client:clients(name), meeting:meetings(id, title, date)')
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as unknown as Row])
      setNewText('')
      setNewDate('')
      setNewPriority('media')
      setNewClientId('')
      setShowForm(false)
    }
    setAdding(false)
  }

  async function deleteTask(id: string) {
    await supabase.from('action_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function moveToStatus(itemId: string, status: TaskStatus) {
    const row = items.find(i => i.id === itemId)
    if (!row || statusFromRow(row) === status) return
    const fields = dbFieldsForStatus(status)
    const { error } = await supabase.from('action_items').update(fields).eq('id', itemId)
    if (!error) setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...fields } : i))
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragEnd() { setDragId(null) }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  async function onDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    if (id) await moveToStatus(id, status)
    setDragId(null)
  }

  if (loading) return <AppLayout><div className="text-slate-400 p-8">Cargando tareas...</div></AppLayout>

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0f1f3d] text-white">
              <LayoutList size={20} />
            </div>
            <div>
              <h1 className="page-title">Tareas</h1>
              <p className="text-slate-500 text-sm mt-0.5">Arrastra entre columnas para cambiar estado</p>
            </div>
          </div>
        </div>

        {/* Create task button + expandable form */}
        <div className="mt-5 mb-6">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4">
              <Plus size={14} />Nueva tarea
            </button>
          ) : (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
              <textarea
                className="input text-sm w-full resize-none"
                placeholder="Descripción de la tarea..."
                rows={3}
                value={newText}
                onChange={e => setNewText(e.target.value)}
                disabled={adding}
                autoFocus
              />
              <div className="flex gap-3 flex-wrap">
                <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-slate-500">Cliente</label>
                  <select className="input text-sm" value={newClientId} onChange={e => setNewClientId(e.target.value)} disabled={adding}>
                    <option value="">Sin cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-slate-500">Fecha límite</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    disabled={adding}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Prioridad</label>
                  <div className="flex gap-1.5">
                    {(['baja', 'media', 'alta'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewPriority(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                          newPriority === p
                            ? p === 'baja' ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : p === 'media' ? 'bg-amber-100 border-amber-300 text-amber-800'
                              : 'bg-red-100 border-red-300 text-red-800'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {p === 'baja' ? 'Baja' : p === 'media' ? 'Media' : 'Alta'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={addTask} disabled={adding || !newText.trim()} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4 disabled:opacity-50">
                  <Plus size={14} />Agregar
                </button>
                <button onClick={() => { setShowForm(false); setNewText(''); setNewDate(''); setNewPriority('media') }} className="btn-secondary text-sm py-2 px-4">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
            <p className="font-medium">No se pudieron cargar las tareas</p>
            <p className="mt-1 text-amber-800/90">{loadError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(col => (
            <div
              key={col.status}
              onDragOver={onDragOver}
              onDrop={e => onDrop(e, col.status)}
              className={`rounded-xl border-2 border-dashed min-h-[280px] p-3 flex flex-col ${col.className}`}
            >
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 px-1">
                {col.title}
                <span className="ml-1.5 font-semibold text-slate-400">({byColumn[col.status].length})</span>
              </h2>
              <div className="space-y-2 flex-1">
                {byColumn[col.status].map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => onDragStart(e, item.id)}
                    onDragEnd={onDragEnd}
                    className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors group ${
                      dragId === item.id ? 'opacity-60 ring-2 ring-blue-400 ring-offset-1' : ''
                    }`}
                  >
                    <div className="flex gap-2">
                      <GripVertical size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 leading-snug">{item.text}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                          {item.priority && (
                            <span className={`px-1.5 py-0.5 rounded font-medium ${
                              item.priority === 'alta' ? 'bg-red-100 text-red-700'
                              : item.priority === 'media' ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.priority === 'alta' ? 'Alta' : item.priority === 'media' ? 'Media' : 'Baja'}
                            </span>
                          )}
                          {item.due_date && (
                            <span className="text-slate-500">{format(new Date(item.due_date + 'T00:00:00'), 'd MMM yyyy', { locale: es })}</span>
                          )}
                          {item.client?.name && <span>{item.client.name}</span>}
                          {item.meeting && (
                            <Link href={`/meetings/${item.meeting.id}`} className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                              {item.meeting.title}<ExternalLink size={10} className="opacity-70" />
                            </Link>
                          )}
                          {item.meeting?.date && (
                            <span>· {format(new Date(item.meeting.date), 'd MMM yyyy', { locale: es })}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
