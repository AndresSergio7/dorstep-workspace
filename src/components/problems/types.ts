export type ProblemRow = {
  id: string
  title: string
  description: string
  solution: string
  tags?: string[] | null
  created_at?: string
  client?: { name: string; id?: string } | null
}
