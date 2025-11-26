"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GET_TEAM_METRICS } from "@/lib/graphql/queries"
import {
  Users,
  UserCheck,
  Crown,
  User,
  FileText,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamStatistics {
  totalMembers: number
  activeMembers: number
  averageContribution: number
  topContributors: Array<{
    userId: string
    userName: string
    email: string
    sectionsCompleted: number
    sectionsAssigned: number
    completionRate: number
  }>
}

interface TeamStatisticsCardProps {
  projectId: string
}

export function TeamStatisticsCard({ projectId }: TeamStatisticsCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["team-statistics", projectId],
    queryFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_TEAM_METRICS,
          variables: { projectId },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to fetch team statistics")
      }

      return result.data.getTeamMetrics as TeamStatistics
    },
    staleTime: 60 * 1000, // 1 minute
  })

  if (isLoading) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Failed to load team statistics</p>
              {error && (
                <p className="text-xs text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = data

  return (
    <Card className="border-yellow-400/20 bg-white dark:bg-black">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black dark:text-white">
          <TrendingUp className="h-5 w-5 text-yellow-400" />
          Team Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Members */}
          <StatCard
            icon={<Users className="h-5 w-5 text-yellow-400" />}
            label="Total Members"
            value={stats.totalMembers}
            className="bg-yellow-400/5"
          />

          {/* Active Members */}
          <StatCard
            icon={<UserCheck className="h-5 w-5 text-yellow-400" />}
            label="Active Members"
            value={stats.activeMembers}
            subtitle={`${Math.round((stats.activeMembers / Math.max(stats.totalMembers, 1)) * 100)}% of team`}
            className="bg-yellow-400/5"
          />

          {/* Average Contribution */}
          <StatCard
            icon={<FileText className="h-5 w-5 text-yellow-400" />}
            label="Avg. Sections"
            value={stats.averageContribution.toFixed(1)}
            subtitle="per member"
            className="bg-yellow-400/5"
          />

          {/* Top Contributors Count */}
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-yellow-400" />}
            label="Top Contributors"
            value={stats.topContributors.length}
            subtitle="high performers"
            className="bg-yellow-400/5"
          />
        </div>

        {/* Top Contributors List */}
        {stats.topContributors.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-black dark:text-white flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              Top Contributors
            </h4>
            <div className="space-y-2">
              {stats.topContributors.slice(0, 3).map((contributor, index) => (
                <div
                  key={contributor.userId}
                  className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm",
                        index === 0 && "bg-yellow-400 text-black",
                        index === 1 && "bg-yellow-400/70 text-black",
                        index === 2 && "bg-yellow-400/40 text-black"
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black dark:text-white truncate">
                        {contributor.userName || contributor.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contributor.sectionsCompleted} of{" "}
                        {contributor.sectionsAssigned} sections
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-yellow-400">
                      {Math.round(contributor.completionRate)}%
                    </p>
                    <p className="text-xs text-muted-foreground">complete</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.totalMembers === 0 && (
          <div className="text-center py-6">
            <Users className="h-12 w-12 text-yellow-400 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No team members yet. Invite members to see statistics.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtitle?: string
  className?: string
}

function StatCard({ icon, label, value, subtitle, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border border-yellow-400/20",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-yellow-400/20">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold text-black dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}
