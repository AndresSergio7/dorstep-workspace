'use client'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Lightbulb, Search } from 'lucide-react'
import ProblemCard from '@/components/problems/ProblemCard'
import type { ProblemRow } from '@/components/problems/types'

export default function ProblemsPage() {
  const supabase = createClient()
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    supabase.from('problems').select('*, client:clients(name)').order('created_at', { ascending: false })
      .then(({ data }) => { setProblems((data as ProblemRow[]) ?? []); setLoading(false) })
  }, [supabase])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const { data } = await supabase.from('problems').select('*, client:clients(name)').or(`title.ilike.%${q}%,description.ilike.%${q}%,solution.ilike.%${q}%`).limit(6)
    setResults((data as ProblemRow[]) ?? [])
    setSearching(false)
  }, [supabase])

  useEffect(() => { const t = setTimeout(() => search(query), 300); return () => clearTimeout(t) }, [query, search])

  function handleProblemUpdated(updated: ProblemRow) {
    setProblems(prev => prev.map(p => p.id === updated.id ? updated : p))
    setResults(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="page-title">Problem library</h1><p className="text-muted-foreground text-sm mt-1">{problems.length} problems — search to find past solutions</p></div>
          <Link href="/problems/new" className="btn-primary flex items-center gap-2"><Plus size={16} />Log problem</Link>
        </div>
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input pl-9" placeholder="Describe a problem to see similar solutions..." value={query} onChange={e => setQuery(e.target.value)} />
          {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Searching...</span>}
        </div>
        {query.trim() && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">{results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;</p>
            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map(p => <ProblemCard key={p.id} problem={p} variant="search" onProblemUpdated={handleProblemUpdated} />)}
              </div>
            ) : (
              <div className="card text-center py-8">
                <p className="text-muted-foreground text-sm">No similar problems found</p>
                <Link href="/problems/new" className="btn-primary inline-flex items-center gap-2 mt-3 text-sm"><Plus size={14} />Log this problem</Link>
              </div>
            )}
          </div>
        )}
        {!query.trim() && (
          loading ? <div className="text-muted-foreground text-sm p-4">Loading...</div>
          : !problems.length ? (
            <div className="card text-center py-16">
              <Lightbulb size={40} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No problems logged yet</p>
              <Link href="/problems/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus size={16} />Log problem</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {problems.map(p => <ProblemCard key={p.id} problem={p} onProblemUpdated={handleProblemUpdated} />)}
            </div>
          )
        )}
      </div>
    </AppLayout>
  )
}
