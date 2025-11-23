'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send 
} from 'lucide-react'

interface ProgressTrackerProps {
  totalProposals: number
  submittedProposals: number
  underReviewProposals: number
  acceptedProposals: number
  rejectedProposals: number
  projectStatus: 'draft' | 'pending_admin_review' | 'published' | 'in_review' | 'awarded' | 'closed'
}

interface StageInfo {
  label: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}

export function ProgressTracker({
  totalProposals,
  submittedProposals,
  underReviewProposals,
  acceptedProposals,
  rejectedProposals,
  projectStatus
}: ProgressTrackerProps) {
  // Calculate evaluation completion percentage
  const decidedProposals = acceptedProposals + rejectedProposals
  const completionPercentage = totalProposals > 0 
    ? Math.round((decidedProposals / totalProposals) * 100) 
    : 0

  const stages: StageInfo[] = [
    {
      label: 'Total',
      count: totalProposals,
      icon: FileText,
      color: 'text-gray-700 dark:text-gray-300',
      bgColor: 'bg-gray-100 dark:bg-gray-800'
    },
    {
      label: 'Submitted',
      count: submittedProposals,
      icon: Send,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      label: 'Under Review',
      count: underReviewProposals,
      icon: Clock,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950'
    },
    {
      label: 'Accepted',
      count: acceptedProposals,
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950'
    },
    {
      label: 'Rejected',
      count: rejectedProposals,
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950'
    }
  ]

  return (
    <Card 
      className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
      role="region"
      aria-labelledby="progress-heading"
    >
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="progress-heading" className="text-lg font-semibold text-black dark:text-white">
            Evaluation Progress
          </h2>
          <Badge 
            className="bg-yellow-400 text-black hover:bg-yellow-500"
            aria-label={`${completionPercentage} percent complete`}
          >
            {completionPercentage}% Complete
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div 
            className="h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Proposal evaluation progress"
          >
            <div 
              className="h-full bg-yellow-400 transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{decidedProposals} of {totalProposals} evaluated</span>
            {projectStatus === 'awarded' && (
              <span className="text-green-600 dark:text-green-400 font-semibold">
                Project Awarded
              </span>
            )}
          </div>
        </div>

        {/* Stage Indicators */}
        <div 
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          role="list"
          aria-label="Proposal status breakdown"
        >
          {stages.map((stage) => {
            const Icon = stage.icon
            return (
              <div
                key={stage.label}
                className={`${stage.bgColor} rounded-lg p-3 transition-all hover:scale-105`}
                role="listitem"
                aria-label={`${stage.label}: ${stage.count} ${stage.count === 1 ? 'proposal' : 'proposals'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${stage.color}`} aria-hidden="true" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${stage.color}`}>
                  {stage.count}
                </p>
              </div>
            )
          })}
        </div>

        {/* Status Message */}
        {totalProposals === 0 && (
          <div 
            className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-center text-muted-foreground">
              No proposals received yet. Waiting for bidding teams to submit.
            </p>
          </div>
        )}

        {acceptedProposals > 0 && (
          <div 
            className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-center text-green-700 dark:text-green-300 font-medium">
              ✓ You have accepted {acceptedProposals} {acceptedProposals === 1 ? 'proposal' : 'proposals'}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
