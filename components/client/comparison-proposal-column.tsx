"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { ProposalWithScores, ScoringCriterion } from "@/lib/graphql/types"

interface ComparisonProposalColumnProps {
  proposalData: ProposalWithScores
  criteria: ScoringCriterion[]
  isBestScore: (criterionId: string, proposalId: string) => boolean
  isWorstScore: (criterionId: string, proposalId: string) => boolean
}

/**
 * ComparisonProposalColumn displays a single proposal's scores in a comparison view.
 * 
 * Features:
 * - Proposal header with title, lead info, and total score
 * - Criteria scores list with raw and weighted scores
 * - Visual indicators for best (green) and worst (red) scores
 * - Scoring status badge
 * - Progress bars for visual score representation
 * 
 * Requirements: 6.2, 6.3, 6.5
 */
export function ComparisonProposalColumn({
  proposalData,
  criteria,
  isBestScore,
  isWorstScore,
}: ComparisonProposalColumnProps) {
  return (
    <div className="space-y-4 pb-4">
      {/* Proposal Header */}
      <Card className="border-yellow-400/20 sticky top-0 z-10 bg-white dark:bg-black">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
              Rank #{proposalData.rank}
            </Badge>
            <div className="text-2xl font-bold text-yellow-400">
              {proposalData.totalScore.toFixed(2)}
            </div>
          </div>
          <CardTitle className="text-lg line-clamp-2">
            {proposalData.proposal.title || "Untitled Proposal"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            by {proposalData.proposal.biddingLead.name}
          </p>
          {proposalData.proposal.budgetEstimate && (
            <p className="text-sm text-muted-foreground">
              ${proposalData.proposal.budgetEstimate.toLocaleString()}
            </p>
          )}
          <Badge
            variant={proposalData.isFullyScored ? "default" : "outline"}
            className={
              proposalData.isFullyScored
                ? "bg-green-500 text-white hover:bg-green-600 mt-2"
                : "border-yellow-400/40 mt-2"
            }
          >
            {proposalData.isFullyScored ? "Fully Scored" : "Partial"}
          </Badge>
        </CardHeader>
      </Card>

      {/* Criteria Scores */}
      {criteria.map((criterion) => {
        const score = proposalData.scores.find((s) => s.criterion.id === criterion.id)
        const isBest = isBestScore(criterion.id, proposalData.proposal.id)
        const isWorst = isWorstScore(criterion.id, proposalData.proposal.id)

        return (
          <Card
            key={criterion.id}
            className={`border-yellow-400/20 ${
              isBest
                ? "bg-green-500/10 border-green-500/40"
                : isWorst
                ? "bg-red-500/10 border-red-500/40"
                : ""
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{criterion.name}</CardTitle>
                  {criterion.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {criterion.description}
                    </p>
                  )}
                </div>
                <div className="text-right ml-2">
                  <div className="text-xs text-muted-foreground">Weight</div>
                  <div className="text-sm font-semibold text-yellow-400">
                    {criterion.weight}%
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {score ? (
                <>
                  {/* Score indicators */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isBest && (
                        <Badge className="bg-green-500 text-white hover:bg-green-600 text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Best
                        </Badge>
                      )}
                      {isWorst && (
                        <Badge className="bg-red-500 text-white hover:bg-red-600 text-xs">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Worst
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Raw score */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Raw Score</span>
                      <span className="font-semibold text-yellow-400">
                        {score.rawScore.toFixed(1)} / 10
                      </span>
                    </div>
                    <Progress
                      value={(score.rawScore / 10) * 100}
                      className="h-2"
                    />
                  </div>

                  {/* Weighted score */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Weighted Score</span>
                    <span className="font-semibold">
                      {score.weightedScore.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Badge variant="outline" className="border-yellow-400/40">
                    Not Scored
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
