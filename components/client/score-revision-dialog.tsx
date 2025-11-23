"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRankings } from "@/hooks/use-realtime-rankings"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Save } from "lucide-react"
import { REVISE_SCORE } from "@/lib/graphql/mutations"
import { GET_PROPOSAL_DETAILS, GET_PROPOSAL_SCORES } from "@/lib/graphql/queries"
import type { ProposalScore, ScoringCriterion } from "@/lib/graphql/types"
import { useToast } from "@/components/ui/use-toast"

interface ScoreRevisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  criterion: ScoringCriterion
  currentScore: ProposalScore
  onRevisionComplete?: () => void
}

export function ScoreRevisionDialog({
  open,
  onOpenChange,
  proposalId,
  criterion,
  currentScore,
  onRevisionComplete,
}: ScoreRevisionDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [rawScore, setRawScore] = useState(currentScore.rawScore)
  const [notes, setNotes] = useState(currentScore.notes || "")
  const [reason, setReason] = useState("")

  // Reset form when dialog opens or current score changes
  useEffect(() => {
    if (open) {
      setRawScore(currentScore.rawScore)
      setNotes(currentScore.notes || "")
      setReason("")
    }
  }, [open, currentScore])

  // Fetch proposal details to check status
  const { data: proposalData } = useQuery({
    queryKey: ['proposalDetails', proposalId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_PROPOSAL_DETAILS,
          variables: { proposalId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch proposal details')
      return result.data.proposalDetail
    },
    enabled: open,
  })

  // Fetch current scores to detect concurrent edits (Requirements: 5.5)
  const { data: scoresData, refetch: refetchScores } = useQuery({
    queryKey: ['proposalScores', proposalId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_PROPOSAL_SCORES,
          variables: { proposalId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch scores')
      return result.data.proposalScores as ProposalScore[]
    },
    enabled: open,
  })

  // Set up real-time updates to detect concurrent edits (Requirements: 5.5)
  useRealtimeRankings({
    projectId: proposalData?.project?.id || '',
    onRankingUpdated: () => {
      if (open) {
        refetchScores()
        // Show warning if score was updated by someone else
        const updatedScore = scoresData?.find(s => s.criterion.id === criterion.id)
        if (updatedScore && updatedScore.rawScore !== currentScore.rawScore) {
          toast({
            title: "Score Updated",
            description: "This score was updated by another user. Please review before saving.",
            variant: "default",
          })
        }
      }
    },
  })

  // Revise score mutation
  const reviseScoreMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: REVISE_SCORE,
          variables: {
            input: {
              proposalId,
              criterionId: criterion.id,
              newRawScore: rawScore,
              newNotes: notes || null,
              reason,
            },
          },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to revise score')
      return result.data.reviseScore as ProposalScore
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalScores', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposalScoreHistory', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposalRankings'] })
      toast({
        title: "Score Revised",
        description: "The score has been updated successfully.",
      })
      onOpenChange(false)
      if (onRevisionComplete) {
        onRevisionComplete()
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to revise score",
        variant: "destructive",
      })
    },
  })

  const calculateWeightedScore = (raw: number, weight: number): number => {
    return (raw * weight) / 100
  }

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this revision.",
        variant: "destructive",
      })
      return
    }

    reviseScoreMutation.mutate()
  }

  const isProposalLocked = proposalData?.status === 'approved' || proposalData?.status === 'rejected'
  const weightedScore = calculateWeightedScore(rawScore, criterion.weight)
  const hasChanges = rawScore !== currentScore.rawScore || notes !== (currentScore.notes || "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Revise Score</DialogTitle>
          <DialogDescription>
            Update the score for "{criterion.name}". All changes will be logged in the score history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning for accepted/rejected proposals */}
          {isProposalLocked && (
            <Alert className="border-yellow-500/50 bg-yellow-500/5">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                This proposal has been {proposalData.status}. Revising scores may affect the final decision.
                Please ensure this change is necessary.
              </AlertDescription>
            </Alert>
          )}

          {/* Current Score Display */}
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Current Score</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {currentScore.rawScore.toFixed(1)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Weighted</div>
                <div className="text-lg font-semibold">
                  {calculateWeightedScore(currentScore.rawScore, criterion.weight).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* New Score Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-score">
                New Raw Score (1-10)
              </Label>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-yellow-400">
                  {rawScore.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  Weighted: {weightedScore.toFixed(2)}
                </span>
              </div>
            </div>
            <Slider
              id="new-score"
              min={1}
              max={10}
              step={0.1}
              value={[rawScore]}
              onValueChange={([value]) => setRawScore(value)}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 (Poor)</span>
              <span>5 (Average)</span>
              <span>10 (Excellent)</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Update your evaluation notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Reason for Revision */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-red-500">
              Reason for Revision *
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why you are revising this score..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none border-red-500/50 focus-visible:ring-red-500"
              required
            />
            <p className="text-xs text-muted-foreground">
              This reason will be recorded in the score history for audit purposes.
            </p>
          </div>

          {/* Change Summary */}
          {hasChanges && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                Changes Summary
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {rawScore !== currentScore.rawScore && (
                  <div>
                    Score: {currentScore.rawScore.toFixed(1)} → {rawScore.toFixed(1)}
                    {rawScore > currentScore.rawScore ? " (↑)" : " (↓)"}
                  </div>
                )}
                {notes !== (currentScore.notes || "") && (
                  <div>Notes: {notes ? "Updated" : "Removed"}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reviseScoreMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reviseScoreMutation.isPending || !hasChanges || !reason.trim()}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {reviseScoreMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Confirm Revision
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
