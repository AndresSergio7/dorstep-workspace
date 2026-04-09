'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, CalendarDays, Search, X, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function MeetingsPage() {
  const supabase = createClient()
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState('')

  useEffect(() => {
    supabase
      .from('meetings')
      .select('*, client:clients(id, name, company)')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setMeetings(data ?? [])
        setLoading(false)
      })
  }, [])

  const clientOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { id: string; name: string }[] = []
    for (const m of meetings) {
      if (m.client && !seen.has(m.client.id)) {
        seen.add(m.client.id)
        opts.push({ id: m.client.id, name: m.client.name })
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name))
  }, [meetings])

  const filtered = useMemo(() => {
    let result = meetings
    if (selectedClient) result = result.filter(m => m.client?.id === selectedClient)
    const q = search.trim().toLowerCase()
    if (q) result = result.filter(m => m.title?.toLowerCase().includes(q) || m.client?.name?.toLowerCase().includes(q))
    return result
  }, [meetings, selectedClient, search])

  const clearFilters = () => { setSearch(''); setSelectedClient('') }
  const hasFilter = search || selectedClient

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Reuniones</h1>
            <p className="text-slate-500 text-sm mt-1">{meetings.length} reuniones</p>
          </div>
          <Link href="/meetings/new" className="btn-primary flex items-center gap-2"><Plus size={16} />Nueva reunión</Link>
        </div>

        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              className="input pl-9 pr-9 text-sm w-full"
              placeholder="Buscar por título o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative min-w-[200px]">
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="input text-sm pr-8 appearance-none w-full"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {clientOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="btn-secondary text-sm flex items-center gap-1.5 whitespace-nowrap">
              <X size={13} />Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm py-8">Cargando reuniones...</div>
        ) : !filtered.length ? (
          <div className="card text-center py-16">
            <CalendarDays size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{hasFilter ? 'Sin resultados' : 'Sin reuniones'}</p>
            {!hasFilter && <Link href="/meetings/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus size={16} />Nueva reunión</Link>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m: any) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="card hover:shadow-md transition-all hover:border-blue-200 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays size={18} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{m.title}</p>
                    <p className="text-sm text-slate-500">{m.client?.name ?? 'Sin cliente'}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{format(new Date(m.date), 'd MMM yyyy', { locale: es })}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
