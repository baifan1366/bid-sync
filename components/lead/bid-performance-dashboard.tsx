"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, TrendingUp, Target, Users, Clock } from "lucide-react"
import { GET_BID_PERFORMANCE } from "@/lib/graphql/queries"
import { WinRateChart } from "./win-rate-chart"
import { ProposalStatusBreakdown } from "./proposal-status-breakdown"
import { ActivityTimelineChart } from "./activity-timeline-chart"

interface BidPerformance {
  totalProposals: number
  submitted: number
  accepted: number
  rejected: number
  winRate: number
  statusBreakdown: {
    draft: number
    submitted: number
    reviewing: number
    approved: number
    rejected: number
  }
  averageTeamSize: number
  averageSectionsCount: number
  averageTimeToSubmit: number
}

interface ProposalStatistics {
  totalProposals: number
  byStatus: {
    draft: number
    submitted: number
    reviewing: number
    approved: number
    rejected: number
  }
  recentProposals: Array<{
    id: string
    projectId: string
    projectTitle: string
    status: string
    submittedAt: string | null
    teamSize: number
    sectionsCount: number
    documentsCount: number
  }>
  performanceMetrics: {
    averageTeamSize: number
    averageSectionsCount: number
    averageDocumentsCount: number
    averageTimeToSubmit: number
  }
}

interface ActivityTimeline {
  proposalActivity: Array<{ date: string; count: number }>
  submissionActivity: Array<{ date: string; count: number }>
  acceptanceActivity: Array<{ date: string; count: number }>
}

interface BidPerformanceDashboardProps {
  leadId: string
}

export function BidPerformanceDashboard({ leadId }: BidPerformanceDashboardProps) {
  const [performance, setPerformance] = useState<BidPerformance | null>(null)
  const [statistics, setStatistics] = useState<ProposalStatistics | null>(null)
  const [timeline, setTimeline] = useState<ActivityTimeline | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30)

  useEffect(() => {
    loadAnalytics()
  }, [leadId, timeRange])

  const loadAnalytics = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch bid performance via GraphQL with timeout
      const perfResponse = await Promise.race([
        fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: GET_BID_PERFORMANCE,
            variables: { leadId },
          }),
        }),
        new Promise<Response>((_, reject) => 
          setTimeout(() => reject(new Error('GraphQL request timeout')), 15000)
        )
      ])

      if (!perfResponse.ok) {
        throw new Error(`GraphQL request failed: ${perfResponse.status} ${perfResponse.statusText}`)
      }

      const perfResult = await perfResponse.json()

      if (perfResult.errors) {
        console.error('GraphQL errors:', perfResult.errors)
        throw new Error(perfResult.errors[0]?.message || 'Failed to fetch bid performance')
      }

      const perfData = perfResult.data?.getBidPerformance

      if (!perfData) {
        throw new Error('No performance data returned from GraphQL')
      }

      // Fetch statistics and timeline via API routes with timeout
      const [statsResponse, timelineResponse] = await Promise.all([
        Promise.race([
          fetch(`/api/analytics/statistics?leadId=${leadId}`),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Statistics request timeout')), 10000)
          )
        ]),
        Promise.race([
          fetch(`/api/analytics/timeline?leadId=${leadId}&days=${timeRange}`),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Timeline request timeout')), 10000)
          )
        ])
      ])

      if (!statsResponse.ok) {
        throw new Error(`Statistics request failed: ${statsResponse.status}`)
      }

      if (!timelineResponse.ok) {
        throw new Error(`Timeline request failed: ${timelineResponse.status}`)
      }

      const statsData = await statsResponse.json()
      const timelineData = await timelineResponse.json()

      setPerformance(perfData)
      setStatistics(statsData)
      setTimeline(timelineData)
    } catch (err) {
      console.error('Analytics loading error:', err)
      setError(err instanceof Error ? err.message : "Failed to load analytics")
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeToSubmit = (seconds: number): string => {
    if (seconds === 0) return "N/A"
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (days > 0) {
      return `${days}d ${hours}h`
    }
    return `${hours}h`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div>
            <h3 className="font-semibold text-black dark:text-white">
              Unable to Load Analytics
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (!performance || !statistics || !timeline) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
          Performance Analytics
        </h2>
        <p className="text-muted-foreground">
          Track your bidding success and team performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <Target className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {performance.winRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <TrendingUp className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Proposals</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {performance.totalProposals}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <Users className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Team Size</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {performance.averageTeamSize.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Time to Submit</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {formatTimeToSubmit(performance.averageTimeToSubmit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white dark:bg-black border border-yellow-400/20">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <WinRateChart performance={performance} />
            <ProposalStatusBreakdown statusBreakdown={performance.statusBreakdown} />
          </div>

          {/* Performance Metrics */}
          <Card className="border-yellow-400/20 bg-white dark:bg-black">
            <CardHeader>
              <CardTitle className="text-black dark:text-white">
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Average Sections</p>
                  <p className="text-xl font-bold text-black dark:text-white">
                    {performance.averageSectionsCount.toFixed(1)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {performance.accepted}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {performance.rejected}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <p className="text-sm text-muted-foreground">Time Range:</p>
            <div className="flex gap-2">
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days as 30 | 60 | 90)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeRange === days
                      ? "bg-yellow-400 text-black"
                      : "bg-white dark:bg-black border border-yellow-400/20 text-black dark:text-white hover:bg-yellow-400/10"
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
          <ActivityTimelineChart timeline={timeline} />
        </TabsContent>
      </Tabs>

      {/* Recent Proposals */}
      {statistics.recentProposals.length > 0 && (
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardHeader>
            <CardTitle className="text-black dark:text-white">
              Recent Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statistics.recentProposals.slice(0, 5).map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/5 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-black dark:text-white">
                      {proposal.projectTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Team: {proposal.teamSize} • Sections: {proposal.sectionsCount} • Docs: {proposal.documentsCount}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        proposal.status === "approved"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : proposal.status === "rejected"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : proposal.status === "submitted"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                      }`}
                    >
                      {proposal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
