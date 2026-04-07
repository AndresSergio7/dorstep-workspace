import type { MonthMetrics, ChangeInsight } from '@/lib/mda-analytics'
import { monthLabelEs, detectChanges, generateExecutiveSummary, generateKeyFindings, deltaPct } from '@/lib/mda-analytics'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtH(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return '—'
  if (h < 24) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} d`
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** HTML autocontenido para enviar al cliente (descargar / imprimir). */
export function buildMdaExportHtml(
  focus: MonthMetrics,
  refM: MonthMetrics | null,
  options: { title: string; periodNote?: string },
): string {
  const focusLabel = cap(monthLabelEs(focus.monthKey))
  const refLabel = refM ? cap(monthLabelEs(refM.monthKey)) : ''
  const gen = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  const title = esc(options.title || 'Análisis MDA')
  const period = options.periodNote ? esc(options.periodNote) : ''

  const narrative = refM ? generateExecutiveSummary(focus, refM) : `En ${focusLabel} se registraron ${focus.total} tickets, con una tasa de resolución del ${focus.resolutionRatePct}%.`
  const keyFindings = generateKeyFindings(focus, refM)
  const changes = refM ? detectChanges(focus, refM) : null

  const kpi = (label: string, main: string, sub?: string) =>
    `<div class="kpi"><div class="kpi-lbl">${esc(label)}</div><div class="kpi-val">${main}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`

  const kpiWithDelta = (label: string, curr: number, prev: number | undefined, suf = '') => {
    const d = prev !== undefined ? deltaPct(curr, prev) : null
    const deltaClass = d === null ? '' : d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : 'delta-neutral'
    const deltaText = d !== null && d !== 0 ? `<span class="${deltaClass}">${d > 0 ? '+' : ''}${d}%</span>` : ''
    const sub = prev !== undefined ? `Mes anterior: ${prev}${suf} ${deltaText}` : undefined
    return kpi(label, `${curr}${suf}`, sub)
  }

  const barTable = (rows: { label: string; count: number }[], maxRows: number) => {
    const slice = rows.slice(0, maxRows)
    const max = Math.max(...slice.map(x => x.count), 1)
    return slice
      .map(
        r => `<div class="bar-row"><div class="bar-lbl" title="${esc(r.label)}">${esc(r.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((r.count / max) * 100)}%"></div></div><div class="bar-val">${r.count}</div></div>`,
      )
      .join('')
  }

  const compareBarTable = (
    label: string,
    currentList: { label: string; count: number }[],
    prevList: { label: string; count: number }[],
    limit: number,
  ) => {
    const allKeys = new Set([...currentList.map(x => x.label), ...prevList.map(x => x.label)])
    const compared = [...allKeys].map(key => {
      const curr = currentList.find(x => x.label === key)?.count ?? 0
      const prev = prevList.find(x => x.label === key)?.count ?? 0
      return { label: key, curr, prev, total: curr + prev }
    })
    const sorted = compared.sort((a, b) => b.total - a.total).slice(0, limit)
    const maxVal = Math.max(...sorted.map(x => Math.max(x.curr, x.prev)), 1)
    return sorted
      .map(
        r => `<div class="cmp-row">
      <div class="cmp-lbl" title="${esc(r.label)}">${esc(r.label)}</div>
      <div class="cmp-bars">
        <div class="cmp-bar"><div class="cmp-bar-fill cmp-current" style="width:${(r.curr / maxVal) * 100}%"></div><span class="cmp-val">${r.curr}</span></div>
        <div class="cmp-bar"><div class="cmp-bar-fill cmp-prev" style="width:${(r.prev / maxVal) * 100}%"></div><span class="cmp-val">${r.prev}</span></div>
      </div>
    </div>`,
      )
      .join('')
  }

  const weeklyRows = ['Sem 1 (días 1–7)', 'Sem 2 (8–14)', 'Sem 3 (15–21)', 'Sem 4 (22+)']
    .map((label, i) => {
      const fv = focus.weeklyCreated[i]
      const rv = refM?.weeklyCreated[i]
      return `<tr><td>${esc(label)}</td><td style="font-weight:600">${fv}</td><td class="muted">${rv !== undefined ? rv : '—'}</td></tr>`
    })
    .join('')

  const pct48 =
    focus.pctResolvedWithin48h != null
      ? `${focus.pctResolvedWithin48h}%`
      : focus.done === 0
        ? 'N/A'
        : '—'

  const changeSection = changes
    ? `<div class="sec"><h3>Análisis de cambios (mes a mes)</h3>
    ${
      changes.increases.length > 0
        ? `<div class="change-block increase"><p class="change-title">📈 Principales incrementos</p>${changes.increases
            .map(
              c =>
                `<div class="change-item"><span>${esc(c.entity)} (${c.entityType === 'agency' ? 'Agencia' : c.entityType === 'department' ? 'Depto.' : 'Error'})</span><span class="change-detail">+${c.delta} tickets (+${c.deltaPct}%)</span></div>`,
            )
            .join('')}</div>`
        : ''
    }
    ${
      changes.decreases.length > 0
        ? `<div class="change-block decrease"><p class="change-title">📉 Principales disminuciones</p>${changes.decreases
            .map(
              c =>
                `<div class="change-item"><span>${esc(c.entity)} (${c.entityType === 'agency' ? 'Agencia' : c.entityType === 'department' ? 'Depto.' : 'Error'})</span><span class="change-detail">${c.delta} tickets (${c.deltaPct}%)</span></div>`,
            )
            .join('')}</div>`
        : ''
    }
    </div>`
    : ''

  const findingsHtml = `<div class="sec findings"><h3>Hallazgos clave</h3>
    <ul class="findings-list">${keyFindings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
  </div>`

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#f8fafc;color:#1e293b;font-size:14px;line-height:1.5}
.header{background:linear-gradient(135deg,#0f1f3d 0%,#1a3a6e 100%);color:#fff;padding:32px 40px}
.header h1{font-size:26px;font-weight:700;margin-bottom:6px;letter-spacing:-0.02em}
.header p{font-size:12px;opacity:.85}
.badge{display:inline-block;background:rgba(255,255,255,.15);padding:5px 12px;border-radius:6px;font-size:11px;margin-top:10px;font-weight:500}
.page{max-width:1080px;margin:0 auto;padding:28px 24px 60px}
.exec-summary{background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1px solid #a7f3d0;border-radius:14px;padding:24px 28px;margin-bottom:32px;box-shadow:0 2px 8px rgba(5,150,105,.08)}
.exec-summary h2{font-size:19px;color:#065f46;margin-bottom:12px;font-weight:700}
.exec-summary .narrative{font-size:14px;color:#047857;line-height:1.6;background:#fff;padding:14px 16px;border-radius:8px;margin-top:12px;border-left:3px solid #10b981}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.kpis{grid-template-columns:1fr}}
.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:16px 18px;transition:box-shadow .2s}
.kpi:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:7px}
.kpi-val{font-size:28px;font-weight:700;color:#047857;line-height:1.1}
.kpi-sub{font-size:11px;color:#64748b;margin-top:6px}
.delta-up{color:#10b981;font-weight:600}
.delta-down{color:#ef4444;font-weight:600}
.delta-neutral{color:#64748b;font-weight:600}
.sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:18px;break-inside:avoid}
.sec h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:14px}
table.wk{width:100%;border-collapse:collapse;font-size:13px}
table.wk th,table.wk td{padding:9px 12px;text-align:left;border-bottom:1px solid #f1f5f9}
table.wk th{color:#64748b;font-size:11px;text-transform:uppercase;font-weight:700}
.muted{color:#94a3b8}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.bar-lbl{width:45%;flex-shrink:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:9px;background:#f1f5f9;border-radius:5px;overflow:hidden}
.bar-fill{height:100%;border-radius:5px;background:#059669}
.bar-val{width:36px;text-align:right;font-size:12px;font-weight:600;color:#334155}
.cmp-row{margin-bottom:14px}
.cmp-lbl{font-size:12px;font-weight:600;color:#334155;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmp-bars{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cmp-bar{display:flex;align-items:center;gap:6px}
.cmp-bar-fill{height:8px;border-radius:4px;transition:width .3s}
.cmp-current{background:#10b981}
.cmp-prev{background:#94a3b8}
.cmp-val{font-size:11px;font-weight:600;color:#475569;min-width:24px;text-align:right}
.legend{display:flex;gap:16px;font-size:11px;color:#64748b;margin-top:12px}
.legend-item{display:flex;align-items:center;gap:5px}
.legend-box{width:14px;height:14px;border-radius:3px}
.change-block{margin-bottom:16px;padding:14px;border-radius:8px}
.change-block.increase{background:#ecfdf5;border:1px solid #d1fae5}
.change-block.decrease{background:#fef2f2;border:1px solid #fecaca}
.change-title{font-size:12px;font-weight:700;color:#334155;margin-bottom:10px}
.change-item{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05)}
.change-item:last-child{border-bottom:none}
.change-detail{font-weight:600;color:#059669}
.findings{background:#fef3c7;border:1px solid #fde68a}
.findings-list{list-style:none;padding:0}
.findings-list li{padding:10px 12px;background:#fff;border-radius:6px;margin-bottom:8px;font-size:13px;line-height:1.5;border-left:3px solid #f59e0b}
.findings-list li:last-child{margin-bottom:0}
.note{font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:13px 16px;margin-top:18px;line-height:1.5}
.footer{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
@media print{body{background:#fff}.header,.exec-summary,.change-block,.findings{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <h1>${title}</h1>
  <p>${period ? `${period} · ` : ''}Generado el ${esc(gen)}</p>
  <span class="badge">Periodo: ${esc(focusLabel)}${refM ? ` vs. ${esc(refLabel)}` : ''}</span>
</div>
<div class="page">
<div class="exec-summary">
  <h2>Resumen ejecutivo</h2>
  <div class="kpis" style="gap:10px;margin:16px 0">
    ${kpiWithDelta('Tickets mes actual', focus.total, refM?.total)}
    ${kpiWithDelta('Tickets cerrados', focus.done, refM?.done)}
    ${kpi('Tasa de cierre', `${focus.resolutionRatePct}%`, refM ? `Mes anterior: ${refM.resolutionRatePct}%` : undefined)}
    ${kpi('Agencias activas', String(focus.activeAgencies))}
    ${kpi('Departamentos activos', String(focus.activeDepartments))}
    ${kpi('Tickets críticos', String(focus.criticalCount), refM ? `Mes anterior: ${refM.criticalCount}` : undefined)}
    ${kpi('Urgencia alta', String(focus.highUrgencyCount))}
    ${kpi('Error principal', esc(focus.topError?.name.substring(0, 28) ?? '—'), focus.topError ? `${focus.topError.count} tickets` : undefined)}
  </div>
  <div class="narrative">${esc(narrative)}</div>
</div>
<div class="kpis">
  ${kpi('Tiempo medio cierre', esc(fmtH(focus.avgResolutionHours)), refM && refM.avgResolutionHours ? `Ref.: ${fmtH(refM.avgResolutionHours)}` : undefined)}
  ${kpi('Mediana cierre', esc(fmtH(focus.medianResolutionHours)), refM && refM.medianResolutionHours ? `Ref.: ${fmtH(refM.medianResolutionHours)}` : undefined)}
  ${kpi('Cerrados en ≤48 h', esc(pct48), refM?.pctResolvedWithin48h != null ? `Ref.: ${refM.pctResolvedWithin48h}%` : undefined)}
  ${kpi('Agencia líder', esc(focus.topAgency?.name.substring(0, 24) ?? '—'), focus.topAgency ? `${focus.topAgency.count} tickets` : undefined)}
</div>
${refM ? `<div class="sec"><h3>Comparativo total: ${esc(focusLabel)} vs. ${esc(refLabel)}</h3>${compareBarTable('Total', [{ label: focusLabel, count: focus.total }], [{ label: refLabel, count: refM.total }], 2)}<div class="legend"><div class="legend-item"><div class="legend-box" style="background:#10b981"></div><span>${esc(focusLabel)}</span></div><div class="legend-item"><div class="legend-box" style="background:#94a3b8"></div><span>${esc(refLabel)}</span></div></div></div>` : ''}
<div class="sec"><h3>Evolución semanal — tickets creados (${esc(focusLabel)})</h3>
<table class="wk"><thead><tr><th>Semana</th><th>${esc(focusLabel)}</th>${refM ? `<th>${esc(refLabel)}</th>` : ''}</tr></thead><tbody>${weeklyRows}</tbody></table>
</div>
${refM ? `<div class="sec"><h3>Tickets por urgencia — comparativo</h3>${compareBarTable('Urgencia', focus.byUrgency, refM.byUrgency, 6)}<div class="legend"><div class="legend-item"><div class="legend-box" style="background:#10b981"></div><span>${esc(focusLabel)}</span></div><div class="legend-item"><div class="legend-box" style="background:#94a3b8"></div><span>${esc(refLabel)}</span></div></div></div>` : `<div class="sec"><h3>Tickets por urgencia (${esc(focusLabel)})</h3>${barTable(focus.byUrgency, 8)}</div>`}
${refM ? `<div class="sec"><h3>Top 5 agencias — comparativo: ${esc(focusLabel)} vs. ${esc(refLabel)}</h3>${compareBarTable('Agencias', focus.byAgency, refM.byAgency, 5)}<div class="legend"><div class="legend-item"><div class="legend-box" style="background:#10b981"></div><span>${esc(focusLabel)}</span></div><div class="legend-item"><div class="legend-box" style="background:#94a3b8"></div><span>${esc(refLabel)}</span></div></div></div>` : `<div class="sec"><h3>Tickets por agencia (${esc(focusLabel)})</h3>${barTable(focus.byAgency, 10)}</div>`}
${refM ? `<div class="sec"><h3>Top 5 tipos de error — comparativo: ${esc(focusLabel)} vs. ${esc(refLabel)}</h3>${compareBarTable('Tipos de error', focus.byErrorType, refM.byErrorType, 5)}<div class="legend"><div class="legend-item"><div class="legend-box" style="background:#10b981"></div><span>${esc(focusLabel)}</span></div><div class="legend-item"><div class="legend-box" style="background:#94a3b8"></div><span>${esc(refLabel)}</span></div></div></div>` : `<div class="sec"><h3>Tipos de error (${esc(focusLabel)})</h3>${barTable(focus.byErrorType, 10)}</div>`}
${focus.activeDepartments > 1 ? (refM ? `<div class="sec"><h3>Tickets por departamento — comparativo: ${esc(focusLabel)} vs. ${esc(refLabel)}</h3>${compareBarTable('Departamentos', focus.byDepartment, refM.byDepartment, 6)}<div class="legend"><div class="legend-item"><div class="legend-box" style="background:#10b981"></div><span>${esc(focusLabel)}</span></div><div class="legend-item"><div class="legend-box" style="background:#94a3b8"></div><span>${esc(refLabel)}</span></div></div></div>` : `<div class="sec"><h3>Tickets por departamento (${esc(focusLabel)})</h3>${barTable(focus.byDepartment, 8)}</div>`) : ''}
<div class="sec"><h3>Estado de tickets (${esc(focusLabel)})</h3>${barTable(focus.byStatus, 8)}</div>
<div class="sec"><h3>Reporter — quién creó tickets (${esc(focusLabel)})</h3>${barTable(focus.byReporter, 10)}</div>
<div class="sec"><h3>Tiempo hasta cierre — distribución (Done, ${esc(focusLabel)})</h3>${barTable(focus.resolutionBuckets, 8)}</div>
${changeSection}
${findingsHtml}
<p class="note"><strong>Nota metodológica:</strong> El tiempo hasta cierre se calcula con <em>Updated − Created</em> para tickets Done. No incluye "primera respuesta" si el CSV no contiene esa columna.</p>
<div class="footer"><span>${title}</span><span>Dorstep · Workspace · ${focus.total} tickets analizados</span></div>
</div></body></html>`
}
