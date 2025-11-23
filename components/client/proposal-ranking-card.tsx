"use client"

import * as React from "react"
import { ProposalRanking } from "@/lib/graphql/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

interface ProposalRankingCardProps {
  ranking: ProposalRanking
  onScoreProposal?: (proposalId: string) => void
}

export function ProposalRankingCard({
  ranking,
  onScoreProposal,
}: ProposalRankingCardProps) {
  // Get scoring status badge
  const getScoringStatusBadge = () => {
    if (ranking.isFullyScored) {
      return (
        <Badge className="bg-green-500 text-white hover:bg-green-600">
          Fully Scored
        </Badge>
      )
    }
    if (ranking.totalScore > 0) {
      return (
        <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
          Partially Scored
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-yellow-400/40 text-muted-foreground">
        Not Scored
      </Badge>
    )
  }

  return (
    <Card className="p-6 border-yellow-400/20 hover:border-yellow-400/40 transition-all hover:shadow-lg hover:scale-[1.02]">
      {/* Rank badge */}
      <div className="flex items-center justify-between mb-4">
        <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 text-lg font-bold px-3 py-1">
          #{ranking.rank}
        </Badge>
        {getScoringStatusBadge()}
      </div>

      {/* Proposal info */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-lg text-black dark:text-white line-clamp-2">
            {ranking.proposal.title || "Untitled Proposal"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            by {ranking.proposal.biddingLead.name}
          </p>
        </div>

        {/* Total score */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-yellow-400">
            {ranking.totalScore.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>

        {/* Budget if available */}
        {ranking.proposal.budgetEstimate && (
          <p className="text-sm text-muted-foreground">
            Budget: ${ranking.proposal.budgetEstimate.toLocaleString()}
          </p>
        )}

        {/* Action button */}
        <Button
          onClick={() => onScoreProposal?.(ranking.proposal.id)}
          className={
            ranking.isFullyScored
              ? "w-full border-yellow-400/40 hover:bg-yellow-400/10"
              : "w-full bg-yellow-400 text-black hover:bg-yellow-500"
          }
          variant={ranking.isFullyScored ? "outline" : "default"}
        >
          {ranking.isFullyScored ? "View Scores" : "Score Proposal"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
