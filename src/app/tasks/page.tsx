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
  const [dragId, setDragId] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    const { data, error } = await supabase
      .from('action_items')
      .select('id, text, status, done, meeting_id, client_id, created_at, client:clients(name), meeting:meetings(id, title, date)')
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message)
      setItems([])
    } else {
      setItems((data as unknown as Row[]) ?? [])
    }
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
      .insert({ text: newText.trim(), meeting_id: null, client_id: null, ...fields })
      .select('id, text, status, done, meeting_id, client_id, created_at, client:clients(name), meeting:meetings(id, title, date)')
      .single()
    if (!error && data) {
      setItems(prev => [...prev, data as unknown as Row])
      setNewText('')
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

        {/* Create task input — same format as meetings */}
        <div className="flex gap-2 mt-5 mb-6">
          <input
            className="input text-sm flex-1"
            placeholder="Nueva tarea..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTask())}
            disabled={adding}
          />
          <button
            onClick={addTask}
            disabled={adding || !newText.trim()}
            className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3 whitespace-nowrap disabled:opacity-50"
          >
            <Plus size={14} />Agregar
          </button>
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
