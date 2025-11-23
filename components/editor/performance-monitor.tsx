/**
 * Performance Monitor Component
 * 
 * Displays real-time performance metrics for the collaboration system.
 * Useful for debugging and monitoring system health.
 * 
 * Requirements: 10.5 - Performance metrics logging
 */

'use client'

import { useEffect, useState } from 'react'
import { getPerformanceOptimizer } from '@/lib/performance-optimizer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Users, Zap, TrendingUp } from 'lucide-react'

interface PerformanceStats {
  connections: {
    active: number
    idle: number
    total: number
  }
  load: {
    activeConnections: number
    requestsPerSecond: number
    averageLatency: number
    errorRate: number
  }
  pendingSubscriptions: number
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development or for admins
    const isDev = process.env.NODE_ENV === 'development'
    setIsVisible(isDev)

    if (!isDev) return

    const optimizer = getPerformanceOptimizer()

    // Update stats every 2 seconds
    const interval = setInterval(() => {
      const currentStats = optimizer.getStats()
      setStats(currentStats)
    }, 2000)

    // Initial load
    setStats(optimizer.getStats())

    return () => {
      clearInterval(interval)
    }
  }, [])

  if (!isVisible || !stats) {
    return null
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'bg-green-500'
    if (latency < 500) return 'bg-yellow-400'
    return 'bg-red-500'
  }

  const getErrorRateColor = (errorRate: number) => {
    if (errorRate < 0.01) return 'bg-green-500'
    if (errorRate < 0.05) return 'bg-yellow-400'
    return 'bg-red-500'
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border-yellow-400/20 z-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-yellow-400" />
          Performance Monitor
        </CardTitle>
        <CardDescription className="text-xs">
          Real-time system metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connections */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Connections
            </div>
            <Badge variant="outline" className="text-xs">
              {stats.connections.active} / {stats.connections.total}
            </Badge>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-muted-foreground">Active:</span>
            <span className="font-medium">{stats.connections.active}</span>
            <span className="text-muted-foreground">Idle:</span>
            <span className="font-medium">{stats.connections.idle}</span>
          </div>
        </div>

        {/* Latency */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Avg Latency
            </div>
            <Badge 
              className={`text-xs ${getLatencyColor(stats.load.averageLatency)}`}
            >
              {Math.round(stats.load.averageLatency)}ms
            </Badge>
          </div>
        </div>

        {/* Request Rate */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Requests/sec
            </div>
            <Badge variant="outline" className="text-xs">
              {stats.load.requestsPerSecond.toFixed(1)}
            </Badge>
          </div>
        </div>

        {/* Error Rate */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Error Rate
            </div>
            <Badge 
              className={`text-xs ${getErrorRateColor(stats.load.errorRate)}`}
            >
              {(stats.load.errorRate * 100).toFixed(2)}%
            </Badge>
          </div>
        </div>

        {/* Pending Subscriptions */}
        {stats.pendingSubscriptions > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Pending Subs
              </div>
              <Badge variant="outline" className="text-xs">
                {stats.pendingSubscriptions}
              </Badge>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="pt-2 border-t border-yellow-400/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">System Status</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                stats.load.errorRate < 0.01 && stats.load.averageLatency < 500
                  ? 'bg-green-500'
                  : stats.load.errorRate < 0.05 && stats.load.averageLatency < 1000
                  ? 'bg-yellow-400'
                  : 'bg-red-500'
              }`} />
              <span className="font-medium">
                {stats.load.errorRate < 0.01 && stats.load.averageLatency < 500
                  ? 'Healthy'
                  : stats.load.errorRate < 0.05 && stats.load.averageLatency < 1000
                  ? 'Degraded'
                  : 'Critical'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
