'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', notes: '', tags: '' })

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setForm({ name: data.name ?? '', company: data.company ?? '', email: data.contact_email ?? '', phone: data.contact_phone ?? '', notes: data.notes ?? '', tags: (data.tags ?? []).join(', ') })
    })
  }, [id])

  function set(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    await supabase.from('clients').update({ name: form.name, company: form.company || null, contact_email: form.email || null, contact_phone: form.phone || null, notes: form.notes || null, tags: tags.length ? tags : null }).eq('id', id)
    router.push(`/clients/${id}`)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clients').delete().eq('id', id)
    router.push('/clients')
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/clients/${id}`} className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Volver</Link>
          <h1 className="page-title">Editar cliente</h1>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nombre *</label><input className="input" required value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="label">Empresa</label><input className="input" value={form.company} onChange={e => set('company', e.target.value)} /></div>
            <div><label className="label">Correo</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Tags</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Notas</label><textarea className="input min-h-[100px] resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <button type="button" onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={15} />Eliminar</button>
            <div className="flex gap-3">
              <Link href={`/clients/${id}`} className="btn-secondary">Cancelar</Link>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
