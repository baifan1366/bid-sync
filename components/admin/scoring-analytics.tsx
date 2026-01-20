'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Target, 
  FileCheck, 
  Clock,
  Loader2,
  Calendar,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const SCORING_ANALYTICS_QUERY = `
  query ScoringAnalytics($dateFrom: String, $dateTo: String) {
    scoringAnalytics(dateFrom: $dateFrom, dateTo: $dateTo) {
      scoringUsagePercentage
      averageProposalsScored
      mostCommonCriteria {
        name
        count
        percentage
      }
      averageScoringDuration
    }
  }
`

export function ScoringAnalytics() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  const getDateFrom = () => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString()
  }

  const { data, isLoading } = useQuery({
    queryKey: ['scoringAnalytics', dateRange],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<any>(SCORING_ANALYTICS_QUERY, {
        dateFrom: getDateFrom(),
        dateTo: new Date().toISOString(),
      })
    }
  })

  if (isLoading) {
    return <ScoringAnalyticsSkeleton />
  }

  const analytics = data?.scoringAnalytics

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

      {/* Key Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Scoring System Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-yellow-400" />
                Scoring Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-yellow-400">
                  {(analytics?.scoringUsagePercentage || 0).toFixed(1)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                of projects use scoring templates
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-green-500" />
                Avg Proposals Scored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {(analytics?.averageProposalsScored || 0).toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                proposals scored per project
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Avg Scoring Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {(analytics?.averageScoringDuration || 0).toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                from first score to finalization
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Most Common Criteria */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-yellow-400" />
            Most Common Scoring Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.mostCommonCriteria && analytics.mostCommonCriteria.length > 0 ? (
            <div className="space-y-4">
              {analytics.mostCommonCriteria.map((criterion: any, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{criterion.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {criterion.count} uses
                      </span>
                      <span className="text-sm font-semibold text-yellow-400">
                        {criterion.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: `${criterion.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No scoring criteria data available for this period
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
