'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCardSkeleton } from "./alert-card-skeleton"
import { Project } from "@/types/project"
import { calculateDaysUntilDeadline, isDeadlineOverdue, formatDate } from "@/lib/utils"
import { AlertTriangle, Clock } from "lucide-react"

interface DeadlineAlertsProps {
  projects: Project[]
  isLoading: boolean
}

export function DeadlineAlerts({ projects, isLoading }: DeadlineAlertsProps) {
  // Filter projects with deadlines within 7 days or overdue
  const alertProjects = projects.filter(project => {
    if (!project.deadline) return false
    const daysUntil = calculateDaysUntilDeadline(project.deadline)
    return daysUntil <= 7 // Includes overdue (negative values) and upcoming (0-7 days)
  })

  // Sort by deadline (soonest first)
  const sortedAlertProjects = [...alertProjects].sort((a, b) => {
    if (!a.deadline || !b.deadline) return 0
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  })

  if (isLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">Deadline Alerts</h2>
        <div className="space-y-2">
          <AlertCardSkeleton />
          <AlertCardSkeleton />
          <AlertCardSkeleton />
        </div>
      </div>
    )
  }

  if (sortedAlertProjects.length === 0) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">Deadline Alerts</h2>
        <Card>
          <CardContent className="p-4 sm:p-6 text-center text-muted-foreground text-sm sm:text-base">
            No upcoming deadlines
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-lg sm:text-xl font-semibold">Deadline Alerts</h2>
      <div className="space-y-2">
        {sortedAlertProjects.map(project => {
          const daysUntil = calculateDaysUntilDeadline(project.deadline!)
          const overdue = isDeadlineOverdue(project.deadline!)
          
          return (
            <Card 
              key={project.id}
              className={
                overdue
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  : "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950"
              }
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {overdue ? (
                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 dark:text-red-400 shrink-0" />
                  ) : (
                    <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm sm:text-base font-semibold truncate ${
                      overdue 
                        ? "text-red-900 dark:text-red-100" 
                        : "text-orange-900 dark:text-orange-100"
                    }`}>
                      {project.title}
                    </h3>
                    <p className={`text-xs sm:text-sm ${
                      overdue
                        ? "text-red-700 dark:text-red-300"
                        : "text-orange-700 dark:text-orange-300"
                    }`}>
                      {overdue ? (
                        <>Overdue by {Math.abs(daysUntil)} {Math.abs(daysUntil) === 1 ? 'day' : 'days'}</>
                      ) : daysUntil === 0 ? (
                        <>Due today</>
                      ) : (
                        <>Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}</>
                      )}
                      <span className="hidden sm:inline">{' • '}</span>
                      <span className="block sm:inline">{formatDate(project.deadline!)}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
