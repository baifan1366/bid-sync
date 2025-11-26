"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Project } from "@/types/project"
import { 
  formatBudget, 
  formatDate, 
  calculateDaysUntilDeadline, 
  isDeadlineOverdue,
  cn 
} from "@/lib/utils"
import { Calendar, Clock, ArrowRight, ChevronDown, ChevronUp } from "lucide-react"

interface PublicProjectCardProps {
  project: Project
  onClick?: () => void
}

export function PublicProjectCard({ project, onClick }: PublicProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline ? calculateDaysUntilDeadline(project.deadline!) : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  
  const descriptionLimit = 120
  const shouldTruncate = project.description.length > descriptionLimit
  const displayDescription = isExpanded || !shouldTruncate
    ? project.description
    : project.description.substring(0, descriptionLimit) + "..."

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300 cursor-pointer",
        "bg-white dark:bg-zinc-900 border-2 border-yellow-400/20",
        "hover:border-yellow-400 hover:shadow-xl hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-yellow-400 to-yellow-500" />
      
      <CardHeader className="pb-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg sm:text-xl font-bold wrap-break-word text-black dark:text-white group-hover:text-yellow-400 transition-colors">
            {project.title}
          </h3>
          <ArrowRight className="h-5 w-5 text-yellow-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        <Badge className="w-fit mt-3 text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-500 border-0">
          Open for Bidding
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4 p-5 sm:p-6 pt-0">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed wrap-break-word whitespace-pre-wrap">
            {displayDescription}
          </p>
          {shouldTruncate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpand}
              className="mt-2 h-auto p-0 text-yellow-400 hover:text-yellow-500 hover:bg-transparent font-medium"
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Budget - Prominent Display */}
        <div className="bg-yellow-400/10 dark:bg-yellow-400/5 rounded-lg p-4 border border-yellow-400/30">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Budget:</span>
            <span className="text-2xl font-bold text-yellow-400 wrap-break-word">
              {formatBudget(project.budget)}
            </span>
          </div>
        </div>
        
        {/* Deadline Info */}
        <div className="space-y-2.5">
          {hasDeadline && (
            <>
              <div className="flex items-center gap-2.5 text-sm flex-wrap">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span className={cn(
                  "font-medium wrap-break-word",
                  isOverdue ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"
                )}>
                  Deadline: {formatDate(project.deadline!)}
                </span>
              </div>
              
              {daysUntilDeadline !== null && !isOverdue && (
                <div className="flex items-center gap-2.5 text-sm flex-wrap">
                  <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span className="font-medium text-yellow-400">
                    {daysUntilDeadline} {daysUntilDeadline === 1 ? 'day' : 'days'} remaining
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="pt-3 border-t border-yellow-400/20">
          <p className="text-xs text-gray-500 dark:text-gray-500 wrap-break-word">
            Posted {formatDate(project.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
