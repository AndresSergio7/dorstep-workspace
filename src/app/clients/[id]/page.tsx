import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus, CalendarDays, Lightbulb, CheckSquare, Building2, Mail, Phone, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: client }, { data: meetings }, { data: problems }, { data: pending }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('meetings').select('*').eq('client_id', id).order('date', { ascending: false }),
    supabase.from('problems').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('action_items').select('*').eq('client_id', id).eq('done', false),
  ])
  if (!client) notFound()
  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Clientes</Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#0f1f3d] flex items-center justify-center">
                <span className="text-white font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="page-title">{client.name}</h1>
                {client.company && <p className="text-slate-500 text-sm flex items-center gap-1"><Building2 size={12} />{client.company}</p>}
              </div>
            </div>
          </div>
          <Link href={`/clients/${client.id}/edit`} className="btn-secondary">Editar</Link>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-5">
            <div className="card space-y-3">
              <h2 className="section-title">Contacto</h2>
              {client.contact_email && <p className="text-sm flex items-center gap-2 text-slate-600"><Mail size={14} className="text-slate-400" />{client.contact_email}</p>}
              {client.contact_phone && <p className="text-sm flex items-center gap-2 text-slate-600"><Phone size={14} className="text-slate-400" />{client.contact_phone}</p>}
              {client.tags?.length > 0 && <div className="flex flex-wrap gap-1">{client.tags.map((tag: string) => <span key={tag} className="badge bg-blue-50 text-blue-600"><Tag size={10} className="mr-1" />{tag}</span>)}</div>}
              {client.notes && <div className="pt-2 border-t border-slate-100"><p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Notas</p><p className="text-sm text-slate-600 whitespace-pre-wrap">{client.notes}</p></div>}
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><CheckSquare size={14} className="text-amber-500" /><h2 className="section-title">Pendientes ({pending?.length ?? 0})</h2></div>
              {!pending?.length ? <p className="text-slate-400 text-sm">Sin pendientes 🎉</p> : <ul className="space-y-2">{pending.map((item: any) => <li key={item.id} className="flex items-start gap-2 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" /><p className="text-slate-600">{item.text}</p></li>)}</ul>}
            </div>
          </div>
          <div className="col-span-2 space-y-5">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><CalendarDays size={15} className="text-teal-500" /><h2 className="section-title">Reuniones ({meetings?.length ?? 0})</h2></div>
                <Link href={`/meetings/new?client=${client.id}`} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"><Plus size={13} />Nueva</Link>
              </div>
              {!meetings?.length ? <p className="text-slate-400 text-sm py-4 text-center">Sin reuniones</p> : (
                <div className="space-y-2">{meetings.map((m: any) => (
                  <Link key={m.id} href={`/meetings/${m.id}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                    <p className="text-sm font-medium text-slate-700">{m.title}</p>
                    <p className="text-xs text-slate-400">{format(new Date(m.date), 'd MMM yyyy', { locale: es })}</p>
                  </Link>
                ))}</div>
              )}
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Lightbulb size={15} className="text-amber-500" /><h2 className="section-title">Problemas ({problems?.length ?? 0})</h2></div>
                <Link href={`/problems/new?client=${client.id}`} className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"><Plus size={13} />Registrar</Link>
              </div>
              {!problems?.length ? <p className="text-slate-400 text-sm py-4 text-center">Sin problemas</p> : (
                <div className="space-y-2">{problems.map((p: any) => (
                  <Link key={p.id} href={`/problems/${p.id}`} className="block p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <p className="text-sm font-medium text-slate-700">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.description}</p>
                  </Link>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
