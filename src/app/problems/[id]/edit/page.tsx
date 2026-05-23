'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function EditProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [form, setForm] = useState({ client_id: '', title: '', description: '', solution: '', tags: '' })

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients(data ?? []))
    supabase.from('problems').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm({ client_id: data.client_id ?? '', title: data.title ?? '', description: data.description ?? '', solution: data.solution ?? '', tags: (data.tags ?? []).join(', ') })
    })
  }, [id])

  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    await supabase.from('problems').update({ client_id: form.client_id || null, title: form.title, description: form.description, solution: form.solution, tags: tags.length ? tags : null }).eq('id', id)
    router.push('/problems')
  }
  async function handleDelete() {
    if (!confirm('Delete this problem?')) return
    await supabase.from('problems').delete().eq('id', id)
    router.push('/problems')
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8"><Link href="/problems" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Back</Link><h1 className="page-title">Edit problem</h1></div>
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Title *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} /></div>
            <div><label className="label">Client</label><select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)}><option value="">No client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Tags</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Description *</label><textarea className="input min-h-[100px] resize-none" required value={form.description} onChange={e => set('description', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Solution *</label><textarea className="input min-h-[100px] resize-none" required value={form.solution} onChange={e => set('solution', e.target.value)} /></div>
          </div>
          <div className="flex justify-between pt-2 border-t border-border/60">
            <button type="button" onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={15} />Delete</button>
            <div className="flex gap-3"><Link href="/problems" className="btn-secondary">Cancel</Link><button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button></div>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
