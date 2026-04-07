'use client'
import AppLayout from '@/components/layout/AppLayout'
import MdaCsvDashboard from '@/components/reports/MdaCsvDashboard'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, BarChart3, Copy, Check, Trash2, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function buildReport(csvText: string, title: string, period: string): string {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const rows = lines.slice(1).map(line => {
    const values: string[] = []; let current = '', inQuote = false
    for (const char of line) {
      if (char === '"') inQuote = !inQuote
      else if (char === ',' && !inQuote) { values.push(current.trim()); current = '' }
      else current += char
    }
    values.push(current.trim())
    const obj: any = {}; headers.forEach((h, i) => { obj[h] = values[i] ?? '' }); return obj
  }).filter(r => r['Summary'])

  const total = rows.length
  const done = rows.filter(r => r['Status'] === 'Done').length
  const pct = total ? Math.round((done/total)*100) : 0
  const statusCounts: Record<string,number> = {}
  rows.forEach(r => { statusCounts[r['Status']] = (statusCounts[r['Status']] ?? 0) + 1 })
  const agencias: Record<string,number> = {}
  rows.forEach(r => { const ag = r['Custom field (Agencia que reporta)'] || 'Sin agencia'; agencias[ag] = (agencias[ag] ?? 0) + 1 })
  const topAg = Object.entries(agencias).sort((a,b) => b[1]-a[1]).slice(0,10)
  const maxAg = topAg[0]?.[1] ?? 1

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#f8fafc;color:#1e293b;font-size:14px}
.header{background:#0f1f3d;color:#fff;padding:32px 40px}.header h1{font-family:'DM Serif Display',serif;font-size:24px;font-weight:400;margin-bottom:4px}.header p{font-size:12px;opacity:.55}
.page{max-width:960px;margin:0 auto;padding:28px 24px 60px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}
.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px}.kpi-lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.7px;color:#64748b;margin-bottom:5px}.kpi-val{font-size:28px;font-weight:600;color:#0f1f3d}.kpi-sub{font-size:11px;color:#64748b;margin-top:3px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin-bottom:16px}.sec h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:14px}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}.bar-lbl{width:170px;flex-shrink:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-track{flex:1;height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden}.bar-fill{height:100%;border-radius:4px;background:#1a56db}.bar-val{width:28px;text-align:right;font-size:12px;font-weight:600}
.status-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.status-row:last-child{border-bottom:none}
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
@media print{body{background:#fff}.sec,.kpi{break-inside:avoid}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body>
<div class="header"><h1>${title}</h1><p>${period ? `Período: ${period} · ` : ''}Generado el ${new Date().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'})}</p></div>
<div class="page">
<div class="kpis">
<div class="kpi"><div class="kpi-lbl">Total tickets</div><div class="kpi-val">${total}</div><div class="kpi-sub">Período completo</div></div>
<div class="kpi"><div class="kpi-lbl">Cerrados</div><div class="kpi-val">${done}</div><div class="kpi-sub" style="color:#16a34a">${pct}% del total</div></div>
<div class="kpi"><div class="kpi-lbl">Abiertos</div><div class="kpi-val">${total-done}</div><div class="kpi-sub">Sin resolver</div></div>
<div class="kpi"><div class="kpi-lbl">Agencias</div><div class="kpi-val">${Object.keys(agencias).length}</div><div class="kpi-sub">Con actividad</div></div>
</div>
<div class="sec"><h2>Estado de tickets</h2>
${Object.entries(statusCounts).map(([status,count])=>`<div class="status-row"><span>${status}</span><div style="display:flex;align-items:center;gap:10px"><div style="width:120px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:${Math.round((count/total)*100)}%;height:100%;background:${status==='Done'?'#16a34a':'#f59e0b'};border-radius:3px"></div></div><span style="font-weight:600;min-width:24px;text-align:right">${count}</span><span style="color:#94a3b8;font-size:12px">${Math.round((count/total)*100)}%</span></div></div>`).join('')}
</div>
<div class="sec"><h2>Tickets por agencia — top 10</h2>
${topAg.map(([ag,n])=>`<div class="bar-row"><div class="bar-lbl" title="${ag}">${ag}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((n/maxAg)*100)}%"></div></div><div class="bar-val">${n}</div></div>`).join('')}
</div>
<div class="footer"><span>${title}</span><span>${total} tickets · ${Object.keys(agencias).length} agencias</span></div>
</div></body></html>`
}

export default function ReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ client_id: '', title: '', period: '' })

  useEffect(() => {
    Promise.all([
      supabase.from('reports').select('*, client:clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ]).then(([{ data: r }, { data: c }]) => { setReports(r ?? []); setClients(c ?? []); setLoading(false) })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file || !form.title) return
    setCreating(true)
    const text = await file.text()
    const html = buildReport(text, form.title, form.period)
    const { data } = await supabase.from('reports').insert({ client_id: form.client_id || null, title: form.title, period: form.period || null, html_content: html }).select().single()
    if (data) { setReports(prev => [{ ...data, client: clients.find(c => c.id === form.client_id) }, ...prev]); setShowForm(false); setForm({ client_id: '', title: '', period: '' }); if (fileRef.current) fileRef.current.value = '' }
    setCreating(false)
  }

  async function deleteReport(id: string) {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/r/${token}`)
    setCopied(token); setTimeout(() => setCopied(null), 2000)
  }

  function downloadReport(report: any) {
    const blob = new Blob([report.html_content], { type: 'text/html' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${report.title.replace(/\s+/g,'_')}.html`; a.click()
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="page-title">Reportes</h1>
          <p className="text-slate-500 text-sm mt-1">Análisis MDA desde CSV, informes guardados y enlaces para clientes</p>
        </div>

        <MdaCsvDashboard />

        <div className="border-t border-slate-200 pt-10 mt-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-[#0f1f3d]">Reportes guardados</h2>
              <p className="text-slate-500 text-sm mt-1">Vista rápida desde CSV (sin análisis MDA) · link público opcional</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={16} />Nuevo reporte simple</button>
          </div>
          {showForm && (
            <form onSubmit={handleCreate} className="card mb-6 space-y-4 border-blue-200 bg-blue-50/20">
              <p className="font-semibold text-slate-700">Reporte básico (mismas columnas CSV)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Título *</label><input className="input bg-white" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Reporte Mensual Grupo Continental" /></div>
                <div><label className="label">Cliente</label><select className="input bg-white" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="label">Período</label><input className="input bg-white" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="Febrero – Marzo 2026" /></div>
                <div className="col-span-2"><label className="label">CSV de Jira *</label><input ref={fileRef} type="file" accept=".csv,.xlsx" required className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1a56db] file:text-white hover:file:bg-[#1648c4] file:cursor-pointer" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-blue-100">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Generando...' : 'Generar y guardar'}</button>
              </div>
            </form>
          )}
          {loading ? <div className="text-slate-400 text-sm">Cargando...</div>
          : !reports.length ? (
            <div className="card text-center py-12 max-w-2xl"><BarChart3 size={36} className="text-slate-300 mx-auto mb-3" /><p className="text-slate-500 font-medium">Sin reportes guardados</p><p className="text-slate-400 text-sm mt-1">Usa el formulario de arriba para crear uno a partir del CSV</p></div>
          ) : (
            <div className="space-y-3 max-w-4xl">
              {reports.map((r: any) => (
                <div key={r.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{r.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      {r.client && <span>{r.client.name}</span>}
                      {r.period && <span>{r.period}</span>}
                      <span>{format(new Date(r.created_at), 'd MMM yyyy', { locale: es })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => downloadReport(r)} className="btn-secondary text-xs">Descargar</button>
                    <button onClick={() => copyLink(r.share_token)} className="btn-secondary text-xs flex items-center gap-1.5">
                      {copied === r.share_token ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                      {copied === r.share_token ? 'Copiado' : 'Copiar link'}
                    </button>
                    <Link href={`/r/${r.share_token}`} target="_blank" className="btn-secondary text-xs flex items-center gap-1.5"><Share2 size={13} />Ver</Link>
                    <button onClick={() => deleteReport(r.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
