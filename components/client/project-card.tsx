import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Project, ProjectStatus } from "@/types/project"
import { 
  formatBudget, 
  formatDate, 
  calculateDaysUntilDeadline, 
  isDeadlineOverdue,
  cn 
} from "@/lib/utils"
import { Calendar, DollarSign, AlertTriangle, AlertCircle, Users } from "lucide-react"
import { useRouter } from "next/navigation"

interface ProjectCardProps {
  project: Project
  onClick?: () => void
  onViewBids?: (e: React.MouseEvent) => void
}

// Status badge color mapping - using yellow accent for primary states
const statusColors: Record<ProjectStatus, string> = {
  PENDING_REVIEW: "bg-yellow-400 text-black hover:bg-yellow-500",
  OPEN: "bg-green-500 text-white hover:bg-green-600",
  CLOSED: "bg-gray-500 text-white hover:bg-gray-600",
  AWARDED: "bg-yellow-400 text-black hover:bg-yellow-500",
}

// Status display labels
const statusLabels: Record<ProjectStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  OPEN: "Open",
  CLOSED: "Closed",
  AWARDED: "Awarded",
}

export function ProjectCard({ project, onClick, onViewBids }: ProjectCardProps) {
  const router = useRouter()
  
  // Calculate deadline status
  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline ? calculateDaysUntilDeadline(project.deadline!) : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  const showDeadlineWarning = hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7
  
  // Truncate description to 2-3 lines (approximately 150 characters)
  const truncatedDescription = project.description.length > 150 
    ? project.description.substring(0, 150) + "..." 
    : project.description
  
  // Handle view bids click
  const handleViewBidsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onViewBids) {
      onViewBids(e)
    } else {
      router.push(`/projects/${project.id}/decision`)
    }
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer",
        "border-yellow-400/20 hover:border-yellow-400/40",
        "bg-white dark:bg-black"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-base sm:text-lg font-bold line-clamp-2 flex-1 text-black dark:text-white">
            {project.title}
          </CardTitle>
          {showDeadlineWarning && (
            <div className="shrink-0">
              {isOverdue ? (
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            className={cn(
              "text-xs font-bold shadow-sm",
              statusColors[project.status]
            )}
          >
            {statusLabels[project.status]}
          </Badge>
          {showDeadlineWarning && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium",
                isOverdue
                  ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                  : "border-yellow-400 text-yellow-400"
              )}
            >
              {isOverdue ? "Overdue" : "Urgent"}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        {/* Description */}
        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
          {truncatedDescription}
        </p>
        
        {/* Budget and Deadline */}
        <div className="space-y-2">
          {/* Budget */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400 shrink-0" />
            <span className="font-semibold text-yellow-400">
              {formatBudget(project.budget)}
            </span>
          </div>
          
          {/* Deadline */}
          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className={cn(
              "font-medium",
              isOverdue && "text-red-600 dark:text-red-400",
              !isOverdue && showDeadlineWarning && "text-yellow-400"
            )}>
              {hasDeadline ? formatDate(project.deadline!) : "No deadline"}
            </span>
            {showDeadlineWarning && daysUntilDeadline !== null && (
              <span className={cn(
                "text-xs",
                isOverdue ? "text-red-600 dark:text-red-400" : "text-yellow-400"
              )}>
                {isOverdue 
                  ? `(${Math.abs(daysUntilDeadline)} days overdue)` 
                  : `(${daysUntilDeadline} days left)`
                }
              </span>
            )}
          </div>
        </div>
        
        {/* Created date */}
        <div className="pt-2 border-t border-yellow-400/20">
          <p className="text-xs text-muted-foreground">
            Created {formatDate(project.createdAt)}
          </p>
        </div>
        
        {/* Action Button - Only show for OPEN or AWARDED projects */}
        {(project.status === 'OPEN' || project.status === 'AWARDED') && (
          <div className="pt-3">
            <Button
              onClick={handleViewBidsClick}
              variant="outline"
              size="sm"
              className="w-full border-yellow-400/40 hover:bg-yellow-400/10 hover:border-yellow-400 text-black dark:text-white"
            >
              <Users className="h-3.5 w-3.5 mr-2" />
              View Bids & Make Decision
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
