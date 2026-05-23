'use client'
import { useState, useEffect } from 'react'
import { Lightbulb, Tag, Expand } from 'lucide-react'
import ProblemSeeMoreModal from './ProblemSeeMoreModal'
import type { ProblemRow } from './types'

type Props = {
  problem: ProblemRow
  variant?: 'list' | 'search' | 'compact'
  onProblemUpdated?: (updated: ProblemRow) => void
}

export default function ProblemCard({ problem, variant = 'list', onProblemUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(problem)

  useEffect(() => { setCurrent(problem) }, [problem])

  function handleSaved(updated: ProblemRow) {
    setCurrent(updated)
    onProblemUpdated?.(updated)
  }

  const modal = open && (
    <ProblemSeeMoreModal
      problem={current}
      onClose={() => setOpen(false)}
      onSaved={handleSaved}
    />
  )

  if (variant === 'search') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="card hover:border-amber-300 hover:shadow-md transition-all w-full text-left cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{current.title}</p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{current.description}</p>
              <div className="mt-2 p-2.5 bg-muted/50 border border-border rounded-lg">
                <p className="text-xs font-semibold text-foreground mb-1">Solution</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{current.solution}</p>
              </div>
              {current.client && <p className="text-xs text-muted-foreground mt-2">{current.client.name}</p>}
            </div>
            <SeeMoreIcon small />
          </div>
        </button>
        {modal}
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-3 rounded-lg border border-border/60 hover:border-amber-200 hover:bg-muted/30 transition-all flex items-start justify-between gap-2 w-full text-left cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{current.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{current.description}</p>
          </div>
          <SeeMoreIcon small />
        </button>
        {modal}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card hover:shadow-md transition-all hover:border-amber-200 flex items-center justify-between group w-full text-left cursor-pointer"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Lightbulb size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground group-hover:text-amber-700">{current.title}</p>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{current.description}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {current.client && <span className="text-xs text-muted-foreground">{current.client.name}</span>}
              {current.tags?.map(tag => (
                <span key={tag} className="badge bg-amber-50 text-amber-600">
                  <Tag size={9} className="mr-1" />{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <SeeMoreIcon />
      </button>
      {modal}
    </>
  )
}

function SeeMoreIcon({ small }: { small?: boolean }) {
  return (
    <span
      className={`flex-shrink-0 text-muted-foreground ${small ? 'p-1' : 'p-2 ml-2'}`}
      aria-hidden="true"
    >
      <Expand size={small ? 14 : 16} />
    </span>
  )
}
