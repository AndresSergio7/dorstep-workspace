export type TaskStatus = 'todo' | 'in_progress' | 'done'

export function statusFromRow(row: { status?: string | null; done?: boolean }): TaskStatus {
  const s = row.status
  if (s === 'todo' || s === 'in_progress' || s === 'done') return s
  return row.done ? 'done' : 'todo'
}

export function dbFieldsForStatus(status: TaskStatus): { status: TaskStatus; done: boolean } {
  return { status, done: status === 'done' }
}
