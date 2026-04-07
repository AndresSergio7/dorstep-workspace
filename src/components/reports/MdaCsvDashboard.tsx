'use client'

import { useMemo, useState, useCallback, useEffect, type ReactNode } from 'react'
import Papa from 'papaparse'
import { Upload, BarChart3, Info, Download } from 'lucide-react'
import {
  rowToTicket,
  distinctMonthKeys,
  buildMonthMetrics,
  monthLabelEs,
  deltaPct,
  type ParsedTicket,
} from '@/lib/mda-analytics'
import { buildMdaExportHtml } from '@/lib/mda-report-html'
import { cn } from '@/lib/utils'

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

export default function MdaCsvDashboard() {
  const [tickets, setTickets] = useState<ParsedTicket[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string>('')
  const [refKey, setRefKey] = useState<string>('')
  const [exportTitle, setExportTitle] = useState('Análisis MDA — tickets Jira')
  const [exportPeriod, setExportPeriod] = useState('')

  const monthOptions = useMemo(() => distinctMonthKeys(tickets), [tickets])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#mda') {
      document.getElementById('mda')?.scrollIntoView({ behavior: 'smooth' })
    }
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
                <button type="button" onClick={downloadExport} className="btn-primary inline-flex items-center gap-2">
                  <Download size={16} />
                  Descargar HTML (para enviar o imprimir)
                </button>
              </div>
            )}
          </div>

          {focus && (
            <>
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-6 mb-8">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">Periodo destacado</p>
                <h3 className="text-2xl font-bold text-slate-900">{capitalizeMonth(monthLabelEs(focus.monthKey))}</h3>
                {refM && (
                  <p className="text-sm text-slate-600 mt-2">
                    Referencia: <span className="font-medium">{capitalizeMonth(monthLabelEs(refM.monthKey))}</span> (comparativo)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <KpiCard title="Tickets creados" focus={focus.total} refVal={refM?.total} suffix="" />
                <KpiCard
                  title="Tasa resolución (Done)"
                  focus={focus.resolutionRatePct}
                  refVal={refM?.resolutionRatePct}
                  suffix="%"
                  isPct
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
                <KpiCard
                  title="Mediana hasta cierre"
                  focusLabel={formatHours(focus.medianResolutionHours)}
                  refLabel={refM ? formatHours(refM.medianResolutionHours) : undefined}
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Evolución semanal (creados)</h3>
                  <p className="text-xs text-slate-500 mb-4">Semanas por día del mes: 1–7, 8–14, 15–21, 22+</p>
                  {refM ? (
                    <div className="space-y-4">
                      {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'].map((label, i) => (
                        <BarCompare key={label} label={label} focusVal={focus.weeklyCreated[i]} refVal={refM.weeklyCreated[i]} />
                      ))}
                      <div className="flex gap-4 text-xs pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-emerald-500" /> Principal
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-slate-400" /> Referencia
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

                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Estado (mes principal)</h3>
                  <HorizontalBars items={focus.byStatus} barClass="bg-sky-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Tipo de error (top)</h3>
                  <HorizontalBars items={focus.byErrorType} maxItems={10} barClass="bg-violet-500" />
                </div>
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Por agencia (top)</h3>
                  <HorizontalBars items={focus.byAgency} maxItems={10} barClass="bg-amber-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-1">Reporter</h3>
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
