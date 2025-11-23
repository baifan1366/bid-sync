"use client"

import { useQuery } from "@tanstack/react-query"
import { useRealtimeRankings } from "@/hooks/use-realtime-rankings"
import { GET_SCORING_COMPARISON } from "@/lib/graphql/queries"
import type { ScoringComparison } from "@/lib/graphql/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { ComparisonProposalColumn } from "./comparison-proposal-column"

interface ScoringComparisonViewProps {
  projectId: string
  proposalIds: string[]
}

export function ScoringComparisonView({
  projectId,
  proposalIds,
}: ScoringComparisonViewProps) {
  // Fetch comparison data
  const { data: comparisonData, isLoading, error, refetch } = useQuery({
    queryKey: ["scoringComparison", projectId, proposalIds],
    queryFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_SCORING_COMPARISON,
          variables: { projectId, proposalIds },
        }),
      })
      const result = await response.json()
      if (result.errors) {
        throw new Error(
          result.errors[0]?.message || "Failed to fetch scoring comparison"
        )
      }
      return result.data.scoringComparison as ScoringComparison
    },
    enabled: proposalIds.length >= 2 && proposalIds.length <= 4,
  })

  // Set up real-time updates for rankings (Requirements: 5.5)
  useRealtimeRankings({
    projectId,
    onRankingUpdated: () => {
      refetch()
    },
    onRankingInserted: () => {
      refetch()
    },
  })

  // Helper to check if a score is best for a criterion
  const isBestScore = (criterionId: string, proposalId: string): boolean => {
    return comparisonData?.bestScores.some(
      (bs) => bs.criterionId === criterionId && bs.proposalId === proposalId
    ) || false
  }

  // Helper to check if a score is worst for a criterion
  const isWorstScore = (criterionId: string, proposalId: string): boolean => {
    return comparisonData?.worstScores.some(
      (ws) => ws.criterionId === criterionId && ws.proposalId === proposalId
    ) || false
  }



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="p-6">
          <p className="text-red-500">Failed to load comparison data. Please try again.</p>
        </CardContent>
      </Card>
    )
  }

  if (!comparisonData) {
    return (
      <Card className="border-yellow-400/20">
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Select 2-4 proposals to compare their scores.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Mobile view with tabs
  const MobileView = () => (
    <Tabs defaultValue={comparisonData.proposals[0]?.proposal.id} className="w-full">
      <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${comparisonData.proposals.length}, 1fr)` }}>
        {comparisonData.proposals.map((proposalData) => (
          <TabsTrigger
            key={proposalData.proposal.id}
            value={proposalData.proposal.id}
            className="text-xs"
          >
            #{proposalData.rank}
          </TabsTrigger>
        ))}
      </TabsList>
      {comparisonData.proposals.map((proposalData) => (
        <TabsContent key={proposalData.proposal.id} value={proposalData.proposal.id}>
          <ComparisonProposalColumn
            proposalData={proposalData}
            criteria={comparisonData.criteria}
            isBestScore={isBestScore}
            isWorstScore={isWorstScore}
          />
        </TabsContent>
      ))}
    </Tabs>
  )

  // Desktop view with side-by-side columns
  const DesktopView = () => (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${comparisonData.proposals.length}, 1fr)` }}
    >
      {comparisonData.proposals.map((proposalData) => (
        <ScrollArea
          key={proposalData.proposal.id}
          className="h-[800px]"
          onScrollCapture={(e) => {
            const target = e.target as HTMLDivElement
            // Sync scroll across all columns
            document.querySelectorAll('[data-radix-scroll-area-viewport]').forEach((el) => {
              if (el !== target) {
                el.scrollTop = target.scrollTop
              }
            })
          }}
        >
          <ComparisonProposalColumn
            proposalData={proposalData}
            criteria={comparisonData.criteria}
            isBestScore={isBestScore}
            isWorstScore={isWorstScore}
          />
        </ScrollArea>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="text-2xl">Proposal Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {comparisonData.proposals.map((proposalData) => (
              <div
                key={proposalData.proposal.id}
                className="text-center p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20"
              >
                <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 mb-2">
                  Rank #{proposalData.rank}
                </Badge>
                <div className="text-3xl font-bold text-yellow-400 mb-1">
                  {proposalData.totalScore.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {proposalData.proposal.biddingLead.name}
                </div>
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Responsive comparison view */}
      <div className="md:hidden">
        <MobileView />
      </div>
      <div className="hidden md:block">
        <DesktopView />
      </div>
    </div>
  )
}
