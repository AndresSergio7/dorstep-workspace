import AppLayout from '@/components/layout/AppLayout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import KickoffFormEditor from '@/components/clients/KickoffFormEditor'
import { ArrowLeft } from 'lucide-react'

export default async function KickoffDetailPage({ params }: { params: Promise<{ id: string; kickoffId: string }> }) {
  const { id, kickoffId } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: kickoff }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('id', id).single(),
    supabase.from('kickoff_forms').select('*').eq('id', kickoffId).eq('client_id', id).single(),
  ])
  if (!client || !kickoff) notFound()

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-5">
        <Link href={`/clients/${id}`} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Volver al cliente
        </Link>
        <KickoffFormEditor client={client} initialKickoff={kickoff} />
      </div>
    </AppLayout>
  )
}
