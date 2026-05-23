'use client'
import Link from 'next/link'
import { X, Tag, Building2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProblemRow } from './types'

type Props = {
  problem: ProblemRow
  onClose: () => void
  onSaved?: (updated: ProblemRow) => void
}

export default function ProblemSeeMoreModal({ problem, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState(problem.title)
  const [description, setDescription] = useState(problem.description)
  const [solution, setSolution] = useState(problem.solution)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(problem.title)
    setDescription(problem.description)
    setSolution(problem.solution)
  }, [problem])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  async function handleSave() {
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedSolution = solution.trim()
    if (!trimmedTitle || !trimmedDescription || !trimmedSolution) return

    setSaving(true)
    const { error } = await supabase
      .from('problems')
      .update({ title: trimmedTitle, description: trimmedDescription, solution: trimmedSolution })
      .eq('id', problem.id)

    if (!error) {
      onSaved?.({
        ...problem,
        title: trimmedTitle,
        description: trimmedDescription,
        solution: trimmedSolution,
      })
      onClose()
    }
    setSaving(false)
  }

  const canSave = title.trim() && description.trim() && solution.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !saving && onClose()}>
      <div
        className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-modal-title"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <input
            id="problem-modal-title"
            className="input text-lg font-bold flex-1"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={saving}
          />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {problem.client && (
            problem.client.id ? (
              <Link href={`/clients/${problem.client.id}`} className="inline-flex items-center gap-1 hover:text-primary">
                <Building2 size={13} />{problem.client.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1"><Building2 size={13} />{problem.client.name}</span>
            )
          )}
          {problem.created_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} />
              {format(new Date(problem.created_at), 'd MMM yyyy', { locale: enUS })}
            </span>
          )}
        </div>

        {problem.tags && problem.tags.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {problem.tags.map(tag => (
              <span key={tag} className="badge bg-amber-50 text-amber-600">
                <Tag size={10} className="mr-1" />{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="section-title mb-2 block">Problem description</label>
            <textarea
              className="input text-sm min-h-[120px] resize-y w-full"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="section-title mb-2 block">Applied solution</label>
            <textarea
              className="input text-sm min-h-[120px] resize-y w-full"
              value={solution}
              onChange={e => setSolution(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
