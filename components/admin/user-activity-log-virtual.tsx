"use client"

import { List } from "react-window"
import { Badge } from "@/components/ui/badge"
import { Calendar, Globe, Monitor } from "lucide-react"
import type { UserActivityLog as ActivityLog } from "@/lib/graphql/types"

interface UserActivityLogVirtualProps {
  logs: ActivityLog[]
  height?: number
}

export function UserActivityLogVirtual({ logs, height = 600 }: UserActivityLogVirtualProps) {
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

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No activity logs found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="border border-yellow-400/20 rounded-lg overflow-hidden">
        <List
          rowComponent={({ index, style }) => {
            const log = logs[index]
            return (
              <div 
                style={style}
                className={`border-b border-yellow-400/20 p-4 hover:border-yellow-400/40 transition-colors ${
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
                      <span className="break-all line-clamp-1">{log.user_agent}</span>
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
            )
          }}
          rowCount={logs.length}
          rowHeight={150}
          rowProps={{}}
          style={{ height }}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {logs.length} activity logs (virtual scrolling enabled)
      </div>
    </div>
  )
}
