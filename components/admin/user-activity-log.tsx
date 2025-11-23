"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createGraphQLClient } from "@/lib/graphql/client"
import { Download, Activity, Calendar, Globe, Monitor } from "lucide-react"
import type { UserActivityLog as ActivityLog } from "@/lib/graphql/types"

interface UserActivityLogProps {
  userId: string
}

const USER_ACTIVITY_LOGS_QUERY = `
  query UserActivityLogs($userId: ID!, $limit: Int, $offset: Int, $dateFrom: String, $dateTo: String) {
    userActivityLogs(userId: $userId, limit: $limit, offset: $offset, dateFrom: $dateFrom, dateTo: $dateTo) {
      id
      userId
      action
      resourceType
      resourceId
      ipAddress
      userAgent
      metadata
      createdAt
    }
  }
`

const EXPORT_ACTIVITY_LOGS_QUERY = `
  query ExportUserActivityLogs($userId: ID!, $dateFrom: String, $dateTo: String) {
    exportUserActivityLogs(userId: $userId, dateFrom: $dateFrom, dateTo: $dateTo)
  }
`

export function UserActivityLog({ userId }: UserActivityLogProps) {
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const pageSize = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['userActivityLogs', userId, page, dateFrom, dateTo],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<{ userActivityLogs: ActivityLog[] }>(
        USER_ACTIVITY_LOGS_QUERY,
        {
          userId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        }
      )
      return result.userActivityLogs
    },
    staleTime: 1 * 60 * 1000, // Activity logs can be stale for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for historical data
  })

  const handleExport = async () => {
    try {
      const client = createGraphQLClient()
      const result = await client.request<{ exportUserActivityLogs: string }>(
        EXPORT_ACTIVITY_LOGS_QUERY,
        {
          userId,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        }
      )
      
      // Create a download link
      const blob = new Blob([result.exportUserActivityLogs], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-activity-${userId}-${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export activity logs:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return 'bg-green-500 text-white'
    }
    if (action.includes('delete') || action.includes('remove')) {
      return 'bg-red-500 text-white'
    }
    if (action.includes('update') || action.includes('edit')) {
      return 'bg-blue-500 text-white'
    }
    if (action.includes('login') || action.includes('auth')) {
      return 'bg-yellow-400 text-black'
    }
    return 'bg-gray-500 text-white'
  }

  const logs = data || []

  return (
    <Card className="border-yellow-400/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              View detailed activity history for this user
            </CardDescription>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="border-yellow-400/20 hover:bg-yellow-400/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Date Range Filter */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading activity logs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">Error loading activity logs: {error.message}</p>
          </div>
        )}

        {/* Activity Timeline */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="space-y-4">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className={`border border-yellow-400/20 rounded-lg p-4 hover:border-yellow-400/40 transition-colors ${
                  index === 0 ? 'border-yellow-400/40' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={getActionBadgeColor(log.action)}>
                      {log.action}
                    </Badge>
                    {log.resource_type && (
                      <span className="text-sm text-muted-foreground">
                        on {log.resource_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(log.created_at)}
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  {log.ip_address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <span>IP: {log.ip_address}</span>
                    </div>
                  )}
                  {log.user_agent && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Monitor className="h-3 w-3 mt-0.5" />
                      <span className="break-all">{log.user_agent}</span>
                    </div>
                  )}
                  {log.resource_id && (
                    <div className="text-muted-foreground">
                      Resource ID: <code className="text-xs bg-yellow-400/10 px-1 py-0.5 rounded">{log.resource_id}</code>
                    </div>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">
                        Additional metadata
                      </summary>
                      <pre className="mt-2 text-xs bg-yellow-400/5 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No activity logs found for this user.</p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Page {page}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={logs.length < pageSize}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
