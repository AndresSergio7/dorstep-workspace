'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeKickoffPayload, kickoffDefaults, type ContactItem, type KickoffFormData, missingKickoffItems, type KickoffStatus } from '@/lib/kickoff-form'
import { useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'
import { Download, FileText, Plus, Save, Trash2 } from 'lucide-react'

type KickoffRow = {
  id: string
  client_id: string
  title: string
  status: KickoffStatus
  meeting_date: string | null
  payload: unknown
  created_at: string
  updated_at: string
}

export default function KickoffFormEditor({
  client,
  initialKickoff,
}: {
  client: { id: string; name: string }
  initialKickoff?: KickoffRow | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [kickoffId, setKickoffId] = useState<string | null>(initialKickoff?.id ?? null)
  const [status, setStatus] = useState<KickoffStatus>(initialKickoff?.status ?? 'draft')
  const [title, setTitle] = useState(initialKickoff?.title ?? `Kickoff ${client.name}`)
  const [data, setData] = useState<KickoffFormData>(() => {
    const hydrated = normalizeKickoffPayload(initialKickoff?.payload)
    return {
      ...hydrated,
      client_name: hydrated.client_name || client.name,
      meeting_date: hydrated.meeting_date || initialKickoff?.meeting_date || '',
    }
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const pendingItems = useMemo(() => missingKickoffItems(data), [data])

  function updateField<K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  function addContact() {
    const next: ContactItem = { name: '', role: '', email: '', phone: '' }
    updateField('additional_contacts', [...data.additional_contacts, next])
  }

  function updateContact(index: number, field: keyof ContactItem, value: string) {
    const contacts = data.additional_contacts.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    updateField('additional_contacts', contacts)
  }

  function removeContact(index: number) {
    updateField(
      'additional_contacts',
      data.additional_contacts.filter((_, idx) => idx !== index),
    )
  }

  async function persist(nextStatus?: KickoffStatus, autosave = false): Promise<string | null> {
    if (!title.trim()) {
      setError('El título del kickoff es obligatorio.')
      return null
    }
    if (!autosave) setSaving(true)
    setError(null)

    const payload = { ...data, client_name: data.client_name || client.name }
    const statusToSave = nextStatus ?? status
    const row = {
      client_id: client.id,
      title: title.trim(),
      status: statusToSave,
      meeting_date: payload.meeting_date || null,
      payload,
    }
    try {
      if (kickoffId) {
        const { error: updateError } = await supabase.from('kickoff_forms').update(row).eq('id', kickoffId)
        if (updateError) throw updateError
        setStatus(statusToSave)
        setSavedAt(new Date().toISOString())
        router.refresh()
        return kickoffId
      }
      const { data: inserted, error: insertError } = await supabase.from('kickoff_forms').insert(row).select('id').single()
      if (insertError) throw insertError
      const newId = inserted?.id as string
      setKickoffId(newId)
      setStatus(statusToSave)
      setSavedAt(new Date().toISOString())
      router.replace(`/clients/${client.id}/kickoff/${newId}`)
      router.refresh()
      return newId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el kickoff.')
      return null
    } finally {
      if (!autosave) setSaving(false)
    }
  }

  useEffect(() => {
    if (!kickoffId) return
    const timer = setTimeout(() => {
      void persist(undefined, true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [data, title]) // eslint-disable-line react-hooks/exhaustive-deps

  async function markCompleted() {
    const criticalMissing = missingKickoffItems(data).filter(item =>
      ['Nombre del cliente', 'Nombre del proyecto', 'Fecha de reunión', 'PM / Account Manager', 'Objetivo principal'].includes(item),
    )
    if (criticalMissing.length) {
      setError(`Completa los campos obligatorios antes de cerrar: ${criticalMissing.join(', ')}`)
      return
    }
    await persist('completed')
  }

  async function generatePdf() {
    const id = kickoffId ?? (await persist())
    if (!id) return
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    const width = 515
    let y = 50

    function ensureSpace(lines = 1) {
      if (y + lines * 18 > 780) {
        pdf.addPage()
        y = 50
      }
    }

    function addTitle(text: string) {
      ensureSpace(2)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(text, margin, y)
      y += 24
    }

    function addSection(titleText: string) {
      ensureSpace(2)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text(titleText, margin, y)
      y += 16
    }

    function addField(label: string, value?: string) {
      const safeValue = value?.trim() ? value.trim() : '—'
      const wrapped = pdf.splitTextToSize(`${label}: ${safeValue}`, width)
      ensureSpace(wrapped.length + 1)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(wrapped, margin, y)
      y += wrapped.length * 14
    }

    addTitle('Client Discovery / Kickoff Form')
    addField('Cliente', data.client_name || client.name)
    addField('Proyecto', data.project_name)
    addField('Fecha', data.meeting_date)
    addField('Estado', status === 'completed' ? 'Completado' : 'Borrador')
    y += 8

    addSection('1. Información general')
    addField('PM / Account Manager', data.internal_pm)
    addField('Estado del proyecto', data.project_status)

    addSection('2. Contactos del cliente')
    addField('Contacto principal', data.main_contact_name)
    addField('Rol', data.main_contact_role)
    addField('Email', data.main_contact_email)
    addField('Teléfono', data.main_contact_phone)
    addField('Canal preferido', data.preferred_channel)
    addField('Grupo Teams requerido', data.teams_group_required ? 'Sí' : 'No')
    addField('Notas de comunicación', data.communication_notes)
    if (data.additional_contacts.length) {
      data.additional_contacts.forEach((c, i) => addField(`Contacto adicional ${i + 1}`, `${c.name} | ${c.role} | ${c.email} | ${c.phone}`))
    }

    addSection('3. Canales del agente')
    addField('WhatsApp requerido', data.whatsapp_required ? 'Sí' : 'No')
    addField('Agente de voz requerido', data.voice_agent_required ? 'Sí' : 'No')
    addField('Otros canales', data.other_channels)
    addField('Número de WhatsApp provisto', data.whatsapp_number_provided ? 'Sí' : 'No')
    addField('Número WhatsApp', data.whatsapp_number)
    addField('Notas migración WhatsApp', data.whatsapp_migration_notes)

    addSection('4. Objetivo de negocio')
    addField('Objetivo principal', data.main_goal)
    addField('Objetivos secundarios', data.secondary_goals)
    addField('Casos de uso', data.use_cases)
    addField('Resultado esperado', data.expected_outcome)

    addSection('5. Alcance conversacional')
    addField('Debe hacer', data.should_do)
    addField('No debe hacer', data.should_not_do)
    addField('FAQ', data.faq)
    addField('Productos/servicios', data.products_covered)
    addField('Escalaciones', data.escalation_scenarios)
    addField('Reglas handoff humano', data.handoff_rules)

    addSection('6. Tono y personalidad')
    addField('Nombre del agente', data.agent_name)
    addField('Tono', data.tone === 'custom' ? `custom: ${data.tone_custom || '—'}` : data.tone)
    addField('Uso de tú/usted', data.use_tu_usted)
    addField('Guías de marca', data.brand_guidelines)
    addField('Frases a evitar', data.avoid_phrases)

    addSection('7. Flujo conversacional')
    addField('Saludo', data.greeting)
    addField('Preguntas de calificación', data.qualification_questions)
    addField('Datos obligatorios', data.required_data_capture)
    addField('Reglas de calificación', data.lead_qualification_rules)
    addField('Lógica de citas', data.appointment_logic)
    addField('Manejo de objeciones', data.objection_handling)
    addField('Cierre', data.closing_message)
    addField('Notas de flujo', data.flow_notes)

    addSection('8. Integraciones')
    addField('CRM requerido', data.crm_required ? 'Sí' : 'No')
    addField('CRM', data.crm_name)
    addField('Otros sistemas', data.other_systems)
    addField('API disponible', data.api_available ? 'Sí' : 'No')
    addField('Webhooks requeridos', data.webhooks_required ? 'Sí' : 'No')
    addField('Integración calendario', data.calendar_required ? 'Sí' : 'No')
    addField('Notas integración', data.integration_notes)

    addSection('9. Documentación cliente')
    addField('FAQ recibida', data.faq_received ? 'Sí' : 'No')
    addField('Catálogo recibido', data.catalog_received ? 'Sí' : 'No')
    addField('Scripts recibidos', data.scripts_received ? 'Sí' : 'No')
    addField('Docs CRM/API recibidas', data.crm_api_docs_received ? 'Sí' : 'No')
    addField('Otros documentos', data.other_documents)
    addField('Faltantes', data.missing_documents)
    addField('Links de archivos', data.upload_links)

    addSection('10. Restricciones y compliance')
    addField('Restricciones legales', data.legal_restrictions)
    addField('Notas compliance', data.compliance_notes)
    addField('Frases prohibidas', data.forbidden_phrases)
    addField('Temas sensibles', data.sensitive_topics)
    addField('Restricciones de marca', data.brand_restrictions)

    addSection('11. Métricas de éxito')
    addField('KPI principal', data.main_kpis)
    addField('KPIs secundarios', data.secondary_kpis)
    addField('Tiempo de respuesta esperado', data.expected_response_time)
    addField('Meta de conversión', data.expected_conversion_goal)
    addField('Notas', data.metrics_notes)

    addSection('12. Timeline')
    addField('Demo estimada', data.estimated_demo_date)
    addField('Testing estimado', data.estimated_testing_date)
    addField('Go-live estimado', data.estimated_go_live_date)
    addField('Notas timeline', data.timeline_notes)

    addSection('13. Notas internas')
    addField('Notas técnicas', data.technical_notes)
    addField('Riesgos / blockers', data.risks_blockers)
    addField('Pendientes cliente', data.pending_client_actions)
    addField('Pendientes internos', data.pending_internal_actions)

    addSection('Pending Items / Missing Information')
    if (!pendingItems.length) {
      addField('Resultado', 'Sin pendientes críticos')
    } else {
      pendingItems.forEach(item => addField('Pendiente', item))
    }

    const blob = pdf.output('blob')
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    const url = URL.createObjectURL(blob)
    setPdfUrl(url)
  }

  function downloadGeneratedPdf() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    const safeTitle = (title || 'kickoff').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    a.href = pdfUrl
    a.download = `${safeTitle}.pdf`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Client discovery / kickoff form</p>
            <h1 className="page-title mt-1">{title || 'Nuevo kickoff'}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Estado: <span className="font-semibold">{status === 'completed' ? 'Completado' : 'Borrador'}</span>
              {savedAt && <span> · Último guardado: {new Date(savedAt).toLocaleString()}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void persist()} disabled={saving}>
              <Save size={14} className="inline mr-1" />
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => void markCompleted()} disabled={saving}>
              Marcar completado
            </button>
            <button type="button" className="btn-secondary" onClick={() => void generatePdf()} disabled={saving}>
              <FileText size={14} className="inline mr-1" />
              Generar PDF
            </button>
            {pdfUrl && (
              <button type="button" className="btn-primary" onClick={downloadGeneratedPdf}>
                <Download size={14} className="inline mr-1" />
                Descargar PDF
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</p>}
      </div>

      <div className="card space-y-4">
        <h2 className="section-title">1. General information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledInput label="Client name *" value={data.client_name} onChange={v => updateField('client_name', v)} />
          <LabeledInput label="Project name *" value={data.project_name} onChange={v => updateField('project_name', v)} />
          <LabeledInput label="Meeting date *" type="date" value={data.meeting_date} onChange={v => updateField('meeting_date', v)} />
          <LabeledInput label="Internal PM / Account Manager *" value={data.internal_pm} onChange={v => updateField('internal_pm', v)} />
          <LabeledInput label="Project status" value={data.project_status} onChange={v => updateField('project_status', v)} />
          <LabeledInput label="Title" value={title} onChange={setTitle} />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="section-title">2. Client contacts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledInput label="Main point of contact *" value={data.main_contact_name} onChange={v => updateField('main_contact_name', v)} />
          <LabeledInput label="Role / position" value={data.main_contact_role} onChange={v => updateField('main_contact_role', v)} />
          <LabeledInput label="Email *" type="email" value={data.main_contact_email} onChange={v => updateField('main_contact_email', v)} />
          <LabeledInput label="Phone" value={data.main_contact_phone} onChange={v => updateField('main_contact_phone', v)} />
          <LabeledInput label="Preferred communication channel" value={data.preferred_channel} onChange={v => updateField('preferred_channel', v)} />
          <BoolSelect label="Teams group required?" value={data.teams_group_required} onChange={v => updateField('teams_group_required', v)} />
        </div>
        <LabeledTextarea label="Notes about communication" value={data.communication_notes} onChange={v => updateField('communication_notes', v)} />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="label !mb-0">Additional contacts</p>
            <button type="button" className="btn-secondary" onClick={addContact}>
              <Plus size={14} className="inline mr-1" />
              Add contact
            </button>
          </div>
          {data.additional_contacts.map((contact, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <LabeledInput label="Name" value={contact.name} onChange={v => updateContact(idx, 'name', v)} />
              <LabeledInput label="Role" value={contact.role} onChange={v => updateContact(idx, 'role', v)} />
              <LabeledInput label="Email" value={contact.email} onChange={v => updateContact(idx, 'email', v)} />
              <LabeledInput label="Phone" value={contact.phone} onChange={v => updateContact(idx, 'phone', v)} />
              <button type="button" className="btn-danger" onClick={() => removeContact(idx)}>
                <Trash2 size={14} className="inline mr-1" />
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <SectionChannel data={data} onChange={updateField} />
      <SectionBusiness data={data} onChange={updateField} />
      <SectionScope data={data} onChange={updateField} />
      <SectionTone data={data} onChange={updateField} />
      <SectionFlow data={data} onChange={updateField} />
      <SectionIntegrations data={data} onChange={updateField} />
      <SectionDocumentation data={data} onChange={updateField} />
      <SectionRestrictions data={data} onChange={updateField} />
      <SectionMetrics data={data} onChange={updateField} />
      <SectionTimeline data={data} onChange={updateField} />
      <SectionInternal data={data} onChange={updateField} />

      <div className="card border-amber-200 bg-amber-50">
        <h2 className="section-title text-amber-700">Pending Items / Missing Information</h2>
        {!pendingItems.length ? (
          <p className="text-sm text-emerald-700 mt-2">Sin pendientes críticos.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {pendingItems.map(item => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-3">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input min-h-[90px] resize-y" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function BoolSelect({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value ? 'yes' : 'no'} onChange={e => onChange(e.target.value === 'yes')}>
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </div>
  )
}

function SectionChannel({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="3. Agent channels">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BoolSelect label="WhatsApp required?" value={data.whatsapp_required} onChange={v => onChange('whatsapp_required', v)} />
        <BoolSelect label="Voice agent required?" value={data.voice_agent_required} onChange={v => onChange('voice_agent_required', v)} />
        <LabeledInput label="Other channels" value={data.other_channels} onChange={v => onChange('other_channels', v)} />
        <BoolSelect label="WhatsApp number provided by client?" value={data.whatsapp_number_provided} onChange={v => onChange('whatsapp_number_provided', v)} />
        <LabeledInput label="WhatsApp number" value={data.whatsapp_number} onChange={v => onChange('whatsapp_number', v)} />
      </div>
      <LabeledTextarea label="Notes about WhatsApp migration / changes" value={data.whatsapp_migration_notes} onChange={v => onChange('whatsapp_migration_notes', v)} />
    </SectionCard>
  )
}

function SectionBusiness({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="4. Business objective">
      <LabeledTextarea label="Main goal *" value={data.main_goal} onChange={v => onChange('main_goal', v)} />
      <LabeledTextarea label="Secondary goals" value={data.secondary_goals} onChange={v => onChange('secondary_goals', v)} />
      <LabeledTextarea label="Main use cases" value={data.use_cases} onChange={v => onChange('use_cases', v)} />
      <LabeledTextarea label="Expected business outcome" value={data.expected_outcome} onChange={v => onChange('expected_outcome', v)} />
    </SectionCard>
  )
}

function SectionScope({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="5. Conversational scope">
      <LabeledTextarea label="What should the agent do?" value={data.should_do} onChange={v => onChange('should_do', v)} />
      <LabeledTextarea label="What should the agent not do?" value={data.should_not_do} onChange={v => onChange('should_not_do', v)} />
      <LabeledTextarea label="Frequently asked questions" value={data.faq} onChange={v => onChange('faq', v)} />
      <LabeledTextarea label="Products / services covered" value={data.products_covered} onChange={v => onChange('products_covered', v)} />
      <LabeledTextarea label="Escalation scenarios" value={data.escalation_scenarios} onChange={v => onChange('escalation_scenarios', v)} />
      <LabeledTextarea label="Human handoff rules" value={data.handoff_rules} onChange={v => onChange('handoff_rules', v)} />
    </SectionCard>
  )
}

function SectionTone({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="6. Tone and personality">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LabeledInput label="Agent name" value={data.agent_name} onChange={v => onChange('agent_name', v)} />
        <div>
          <label className="label">Tone</label>
          <select className="input" value={data.tone} onChange={e => onChange('tone', e.target.value as KickoffFormData['tone'])}>
            <option value="formal">formal</option>
            <option value="friendly">friendly</option>
            <option value="professional">professional</option>
            <option value="custom">custom</option>
          </select>
        </div>
      </div>
      {data.tone === 'custom' && <LabeledInput label="Custom tone" value={data.tone_custom} onChange={v => onChange('tone_custom', v)} />}
      <LabeledInput label="Use of tú / usted" value={data.use_tu_usted} onChange={v => onChange('use_tu_usted', v)} />
      <LabeledTextarea label="Brand guidelines" value={data.brand_guidelines} onChange={v => onChange('brand_guidelines', v)} />
      <LabeledTextarea label="Words or phrases to avoid" value={data.avoid_phrases} onChange={v => onChange('avoid_phrases', v)} />
    </SectionCard>
  )
}

function SectionFlow({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="7. Conversation flow requirements">
      <LabeledTextarea label="Greeting" value={data.greeting} onChange={v => onChange('greeting', v)} />
      <LabeledTextarea label="Qualification questions" value={data.qualification_questions} onChange={v => onChange('qualification_questions', v)} />
      <LabeledTextarea label="Required data to capture" value={data.required_data_capture} onChange={v => onChange('required_data_capture', v)} />
      <LabeledTextarea label="Lead qualification rules" value={data.lead_qualification_rules} onChange={v => onChange('lead_qualification_rules', v)} />
      <LabeledTextarea label="Appointment booking logic" value={data.appointment_logic} onChange={v => onChange('appointment_logic', v)} />
      <LabeledTextarea label="Objection handling notes" value={data.objection_handling} onChange={v => onChange('objection_handling', v)} />
      <LabeledTextarea label="Closing message" value={data.closing_message} onChange={v => onChange('closing_message', v)} />
      <LabeledTextarea label="Additional flow notes" value={data.flow_notes} onChange={v => onChange('flow_notes', v)} />
    </SectionCard>
  )
}

function SectionIntegrations({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="8. Integrations">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BoolSelect label="CRM required?" value={data.crm_required} onChange={v => onChange('crm_required', v)} />
        <LabeledInput label="CRM name" value={data.crm_name} onChange={v => onChange('crm_name', v)} />
        <LabeledInput label="Other systems" value={data.other_systems} onChange={v => onChange('other_systems', v)} />
        <BoolSelect label="API available?" value={data.api_available} onChange={v => onChange('api_available', v)} />
        <BoolSelect label="Webhooks required?" value={data.webhooks_required} onChange={v => onChange('webhooks_required', v)} />
        <BoolSelect label="Calendar integration required?" value={data.calendar_required} onChange={v => onChange('calendar_required', v)} />
      </div>
      <LabeledTextarea label="Integration notes" value={data.integration_notes} onChange={v => onChange('integration_notes', v)} />
    </SectionCard>
  )
}

function SectionDocumentation({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="9. Client documentation">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BoolSelect label="FAQ document received?" value={data.faq_received} onChange={v => onChange('faq_received', v)} />
        <BoolSelect label="Product catalog received?" value={data.catalog_received} onChange={v => onChange('catalog_received', v)} />
        <BoolSelect label="Existing scripts received?" value={data.scripts_received} onChange={v => onChange('scripts_received', v)} />
        <BoolSelect label="CRM/API docs received?" value={data.crm_api_docs_received} onChange={v => onChange('crm_api_docs_received', v)} />
      </div>
      <LabeledTextarea label="Other documents" value={data.other_documents} onChange={v => onChange('other_documents', v)} />
      <LabeledTextarea label="Missing documentation" value={data.missing_documents} onChange={v => onChange('missing_documents', v)} />
      <LabeledTextarea
        label="File upload section / links"
        value={data.upload_links}
        onChange={v => onChange('upload_links', v)}
      />
    </SectionCard>
  )
}

function SectionRestrictions({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="10. Restrictions / compliance">
      <LabeledTextarea label="Legal restrictions" value={data.legal_restrictions} onChange={v => onChange('legal_restrictions', v)} />
      <LabeledTextarea label="Compliance notes" value={data.compliance_notes} onChange={v => onChange('compliance_notes', v)} />
      <LabeledTextarea label="Things the agent must never say" value={data.forbidden_phrases} onChange={v => onChange('forbidden_phrases', v)} />
      <LabeledTextarea label="Sensitive topics" value={data.sensitive_topics} onChange={v => onChange('sensitive_topics', v)} />
      <LabeledTextarea label="Brand restrictions" value={data.brand_restrictions} onChange={v => onChange('brand_restrictions', v)} />
    </SectionCard>
  )
}

function SectionMetrics({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="11. Success metrics">
      <LabeledTextarea label="Main KPIs" value={data.main_kpis} onChange={v => onChange('main_kpis', v)} />
      <LabeledTextarea label="Secondary KPIs" value={data.secondary_kpis} onChange={v => onChange('secondary_kpis', v)} />
      <LabeledInput label="Expected response time" value={data.expected_response_time} onChange={v => onChange('expected_response_time', v)} />
      <LabeledInput label="Expected conversion goal" value={data.expected_conversion_goal} onChange={v => onChange('expected_conversion_goal', v)} />
      <LabeledTextarea label="Notes" value={data.metrics_notes} onChange={v => onChange('metrics_notes', v)} />
    </SectionCard>
  )
}

function SectionTimeline({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="12. Timeline">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <LabeledInput label="Estimated demo date" type="date" value={data.estimated_demo_date} onChange={v => onChange('estimated_demo_date', v)} />
        <LabeledInput label="Estimated testing date" type="date" value={data.estimated_testing_date} onChange={v => onChange('estimated_testing_date', v)} />
        <LabeledInput label="Estimated go-live date" type="date" value={data.estimated_go_live_date} onChange={v => onChange('estimated_go_live_date', v)} />
      </div>
      <LabeledTextarea label="Timeline notes" value={data.timeline_notes} onChange={v => onChange('timeline_notes', v)} />
    </SectionCard>
  )
}

function SectionInternal({ data, onChange }: { data: KickoffFormData; onChange: <K extends keyof KickoffFormData>(field: K, value: KickoffFormData[K]) => void }) {
  return (
    <SectionCard title="13. Internal notes">
      <LabeledTextarea label="Technical notes" value={data.technical_notes} onChange={v => onChange('technical_notes', v)} />
      <LabeledTextarea label="Risks / blockers" value={data.risks_blockers} onChange={v => onChange('risks_blockers', v)} />
      <LabeledTextarea label="Pending client actions" value={data.pending_client_actions} onChange={v => onChange('pending_client_actions', v)} />
      <LabeledTextarea label="Pending internal actions" value={data.pending_internal_actions} onChange={v => onChange('pending_internal_actions', v)} />
    </SectionCard>
  )
}
