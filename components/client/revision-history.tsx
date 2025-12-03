"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  History,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export interface CompletionRevision {
  id: string
  revisionNumber: number
  requestedBy: string
  requestedByName?: string
  requestedAt: Date | string
  revisionNotes: string
  resolvedBy?: string
  resolvedByName?: string
  resolvedAt?: Date | string
}

export interface RevisionHistoryProps {
  revisions: CompletionRevision[]
  loading?: boolean
  className?: string
}

/**
 * RevisionHistory Component
 * 
 * Displays all revision requests chronologically with notes and resolution status.
 * 
 * Requirements:
 * - 5.5: Display all revision requests chronologically
 * - Show revision notes and timestamps
 * - Show resolution status
 */
export function RevisionHistory({
  revisions,
  loading = false,
  className,
}: RevisionHistoryProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  const formatRelativeTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return formatDistanceToNow(d, { addSuffix: true })
  }

  // Requirement 5.5: Sort revisions chronologically
  const sortedRevisions = [...revisions].sort((a, b) => {
    const dateA = typeof a.requestedAt === 'string' ? new Date(a.requestedAt) : a.requestedAt
    const dateB = typeof b.requestedAt === 'string' ? new Date(b.requestedAt) : b.requestedAt
    return dateA.getTime() - dateB.getTime()
  })

  if (loading) {
    return (
      <Card className={cn("p-6 border-yellow-400/20", className)}>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4" />
                  <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (sortedRevisions.length === 0) {
    return (
      <Card className={cn("p-8 border-yellow-400/20", className)}>
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-yellow-400/10">
              <History className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-black dark:text-white">
            No revision history
          </p>
          <p className="text-xs text-muted-foreground">
            No revisions have been requested for this project
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("border-yellow-400/20", className)}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-black dark:text-white">
              Revision History
            </h3>
          </div>
          <Badge className="bg-yellow-400 text-black">
            {sortedRevisions.length} {sortedRevisions.length === 1 ? 'revision' : 'revisions'}
          </Badge>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {sortedRevisions.map((revision, index) => {
            const isResolved = !!revision.resolvedAt
            const isLast = index === sortedRevisions.length - 1

            return (
              <div key={revision.id} className="relative">
                {/* Timeline Line */}
                {!isLast && (
                  <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-yellow-400/20" />
                )}

                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-yellow-400/20">
                      <AvatarFallback className="bg-yellow-400 text-black text-sm font-semibold">
                        {revision.requestedByName
                          ? getInitials(revision.requestedByName)
                          : 'CL'}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status Badge */}
                    <div className="absolute -bottom-1 -right-1">
                      {isResolved ? (
                        <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-white dark:border-black">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-yellow-400 flex items-center justify-center border-2 border-white dark:border-black">
                          <Clock className="h-3 w-3 text-black" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-black dark:text-white">
                          Revision #{revision.revisionNumber}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            isResolved
                              ? "border-green-500/40 text-green-500"
                              : "border-yellow-400/40 text-yellow-400"
                          )}
                        >
                          {isResolved ? 'Resolved' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>
                          Requested by {revision.requestedByName || 'Client'}
                        </span>
                        <span>•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{formatRelativeTime(revision.requestedAt)}</span>
                      </div>
                    </div>

                    {/* Revision Notes */}
                    <Card className="p-4 border-yellow-400/20 bg-yellow-400/5">
                      <div className="flex items-start gap-2 mb-2">
                        <FileText className="h-4 w-4 text-yellow-400 mt-0.5" />
                        <p className="text-xs font-medium text-black dark:text-white">
                          Revision Notes
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {revision.revisionNotes}
                      </p>
                    </Card>

                    {/* Resolution Info */}
                    {isResolved && (
                      <>
                        <Separator className="bg-yellow-400/20" />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>
                            Resolved by {revision.resolvedByName || 'Team'}
                          </span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          <span>{formatRelativeTime(revision.resolvedAt!)}</span>
                        </div>
                      </>
                    )}

                    {/* Timestamp Details */}
                    <div className="text-xs text-muted-foreground">
                      <p>Requested: {formatDate(revision.requestedAt)}</p>
                      {isResolved && revision.resolvedAt && (
                        <p>Resolved: {formatDate(revision.resolvedAt)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-yellow-400/20">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
              <p className="text-2xl font-bold text-black dark:text-white">
                {sortedRevisions.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Total Revisions
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <p className="text-2xl font-bold text-black dark:text-white">
                {sortedRevisions.filter((r) => r.resolvedAt).length}
              </p>
              <p className="text-xs text-muted-foreground">
                Resolved
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
