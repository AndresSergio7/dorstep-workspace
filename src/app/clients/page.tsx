'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Building2, Mail, Search, X } from 'lucide-react'

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients(data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [clients, search])

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="text-slate-500 text-sm mt-1">{clients.length} clientes registrados</p>
          </div>
          <Link href="/clients/new" className="btn-primary flex items-center gap-2"><Plus size={16} />Nuevo cliente</Link>
        </div>

        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="input pl-9 pr-9 text-sm w-full"
            placeholder="Buscar por nombre, empresa o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm py-8">Cargando clientes...</div>
        ) : !filtered.length ? (
          <div className="card text-center py-16">
            <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{search ? 'Sin resultados' : 'Sin clientes aún'}</p>
            {!search && <Link href="/clients/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus size={16} />Nuevo cliente</Link>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((client: any) => (
              <Link key={client.id} href={`/clients/${client.id}`} className="card hover:shadow-md transition-all hover:border-blue-200 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#0f1f3d] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">{client.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{client.name}</p>
                    {client.company && <p className="text-sm text-slate-500 flex items-center gap-1"><Building2 size={12} />{client.company}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-sm">
                  {client.email && <span className="flex items-center gap-1"><Mail size={13} />{client.email}</span>}
                  {client.tags?.length > 0 && <div className="flex gap-1">{client.tags.slice(0, 2).map((tag: string) => <span key={tag} className="badge bg-blue-50 text-blue-600">{tag}</span>)}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
