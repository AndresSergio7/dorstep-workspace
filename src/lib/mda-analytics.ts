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
} as const

export interface ParsedTicket {
  status: string
  created: Date
  updated: Date | null
  urgency: string
  agency: string
  reporter: string
  errorType: string
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
  topError: { name: string; count: number } | null
  topAgency: { name: string; count: number } | null
  topReporter: { name: string; count: number } | null
  byStatus: { label: string; count: number }[]
  byErrorType: { label: string; count: number }[]
  byAgency: { label: string; count: number }[]
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

  const errMap = countBy(tickets.map(t => t.errorType))
  const topErrorEntry = [...errMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topError = topErrorEntry ? { name: topErrorEntry[0], count: topErrorEntry[1] } : null

  const agMap = countBy(tickets.map(t => t.agency))
  const topAgencyEntry = [...agMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topAgency = topAgencyEntry ? { name: topAgencyEntry[0], count: topAgencyEntry[1] } : null

  const repMap = countBy(tickets.map(t => t.reporter))
  const topReporterEntry = [...repMap.entries()].sort((a, b) => b[1] - a[1])[0]
  const topReporter = topReporterEntry ? { name: topReporterEntry[0], count: topReporterEntry[1] } : null

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
    topError,
    topAgency,
    topReporter,
    byStatus,
    byErrorType,
    byAgency,
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
