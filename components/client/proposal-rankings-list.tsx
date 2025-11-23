"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { GET_PROPOSAL_RANKINGS } from "@/lib/graphql/queries"
import { ProposalRanking } from "@/lib/graphql/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, TrendingUp, AlertCircle } from "lucide-react"
import { ProposalRankingCard } from "./proposal-ranking-card"
import { useRealtimeRankings } from "@/hooks/use-realtime-rankings"
import { ConnectionStatusIndicator } from "@/components/editor/connection-status-indicator"

interface ProposalRankingsListProps {
  projectId: string
  onScoreProposal?: (proposalId: string) => void
}

type ScoringStatus = "all" | "fully_scored" | "partially_scored" | "not_scored"

export function ProposalRankingsList({
  projectId,
  onScoreProposal,
}: ProposalRankingsListProps) {
  const [filterStatus, setFilterStatus] = React.useState<ScoringStatus>("all")

  // Fetch rankings
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["proposalRankings", projectId],
    queryFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_PROPOSAL_RANKINGS,
          variables: { projectId },
        }),
      })
      const result = await response.json()
      if (result.errors) {
        throw new Error(
          result.errors[0]?.message || "Failed to fetch proposal rankings"
        )
      }
      return result.data.proposalRankings as ProposalRanking[]
    },
    enabled: !!projectId,
  })

  // Set up real-time subscription with connection status
  const { connectionStatus, reconnect } = useRealtimeRankings({
    projectId,
    onRankingUpdated: () => {
      // Refetch rankings when any ranking is updated
      refetch()
    },
    onRankingInserted: () => {
      // Refetch rankings when a new ranking is inserted
      refetch()
    },
    onRankingDeleted: () => {
      // Refetch rankings when a ranking is deleted
      refetch()
    },
  })

  // Filter rankings by status
  const filteredRankings = React.useMemo(() => {
    if (!data) return []

    if (filterStatus === "all") return data

    return data.filter((ranking) => {
      if (filterStatus === "fully_scored") return ranking.isFullyScored
      if (filterStatus === "not_scored") return ranking.totalScore === 0
      if (filterStatus === "partially_scored")
        return !ranking.isFullyScored && ranking.totalScore > 0
      return true
    })
  }, [data, filterStatus])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-16 mb-4" />
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-6 w-32" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-red-500/10 p-6 mb-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
          Failed to load rankings
        </h3>
        <p className="text-muted-foreground max-w-md mb-4">
          There was an error loading the proposal rankings. Please try again.
        </p>
        <Button
          onClick={() => refetch()}
          className="bg-yellow-400 text-black hover:bg-yellow-500"
        >
          Retry
        </Button>
      </div>
    )
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-yellow-400/10 p-6 mb-4">
          <Trophy className="h-12 w-12 text-yellow-400" />
        </div>
        <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
          No rankings available
        </h3>
        <p className="text-muted-foreground max-w-md">
          Rankings will appear here once you start scoring proposals for this project.
        </p>
      </div>
    )
  }

  // Empty filtered state
  if (filteredRankings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Proposal Rankings
          </h2>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ScoringStatus)}>
            <SelectTrigger className="w-[180px] border-yellow-400/40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Proposals</SelectItem>
              <SelectItem value="fully_scored">Fully Scored</SelectItem>
              <SelectItem value="partially_scored">Partially Scored</SelectItem>
              <SelectItem value="not_scored">Not Scored</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="rounded-full bg-yellow-400/10 p-6 mb-4">
            <TrendingUp className="h-12 w-12 text-yellow-400" />
          </div>
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
            No proposals match this filter
          </h3>
          <p className="text-muted-foreground max-w-md">
            Try selecting a different filter to see more proposals.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filter and connection status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            Proposal Rankings
          </h2>
          <ConnectionStatusIndicator
            status={connectionStatus.status}
            onReconnect={reconnect}
          />
        </div>
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ScoringStatus)}>
          <SelectTrigger className="w-[180px] border-yellow-400/40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Proposals</SelectItem>
            <SelectItem value="fully_scored">Fully Scored</SelectItem>
            <SelectItem value="partially_scored">Partially Scored</SelectItem>
            <SelectItem value="not_scored">Not Scored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rankings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredRankings.map((ranking) => (
          <ProposalRankingCard
            key={ranking.id}
            ranking={ranking}
            onScoreProposal={onScoreProposal}
          />
        ))}
      </div>

      {/* Summary footer */}
      <div className="border-t border-yellow-400/20 pt-4 text-sm text-muted-foreground">
        Showing {filteredRankings.length} of {data.length} proposals
        {filterStatus !== "all" && ` (filtered by ${filterStatus.replace("_", " ")})`}
      </div>
    </div>
  )
}
