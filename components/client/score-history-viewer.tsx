"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, History, ArrowRight, FileText, User, Clock } from "lucide-react"
import { GET_PROPOSAL_SCORE_HISTORY } from "@/lib/graphql/queries"
import type { ProposalScoreHistory } from "@/lib/graphql/types"
import { format } from "date-fns"

interface ScoreHistoryViewerProps {
  proposalId: string
}

export function ScoreHistoryViewer({ proposalId }: ScoreHistoryViewerProps) {
  const [selectedCriterion, setSelectedCriterion] = useState<string>("all")

  // Fetch score history
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['proposalScoreHistory', proposalId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_PROPOSAL_SCORE_HISTORY,
          variables: { proposalId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch score history')
      return result.data.proposalScoreHistory as ProposalScoreHistory[]
    },
  })

  // Get unique criteria for filter
  const criteria = history
    ? Array.from(new Set(history.map(h => h.criterion.id))).map(id => {
        const criterion = history.find(h => h.criterion.id === id)?.criterion
        return criterion
      }).filter(Boolean)
    : []

  // Filter history by selected criterion
  const filteredHistory = selectedCriterion === "all"
    ? history
    : history?.filter(h => h.criterion.id === selectedCriterion)

  // Helper to calculate weighted score
  const calculateWeightedScore = (rawScore: number, weight: number): number => {
    return (rawScore * weight) / 100
  }

  // Helper to render diff for notes
  const renderNotesDiff = (previous?: string, current?: string) => {
    if (!previous && !current) return null
    if (!previous) {
      return (
        <div className="text-sm">
          <span className="text-muted-foreground">Notes added:</span>
          <div className="mt-1 rounded bg-green-500/10 p-2 text-green-700 dark:text-green-400">
            {current}
          </div>
        </div>
      )
    }
    if (!current) {
      return (
        <div className="text-sm">
          <span className="text-muted-foreground">Notes removed:</span>
          <div className="mt-1 rounded bg-red-500/10 p-2 text-red-700 dark:text-red-400 line-through">
            {previous}
          </div>
        </div>
      )
    }
    if (previous !== current) {
      return (
        <div className="text-sm space-y-2">
          <span className="text-muted-foreground">Notes changed:</span>
          <div className="rounded bg-red-500/10 p-2 text-red-700 dark:text-red-400 line-through">
            {previous}
          </div>
          <div className="rounded bg-green-500/10 p-2 text-green-700 dark:text-green-400">
            {current}
          </div>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return <ScoreHistoryViewerSkeleton />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load score history'}
        </p>
      </div>
    )
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-8 text-center">
        <History className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
        <p className="text-muted-foreground">
          No score revisions have been made yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter by Criterion */}
      <div className="flex items-center gap-4">
        <Label htmlFor="criterion-filter" className="whitespace-nowrap">
          Filter by Criterion:
        </Label>
        <Select value={selectedCriterion} onValueChange={setSelectedCriterion}>
          <SelectTrigger id="criterion-filter" className="w-[300px]">
            <SelectValue placeholder="All criteria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Criteria</SelectItem>
            {criteria.map((criterion) => (
              <SelectItem key={criterion!.id} value={criterion!.id}>
                {criterion!.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* History List */}
      <ScrollArea className="h-[600px] rounded-lg border border-yellow-400/20">
        <div className="space-y-4 p-4">
          {filteredHistory && filteredHistory.length > 0 ? (
            filteredHistory.map((entry) => (
              <Card
                key={entry.id}
                className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
              >
                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                          {entry.criterion.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Weight: {entry.criterion.weight}%
                        </span>
                      </div>
                      {entry.criterion.description && (
                        <p className="text-sm text-muted-foreground">
                          {entry.criterion.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(entry.changedAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(entry.changedAt), 'h:mm a')}
                      </div>
                    </div>
                  </div>

                  {/* Score Change */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Previous Score</div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-red-500">
                          {entry.previousRawScore?.toFixed(1) ?? 'N/A'}
                        </span>
                        {entry.previousRawScore && (
                          <span className="text-sm text-muted-foreground">
                            (Weighted: {calculateWeightedScore(entry.previousRawScore, entry.criterion.weight).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-6 w-6 text-yellow-400 shrink-0" />

                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">New Score</div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-green-500">
                          {entry.newRawScore.toFixed(1)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (Weighted: {calculateWeightedScore(entry.newRawScore, entry.criterion.weight).toFixed(2)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  {entry.reason && (
                    <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-medium">Reason for Revision</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.reason}</p>
                    </div>
                  )}

                  {/* Notes Diff */}
                  {renderNotesDiff(entry.previousNotes, entry.newNotes)}

                  {/* Changed By */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-yellow-400/10">
                    <User className="h-4 w-4" />
                    <span>
                      Changed by {entry.changedBy.fullName || entry.changedBy.email}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No revisions found for the selected criterion.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
