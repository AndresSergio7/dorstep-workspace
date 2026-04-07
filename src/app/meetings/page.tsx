'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, CalendarDays, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type MeetingRow = {
  id: string
  title: string
  date: string
  client_id: string | null
  client: { name: string; company: string | null } | null
}

export default function MeetingsPage() {
  const supabase = createClient()
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [mRes, cRes] = await Promise.all([
        supabase.from('meetings').select('id, title, date, client_id, client:clients(name, company)').order('date', { ascending: false }),
        supabase.from('clients').select('id, name').order('name'),
      ])
      if (cancelled) return
      setMeetings((mRes.data as MeetingRow[]) ?? [])
      setClients(cRes.data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!clientFilter) return meetings
    return meetings.filter(m => m.client_id === clientFilter)
  }, [meetings, clientFilter])

  if (loading) {
    return (
      <AppLayout>
        <div className="text-slate-400 p-8">Cargando reuniones...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Reuniones</h1>
            <p className="text-slate-500 text-sm mt-1">
              {filtered.length === meetings.length
                ? `${meetings.length} reuniones`
                : `${filtered.length} de ${meetings.length} reuniones (filtro activo)`}
            </p>
          </div>
          <Link href="/meetings/new" className="btn-primary flex items-center justify-center gap-2 shrink-0">
            <Plus size={16} />Nueva reunión
          </Link>
        </div>

        <div className="card mb-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label flex items-center gap-1.5">
              <Building2 size={12} className="text-slate-400" />
              Filtrar por cliente
            </label>
            <select
              className="input bg-white"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {clientFilter && (
            <button type="button" className="btn-secondary text-sm py-2 self-start sm:self-auto" onClick={() => setClientFilter('')}>
              Quitar filtro
            </button>
          )}
        </div>

        {!meetings.length ? (
          <div className="card text-center py-16">
            <CalendarDays size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sin reuniones</p>
            <Link href="/meetings/new" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={16} />Nueva reunión
            </Link>
          </div>
        ) : !filtered.length ? (
          <div className="card text-center py-12">
            <p className="text-slate-500 font-medium">No hay reuniones para este cliente</p>
            <button type="button" className="btn-secondary mt-4" onClick={() => setClientFilter('')}>
              Ver todas las reuniones
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(m => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="card hover:shadow-md transition-all hover:border-blue-200 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays size={18} className="text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">{m.title}</p>
                    <p className="text-sm text-slate-500 truncate">{m.client?.name ?? 'Sin cliente'}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 flex-shrink-0 ml-3">{format(new Date(m.date), 'd MMM yyyy', { locale: es })}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
