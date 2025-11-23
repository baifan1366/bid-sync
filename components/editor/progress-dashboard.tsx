'use client'

import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { SectionStatus } from '@/lib/graphql/types'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Eye, 
  AlertCircle,
  TrendingUp,
  User
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

export interface ProgressDashboardProps {
  documentId: string
  className?: string
}

/**
 * Progress Dashboard Component
 * 
 * Displays comprehensive progress tracking for document sections including:
 * - All sections with current status
 * - Overall completion percentage
 * - Assigned users per section
 * - Deadline indicators (warning/overdue)
 * - Real-time progress updates
 * 
 * Requirements: 7.3, 7.4, 7.5
 */
export function ProgressDashboard({ documentId, className }: ProgressDashboardProps) {
  const {
    sections,
    overallProgress,
    upcomingDeadlines,
    isLoading,
    error,
  } = useProgressTracker({
    documentId,
    enabled: true,
  })

  if (isLoading) {
    return <ProgressDashboardSkeleton />
  }

  if (error) {
    return (
      <Card className={cn('border-red-500/20', className)}>
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Progress</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Calculate status counts
  const statusCounts = {
    not_started: sections.filter(s => s.status === 'not_started').length,
    in_progress: sections.filter(s => s.status === 'in_progress').length,
    in_review: sections.filter(s => s.status === 'in_review').length,
    completed: sections.filter(s => s.status === 'completed').length,
  }

  const completionPercentage = overallProgress?.completionPercentage || 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall Progress Card */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-400" />
                Overall Progress
              </CardTitle>
              <CardDescription>
                {sections.length} total section{sections.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-yellow-400">
                {completionPercentage.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <Progress 
            value={completionPercentage} 
            className="h-3 bg-yellow-400/10"
          />

          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusSummaryCard
              label="Not Started"
              count={statusCounts.not_started}
              icon={Circle}
              color="text-gray-400"
            />
            <StatusSummaryCard
              label="In Progress"
              count={statusCounts.in_progress}
              icon={Clock}
              color="text-yellow-400"
            />
            <StatusSummaryCard
              label="In Review"
              count={statusCounts.in_review}
              icon={Eye}
              color="text-blue-500"
            />
            <StatusSummaryCard
              label="Completed"
              count={statusCounts.completed}
              icon={CheckCircle2}
              color="text-green-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines Alert */}
      {upcomingDeadlines.length > 0 && (
        <Card className="border-yellow-400/20 bg-yellow-400/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>
              {upcomingDeadlines.length} section{upcomingDeadlines.length !== 1 ? 's' : ''} due within 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingDeadlines.slice(0, 3).map((deadline) => (
                <DeadlineItem key={deadline.sectionId} deadline={deadline} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections List */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Section Status</CardTitle>
          <CardDescription>
            Track progress for each section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sections found. Create sections to start tracking progress.
              </div>
            ) : (
              sections.map((section) => (
                <SectionProgressItem
                  key={section.sectionId}
                  section={section}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatusSummaryCardProps {
  label: string
  count: number
  icon: React.ElementType
  color: string
}

function StatusSummaryCard({ label, count, icon: Icon, color }: StatusSummaryCardProps) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg border border-yellow-400/20 bg-white dark:bg-black">
      <Icon className={cn('h-5 w-5 mb-1', color)} />
      <div className="text-2xl font-bold text-black dark:text-white">{count}</div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  )
}

interface SectionProgressItemProps {
  section: {
    sectionId: string
    title: string
    status: SectionStatus
    assignedTo?: string
    assignedToUser?: {
      id: string
      name?: string
      email: string
    }
    deadline?: Date | string
    lastUpdated: string
    isOverdue?: boolean
    hoursRemaining?: number
  }
}

function SectionProgressItem({ section }: SectionProgressItemProps) {
  const getStatusIcon = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_review':
        return <Eye className="h-4 w-4 text-blue-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-400" />
      default:
        return <Circle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in_review':
        return 'bg-blue-500 text-white'
      case 'in_progress':
        return 'bg-yellow-400 text-black'
      default:
        return 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getDeadlineColor = () => {
    if (section.isOverdue === true) {
      return 'text-red-500'
    } else if (section.hoursRemaining !== undefined && section.hoursRemaining < 24) {
      return 'text-yellow-400'
    }
    return 'text-muted-foreground'
  }

  const formatDeadline = () => {
    if (!section.deadline) return null

    const deadline = section.deadline instanceof Date ? section.deadline : new Date(section.deadline)
    const now = new Date()
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursRemaining < 0) {
      return 'Overdue'
    } else if (hoursRemaining < 24) {
      return `Due in ${Math.round(hoursRemaining)}h`
    } else {
      return deadline.toLocaleDateString()
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
      {/* Status Icon */}
      <div className="shrink-0">
        {getStatusIcon(section.status)}
      </div>

      {/* Section Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-sm text-black dark:text-white truncate">
            {section.title}
          </h4>
          <Badge className={cn('text-xs', getStatusColor(section.status))}>
            {section.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* Assigned User */}
          {section.assignedToUser && (
            <div className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[10px] bg-yellow-400 text-black">
                  {(section.assignedToUser.name || section.assignedToUser.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{section.assignedToUser.name || section.assignedToUser.email}</span>
            </div>
          )}

          {/* Deadline */}
          {section.deadline && (
            <div className={cn('flex items-center gap-1', getDeadlineColor())}>
              <Clock className="h-3 w-3" />
              <span>{formatDeadline()}</span>
            </div>
          )}

          {/* Last Updated */}
          <span>
            Updated {new Date(section.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Overdue Badge */}
      {section.isOverdue === true && (
        <Badge variant="destructive" className="shrink-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      )}
    </div>
  )
}

interface DeadlineItemProps {
  deadline: {
    sectionId: string
    title: string
    deadline: Date
    assignedTo?: string
    assignedToUser?: {
      id: string
      name?: string
      email: string
    }
    isOverdue: boolean
    hoursRemaining: number
    status: SectionStatus
  }
}

function DeadlineItem({ deadline }: DeadlineItemProps) {
  const getUrgencyColor = () => {
    if (deadline.isOverdue) return 'text-red-500'
    if (deadline.hoursRemaining < 6) return 'text-red-400'
    if (deadline.hoursRemaining < 12) return 'text-yellow-400'
    return 'text-yellow-300'
  }

  return (
    <div className="flex items-center justify-between p-2 rounded border border-yellow-400/20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertCircle className={cn('h-4 w-4 shrink-0', getUrgencyColor())} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-black dark:text-white truncate">
            {deadline.title}
          </div>
          {deadline.assignedToUser && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{deadline.assignedToUser.name || deadline.assignedToUser.email}</span>
            </div>
          )}
        </div>
      </div>
      <div className={cn('text-sm font-medium shrink-0 ml-2', getUrgencyColor())}>
        {deadline.isOverdue
          ? 'Overdue'
          : `${Math.round(deadline.hoursRemaining)}h`}
      </div>
    </div>
  )
}

function ProgressDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="border-yellow-400/20">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-yellow-400/20">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
