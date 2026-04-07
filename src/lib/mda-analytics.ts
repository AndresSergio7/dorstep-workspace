import { format, parse } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { es } from 'date-fns/locale'

/** Columnas típicas del export Jira / Mesa de ayuda */
export const MDA_COLUMNS = {
  status: 'Status',
  created: 'Created',
  updated: 'Updated',
  urgency: 'Custom field (Nivel de urgencia)',
  agency: 'Custom field (Agencia que reporta)',
  reporter: 'Reporter',
  errorType: 'Tipo de Error',
  department: 'Custom field (Departamento)',
} as const

export interface ParsedTicket {
  status: string
  created: Date
  updated: Date | null
  urgency: string
  agency: string
  reporter: string
  errorType: string
  department: string
  resolutionHours: number | null
}

const DATE_FMT = 'dd/MMM/yy h:mm a'

export function parseJiraDate(s: string | undefined): Date | null {
  if (!s?.trim()) return null
  const t = s.trim()
  try {
    return parse(t, DATE_FMT, new Date(), { locale: enUS })
  } catch {
    return null
  }
}

export function rowToTicket(row: Record<string, string>): ParsedTicket | null {
  const c = parseJiraDate(row[MDA_COLUMNS.created])
  if (!c || Number.isNaN(c.getTime())) return null
  const u = parseJiraDate(row[MDA_COLUMNS.updated])
  let resolutionHours: number | null = null
  if (u && row[MDA_COLUMNS.status]?.toLowerCase() === 'done') {
    resolutionHours = Math.max(0, (u.getTime() - c.getTime()) / 36e5)
  }
  return {
    status: (row[MDA_COLUMNS.status] ?? '').trim() || 'Sin estado',
    created: c,
    updated: u,
    urgency: (row[MDA_COLUMNS.urgency] ?? '').trim(),
    agency: (row[MDA_COLUMNS.agency] ?? '').trim() || 'Sin agencia',
    reporter: (row[MDA_COLUMNS.reporter] ?? '').trim() || 'Sin reporter',
    errorType: (row[MDA_COLUMNS.errorType] ?? '').trim() || 'Sin clasificar',
    department: (row[MDA_COLUMNS.department] ?? '').trim() || 'Sin departamento',
    resolutionHours,
  }
}

export function monthKey(d: Date): string {
  return format(d, 'yyyy-MM')
}

export function monthLabelEs(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return format(d, 'MMMM yyyy', { locale: es })
}

/** Meses presentes en los datos, más reciente primero */
export function distinctMonthKeys(tickets: ParsedTicket[]): string[] {
  const set = new Set<string>()
  tickets.forEach(t => set.add(monthKey(t.created)))
  return [...set].sort().reverse()
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function countBy<T extends string>(items: T[]): Map<T, number> {
  const m = new Map<T, number>()
  items.forEach(x => m.set(x, (m.get(x) ?? 0) + 1))
  return m
}

export interface MonthSlice {
  key: string
  label: string
  tickets: ParsedTicket[]
}

export interface MonthMetrics {
  monthKey: string
  total: number
  done: number
  cancelled: number
  otherStatus: number
  resolutionRatePct: number
  avgResolutionHours: number | null
  medianResolutionHours: number | null
  /** % tickets Done con cierre en ≤48h desde creación */
  pctResolvedWithin48h: number | null
  criticalCount: number
  highUrgencyCount: number
  mediumUrgencyCount: number
  topError: { name: string; count: number } | null
  topAgency: { name: string; count: number } | null
  topDepartment: { name: string; count: number } | null
  topReporter: { name: string; count: number } | null
  activeAgencies: number
  activeDepartments: number
  byStatus: { label: string; count: number }[]
  byErrorType: { label: string; count: number }[]
  byAgency: { label: string; count: number }[]
  byDepartment: { label: string; count: number }[]
  byUrgency: { label: string; count: number }[]
  byReporter: { label: string; count: number }[]
  /** Semanas del mes (por día del mes 1–7, 8–14, …) */
  weeklyCreated: [number, number, number, number]
  /** Histograma horas hasta cierre (solo Done con datos) */
  resolutionBuckets: { label: string; count: number }[]
}

function weekIndexInMonth(d: Date): 0 | 1 | 2 | 3 {
  const day = d.getDate()
  if (day <= 7) return 0
  if (day <= 14) return 1
  if (day <= 21) return 2
  return 3
}

function buildMetrics(tickets: ParsedTicket[], monthKeyStr: string): MonthMetrics {
  const total = tickets.length
  const done = tickets.filter(t => t.status.toLowerCase() === 'done').length
  const cancelled = tickets.filter(t => /cancel/i.test(t.status)).length
  const otherStatus = total - done - cancelled
  const resolutionRatePct = total ? Math.round((done / total) * 100) : 0

  const resolvedHours = tickets
    .filter(t => t.status.toLowerCase() === 'done' && t.resolutionHours != null)
    .map(t => t.resolutionHours!) 

  const avgResolutionHours = mean(resolvedHours)
  const medianResolutionHours = median(resolvedHours)

  const within48 = tickets.filter(
    t => t.status.toLowerCase() === 'done' && t.resolutionHours != null && t.resolutionHours <= 48,
  ).length
  const pctResolvedWithin48h = done ? Math.round((within48 / done) * 100) : null

  const criticalCount = tickets.filter(t => /cr[ií]tico/i.test(t.urgency)).length
  const highUrgencyCount = tickets.filter(t => /alta/i.test(t.urgency)).length
  const mediumUrgencyCount = tickets.filter(t => /media/i.test(t.urgency)).length

  const errMap = countBy(tickets.map(t => t.errorType))
  const topErrorEntry = [...errMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topError = topErrorEntry ? { name: topErrorEntry[0], count: topErrorEntry[1] } : null

  const agMap = countBy(tickets.map(t => t.agency))
  const topAgencyEntry = [...agMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topAgency = topAgencyEntry ? { name: topAgencyEntry[0], count: topAgencyEntry[1] } : null

  const deptMap = countBy(tickets.map(t => t.department))
  const topDepartmentEntry = [...deptMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topDepartment = topDepartmentEntry ? { name: topDepartmentEntry[0], count: topDepartmentEntry[1] } : null

  const repMap = countBy(tickets.map(t => t.reporter))
  const topReporterEntry = [...repMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topReporter = topReporterEntry ? { name: topReporterEntry[0], count: topReporterEntry[1] } : null

  const activeAgencies = [...agMap.keys()].filter(k => k && k !== 'Sin agencia').length
  const activeDepartments = [...deptMap.keys()].filter(k => k && k !== 'Sin departamento').length

  const statusMap = countBy(tickets.map(t => t.status))
  const byStatus = [...statusMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const byErrorType = [...errMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const byAgency = [...agMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const byDepartment = [...deptMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const urgMap = countBy(tickets.map(t => t.urgency))
  const byUrgency = [...urgMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const byReporter = [...repMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const weeklyCreated: [number, number, number, number] = [0, 0, 0, 0]
  tickets.forEach(t => {
    weeklyCreated[weekIndexInMonth(t.created)]++
  })

  const b0 = resolvedHours.filter(h => h < 4).length
  const b1 = resolvedHours.filter(h => h >= 4 && h < 24).length
  const b2 = resolvedHours.filter(h => h >= 24 && h < 72).length
  const b3 = resolvedHours.filter(h => h >= 72).length
  const resolutionBuckets = [
    { label: '< 4 h', count: b0 },
    { label: '4–24 h', count: b1 },
    { label: '1–3 d', count: b2 },
    { label: '> 3 d', count: b3 },
  ]

  return {
    monthKey: monthKeyStr,
    total,
    done,
    cancelled,
    otherStatus,
    resolutionRatePct,
    avgResolutionHours,
    medianResolutionHours,
    pctResolvedWithin48h,
    criticalCount,
    highUrgencyCount,
    mediumUrgencyCount,
    topError,
    topAgency,
    topDepartment,
    topReporter,
    activeAgencies,
    activeDepartments,
    byStatus,
    byErrorType,
    byAgency,
    byDepartment,
    byUrgency,
    byReporter,
    weeklyCreated,
    resolutionBuckets,
  }
}

export function ticketsForMonth(all: ParsedTicket[], key: string): ParsedTicket[] {
  return all.filter(t => monthKey(t.created) === key)
}

export function buildMonthMetrics(all: ParsedTicket[], key: string): MonthMetrics {
  return buildMetrics(ticketsForMonth(all, key), key)
}

/** Delta porcentual simple (focus vs ref) */
export function deltaPct(focus: number, ref: number): number | null {
  if (ref === 0) return null
  return Math.round(((focus - ref) / ref) * 100)
}

export interface ChangeInsight {
  entity: string
  entityType: 'agency' | 'department' | 'error'
  currentCount: number
  previousCount: number
  delta: number
  deltaPct: number
}

/** Detecta los cambios más significativos entre dos meses */
export function detectChanges(current: MonthMetrics, previous: MonthMetrics): {
  increases: ChangeInsight[]
  decreases: ChangeInsight[]
} {
  const changes: ChangeInsight[] = []

  const processCategory = (
    currentList: { label: string; count: number }[],
    previousList: { label: string; count: number }[],
    type: 'agency' | 'department' | 'error',
  ) => {
    const prevMap = new Map(previousList.map(x => [x.label, x.count]))
    currentList.forEach(curr => {
      const prev = prevMap.get(curr.label) ?? 0
      const delta = curr.count - prev
      const pct = prev > 0 ? Math.round(((curr.count - prev) / prev) * 100) : 100
      if (Math.abs(delta) >= 2) {
        changes.push({
          entity: curr.label,
          entityType: type,
          currentCount: curr.count,
          previousCount: prev,
          delta,
          deltaPct: pct,
        })
      }
    })
  }

  processCategory(current.byAgency, previous.byAgency, 'agency')
  processCategory(current.byDepartment, previous.byDepartment, 'department')
  processCategory(current.byErrorType, previous.byErrorType, 'error')

  const sorted = [...changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return {
    increases: sorted.filter(c => c.delta > 0).slice(0, 5),
    decreases: sorted.filter(c => c.delta < 0).slice(0, 5),
  }
}

/** Genera un párrafo narrativo determinístico basado en los datos */
export function generateExecutiveSummary(current: MonthMetrics, previous: MonthMetrics | null): string {
  const monthName = monthLabelEs(current.monthKey)
  const parts: string[] = []

  if (previous) {
    const volDelta = current.total - previous.total
    const volPct = deltaPct(current.total, previous.total)
    if (volDelta > 0) {
      parts.push(`se observó un incremento de ${volPct}% en tickets creados respecto al mes anterior (${volDelta} tickets adicionales)`)
    } else if (volDelta < 0) {
      parts.push(`se observó una disminución de ${Math.abs(volPct ?? 0)}% en tickets creados respecto al mes anterior (${Math.abs(volDelta)} tickets menos)`)
    } else {
      parts.push(`el volumen de tickets se mantuvo estable respecto al mes anterior`)
    }
  } else {
    parts.push(`se registraron ${current.total} tickets`)
  }

  if (current.topAgency) {
    const pct = Math.round((current.topAgency.count / current.total) * 100)
    parts.push(`concentrándose ${pct}% en ${current.topAgency.name}`)
  }

  if (current.topError) {
    parts.push(`con ${current.topError.name} como el tipo de incidencia más frecuente`)
  }

  const critPct = current.total > 0 ? Math.round((current.criticalCount / current.total) * 100) : 0
  if (critPct >= 30) {
    parts.push(`El ${critPct}% de los tickets fueron críticos, lo que requiere atención prioritaria`)
  }

  if (previous && current.resolutionRatePct < previous.resolutionRatePct - 5) {
    parts.push(`La tasa de resolución disminuyó de ${previous.resolutionRatePct}% a ${current.resolutionRatePct}%`)
  } else if (previous && current.resolutionRatePct > previous.resolutionRatePct + 5) {
    parts.push(`La tasa de resolución mejoró de ${previous.resolutionRatePct}% a ${current.resolutionRatePct}%`)
  }

  const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  return `En ${cap} ${parts.join(', ')}.`
}

/** Genera hallazgos clave determinísticamente */
export function generateKeyFindings(current: MonthMetrics, previous: MonthMetrics | null): string[] {
  const findings: string[] = []

  if (previous) {
    const volDelta = current.total - previous.total
    const volPct = deltaPct(current.total, previous.total) ?? 0
    if (Math.abs(volPct) >= 10) {
      findings.push(
        `Volumen mensual ${volDelta > 0 ? 'aumentó' : 'disminuyó'} ${Math.abs(volPct)}% (${Math.abs(volDelta)} tickets)`,
      )
    }

    const resDelta = current.resolutionRatePct - previous.resolutionRatePct
    if (Math.abs(resDelta) >= 5) {
      findings.push(
        `Tasa de resolución ${resDelta > 0 ? 'mejoró' : 'empeoró'} ${Math.abs(resDelta)} puntos porcentuales`,
      )
    }

    if (
      current.avgResolutionHours != null &&
      previous.avgResolutionHours != null &&
      Math.abs(current.avgResolutionHours - previous.avgResolutionHours) >= 6
    ) {
      const diff = current.avgResolutionHours - previous.avgResolutionHours
      findings.push(
        `Tiempo promedio de resolución ${diff > 0 ? 'aumentó' : 'disminuyó'} ${Math.abs(diff).toFixed(1)} horas`,
      )
    }
  }

  const critPct = current.total > 0 ? Math.round((current.criticalCount / current.total) * 100) : 0
  if (critPct >= 25) {
    findings.push(`${critPct}% de tickets fueron críticos, indicando alta presión operativa`)
  } else if (critPct < 10) {
    findings.push(`Solo ${critPct}% de tickets fueron críticos, reflejando operación estable`)
  }

  if (current.topAgency) {
    const concPct = Math.round((current.topAgency.count / current.total) * 100)
    if (concPct >= 30) {
      findings.push(`${current.topAgency.name} concentró ${concPct}% del total (${current.topAgency.count} tickets)`)
    }
  }

  if (current.topError && current.total > 0) {
    const errPct = Math.round((current.topError.count / current.total) * 100)
    if (errPct >= 20) {
      findings.push(`${current.topError.name} representa ${errPct}% de las incidencias`)
    }
  }

  if (current.pctResolvedWithin48h != null && current.pctResolvedWithin48h >= 70) {
    findings.push(`${current.pctResolvedWithin48h}% de tickets se resolvieron en menos de 48 horas (buen SLA)`)
  } else if (current.pctResolvedWithin48h != null && current.pctResolvedWithin48h < 50) {
    findings.push(`Solo ${current.pctResolvedWithin48h}% de tickets se resolvieron en 48h, sugeriendo posibles cuellos de botella`)
  }

  if (findings.length === 0) {
    findings.push('Operación dentro de parámetros esperados sin variaciones significativas')
  }

  return findings.slice(0, 5)
}
