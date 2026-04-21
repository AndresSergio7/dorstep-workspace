import AppLayout from '@/components/layout/AppLayout'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import KickoffFormEditor from '@/components/clients/KickoffFormEditor'
import { ArrowLeft } from 'lucide-react'

export default async function NewKickoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('id, name').eq('id', id).single()
  if (!client) notFound()

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-5">
        <Link href={`/clients/${id}`} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Volver al cliente
        </Link>
        <KickoffFormEditor client={client} />
      </div>
    </AppLayout>
  )
}
