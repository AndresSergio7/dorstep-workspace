import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, CalendarDays, Lightbulb, BarChart3, CheckSquare, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()
  const [
    { count: clientsCount },
    { count: meetingsCount },
    { count: problemsCount },
    { count: reportsCount },
    { data: pendingItems },
    { data: recentMeetings },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('meetings').select('*', { count: 'exact', head: true }),
    supabase.from('problems').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('action_items').select('*, client:clients(name)').eq('done', false).order('created_at', { ascending: false }).limit(5),
    supabase.from('meetings').select('*, client:clients(name)').order('date', { ascending: false }).limit(4),
  ])

  const stats = [
    { label: 'Clientes', value: clientsCount ?? 0, icon: Users, href: '/clients', color: 'bg-blue-50 text-blue-600' },
    { label: 'Reuniones', value: meetingsCount ?? 0, icon: CalendarDays, href: '/meetings', color: 'bg-teal-50 text-teal-600' },
    { label: 'Problemas', value: problemsCount ?? 0, icon: Lightbulb, href: '/problems', color: 'bg-amber-50 text-amber-600' },
    { label: 'Reportes', value: reportsCount ?? 0, icon: BarChart3, href: '/reports', color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="page-title">Buenos días 👋</h1>
          <p className="text-slate-500 text-sm mt-1">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, href, color }) => (
            <Link key={href} href={href} className="card hover:shadow-md transition-shadow">
              <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}><Icon size={18} /></div>
              <p className="text-2xl font-bold text-[#0f1f3d]">{value}</p>
              <p className="text-slate-500 text-sm">{label}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><CheckSquare size={16} className="text-slate-400" /><h2 className="font-semibold text-slate-700">Pendientes</h2></div>
              <Link href="/tasks" className="text-xs text-blue-600 hover:underline">Ver tablero</Link>
            </div>
            {!pendingItems?.length ? (
              <p className="text-slate-400 text-sm py-4 text-center">Sin pendientes 🎉</p>
            ) : (
              <ul className="space-y-2">
                {pendingItems.map((item: any) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <div><p className="text-slate-700">{item.text}</p>{item.client && <p className="text-xs text-slate-400">{item.client.name}</p>}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Clock size={16} className="text-slate-400" /><h2 className="font-semibold text-slate-700">Reuniones recientes</h2></div>
              <Link href="/meetings" className="text-xs text-blue-600 hover:underline">Ver todo</Link>
            </div>
            {!recentMeetings?.length ? (
              <p className="text-slate-400 text-sm py-4 text-center">Sin reuniones aún</p>
            ) : (
              <ul className="space-y-3">
                {recentMeetings.map((m: any) => (
                  <li key={m.id}>
                    <Link href={`/meetings/${m.id}`} className="block hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                      <p className="text-sm font-medium text-slate-700">{m.title}</p>
                      <p className="text-xs text-slate-400">{m.client?.name ?? 'Sin cliente'} · {format(new Date(m.date), 'd MMM yyyy', { locale: es })}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
