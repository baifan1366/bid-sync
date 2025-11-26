"use client"

import { useState, useMemo } from "react"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { LIST_PROJECTS_BY_CLIENT } from "@/lib/graphql/queries"
import { Project, ProjectStatus } from "@/types/project"
import { ProjectStatistics } from "@/components/client/project-statistics"
import { FilterControls } from "@/components/client/filter-controls"
import { SortControls } from "@/components/client/sort-controls"
import { DeadlineAlerts } from "@/components/client/deadline-alerts"
import { TrendingCategories } from "@/components/client/trending-categories"
import { ProjectCard } from "@/components/client/project-card"
import { ProjectCardSkeleton } from "@/components/client/project-card-skeleton"
import { ProjectDialog } from "@/components/client/project-dialog"
import { CreateProjectDialog } from "@/components/client/create-project-dialog"
import { VerificationGuideDialog } from "@/components/client/verification-guide-dialog"
import { VerificationBanner } from "@/components/client/verification-banner"
import { Button } from "@/components/ui/button"
import { Plus, Lock } from "lucide-react"

type SortField = 'created_at' | 'deadline' | 'budget'
type SortOrder = 'asc' | 'desc'

interface ProjectsResponse {
  projects: Project[]
}

export function ClientProjectsDashboard() {
  // Authentication
  const { user, loading: userLoading } = useUser()
  
  // Local state
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  
  // Data fetching
  const { data, isLoading: projectsLoading } = useGraphQLQuery<ProjectsResponse>(
    ['projects', user?.id || ''],
    LIST_PROJECTS_BY_CLIENT,
    { clientId: user?.id },
    { enabled: !!user?.id }
  )
  
  const isLoading = userLoading || projectsLoading
  const projects = data?.projects || []
  
  // Check verification status
  const verificationStatus = user?.user_metadata?.verification_status
  const isVerified = verificationStatus === 'verified'
  
  // Filter projects by status
  const filteredProjects = useMemo(() => {
    if (filterStatus === 'all') {
      return projects
    }
    return projects.filter((project: Project) => project.status === filterStatus)
  }, [projects, filterStatus])
  
  // Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects]
    
    sorted.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'created_at':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'deadline':
          // Handle null deadlines - put them at the end
          if (!a.deadline && !b.deadline) comparison = 0
          else if (!a.deadline) comparison = 1
          else if (!b.deadline) comparison = -1
          else comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          break
        case 'budget':
          // Handle null budgets - put them at the end
          const budgetA = a.budget || 0
          const budgetB = b.budget || 0
          comparison = budgetA - budgetB
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }, [filteredProjects, sortBy, sortOrder])
  
  // Calculate deadline alerts from all projects (not just filtered)
  const deadlineAlertProjects = useMemo(() => {
    return projects
  }, [projects])
  
  // Handle create project button click
  const handleCreateProjectClick = () => {
    if (isVerified) {
      setIsCreateDialogOpen(true)
    } else {
      setIsVerificationDialogOpen(true)
    }
  }
  
  // Handle project card click
  const handleProjectClick = (project: Project) => {
    setSelectedProject(project)
    setIsProjectDialogOpen(true)
  }
  
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Verification Banner */}
      {!isLoading && (
        <VerificationBanner
          verificationStatus={verificationStatus}
          onLearnMore={() => setIsVerificationDialogOpen(true)}
        />
      )}
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-white">My Projects</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage and track all your projects
          </p>
        </div>
        <Button 
          onClick={handleCreateProjectClick} 
          className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          disabled={!isVerified}
        >
          {isVerified ? (
            <Plus className="h-4 w-4 mr-2" />
          ) : (
            <Lock className="h-4 w-4 mr-2" />
          )}
          Create Project
        </Button>
      </div>
      
      {/* Statistics Section */}
      <ProjectStatistics projects={projects} isLoading={isLoading} />
      
      {/* Main Content Grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left Column - Projects List (2/3 width on large screens) */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
            <FilterControls 
              value={filterStatus} 
              onChange={setFilterStatus} 
            />
            <SortControls
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortByChange={setSortBy}
              onSortOrderChange={setSortOrder}
            />
          </div>
          
          {/* Projects Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {isLoading ? (
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            ) : sortedProjects.length === 0 ? (
              <div className="col-span-full text-center py-8 sm:py-12">
                <p className="text-muted-foreground text-sm sm:text-base">
                  {filterStatus === 'all' 
                    ? "No projects yet. Create your first project to get started!"
                    : `No ${filterStatus} projects found.`
                  }
                </p>
              </div>
            ) : (
              sortedProjects.map(project => (
                <ProjectCard 
                  key={project.id} 
                  project={project}
                  onClick={() => handleProjectClick(project)}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Right Column - Alerts and Categories (1/3 width on large screens) */}
        <div className="space-y-4 sm:space-y-6">
          <DeadlineAlerts projects={deadlineAlertProjects} isLoading={isLoading} />
          <TrendingCategories projects={projects} isLoading={isLoading} />
        </div>
      </div>
      
      {/* Project Dialog */}
      <ProjectDialog
        project={selectedProject}
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
      />
      
      {/* Create Project Dialog */}
      <CreateProjectDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
      
      {/* Verification Guide Dialog */}
      <VerificationGuideDialog
        open={isVerificationDialogOpen}
        onOpenChange={setIsVerificationDialogOpen}
        verificationStatus={verificationStatus}
      />
    </div>
  )
}
