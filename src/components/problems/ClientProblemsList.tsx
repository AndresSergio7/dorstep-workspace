'use client'
import ProblemCard from '@/components/problems/ProblemCard'
import type { ProblemRow } from '@/components/problems/types'

type Props = {
  problems: ProblemRow[]
}

export default function ClientProblemsList({ problems }: Props) {
  return (
    <div className="space-y-2">
      {problems.map(p => (
        <ProblemCard key={p.id} problem={p} variant="compact" />
      ))}
    </div>
  )
}
