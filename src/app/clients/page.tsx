import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, Mail, Phone } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from('clients').select('*').order('name')
  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="text-slate-500 text-sm mt-1">{clients?.length ?? 0} clientes registrados</p>
          </div>
          <Link href="/clients/new" className="btn-primary flex items-center gap-2"><Plus size={16} />Nuevo cliente</Link>
        </div>
        {!clients?.length ? (
          <div className="card text-center py-16">
            <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sin clientes aún</p>
            <Link href="/clients/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus size={16} />Nuevo cliente</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {clients.map((client: any) => (
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
                  {client.contact_email && <span className="flex items-center gap-1"><Mail size={13} />{client.contact_email}</span>}
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
