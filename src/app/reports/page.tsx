'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, BarChart3, Copy, Check, Trash2, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function buildReport(csvText: string, title: string, period: string): string {
  // ── CSV PARSE ──────────────────────────────────────────────────────────────
  function splitLine(line: string): string[] {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    vals.push(cur.trim())
    return vals.map(v => v.replace(/^"|"$/g, '').trim())
  }
  const rawLines: string[] = []
  let buf = '', inQuote = false
  for (const ch of (csvText + '\n')) {
    if (ch === '"') inQuote = !inQuote
    else if (ch === '\n' && !inQuote) { if (buf) rawLines.push(buf.replace(/\r$/, '')); buf = ''; continue }
    buf += ch
  }
  const headers = splitLine(rawLines[0] ?? '')
  const rows = rawLines.slice(1).map(line => {
    const vals = splitLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  }).filter(r => r['Summary'])

  // ── DATE PARSE ─────────────────────────────────────────────────────────────
  // Format: "03/Feb/26 1:16 PM"
  const MMAP: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }
  const MSHORT: Record<number, string> = { 0:'Ene',1:'Feb',2:'Mar',3:'Abr',4:'May',5:'Jun',6:'Jul',7:'Ago',8:'Sep',9:'Oct',10:'Nov',11:'Dic' }
  function parseCreated(s: string): { month: number; week: number } | null {
    const m = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/\d{2}\s/)
    if (!m) return null
    const month = MMAP[m[2]]
    if (month === undefined) return null
    return { month, week: Math.min(Math.ceil(parseInt(m[1]) / 7), 4) }
  }

  // ── FIELD DETECTION ────────────────────────────────────────────────────────
  const createdField = headers.find(h => /created/i.test(h)) ?? 'Created'
  const agField = headers.find(h => /agencia/i.test(h)) ?? 'Custom field (Agencia que reporta)'
  const urgField = headers.find(h => /urgencia/i.test(h)) ?? 'Custom field (Nivel de urgencia)'

  // ── CLASSIFY TIPO DE ERROR ─────────────────────────────────────────────────
  function classifyTipo(row: Record<string, string>): string {
    const up = ((row['Summary'] ?? '') + ' ' + (row['Description'] ?? '')).toUpperCase()
    if (/ENTRENAMIENTO|TRAINING/.test(up)) return 'Entrenamiento IA'
    if (/RESET|RESETAR/.test(up)) return 'Reset / Act. IA'
    if (/CAMPA[ÑN]|OFERTA|PROMO|BONO/.test(up)) return 'Campaña / Oferta'
    if (/CITA|AGENDA|BPRO/.test(up)) return 'Error en Citas'
    if (/LLAMADA|VOZ|TRANSFER/.test(up)) return 'Error Llamadas'
    if (/WHATSAPP|MENSAJ|PLANTILLA/.test(up)) return 'Error WhatsApp'
    if (/DIRECCI[OÓ]N|HORARIO|PRECIO|DA MAL/.test(up)) return 'Error Información'
    if (/LEAD|CRM|SEEKOP|SYONET/.test(up) && !/CITA/.test(up)) return 'Error Leads / CRM'
    return 'Otro'
  }
  rows.forEach(r => {
    r['_tipo'] = classifyTipo(r)
    const d = parseCreated(r[createdField] ?? '')
    r['_month'] = d ? String(d.month) : '-1'
    r['_week'] = d ? String(d.week) : '1'
  })

  // ── DETECT MONTHS ──────────────────────────────────────────────────────────
  const monthSet = new Set(rows.map(r => r['_month']).filter(m => m !== '-1').map(Number))
  const sortedMonths = Array.from(monthSet).sort((a, b) => a - b)
  const m0 = sortedMonths[0] ?? 1
  const m1 = sortedMonths[1]
  const two = sortedMonths.length >= 2
  const rowsM0 = rows.filter(r => Number(r['_month']) === m0)
  const rowsM1 = two ? rows.filter(r => Number(r['_month']) === m1) : []
  const nm0 = MSHORT[m0] ?? 'M1'
  const nm1 = two ? (MSHORT[m1] ?? 'M2') : ''

  // ── STATISTICS ─────────────────────────────────────────────────────────────
  const total = rows.length
  const totalM0 = rowsM0.length
  const totalM1 = rowsM1.length
  const doneM0 = rowsM0.filter(r => r['Status'] === 'Done').length
  const doneM1 = rowsM1.filter(r => r['Status'] === 'Done').length
  const done = doneM0 + doneM1
  const resRate = total ? Math.round((done / total) * 100) : 0
  const resM0 = totalM0 ? Math.round((doneM0 / totalM0) * 100) : 0
  const resM1 = totalM1 ? Math.round((doneM1 / totalM1) * 100) : 0
  const critM0 = rowsM0.filter(r => /critico|critical/i.test(r[urgField] ?? '')).length
  const critM1 = rowsM1.filter(r => /critico|critical/i.test(r[urgField] ?? '')).length
  const critTotal = critM0 + critM1

  const agMap: Record<string, number> = {}
  rows.forEach(r => { const ag = r[agField]?.trim() || 'Sin agencia'; agMap[ag] = (agMap[ag] ?? 0) + 1 })
  const topAgs = Object.entries(agMap).sort((a, b) => b[1] - a[1])
  const topAgency = topAgs[0]?.[0] ?? 'N/A'
  const topAgCount = topAgs[0]?.[1] ?? 0
  const activeAgs = Object.keys(agMap).length

  const tipoMap: Record<string, number> = {}
  rows.forEach(r => { tipoMap[r['_tipo']] = (tipoMap[r['_tipo']] ?? 0) + 1 })
  const topTipo = Object.entries(tipoMap).sort((a, b) => b[1] - a[1])[0]
  const topTipoName = topTipo?.[0] ?? 'N/A'
  const topTipoCount = topTipo?.[1] ?? 0
  const topTipoPct = total ? Math.round((topTipoCount / total) * 100) : 0

  const waCount = tipoMap['Error WhatsApp'] ?? 0
  const waPct = total ? Math.round((waCount / total) * 100) : 0
  const waAlert = waPct >= 15 ? ` ⚠️ WhatsApp representa el ${waPct}% de los tickets.` : ''

  // ── CHART DATA ─────────────────────────────────────────────────────────────
  const TIPO_ORDER = ['Error en Citas','Entrenamiento IA','Campaña / Oferta','Error Leads / CRM',
    'Error WhatsApp','Error Información','Reset / Act. IA','Error Llamadas','Otro']

  function weekCounts(arr: Record<string, string>[]): number[] {
    const c = [0,0,0,0]
    arr.forEach(r => { const w = Math.min(parseInt(r['_week'] ?? '1') - 1, 3); if (w >= 0) c[w]++ })
    return c
  }
  function tipoCounts(arr: Record<string, string>[]): number[] {
    return TIPO_ORDER.map(t => arr.filter(r => r['_tipo'] === t).length)
  }
  function statusCounts(arr: Record<string, string>[]): number[] {
    const d = arr.filter(r => r['Status'] === 'Done').length
    const c = arr.filter(r => /cancel/i.test(r['Status'] ?? '')).length
    return [d, c, arr.length - d - c]
  }
  const top8 = topAgs.slice(0, 8).map(e => e[0])
  function agCounts(arr: Record<string, string>[]): number[] {
    return top8.map(ag => arr.filter(r => (r[agField]?.trim() || 'Sin agencia') === ag).length)
  }

  const jWL = JSON.stringify(['Sem 1','Sem 2','Sem 3','Sem 4'])
  const jW0 = JSON.stringify(weekCounts(rowsM0))
  const jW1 = JSON.stringify(weekCounts(rowsM1))
  const jTL = JSON.stringify(TIPO_ORDER)
  const jT0 = JSON.stringify(tipoCounts(rowsM0))
  const jT1 = JSON.stringify(tipoCounts(rowsM1))
  const jSL = JSON.stringify(['Done','Cancelado','Pendiente / Otro'])
  const jS0 = JSON.stringify(statusCounts(rowsM0))
  const jS1 = JSON.stringify(statusCounts(rowsM1))
  const jAL = JSON.stringify(top8)
  const jA0 = JSON.stringify(agCounts(rowsM0))
  const jA1 = JSON.stringify(agCounts(rowsM1))

  // ── KPI HELPERS ────────────────────────────────────────────────────────────
  function dot(clr: string, lbl: string, val: string | number): string {
    return `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:11px;color:#64748b"><span style="width:6px;height:6px;border-radius:50%;background:${clr};flex-shrink:0;display:inline-block"></span>${lbl}: <strong>${val}</strong></span>`
  }

  const kpis = [
    { lbl:'Total tickets', c:'#1a56db', val:String(total), sm:false,
      sub: two ? dot('#1a56db',nm0,totalM0)+dot('#0d9488',nm1,totalM1) : 'Período completo' },
    { lbl:'Tasa de resolución', c:'#10b981', val:`${resRate}%`, sm:false,
      sub: two ? dot('#1a56db',nm0,`${resM0}%`)+dot('#0d9488',nm1,`${resM1}%`) : `${done} tickets cerrados` },
    { lbl:'Avg resolución', c:'#0d9488', val:'—', sm:false,
      sub:'<span style="font-size:11px;color:#94a3b8">Sin datos de resolución</span>' },
    { lbl:'Tickets críticos', c:'#ef4444', val:String(critTotal), sm:false,
      sub: two ? dot('#1a56db',nm0,critM0)+dot('#0d9488',nm1,critM1) : 'Nivel crítico' },
    { lbl:'SLA cumplido', c:'#10b981', val:`${resRate}%`, sm:false,
      sub: two ? dot('#1a56db',nm0,`${resM0}%`)+dot('#0d9488',nm1,`${resM1}%`) : 'Del total' },
    { lbl:'Mediana resolución', c:'#1a56db', val:'—', sm:false,
      sub:'<span style="font-size:11px;color:#94a3b8">Sin datos de resolución</span>' },
    { lbl:'Error más frecuente', c:'#f59e0b', val:topTipoName, sm:true,
      sub:`<span style="font-size:11px;color:#94a3b8">${topTipoCount} tickets · ${topTipoPct}%</span>` },
    { lbl:'Agencia con más tickets', c:'#0f1f3d', val:topAgency, sm:true,
      sub:`<span style="font-size:11px;color:#94a3b8">${topAgCount} tickets</span>` },
  ]

  const insight = `📌 El período tiene <strong>${total} tickets</strong> en <strong>${activeAgs} agencias</strong>. El problema más frecuente fue <strong>${topTipoName}</strong> (${topTipoCount} tickets, ${topTipoPct}%).${waAlert}`
  const genDate = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })
  const SUBTITLE = 'Mesa de Ayuda — Grupo Continental · Plataforma de Agentes IA Dorstep'

  const badgesHTML = two
    ? `<span class="bdg bdg0">${nm0} · ${totalM0} tickets</span><span class="bdg bdg1">${nm1} · ${totalM1} tickets</span>`
    : `<span class="bdg bdg0">${nm0} · ${totalM0} tickets</span>`

  const kpisHTML = kpis.map(k =>
    `<div class="kpi" style="--c:${k.c}"><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val${k.sm?' sm':''}">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`
  ).join('')

  const comparativeSection = two ? `
  <div class="sec">
    <h2>Análisis comparativo ${nm0} vs ${nm1}</h2>
    <div class="legend">
      <div class="li"><div class="ld" style="background:#1a56db"></div>${nm0}</div>
      <div class="li"><div class="ld" style="background:#0d9488"></div>${nm1}</div>
    </div>
    <div class="g2" style="margin-bottom:16px">
      <div>
        <div class="chart-lbl">Evolución semanal de tickets creados</div>
        <div class="cw" style="height:200px"><canvas id="weekChart"></canvas></div>
      </div>
      <div>
        <div class="chart-lbl">Estado de tickets</div>
        <div class="cw" style="height:200px"><canvas id="statusChart"></canvas></div>
      </div>
    </div>
    <div class="chart-lbl">Tickets por tipo de error — comparativo</div>
    <div class="cw" style="height:230px;margin-bottom:20px"><canvas id="tipoChart"></canvas></div>
    <div class="chart-lbl">Tickets por agencia — top 8</div>
    <div class="cw" style="height:230px"><canvas id="agChart"></canvas></div>
  </div>` : ''

  const comparativeJS = two ? `
var lCfg = { display:true, position:'top', labels:{ boxWidth:10, padding:10, font:{size:11} } };
new Chart(document.getElementById('weekChart'), {
  type:'line',
  data:{ labels:${jWL}, datasets:[
    { label:nm0, data:${jW0}, borderColor:'#1a56db', backgroundColor:'rgba(26,86,219,0.10)', fill:true, tension:0.35, pointRadius:5, pointBackgroundColor:'#1a56db' },
    { label:nm1, data:${jW1}, borderColor:'#0d9488', backgroundColor:'rgba(13,148,136,0.10)', fill:true, tension:0.35, pointRadius:5, pointBackgroundColor:'#0d9488' }
  ]},
  options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:lCfg },
    scales:{ x:{grid:{color:gc}}, y:{grid:{color:gc},ticks:{precision:0}} } }
});
new Chart(document.getElementById('tipoChart'), {
  type:'bar',
  data:{ labels:${jTL}, datasets:[
    { label:nm0, data:${jT0}, backgroundColor:'#1a56db', borderRadius:4 },
    { label:nm1, data:${jT1}, backgroundColor:'#0d9488', borderRadius:4 }
  ]},
  options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:lCfg },
    scales:{ x:{grid:{color:gc}}, y:{grid:{color:gc},ticks:{precision:0}} } }
});
new Chart(document.getElementById('statusChart'), {
  type:'bar',
  data:{ labels:${jSL}, datasets:[
    { label:nm0, data:${jS0}, backgroundColor:'#1a56db', borderRadius:4 },
    { label:nm1, data:${jS1}, backgroundColor:'#0d9488', borderRadius:4 }
  ]},
  options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:lCfg },
    scales:{ x:{grid:{color:gc},ticks:{precision:0}}, y:{grid:{display:false}} } }
});
new Chart(document.getElementById('agChart'), {
  type:'bar',
  data:{ labels:${jAL}, datasets:[
    { label:nm0, data:${jA0}, backgroundColor:'#1a56db', borderRadius:4 },
    { label:nm1, data:${jA1}, backgroundColor:'#0d9488', borderRadius:4 }
  ]},
  options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:lCfg },
    scales:{ x:{grid:{color:gc},ticks:{maxRotation:35,minRotation:35,font:{size:10}}}, y:{grid:{color:gc},ticks:{precision:0}} } }
});` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#f8fafc;color:#1e293b;font-size:13px}
.hdr{background:#0f1f3d;color:#fff;padding:30px 48px 26px}
.hdr-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.hdr h1{font-family:'DM Serif Display',serif;font-size:26px;font-weight:400;margin-bottom:4px}
.hdr .sub{font-size:11px;opacity:.5;margin-bottom:10px}
.bdg{display:inline-block;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.3px;margin-right:6px}
.bdg0{background:rgba(26,86,219,0.25);color:#93c5fd}
.bdg1{background:rgba(13,148,136,0.25);color:#5eead4}
.hdr-r{text-align:right}
.hdr-r .dt{font-size:11px;opacity:.5;margin-bottom:4px}
.hdr-r .tot{font-size:24px;font-weight:700;letter-spacing:-.5px}
.hdr-r .tot-l{font-size:10px;opacity:.45;text-transform:uppercase;letter-spacing:.8px}
.ins{background:#0f1f3d;border-top:1px solid rgba(255,255,255,.08);padding:14px 48px}
.ins p{font-size:13px;color:rgba(255,255,255,.65);line-height:1.7}
.ins strong{color:#93c5fd;font-weight:600}
.page{max-width:1080px;margin:0 auto;padding:28px 24px 60px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;border-top:3px solid var(--c)}
.kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-bottom:8px}
.kpi-val{font-size:28px;font-weight:700;color:#0f1f3d;line-height:1}
.kpi-val.sm{font-size:14px;font-weight:600;line-height:1.4;margin-top:4px}
.kpi-sub{font-size:11px;color:#94a3b8;margin-top:7px}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:22px 24px;margin-bottom:16px}
.sec h2{font-family:'DM Serif Display',serif;font-size:17px;font-weight:400;color:#0f1f3d;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
.legend{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.li{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#475569}
.ld{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.chart-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#94a3b8;margin-bottom:10px}
.cw{position:relative}
.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media print{body{background:#fff}.sec,.kpi{break-inside:avoid}.hdr,.ins{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{padding:16px}}
</style>
</head>
<body>
<div class="hdr">
  <div class="hdr-row">
    <div>
      <h1>${title}</h1>
      <div class="sub">${SUBTITLE}</div>
      <div>${badgesHTML}</div>
    </div>
    <div class="hdr-r">
      <div class="dt">Generado el ${genDate}</div>
      <div class="tot">${total}</div>
      <div class="tot-l">tickets totales</div>
    </div>
  </div>
</div>
<div class="ins"><p>${insight}</p></div>
<div class="page">
  <div class="kpis">${kpisHTML}</div>
  ${comparativeSection}
  <div class="footer">
    <span>${title}${period ? ` · ${period}` : ''}</span>
    <span>${total} tickets · ${activeAgs} agencias</span>
  </div>
</div>
<script>
Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#64748b';
Chart.defaults.plugins.legend.display = false;
var gc = 'rgba(0,0,0,0.04)';
var nm0 = ${JSON.stringify(nm0)}, nm1 = ${JSON.stringify(nm1)};
${comparativeJS}
<\/script>
</body>
</html>`
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
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="page-title">Reportes</h1><p className="text-slate-500 text-sm mt-1">Genera y comparte reportes con tus clientes</p></div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={16} />Generar reporte</button>
        </div>
        {showForm && (
          <form onSubmit={handleCreate} className="card mb-6 space-y-4 border-blue-200 bg-blue-50/20">
            <h2 className="font-semibold text-slate-700">Nuevo reporte</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="label">Título *</label><input className="input bg-white" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Reporte Mensual Grupo Continental" /></div>
              <div><label className="label">Cliente</label><select className="input bg-white" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label">Período</label><input className="input bg-white" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="Febrero – Marzo 2026" /></div>
              <div className="col-span-2"><label className="label">CSV de Jira *</label><input ref={fileRef} type="file" accept=".csv,.xlsx" required className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1a56db] file:text-white hover:file:bg-[#1648c4] file:cursor-pointer" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-blue-100">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Generando...' : 'Generar reporte'}</button>
            </div>
          </form>
        )}
        {loading ? <div className="text-slate-400 text-sm">Cargando...</div>
        : !reports.length ? (
          <div className="card text-center py-16"><BarChart3 size={40} className="text-slate-300 mx-auto mb-3" /><p className="text-slate-500 font-medium">Sin reportes</p><p className="text-slate-400 text-sm mt-1">Sube un CSV de Jira para generar un reporte</p></div>
        ) : (
          <div className="space-y-3">
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
                <div className="flex items-center gap-2">
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
    </AppLayout>
  )
}
