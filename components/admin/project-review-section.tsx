"use client"

import { useState } from "react"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectReviewDialog } from "./project-review-dialog"
import { FileText, Calendar, DollarSign, User } from "lucide-react"
import { formatBudget, formatDate } from "@/lib/utils"

const PENDING_PROJECTS_QUERY = `
  query PendingProjects {
    projects {
      id
      clientId
      title
      description
      status
      budget
      deadline
      createdAt
      updatedAt
    }
  }
`

interface Project {
  id: string
  clientId: string
  title: string
  description: string
  status: string
  budget?: number
  deadline?: string
  createdAt: string
  updatedAt: string
}

interface ProjectsResponse {
  projects: Project[]
}

export function ProjectReviewSection() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data, isLoading, refetch } = useGraphQLQuery<ProjectsResponse>(
    ['admin-projects'],
    PENDING_PROJECTS_QUERY
  )

  const pendingProjects = data?.projects?.filter(p => p.status === 'PENDING_REVIEW') || []
  const openProjects = data?.projects?.filter(p => p.status === 'OPEN') || []
  const closedProjects = data?.projects?.filter(p => p.status === 'CLOSED') || []
  const awardedProjects = data?.projects?.filter(p => p.status === 'AWARDED') || []

  const handleReview = (project: Project) => {
    setSelectedProject(project)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedProject(null)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-yellow-400/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {pendingProjects.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {openProjects.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awarded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {awardedProjects.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {closedProjects.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Projects */}
      <div>
        <h2 className="text-xl font-bold mb-4">Projects Pending Review</h2>
        {pendingProjects.length === 0 ? (
          <Card className="border-yellow-400/20">
            <CardContent className="py-8 text-center text-muted-foreground">
              No projects pending review
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingProjects.map((project) => (
              <Card key={project.id} className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold text-black dark:text-white">
                          {project.title}
                        </h3>
                        <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                          Pending Review
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {project.description}
                      </p>

                      <div className="grid gap-2 sm:grid-cols-3 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-yellow-400" />
                          <span className="font-semibold text-yellow-400">
                            {formatBudget(project.budget)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {project.deadline ? formatDate(project.deadline) : 'No deadline'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Created {formatDate(project.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleReview(project)}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* All Projects */}
      <div>
        <h2 className="text-xl font-bold mb-4">All Projects</h2>
        <div className="space-y-4">
          {data?.projects?.map((project) => (
            <Card key={project.id} className="border-yellow-400/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{project.title}</h3>
                      <Badge
                        className={
                          project.status === 'PENDING_REVIEW'
                            ? 'bg-yellow-400 text-black'
                            : project.status === 'OPEN'
                            ? 'bg-green-500 text-white'
                            : project.status === 'AWARDED'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-500 text-white'
                        }
                      >
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatBudget(project.budget)}</span>
                      <span>Created {formatDate(project.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReview(project)}
                    className="border-yellow-400/40 hover:bg-yellow-400/10"
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Review Dialog */}
      {selectedProject && (
        <ProjectReviewDialog
          project={selectedProject}
          open={isDialogOpen}
          onOpenChange={handleDialogClose}
        />
      )}
    </div>
  )
}
