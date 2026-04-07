'use client'

import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import Papa from 'papaparse'
import { Upload, BarChart3, Info, Download, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Save } from 'lucide-react'
import {
  rowToTicket,
  distinctMonthKeys,
  buildMonthMetrics,
  monthLabelEs,
  deltaPct,
  detectChanges,
  generateExecutiveSummary,
  generateKeyFindings,
  type ParsedTicket,
  type ChangeInsight,
} from '@/lib/mda-analytics'
import { buildMdaExportHtml } from '@/lib/mda-report-html'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

function capitalizeMonth(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return '—'
  if (h < 24) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} d`
}

function BarCompare({
  label,
  focusVal,
  refVal,
  format = (n: number) => String(n),
}: {
  label: string
  focusVal: number
  refVal: number
  format?: (n: number) => string
}) {
  const max = Math.max(focusVal, refVal, 1)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex-1 h-8 bg-slate-100 rounded-md overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all rounded-l-md"
            style={{ width: `${(focusVal / max) * 100}%` }}
            title="Mes principal"
          />
        </div>
        <span className="text-xs font-semibold text-emerald-700 w-10 text-right tabular-nums">{format(focusVal)}</span>
      </div>
      <div className="flex gap-2 items-center opacity-70">
        <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden flex">
          <div
            className="h-full bg-slate-400 transition-all rounded-l-md"
            style={{ width: `${(refVal / max) * 100}%` }}
            title="Referencia"
          />
        </div>
        <span className="text-xs text-slate-600 w-10 text-right tabular-nums">{format(refVal)}</span>
      </div>
    </div>
  )
}

function HorizontalBars({
  items,
  maxItems = 8,
  barClass = 'bg-emerald-500',
}: {
  items: { label: string; count: number }[]
  maxItems?: number
  barClass?: string
}) {
  const slice = items.slice(0, maxItems)
  const max = Math.max(...slice.map(i => i.count), 1)
  return (
    <div className="space-y-2.5">
      {slice.map(row => (
        <div key={row.label}>
          <div className="flex justify-between text-xs mb-0.5 gap-2">
            <span className="text-slate-700 truncate" title={row.label}>
              {row.label}
            </span>
            <span className="text-slate-500 tabular-nums flex-shrink-0">{row.count}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CompareList({
  currentList,
  prevList,
  limit,
  currentLabel,
  prevLabel,
}: {
  currentList: { label: string; count: number }[]
  prevList: { label: string; count: number }[]
  limit: number
  currentLabel?: string
  prevLabel?: string
}) {
  const allKeys = new Set([...currentList.map(x => x.label), ...prevList.map(x => x.label)])
  const compared = [...allKeys].map(key => {
    const curr = currentList.find(x => x.label === key)?.count ?? 0
    const prev = prevList.find(x => x.label === key)?.count ?? 0
    return { label: key, curr, prev, total: curr + prev }
  })
  const sorted = compared.sort((a, b) => b.total - a.total).slice(0, limit)
  const maxVal = Math.max(...sorted.map(x => Math.max(x.curr, x.prev)), 1)

  return (
    <div className="space-y-3">
      {sorted.map(row => (
        <div key={row.label}>
          <div className="flex justify-between text-xs mb-1.5 gap-2">
            <span className="text-slate-700 font-medium truncate" title={row.label}>
              {row.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(row.curr / maxVal) * 100}%` }}
                  title={currentLabel || 'Mes actual'}
                />
              </div>
              <span className="text-xs font-semibold text-emerald-700 w-8 text-right tabular-nums">{row.curr}</span>
            </div>
            <div className="flex items-center gap-2 opacity-70">
              <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-slate-400 transition-all"
                  style={{ width: `${(row.prev / maxVal) * 100}%` }}
                  title={prevLabel || 'Mes anterior'}
                />
              </div>
              <span className="text-xs text-slate-600 w-8 text-right tabular-nums">{row.prev}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500" /> {currentLabel || 'Mes actual'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-400" /> {prevLabel || 'Mes anterior'}
        </span>
      </div>
    </div>
  )
}

export default function MdaCsvDashboard() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<ParsedTicket[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string>('')
  const [refKey, setRefKey] = useState<string>('')
  const [exportTitle, setExportTitle] = useState('Análisis MDA — tickets Jira')
  const [exportPeriod, setExportPeriod] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [saveForm, setSaveForm] = useState({ client_id: '', title: '', period: '' })
  const [saving, setSaving] = useState(false)

  const monthOptions = useMemo(() => distinctMonthKeys(tickets), [tickets])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#mda') {
      document.getElementById('mda')?.scrollIntoView({ behavior: 'smooth' })
    }
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      setClients(data ?? [])
    })
  }, [])

  const onFile = useCallback((file: File | null) => {
    setParseError(null)
    if (!file) return
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const errs = results.errors.filter(e => e.type !== 'Quotes' || e.code !== 'MissingQuotes')
        if (errs.length) setParseError(errs.map(e => e.message).join('; '))
        const rows = results.data.filter(r => Object.values(r).some(v => String(v).trim()))
        const parsed: ParsedTicket[] = []
        for (const row of rows) {
          const t = rowToTicket(row)
          if (t) parsed.push(t)
        }
        setTickets(parsed)
        const keys = distinctMonthKeys(parsed)
        if (keys.length) {
          setFocusKey(keys[0])
          setRefKey(keys[1] ?? '')
        } else {
          setFocusKey('')
          setRefKey('')
        }
      },
      error: err => setParseError(err.message),
    })
  }, [])

  const focus = useMemo(() => (focusKey ? buildMonthMetrics(tickets, focusKey) : null), [tickets, focusKey])
  const refM = useMemo(() => (refKey ? buildMonthMetrics(tickets, refKey) : null), [tickets, refKey])

  const executiveSummary = useMemo(() => {
    if (!focus) return null
    return generateExecutiveSummary(focus, refM)
  }, [focus, refM])

  const keyFindings = useMemo(() => {
    if (!focus) return []
    return generateKeyFindings(focus, refM)
  }, [focus, refM])

  const changes = useMemo(() => {
    if (!focus || !refM) return null
    return detectChanges(focus, refM)
  }, [focus, refM])

  function downloadExport() {
    if (!focus) return
    const html = buildMdaExportHtml(focus, refM, {
      title: exportTitle.trim() || 'Análisis MDA',
      periodNote: exportPeriod.trim() || undefined,
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const safe = (exportTitle.trim() || 'reporte-mda').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
    a.download = `${safe}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function saveReport() {
    if (!focus || !saveForm.title.trim()) return
    setSaving(true)
    try {
      const html = buildMdaExportHtml(focus, refM, {
        title: saveForm.title.trim(),
        periodNote: saveForm.period.trim() || undefined,
      })
      const { data, error } = await supabase
        .from('reports')
        .insert({
          client_id: saveForm.client_id || null,
          title: saveForm.title.trim(),
          period: saveForm.period.trim() || null,
          html_content: html,
        })
        .select()
        .single()
      
      if (error) throw error
      
      setShowSaveForm(false)
      setSaveForm({ client_id: '', title: '', period: '' })
      alert('Reporte guardado exitosamente')
    } catch (err) {
      console.error('Error guardando reporte:', err)
      alert('Error al guardar el reporte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="mda" className="scroll-mt-6 pb-2">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <BarChart3 size={18} />
            <span>Análisis MDA (CSV Jira)</span>
          </div>
          <h2 className="text-xl font-bold text-[#0f1f3d]">Tickets mes principal vs. referencia</h2>
          <p className="text-slate-500 text-sm mt-2 max-w-2xl">
            El <strong className="text-slate-700">mes principal</strong> es el que verás destacado; el{' '}
            <strong className="text-slate-700">mes de referencia</strong> solo sirve para comparar (por ejemplo el mes
            anterior). Exporta el HTML para compartirlo con tu cliente.
          </p>
        </div>
        <label className="btn-primary flex items-center gap-2 cursor-pointer shrink-0 self-start">
          <Upload size={16} />
          Cargar CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {parseError && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">{parseError}</div>
      )}

      {!tickets.length ? (
        <div className="card border-dashed border-2 text-center py-12 text-slate-500">
          <Upload className="mx-auto mb-3 text-slate-300" size={36} />
          <p className="font-medium">Sube el CSV exportado desde Jira</p>
          <p className="text-sm mt-2 max-w-md mx-auto">
            Columnas esperadas: Created, Updated, Status, Tipo de Error, Agencia que reporta, Reporter, etc.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-end">
              <div>
                <label className="label">Mes principal</label>
                <select className="input bg-white min-w-[220px]" value={focusKey} onChange={e => setFocusKey(e.target.value)}>
                  {monthOptions.map(k => (
                    <option key={k} value={k}>
                      {capitalizeMonth(monthLabelEs(k))}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Mes de referencia</label>
                <select className="input bg-white min-w-[220px]" value={refKey} onChange={e => setRefKey(e.target.value)}>
                  <option value="">Sin comparar</option>
                  {monthOptions
                    .filter(k => k !== focusKey)
                    .map(k => (
                      <option key={k} value={k}>
                        {capitalizeMonth(monthLabelEs(k))}
                      </option>
                    ))}
                </select>
              </div>
              {fileName && <p className="text-xs text-slate-400 sm:ml-auto">Archivo: {fileName}</p>}
            </div>

            {focus && (
              <div className="card border-emerald-200 bg-emerald-50/30 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Exportar para el cliente</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Título del informe</label>
                    <input
                      className="input bg-white"
                      value={exportTitle}
                      onChange={e => setExportTitle(e.target.value)}
                      placeholder="Ej. Mesa de ayuda — marzo 2026"
                    />
                  </div>
                  <div>
                    <label className="label">Nota de período (opcional)</label>
                    <input
                      className="input bg-white"
                      value={exportPeriod}
                      onChange={e => setExportPeriod(e.target.value)}
                      placeholder="Ej. Comparativo febrero vs marzo 2026"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={downloadExport} className="btn-primary inline-flex items-center gap-2">
                    <Download size={16} />
                    Descargar HTML
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowSaveForm(!showSaveForm)} 
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <Save size={16} />
                    Guardar reporte
                  </button>
                </div>
                
                {showSaveForm && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Guardar en reportes</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Título *</label>
                        <input
                          className="input bg-slate-50"
                          required
                          value={saveForm.title}
                          onChange={e => setSaveForm(p => ({ ...p, title: e.target.value }))}
                          placeholder="Ej. MDA Continental — marzo 2026"
                        />
                      </div>
                      <div>
                        <label className="label">Cliente</label>
                        <select 
                          className="input bg-slate-50" 
                          value={saveForm.client_id} 
                          onChange={e => setSaveForm(p => ({ ...p, client_id: e.target.value }))}
                        >
                          <option value="">Sin cliente</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Período</label>
                        <input
                          className="input bg-slate-50"
                          value={saveForm.period}
                          onChange={e => setSaveForm(p => ({ ...p, period: e.target.value }))}
                          placeholder="Ej. Febrero – Marzo 2026"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                      <button 
                        type="button" 
                        onClick={() => setShowSaveForm(false)} 
                        className="btn-secondary text-sm"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button" 
                        onClick={saveReport} 
                        className="btn-primary text-sm"
                        disabled={saving || !saveForm.title.trim()}
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {focus && (
            <>
              <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-8 mb-8 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-emerald-600" size={24} />
                  <h3 className="text-xl font-bold text-slate-900">Resumen ejecutivo</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Periodo destacado</p>
                    <p className="text-2xl font-bold text-slate-900">{capitalizeMonth(monthLabelEs(focus.monthKey))}</p>
                    {refM && (
                      <p className="text-xs text-slate-500 mt-1">
                        vs. <span className="font-medium">{capitalizeMonth(monthLabelEs(refM.monthKey))}</span>
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total tickets</p>
                    <p className="text-2xl font-bold text-emerald-700">{focus.total}</p>
                    {refM && (
                      <p className="text-xs text-slate-500 mt-1">
                        Anterior: {refM.total}{' '}
                        <span className={cn('font-semibold', focus.total > refM.total ? 'text-amber-600' : 'text-emerald-600')}>
                          ({focus.total > refM.total ? '+' : ''}
                          {focus.total - refM.total})
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tasa de cierre</p>
                    <p className="text-2xl font-bold text-sky-700">{focus.resolutionRatePct}%</p>
                    {refM && (
                      <p className="text-xs text-slate-500 mt-1">
                        Anterior: {refM.resolutionRatePct}%{' '}
                        <span
                          className={cn(
                            'font-semibold',
                            focus.resolutionRatePct > refM.resolutionRatePct ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          ({focus.resolutionRatePct > refM.resolutionRatePct ? '+' : ''}
                          {focus.resolutionRatePct - refM.resolutionRatePct}pp)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                {executiveSummary && (
                  <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm">
                    <p className="text-sm text-slate-700 leading-relaxed">{executiveSummary}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <KpiCard title="Tickets mes actual" focus={focus.total} refVal={refM?.total} suffix="" />
                <KpiCard title="Tickets cerrados" focus={focus.done} refVal={refM?.done} suffix="" />
                <KpiCard
                  title="Tasa resolución (Done)"
                  focus={focus.resolutionRatePct}
                  refVal={refM?.resolutionRatePct}
                  suffix="%"
                  isPct
                />
                <KpiCard
                  title="Variación mensual"
                  custom={
                    refM ? (
                      <p
                        className={cn(
                          'text-2xl font-bold mt-1',
                          focus.total > refM.total ? 'text-amber-600' : 'text-emerald-600',
                        )}
                      >
                        {focus.total > refM.total ? '+' : ''}
                        {((focus.total - refM.total) / refM.total * 100).toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-slate-400 text-lg">N/A</p>
                    )
                  }
                  sub={refM ? `${focus.total - refM.total > 0 ? '+' : ''}${focus.total - refM.total} tickets` : undefined}
                />
                <KpiCard
                  title="Tiempo medio hasta cierre"
                  focusLabel={formatHours(focus.avgResolutionHours)}
                  refLabel={refM ? formatHours(refM.avgResolutionHours) : undefined}
                  numericDelta={
                    focus.avgResolutionHours != null && refM?.avgResolutionHours != null
                      ? deltaPct(focus.avgResolutionHours, refM.avgResolutionHours)
                      : null
                  }
                  invertDeltaGood
                />
                <KpiCard title="Tickets críticos" focus={focus.criticalCount} refVal={refM?.criticalCount} suffix="" />
                <KpiCard
                  title="Cerrados en ≤48 h"
                  focusLabel={
                    focus.pctResolvedWithin48h != null ? `${focus.pctResolvedWithin48h}%` : focus.done === 0 ? 'N/A' : '—'
                  }
                  refLabel={refM?.pctResolvedWithin48h != null ? `${refM.pctResolvedWithin48h}%` : undefined}
                />
                <KpiCard
                  title="Error más frecuente"
                  custom={
                    focus.topError ? (
                      <p className="text-lg font-semibold text-slate-800 leading-tight mt-1">{focus.topError.name}</p>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )
                  }
                  sub={
                    focus.topError
                      ? `${focus.topError.count} tickets (${focus.total ? Math.round((focus.topError.count / focus.total) * 100) : 0}%)`
                      : undefined
                  }
                />
                <KpiCard
                  title="Agencia con más tickets"
                  custom={
                    focus.topAgency ? (
                      <p className="text-lg font-semibold text-slate-800 leading-tight mt-1">{focus.topAgency.name}</p>
                    ) : (
                      <p className="text-slate-400">—</p>
                    )
                  }
                  sub={focus.topAgency ? `${focus.topAgency.count} tickets` : undefined}
                />
              </div>

              <div className="card mb-8">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Evolución semanal (creados)</h3>
                <p className="text-xs text-slate-500 mb-4">Semanas por día del mes: 1–7, 8–14, 15–21, 22+</p>
                {refM ? (
                  <div className="space-y-4">
                    {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'].map((label, i) => (
                      <BarCompare key={label} label={label} focusVal={focus.weeklyCreated[i]} refVal={refM.weeklyCreated[i]} />
                    ))}
                    <div className="flex gap-4 text-xs pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-emerald-500" /> {capitalizeMonth(monthLabelEs(focus.monthKey))}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-slate-400" /> {capitalizeMonth(monthLabelEs(refM.monthKey))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {focus.weeklyCreated.map((n, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="h-24 bg-slate-100 rounded-lg flex items-end justify-center p-1">
                          <div
                            className="w-full bg-emerald-500 rounded-md transition-all"
                            style={{ height: `${(n / Math.max(...focus.weeklyCreated, 1)) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">S{i + 1}</p>
                        <p className="text-sm font-semibold">{n}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!refM && (
                <div className="card mb-8">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Estado (mes actual)</h3>
                  <HorizontalBars items={focus.byStatus} barClass="bg-sky-500" />
                </div>
              )}

              {refM && (
                <div className="mb-8">
                  <div className="card">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                      Total tickets: comparativo mes a mes
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                          {capitalizeMonth(monthLabelEs(focus.monthKey))}
                        </p>
                        <p className="text-4xl font-bold text-emerald-700">{focus.total}</p>
                        <p className="text-xs text-slate-500 mt-1">Tickets creados</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          {capitalizeMonth(monthLabelEs(refM.monthKey))}
                        </p>
                        <p className="text-4xl font-bold text-slate-600">{refM.total}</p>
                        <p className="text-xs text-slate-500 mt-1">Tickets creados</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Variación:</span>
                        <span
                          className={cn(
                            'text-lg font-bold',
                            focus.total > refM.total ? 'text-amber-600' : 'text-emerald-600',
                          )}
                        >
                          {focus.total > refM.total ? '+' : ''}
                          {focus.total - refM.total} tickets ({focus.total > refM.total ? '+' : ''}
                          {((focus.total - refM.total) / refM.total * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {refM && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="card">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                      Tickets por urgencia: comparativo
                    </h3>
                    <CompareList 
                      currentList={focus.byUrgency} 
                      prevList={refM.byUrgency} 
                      limit={5}
                      currentLabel={capitalizeMonth(monthLabelEs(focus.monthKey))}
                      prevLabel={capitalizeMonth(monthLabelEs(refM.monthKey))}
                    />
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Estado (mes actual)</h3>
                    <HorizontalBars items={focus.byStatus} barClass="bg-sky-500" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                    {refM ? 'Top 5 agencias: comparativo' : 'Por agencia (mes actual)'}
                  </h3>
                  {refM ? (
                    <CompareList 
                      currentList={focus.byAgency} 
                      prevList={refM.byAgency} 
                      limit={5}
                      currentLabel={capitalizeMonth(monthLabelEs(focus.monthKey))}
                      prevLabel={capitalizeMonth(monthLabelEs(refM.monthKey))}
                    />
                  ) : (
                    <HorizontalBars items={focus.byAgency} maxItems={10} barClass="bg-amber-500" />
                  )}
                </div>
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                    {refM ? 'Top 5 tipos de error: comparativo' : 'Tipo de error (mes actual)'}
                  </h3>
                  {refM ? (
                    <CompareList 
                      currentList={focus.byErrorType} 
                      prevList={refM.byErrorType} 
                      limit={5}
                      currentLabel={capitalizeMonth(monthLabelEs(focus.monthKey))}
                      prevLabel={capitalizeMonth(monthLabelEs(refM.monthKey))}
                    />
                  ) : (
                    <HorizontalBars items={focus.byErrorType} maxItems={10} barClass="bg-violet-500" />
                  )}
                </div>
              </div>

              {focus.activeDepartments > 1 && (
                <div className="card mb-8">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                    {refM ? 'Tickets por departamento: comparativo' : 'Por departamento (mes actual)'}
                  </h3>
                  {refM ? (
                    <CompareList 
                      currentList={focus.byDepartment} 
                      prevList={refM.byDepartment} 
                      limit={6}
                      currentLabel={capitalizeMonth(monthLabelEs(focus.monthKey))}
                      prevLabel={capitalizeMonth(monthLabelEs(refM.monthKey))}
                    />
                  ) : (
                    <HorizontalBars items={focus.byDepartment} maxItems={8} barClass="bg-cyan-500" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">Estado (mes actual)</h3>
                  <p className="text-xs text-slate-500 mb-4">Distribución por status</p>
                  <HorizontalBars items={focus.byStatus} maxItems={8} barClass="bg-sky-500" />
                </div>
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Distribución de urgencia (mes actual)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Nivel de prioridad</p>
                  <HorizontalBars items={focus.byUrgency} maxItems={6} barClass="bg-rose-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">Reporter (mes actual)</h3>
                  <p className="text-xs text-slate-500 mb-4">Quién creó los tickets</p>
                  <HorizontalBars items={focus.byReporter} maxItems={12} barClass="bg-cyan-600" />
                </div>
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">Tiempo hasta cierre (Done)</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    <code className="text-[11px] bg-slate-100 px-1 rounded">Updated − Created</code>
                  </p>
                  <HorizontalBars items={focus.resolutionBuckets} maxItems={4} barClass="bg-emerald-600" />
                </div>
              </div>

              {changes && (changes.increases.length > 0 || changes.decreases.length > 0) && (
                <div className="card mb-8 bg-gradient-to-br from-blue-50 to-white border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-blue-600" size={20} />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Análisis de cambios (mes a mes)</h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {changes.increases.length > 0 && (
                      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="text-emerald-600" size={18} />
                          <p className="font-semibold text-emerald-900 text-sm">Principales incrementos</p>
                        </div>
                        <div className="space-y-2">
                          {changes.increases.map((c, i) => (
                            <div key={i} className="flex justify-between items-center text-sm bg-white rounded p-2">
                              <span className="text-slate-700 truncate flex-1">
                                {c.entity}{' '}
                                <span className="text-xs text-slate-400">
                                  ({c.entityType === 'agency' ? 'Agencia' : c.entityType === 'department' ? 'Depto.' : 'Error'})
                                </span>
                              </span>
                              <span className="font-semibold text-emerald-700 ml-2 whitespace-nowrap">
                                +{c.delta} ({c.deltaPct > 0 ? '+' : ''}
                                {c.deltaPct}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {changes.decreases.length > 0 && (
                      <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingDown className="text-rose-600" size={18} />
                          <p className="font-semibold text-rose-900 text-sm">Principales disminuciones</p>
                        </div>
                        <div className="space-y-2">
                          {changes.decreases.map((c, i) => (
                            <div key={i} className="flex justify-between items-center text-sm bg-white rounded p-2">
                              <span className="text-slate-700 truncate flex-1">
                                {c.entity}{' '}
                                <span className="text-xs text-slate-400">
                                  ({c.entityType === 'agency' ? 'Agencia' : c.entityType === 'department' ? 'Depto.' : 'Error'})
                                </span>
                              </span>
                              <span className="font-semibold text-rose-700 ml-2 whitespace-nowrap">
                                {c.delta} ({c.deltaPct}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {keyFindings.length > 0 && (
                <div className="card mb-8 bg-gradient-to-br from-amber-50 to-white border-amber-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="text-amber-600" size={20} />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Hallazgos clave</h3>
                  </div>
                  <ul className="space-y-3">
                    {keyFindings.map((finding, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 bg-white rounded-lg p-3 border border-amber-100 text-sm text-slate-700 leading-relaxed"
                      >
                        <span className="text-amber-600 font-bold flex-shrink-0">{i + 1}.</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex gap-3 text-sm text-slate-600">
                <Info size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Nota:</strong> El CSV no incluye “primera respuesta al cliente”; el tiempo mostrado es el ciclo hasta
                  cierre. Usa <strong>Descargar HTML</strong> para un informe listo para el cliente.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

function KpiCard({
  title,
  focus,
  refVal,
  suffix,
  isPct,
  custom,
  sub,
  focusLabel,
  refLabel,
  numericDelta,
  invertDeltaGood,
}: {
  title: string
  focus?: number
  refVal?: number
  suffix?: string
  isPct?: boolean
  custom?: ReactNode
  sub?: string
  focusLabel?: string
  refLabel?: string
  numericDelta?: number | null
  invertDeltaGood?: boolean
}) {
  const showDelta = focus != null && refVal != null && !isPct && !focusLabel
  const d = showDelta ? deltaPct(focus!, refVal!) : null
  const good = invertDeltaGood ? d != null && d < 0 : d != null && d > 0

  return (
    <div className="card border-slate-200/80">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      {custom}
      {focusLabel != null && (
        <p className={cn('text-3xl font-bold text-emerald-700 mt-1 tabular-nums', focusLabel === '—' && 'text-slate-400 text-xl')}>
          {focusLabel}
        </p>
      )}
      {focus != null && focusLabel == null && (
        <p className="text-3xl font-bold text-emerald-700 mt-1 tabular-nums">
          {focus}
          {suffix && <span className="text-lg">{suffix}</span>}
        </p>
      )}
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {refVal != null && focus != null && focusLabel == null && (
        <p className="text-xs text-slate-500 mt-2">
          Ref.: <span className="tabular-nums">{refVal}{suffix}</span>
          {d != null && (
            <span className={cn('ml-2 font-medium', good ? 'text-emerald-600' : 'text-rose-600')}>
              ({d > 0 ? '+' : ''}
              {d}%)
            </span>
          )}
        </p>
      )}
      {refLabel && focusLabel != null && (
        <p className="text-xs text-slate-500 mt-2">
          Ref.: <span className="tabular-nums">{refLabel}</span>
          {numericDelta != null && (
            <span
              className={cn(
                'ml-2 font-medium',
                invertDeltaGood && numericDelta < 0
                  ? 'text-emerald-600'
                  : !invertDeltaGood && numericDelta > 0
                    ? 'text-emerald-600'
                    : 'text-rose-600',
              )}
            >
              ({numericDelta > 0 ? '+' : ''}
              {numericDelta}% vs ref.)
            </span>
          )}
        </p>
      )}
    </div>
  )
}
