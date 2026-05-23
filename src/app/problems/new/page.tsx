'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function NewProblemForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [form, setForm] = useState({ client_id: searchParams.get('client') ?? '', title: '', description: '', solution: '', tags: '' })

  useEffect(() => { supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients(data ?? [])) }, [])
  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { data, error } = await supabase.from('problems').insert({
      client_id: form.client_id || null, title: form.title, description: form.description, solution: form.solution,
      tags: tags.length ? tags : null,
    }).select().single()
    if (!error && data) router.push('/problems')
    setLoading(false)
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8"><Link href="/problems" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Back</Link><h1 className="page-title">Log problem</h1></div>
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Title *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. AI not booking appointments in BPRO" /></div>
            <div><label className="label">Client</label><select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)}><option value="">No client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Tags (comma-separated)</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="BMW, booking" /></div>
            <div className="col-span-2"><label className="label">Problem description *</label><textarea className="input min-h-[120px] resize-none" required value={form.description} onChange={e => set('description', e.target.value)} placeholder="What happened? When does it occur?" /></div>
            <div className="col-span-2"><label className="label">Applied solution *</label><textarea className="input min-h-[120px] resize-none" required value={form.solution} onChange={e => set('solution', e.target.value)} placeholder="How was it fixed?" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
            <Link href="/problems" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default function NewProblemPage() { return <Suspense><NewProblemForm /></Suspense> }
