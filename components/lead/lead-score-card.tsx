"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, TrendingUp, Award } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScoringCriterion {
  id: string
  name: string
  description?: string
  weight: number
  orderIndex: number
}

interface ProposalScore {
  id: string
  proposalId: string
  criterion: ScoringCriterion
  rawScore: number
  weightedScore: number
  isFinal: boolean
}

interface ProposalRanking {
  rank: number
  totalScore: number
  isFullyScored: boolean
}

interface LeadScoreCardProps {
  scores: ProposalScore[]
  ranking?: ProposalRanking | null
  className?: string
}

export function LeadScoreCard({ scores, ranking, className }: LeadScoreCardProps) {
  // Calculate total score from scores if not provided in ranking
  const totalScore = ranking?.totalScore ?? scores.reduce((sum, score) => sum + score.weightedScore, 0)
  const isFullyScored = ranking?.isFullyScored ?? scores.every(score => score.isFinal)
  const rank = ranking?.rank

  // Sort scores by order index
  const sortedScores = [...scores].sort((a, b) => a.criterion.orderIndex - b.criterion.orderIndex)

  return (
    <Card className={cn("border-yellow-400/20 bg-white dark:bg-black", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-black dark:text-white">
            Evaluation Score
          </CardTitle>
          {isFullyScored ? (
            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
              <Award className="h-3 w-3 mr-1" />
              Scored
            </Badge>
          ) : (
            <Badge variant="outline" className="border-yellow-400 text-yellow-400">
              Partially Scored
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Total Score Display */}
        <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium text-muted-foreground">
                Total Score
              </span>
            </div>
            {rank && (
              <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                Rank #{rank}
              </Badge>
            )}
          </div>
          <div className="text-3xl font-bold text-yellow-400">
            {totalScore.toFixed(2)}
          </div>
          {!isFullyScored && (
            <p className="text-xs text-muted-foreground mt-2">
              Score may change as evaluation continues
            </p>
          )}
        </div>

        {/* Individual Criterion Scores */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-yellow-400" />
            <h4 className="text-sm font-semibold text-black dark:text-white">
              Criterion Breakdown
            </h4>
          </div>

          {sortedScores.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No scores available yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedScores.map((score) => (
                <div key={score.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {score.criterion.name}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {score.criterion.weight}%
                        </Badge>
                      </div>
                      {score.criterion.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {score.criterion.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-yellow-400">
                        {score.weightedScore.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {score.rawScore.toFixed(1)}/10
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <Progress 
                    value={(score.rawScore / 10) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scoring Status Message */}
        {!isFullyScored && scores.length > 0 && (
          <div className="pt-4 border-t border-yellow-400/20">
            <p className="text-xs text-muted-foreground text-center">
              The client is still evaluating your proposal. Check back later for updates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
