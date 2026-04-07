'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', notes: '', tags: '' })
  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const { data, error: insertError } = await supabase.from('clients').insert({
        name: form.name.trim(), company: form.company.trim() || null, email: form.email.trim() || null,
        phone: form.phone.trim() || null, notes: form.notes.trim() || null, tags: tags.length ? tags : null,
      }).select('id')
      if (insertError) {
        setError(insertError.message)
        return
      }
      const id = data?.[0]?.id
      if (id) {
        router.push(`/clients/${id}`)
        router.refresh()
        return
      }
      setError('No se guardó el cliente (sin respuesta del servidor). Revisa políticas RLS en Supabase o la consola.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/clients" className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} />Volver</Link>
          <h1 className="page-title">Nuevo cliente</h1>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3" role="alert">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nombre *</label><input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del contacto" /></div>
            <div><label className="label">Empresa</label><input className="input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Empresa" /></div>
            <div><label className="label">Correo</label><input className="input" type="text" inputMode="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com" /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+52 55 0000 0000" /></div>
            <div><label className="label">Tags (separados por coma)</label><input className="input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="BMW, GWM" /></div>
            <div className="col-span-2"><label className="label">Notas</label><textarea className="input min-h-[100px] resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Información relevante..." /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Link href="/clients" className="btn-secondary">Cancelar</Link>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Crear cliente'}</button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
