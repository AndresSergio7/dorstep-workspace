export type KickoffStatus = 'draft' | 'completed'

export type ContactItem = {
  name: string
  role: string
  email: string
  phone: string
}

export type KickoffFormData = {
  client_name: string
  project_name: string
  meeting_date: string
  internal_pm: string
  project_status: string
  main_contact_name: string
  main_contact_role: string
  main_contact_email: string
  main_contact_phone: string
  additional_contacts: ContactItem[]
  preferred_channel: string
  teams_group_required: boolean
  communication_notes: string
  whatsapp_required: boolean
  voice_agent_required: boolean
  other_channels: string
  whatsapp_number_provided: boolean
  whatsapp_number: string
  whatsapp_migration_notes: string
  main_goal: string
  secondary_goals: string
  use_cases: string
  expected_outcome: string
  should_do: string
  should_not_do: string
  faq: string
  products_covered: string
  escalation_scenarios: string
  handoff_rules: string
  agent_name: string
  tone: 'formal' | 'friendly' | 'professional' | 'custom'
  tone_custom: string
  use_tu_usted: string
  brand_guidelines: string
  avoid_phrases: string
  greeting: string
  qualification_questions: string
  required_data_capture: string
  lead_qualification_rules: string
  appointment_logic: string
  objection_handling: string
  closing_message: string
  flow_notes: string
  crm_required: boolean
  crm_name: string
  other_systems: string
  api_available: boolean
  webhooks_required: boolean
  calendar_required: boolean
  integration_notes: string
  faq_received: boolean
  catalog_received: boolean
  scripts_received: boolean
  crm_api_docs_received: boolean
  other_documents: string
  missing_documents: string
  upload_links: string
  legal_restrictions: string
  compliance_notes: string
  forbidden_phrases: string
  sensitive_topics: string
  brand_restrictions: string
  main_kpis: string
  secondary_kpis: string
  expected_response_time: string
  expected_conversion_goal: string
  metrics_notes: string
  estimated_demo_date: string
  estimated_testing_date: string
  estimated_go_live_date: string
  timeline_notes: string
  technical_notes: string
  risks_blockers: string
  pending_client_actions: string
  pending_internal_actions: string
}

export const kickoffDefaults: KickoffFormData = {
  client_name: '',
  project_name: '',
  meeting_date: '',
  internal_pm: '',
  project_status: '',
  main_contact_name: '',
  main_contact_role: '',
  main_contact_email: '',
  main_contact_phone: '',
  additional_contacts: [],
  preferred_channel: '',
  teams_group_required: false,
  communication_notes: '',
  whatsapp_required: false,
  voice_agent_required: false,
  other_channels: '',
  whatsapp_number_provided: false,
  whatsapp_number: '',
  whatsapp_migration_notes: '',
  main_goal: '',
  secondary_goals: '',
  use_cases: '',
  expected_outcome: '',
  should_do: '',
  should_not_do: '',
  faq: '',
  products_covered: '',
  escalation_scenarios: '',
  handoff_rules: '',
  agent_name: '',
  tone: 'professional',
  tone_custom: '',
  use_tu_usted: '',
  brand_guidelines: '',
  avoid_phrases: '',
  greeting: '',
  qualification_questions: '',
  required_data_capture: '',
  lead_qualification_rules: '',
  appointment_logic: '',
  objection_handling: '',
  closing_message: '',
  flow_notes: '',
  crm_required: false,
  crm_name: '',
  other_systems: '',
  api_available: false,
  webhooks_required: false,
  calendar_required: false,
  integration_notes: '',
  faq_received: false,
  catalog_received: false,
  scripts_received: false,
  crm_api_docs_received: false,
  other_documents: '',
  missing_documents: '',
  upload_links: '',
  legal_restrictions: '',
  compliance_notes: '',
  forbidden_phrases: '',
  sensitive_topics: '',
  brand_restrictions: '',
  main_kpis: '',
  secondary_kpis: '',
  expected_response_time: '',
  expected_conversion_goal: '',
  metrics_notes: '',
  estimated_demo_date: '',
  estimated_testing_date: '',
  estimated_go_live_date: '',
  timeline_notes: '',
  technical_notes: '',
  risks_blockers: '',
  pending_client_actions: '',
  pending_internal_actions: '',
}

export const kickoffRequiredFields: (keyof KickoffFormData)[] = [
  'client_name',
  'project_name',
  'meeting_date',
  'internal_pm',
  'main_contact_name',
  'main_contact_email',
  'main_goal',
]

export function normalizeKickoffPayload(raw: unknown): KickoffFormData {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    ...kickoffDefaults,
    ...source,
    additional_contacts: Array.isArray(source.additional_contacts)
      ? source.additional_contacts.map(c => ({
          name: String((c as Record<string, unknown>)?.name ?? ''),
          role: String((c as Record<string, unknown>)?.role ?? ''),
          email: String((c as Record<string, unknown>)?.email ?? ''),
          phone: String((c as Record<string, unknown>)?.phone ?? ''),
        }))
      : [],
  }
}

export function missingKickoffItems(data: KickoffFormData): string[] {
  const pending: string[] = []
  for (const field of kickoffRequiredFields) {
    if (!String(data[field] ?? '').trim()) pending.push(fieldLabel(field))
  }
  if (data.crm_required && !data.crm_name.trim()) pending.push('Nombre de CRM')
  if (data.whatsapp_required && !data.whatsapp_number.trim()) pending.push('Número de WhatsApp')
  if (!data.faq_received) pending.push('Documento de FAQ')
  if (!data.catalog_received) pending.push('Catálogo de productos/servicios')
  if (!data.crm_api_docs_received && data.crm_required) pending.push('Documentación CRM/API')
  return pending
}

function fieldLabel(key: keyof KickoffFormData): string {
  const map: Partial<Record<keyof KickoffFormData, string>> = {
    client_name: 'Nombre del cliente',
    project_name: 'Nombre del proyecto',
    meeting_date: 'Fecha de reunión',
    internal_pm: 'PM / Account Manager',
    main_contact_name: 'Contacto principal',
    main_contact_email: 'Email de contacto principal',
    main_goal: 'Objetivo principal',
  }
  return map[key] ?? key
}
