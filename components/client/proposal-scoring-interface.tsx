"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, CheckCircle2, Loader2, Save, WifiOff } from "lucide-react"
import { GET_SCORING_TEMPLATE, GET_PROPOSAL_SCORES } from "@/lib/graphql/queries"
import { SCORE_PROPOSAL, FINALIZE_SCORING } from "@/lib/graphql/mutations"
import type { ScoringTemplate, ProposalScore } from "@/lib/graphql/types"
import { useToast } from "@/components/ui/use-toast"

interface ProposalScoringInterfaceProps {
  projectId: string
  proposalId: string
  onScoreFinalized?: () => void
}

interface ScoreData {
  criterionId: string
  rawScore: number
  notes: string
}

export function ProposalScoringInterface({
  projectId,
  proposalId,
  onScoreFinalized,
}: ProposalScoringInterfaceProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [scores, setScores] = useState<Map<string, ScoreData>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Fetch scoring template
  const {
    data: templateData,
    isLoading: isLoadingTemplate,
    error: templateError,
  } = useQuery({
    queryKey: ['scoringTemplate', projectId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_SCORING_TEMPLATE,
          variables: { projectId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch scoring template')
      return result.data.scoringTemplate as ScoringTemplate | null
    },
  })

  // Fetch existing scores
  const {
    data: existingScoresData,
    isLoading: isLoadingScores,
    error: scoresError,
  } = useQuery({
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
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch proposal scores')
      return result.data.proposalScores as ProposalScore[]
    },
  })

  // Initialize scores from existing data
  useEffect(() => {
    if (existingScoresData && templateData) {
      const scoreMap = new Map<string, ScoreData>()
      
      // Initialize with existing scores
      existingScoresData.forEach(score => {
        scoreMap.set(score.criterion.id, {
          criterionId: score.criterion.id,
          rawScore: score.rawScore,
          notes: score.notes || "",
        })
      })
      
      // Fill in missing criteria with default values
      templateData.criteria.forEach(criterion => {
        if (!scoreMap.has(criterion.id)) {
          scoreMap.set(criterion.id, {
            criterionId: criterion.id,
            rawScore: 5, // Default middle value
            notes: "",
          })
        }
      })
      
      setScores(scoreMap)
    }
  }, [existingScoresData, templateData])

  // Score proposal mutation with optimistic updates and rollback
  const scoreProposalMutation = useMutation({
    mutationFn: async (scoreData: ScoreData) => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: SCORE_PROPOSAL,
          variables: {
            input: {
              proposalId,
              criterionId: scoreData.criterionId,
              rawScore: scoreData.rawScore,
              notes: scoreData.notes || null,
            },
          },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to save score')
      return result.data.scoreProposal as ProposalScore
    },
    onMutate: async (scoreData) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['proposalScores', proposalId] })

      // Snapshot the previous value for rollback
      const previousScores = queryClient.getQueryData<ProposalScore[]>(['proposalScores', proposalId])

      // Optimistically update the cache
      if (previousScores) {
        const optimisticScores = previousScores.map(score => {
          if (score.criterion.id === scoreData.criterionId) {
            return {
              ...score,
              rawScore: scoreData.rawScore,
              notes: scoreData.notes,
              weightedScore: (scoreData.rawScore * score.criterion.weight) / 100,
            }
          }
          return score
        })
        queryClient.setQueryData(['proposalScores', proposalId], optimisticScores)
      }

      // Return context with previous value for rollback
      return { previousScores }
    },
    onError: (error, scoreData, context) => {
      // Rollback to previous value on error
      if (context?.previousScores) {
        queryClient.setQueryData(['proposalScores', proposalId], context.previousScores)
      }
      
      toast({
        title: "Error Saving Score",
        description: error instanceof Error ? error.message : "Failed to save score. Please try again.",
        variant: "destructive",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalScores', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposalRankings', projectId] })
      setHasUnsavedChanges(false)
    },
  })

  // Finalize scoring mutation with optimistic updates
  const finalizeScoringMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: FINALIZE_SCORING,
          variables: {
            input: { proposalId },
          },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to finalize scoring')
      return result.data.finalizeScoring
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['proposalScores', proposalId] })

      // Snapshot the previous value for rollback
      const previousScores = queryClient.getQueryData<ProposalScore[]>(['proposalScores', proposalId])

      // Optimistically mark all scores as final
      if (previousScores) {
        const optimisticScores = previousScores.map(score => ({
          ...score,
          isFinal: true,
        }))
        queryClient.setQueryData(['proposalScores', proposalId], optimisticScores)
      }

      return { previousScores }
    },
    onError: (error, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousScores) {
        queryClient.setQueryData(['proposalScores', proposalId], context.previousScores)
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to finalize scoring",
        variant: "destructive",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposalScores', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposalRankings', projectId] })
      toast({
        title: "Scoring Finalized",
        description: "Your scores have been submitted successfully.",
      })
      if (onScoreFinalized) {
        onScoreFinalized()
      }
    },
  })

  // Auto-save with debouncing (1.5 seconds)
  const debouncedSave = useCallback((scoreData: ScoreData) => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    // Set new timeout for auto-save
    const timeout = setTimeout(() => {
      setIsSaving(true)
      scoreProposalMutation.mutate(scoreData, {
        onSettled: () => setIsSaving(false),
      })
    }, 1500) // 1.5 second debounce

    setSaveTimeout(timeout)
  }, [saveTimeout, scoreProposalMutation])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveTimeout])

  const updateScore = (criterionId: string, updates: Partial<ScoreData>) => {
    setScores(prev => {
      const newScores = new Map(prev)
      const existing = newScores.get(criterionId) || {
        criterionId,
        rawScore: 5,
        notes: "",
      }
      const updated = { ...existing, ...updates }
      newScores.set(criterionId, updated)
      
      // Trigger auto-save
      setHasUnsavedChanges(true)
      debouncedSave(updated)
      
      return newScores
    })
  }

  const calculateWeightedScore = (rawScore: number, weight: number): number => {
    return (rawScore * weight) / 100
  }

  const calculateTotalScore = (): number => {
    if (!templateData) return 0
    
    let total = 0
    templateData.criteria.forEach(criterion => {
      const score = scores.get(criterion.id)
      if (score) {
        total += calculateWeightedScore(score.rawScore, criterion.weight)
      }
    })
    
    return total
  }

  const handleFinalizeScoring = async () => {
    if (!templateData) return
    
    // Check if all criteria are scored
    const allScored = templateData.criteria.every(criterion => 
      scores.has(criterion.id)
    )
    
    if (!allScored) {
      toast({
        title: "Incomplete Scoring",
        description: "Please score all criteria before finalizing.",
        variant: "destructive",
      })
      return
    }

    // Save any pending changes first
    if (hasUnsavedChanges && saveTimeout) {
      clearTimeout(saveTimeout)
      setIsSaving(true)
      
      // Save all scores
      const savePromises = Array.from(scores.values()).map(scoreData =>
        scoreProposalMutation.mutateAsync(scoreData)
      )
      
      try {
        await Promise.all(savePromises)
        setIsSaving(false)
        setHasUnsavedChanges(false)
      } catch (error) {
        setIsSaving(false)
        toast({
          title: "Error",
          description: "Failed to save scores. Please try again.",
          variant: "destructive",
        })
        return
      }
    }

    // Finalize scoring
    finalizeScoringMutation.mutate()
  }

  // Loading state
  if (isLoadingTemplate || isLoadingScores) {
    return (
      <div className="space-y-6">
        <Card className="border-yellow-400/20">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (templateError || scoresError) {
    return (
      <Alert className="border-red-500/50 bg-red-500/5">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-700 dark:text-red-400">
          {templateError ? 'Failed to load scoring template. ' : 'Failed to load existing scores. '}
          Please try refreshing the page.
        </AlertDescription>
      </Alert>
    )
  }

  // No template state
  if (!templateData) {
    return (
      <Alert className="border-yellow-400/50 bg-yellow-400/5">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertDescription className="text-yellow-700 dark:text-yellow-400">
          No scoring template has been configured for this project. Please create a scoring template first.
        </AlertDescription>
      </Alert>
    )
  }

  const totalScore = calculateTotalScore()
  const isFinalized = existingScoresData?.some(score => score.isFinal) || false

  return (
    <div className="space-y-6">
      {/* Total Score Display */}
      <Card className="border-yellow-400 bg-yellow-400/5">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-between">
            <span>Total Score</span>
            <span className="text-4xl font-bold text-yellow-400">
              {totalScore.toFixed(2)}
            </span>
          </CardTitle>
          <CardDescription>
            Out of 100 points • {templateData.criteria.length} criteria
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Auto-save indicator */}
      {(isSaving || hasUnsavedChanges) && (
        <Alert className="border-blue-500/50 bg-blue-500/5">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                Saving changes...
              </AlertDescription>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                Changes will be saved automatically in {saveTimeout ? '1.5' : '0'} seconds
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Error indicator for failed saves */}
      {scoreProposalMutation.isError && (
        <Alert className="border-red-500/50 bg-red-500/5">
          <WifiOff className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700 dark:text-red-400">
            Failed to save changes. Your changes will be retried automatically.
          </AlertDescription>
        </Alert>
      )}

      {/* Finalized indicator */}
      {isFinalized && (
        <Alert className="border-green-500/50 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            This scoring has been finalized and submitted.
          </AlertDescription>
        </Alert>
      )}

      {/* Scoring Criteria */}
      <div className="space-y-4">
        {templateData.criteria
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(criterion => {
            const scoreData = scores.get(criterion.id) || {
              criterionId: criterion.id,
              rawScore: 5,
              notes: "",
            }
            const weightedScore = calculateWeightedScore(scoreData.rawScore, criterion.weight)

            return (
              <Card key={criterion.id} className="border-yellow-400/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{criterion.name}</CardTitle>
                      {criterion.description && (
                        <CardDescription className="mt-1">
                          {criterion.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-muted-foreground">Weight</div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {criterion.weight}%
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`score-${criterion.id}`}>
                        Raw Score (1-10)
                      </Label>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-yellow-400">
                          {scoreData.rawScore.toFixed(1)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Weighted: {weightedScore.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Slider
                      id={`score-${criterion.id}`}
                      min={1}
                      max={10}
                      step={0.1}
                      value={[scoreData.rawScore]}
                      onValueChange={([value]) => 
                        updateScore(criterion.id, { rawScore: value })
                      }
                      disabled={isFinalized}
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
                    <Label htmlFor={`notes-${criterion.id}`}>
                      Notes (optional)
                    </Label>
                    <Textarea
                      id={`notes-${criterion.id}`}
                      placeholder="Add your evaluation notes here..."
                      value={scoreData.notes}
                      onChange={(e) => 
                        updateScore(criterion.id, { notes: e.target.value })
                      }
                      disabled={isFinalized}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {/* Finalize Button */}
      {!isFinalized && (
        <div className="flex justify-end">
          <Button
            onClick={handleFinalizeScoring}
            disabled={finalizeScoringMutation.isPending || isSaving}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
            size="lg"
          >
            {finalizeScoringMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalize Scoring
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
