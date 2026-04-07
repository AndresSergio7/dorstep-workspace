export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}
export interface Meeting {
  id: string
  client_id: string | null
  title: string
  date: string
  attendees: string | null
  content: string | null
  created_at: string
  updated_at: string
  client?: Client
  action_items?: ActionItem[]
}
export type ActionItemStatus = 'todo' | 'in_progress' | 'done'

export interface ActionItem {
  id: string
  meeting_id: string | null
  client_id: string | null
  text: string
  done: boolean
  status?: ActionItemStatus | null
  due_date: string | null
  created_at: string
  client?: Pick<Client, 'id' | 'name'>
  meeting?: Pick<Meeting, 'id' | 'title' | 'date'>
}
export interface Problem {
  id: string
  client_id: string | null
  title: string
  description: string
  solution: string
  tags: string[] | null
  created_at: string
  updated_at: string
  client?: Client
}
export interface Report {
  id: string
  client_id: string | null
  title: string
  period: string | null
  html_content: string | null
  share_token: string | null
  created_at: string
  client?: Client
}
