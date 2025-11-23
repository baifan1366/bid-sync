'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, DollarSign, FileText, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ProjectDocument {
  id: string
  name: string
  url: string
  fileType: string
}

interface ProjectHeaderProps {
  project: {
    id: string
    title: string
    description: string
    budget?: number | null
    budget_min?: number | null
    budget_max?: number | null
    deadline?: string | null
    status: string
    createdAt?: string
    created_at?: string
    documents?: ProjectDocument[]
  }
  proposalsCount: number
}

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-400 text-black hover:bg-gray-500' },
  pending_admin_review: { label: 'Pending Review', color: 'bg-yellow-400 text-black hover:bg-yellow-500' },
  published: { label: 'Published', color: 'bg-blue-500 text-white hover:bg-blue-600' },
  in_review: { label: 'In Review', color: 'bg-yellow-400 text-black hover:bg-yellow-500' },
  awarded: { label: 'Awarded', color: 'bg-green-500 text-white hover:bg-green-600' },
  closed: { label: 'Closed', color: 'bg-gray-500 text-white hover:bg-gray-600' }
}

function formatBudget(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Budget not specified'
  if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`
  if (min) return `From $${min.toLocaleString()}`
  if (max) return `Up to $${max.toLocaleString()}`
  return 'Budget not specified'
}

function getDeadlineInfo(deadline?: string | null) {
  if (!deadline) return null
  
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  let urgency: 'high' | 'medium' | 'low' = 'low'
  if (daysRemaining < 0) urgency = 'high'
  else if (daysRemaining <= 7) urgency = 'high'
  else if (daysRemaining <= 14) urgency = 'medium'
  
  return {
    date: deadlineDate,
    daysRemaining,
    urgency,
    timeAgo: formatDistanceToNow(deadlineDate, { addSuffix: true })
  }
}

export function ProjectHeader({ project, proposalsCount }: ProjectHeaderProps) {
  const statusKey = project.status.toLowerCase() as keyof typeof statusConfig
  const statusInfo = statusConfig[statusKey] || statusConfig.draft
  const deadlineInfo = getDeadlineInfo(project.deadline)
  
  const urgencyColor = deadlineInfo?.urgency === 'high' 
    ? 'text-red-500 dark:text-red-400' 
    : deadlineInfo?.urgency === 'medium'
    ? 'text-yellow-500 dark:text-yellow-400'
    : 'text-green-500 dark:text-green-400'

  return (
    <Card className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors" role="region" aria-labelledby="project-title">
      <div className="p-4 sm:p-6">
        {/* Header Row */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 id="project-title" className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                {project.title}
              </h1>
              <Badge className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {proposalsCount} {proposalsCount === 1 ? 'proposal' : 'proposals'} received
            </p>
          </div>
        </header>

        {/* Description */}
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          {project.description}
        </p>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Budget */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <DollarSign className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="font-semibold text-black dark:text-white">
                {project.budget ? `$${project.budget.toLocaleString()}` : formatBudget(project.budget_min, project.budget_max)}
              </p>
            </div>
          </div>

          {/* Deadline */}
          {deadlineInfo && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-yellow-400/10">
                <Clock className={`h-5 w-5 ${urgencyColor}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deadline</p>
                <p className={`font-semibold ${urgencyColor}`}>
                  {deadlineInfo.timeAgo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {deadlineInfo.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <Calendar className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-semibold text-black dark:text-white">
                {formatDistanceToNow(new Date(project.createdAt || project.created_at || new Date()), { addSuffix: true })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(project.createdAt || project.created_at || new Date()).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        {project.documents && project.documents.length > 0 && (
          <section className="border-t border-yellow-400/20 pt-4" aria-labelledby="documents-heading">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              <h3 id="documents-heading" className="font-semibold text-black dark:text-white">
                Reference Documents
              </h3>
            </div>
            <nav className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Project documents">
              {project.documents.map((doc) => (
                <Button
                  key={doc.id}
                  variant="outline"
                  className="justify-between border-yellow-400/20 hover:border-yellow-400/40 hover:bg-yellow-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
                  asChild
                >
                  <a 
                    href={doc.url} 
                    download 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={`Download ${doc.name}`}
                  >
                    <span className="truncate">{doc.name}</span>
                    <Download className="h-4 w-4 ml-2 shrink-0" aria-hidden="true" />
                  </a>
                </Button>
              ))}
            </nav>
          </section>
        )}
      </div>
    </Card>
  )
}
