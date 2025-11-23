import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Project } from "@/types/project"
import { 
  formatBudget, 
  formatDate, 
  calculateDaysUntilDeadline, 
  isDeadlineOverdue,
  cn 
} from "@/lib/utils"
import { Calendar, DollarSign, Clock } from "lucide-react"

interface PublicProjectCardProps {
  project: Project
  onClick?: () => void
}

export function PublicProjectCard({ project, onClick }: PublicProjectCardProps) {
  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline ? calculateDaysUntilDeadline(project.deadline!) : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  
  const truncatedDescription = project.description.length > 120 
    ? project.description.substring(0, 120) + "..." 
    : project.description

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer",
        "bg-card text-card-foreground border-yellow-400/20 hover:border-yellow-400/40"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3 p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg font-semibold line-clamp-2">
          {project.title}
        </CardTitle>
        <Badge className="w-fit mt-2 text-xs bg-yellow-400 text-black hover:bg-yellow-500">
          Open for Bidding
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3">
          {truncatedDescription}
        </p>
        
        <div className="space-y-2">
          {/* Budget */}
          <div className="flex items-center gap-2 text-sm sm:text-base">
            <DollarSign className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="font-semibold text-yellow-400">
              {formatBudget(project.budget)}
            </span>
          </div>
          
          {/* Deadline */}
          {hasDeadline && (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <span className={cn(
                "font-medium",
                isOverdue && "text-red-600 dark:text-red-400"
              )}>
                Deadline: {formatDate(project.deadline!)}
              </span>
            </div>
          )}

          {/* Days remaining */}
          {hasDeadline && daysUntilDeadline !== null && !isOverdue && (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                {daysUntilDeadline} days remaining
              </span>
            </div>
          )}
        </div>
        
        <div className="pt-2 border-t border-yellow-400/20">
          <p className="text-xs text-muted-foreground">
            Posted {formatDate(project.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
