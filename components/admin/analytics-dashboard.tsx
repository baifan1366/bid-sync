'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  FileText, 
  CheckCircle, 
  TrendingUp,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScoringAnalytics } from './scoring-analytics'
import { AnalyticsDashboardSkeleton } from './analytics-dashboard-skeleton'

const PLATFORM_ANALYTICS_QUERY = `
  query PlatformAnalytics($dateFrom: String, $dateTo: String) {
    platformAnalytics(dateFrom: $dateFrom, dateTo: $dateTo) {
      userGrowth {
        date
        value
      }
      projectStats {
        total
        pending
        open
        closed
        awarded
      }
      proposalStats {
        total
        draft
        submitted
        accepted
        rejected
      }
      conversionRates {
        projectApprovalRate
        proposalAcceptanceRate
        clientRetentionRate
      }
    }
  }
`

export function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  const getDateFrom = () => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['platformAnalytics', dateRange],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<any>(PLATFORM_ANALYTICS_QUERY, {
        dateFrom: getDateFrom(),
        dateTo: new Date().toISOString(),
      })
    }
  })

  if (isLoading) {
    return <AnalyticsDashboardSkeleton />
  }

  const analytics = data?.platformAnalytics

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-yellow-400" />
        <span className="text-sm font-medium">Time Period:</span>
        <div className="flex gap-2">
          <Button
            variant={dateRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('7d')}
            className={dateRange === '7d' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'border-yellow-400/20'}
          >
            Last 7 Days
          </Button>
          <Button
            variant={dateRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('30d')}
            className={dateRange === '30d' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'border-yellow-400/20'}
          >
            Last 30 Days
          </Button>
          <Button
            variant={dateRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('90d')}
            className={dateRange === '90d' ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'border-yellow-400/20'}
          >
            Last 90 Days
          </Button>
        </div>
      </div>

      {/* Project Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Project Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{analytics?.projectStats.total || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">{analytics?.projectStats.pending || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold">{analytics?.projectStats.open || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Awarded</p>
                  <p className="text-2xl font-bold">{analytics?.projectStats.awarded || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed</p>
                  <p className="text-2xl font-bold">{analytics?.projectStats.closed || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Proposal Statistics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Proposal Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Proposals</p>
                  <p className="text-2xl font-bold">{analytics?.proposalStats.total || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Draft</p>
                  <p className="text-2xl font-bold">{analytics?.proposalStats.draft || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-2xl font-bold">{analytics?.proposalStats.submitted || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold">{analytics?.proposalStats.accepted || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold">{analytics?.proposalStats.rejected || 0}</p>
                </div>
                <FileText className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conversion Rates */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Conversion Rates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base">Project Approval Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">
                  {(analytics?.conversionRates.projectApprovalRate || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Projects approved vs submitted
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base">Proposal Acceptance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">
                  {(analytics?.conversionRates.proposalAcceptanceRate || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Proposals accepted vs submitted
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base">Client Retention Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">
                  {(analytics?.conversionRates.clientRetentionRate || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Returning clients
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Growth Chart Placeholder */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>User Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-yellow-400/20 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
              <p className="text-muted-foreground">
                Chart visualization coming soon
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {analytics?.userGrowth?.length || 0} data points available
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Analytics Section */}
      <div className="pt-8 border-t border-yellow-400/20">
        <h2 className="text-2xl font-semibold mb-6">Proposal Scoring Analytics</h2>
        <ScoringAnalytics />
      </div>
    </div>
  )
}
