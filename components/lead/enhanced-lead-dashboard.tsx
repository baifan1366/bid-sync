"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBudget, calculateDaysUntilDeadline } from "@/lib/utils"
import {
  AlertCircle,
  Briefcase,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { ProjectSearchBar } from "./project-search-bar"
import { ProjectFilterControls, ProjectFilterValues } from "./project-filter-controls"
import { EnhancedProjectCard } from "./enhanced-project-card"
import { ProjectDetailView } from "./project-detail-view"
import { CREATE_PROPOSAL } from "@/lib/graphql/mutations"
import { GET_OPEN_PROJECTS } from "@/lib/graphql/queries"
import type { Project } from "@/types/project"

interface ProjectFilter {
  budgetMin?: number
  budgetMax?: number
  deadlineBefore?: Date
  deadlineAfter?: Date
  category?: string
  searchTerm?: string
  status?: string
}

export function EnhancedLeadDashboard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState<ProjectFilterValues>({})
  const [creatingProposalId, setCreatingProposalId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [filters, searchTerm])

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const projectFilter: ProjectFilter = {
        ...filters,
        searchTerm: searchTerm || undefined,
      }

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_OPEN_PROJECTS,
          variables: { filter: projectFilter },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to load projects')
      }

      const fetchedProjects = result.data?.getOpenProjects || []
      setProjects(fetchedProjects)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    loadProjects()
  }

  const handleFiltersChange = (newFilters: ProjectFilterValues) => {
    setFilters(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  const handleCreateProposal = async (projectId: string) => {
    setCreatingProposalId(projectId)
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CREATE_PROPOSAL,
          variables: { projectId },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to create proposal')
      }

      const proposalId = result.data?.createProposal?.id

      if (proposalId) {
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['lead-proposals'] })
        
        // Close detail view if open
        setIsDetailViewOpen(false)
        
        // Navigate to workspace with the new proposal
        router.push(`/workspace?proposal=${proposalId}`)
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      alert(error instanceof Error ? error.message : 'Failed to create proposal')
    } finally {
      setCreatingProposalId(null)
    }
  }

  const handleViewDetails = (projectId: string) => {
    setSelectedProjectId(projectId)
    setIsDetailViewOpen(true)
  }

  const handleCloseDetailView = () => {
    setIsDetailViewOpen(false)
    setSelectedProjectId(null)
  }

  // Calculate stats
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const urgentProjects = projects.filter(
    (p) => p.deadline && calculateDaysUntilDeadline(p.deadline) <= 7
  ).length

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-12 w-full mb-6" />
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Project Discovery
        </h1>
        <p className="text-muted-foreground">
          Browse open projects and submit proposals
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProjectSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleSearch}
            />
          </div>
          <ProjectFilterControls
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
        </div>
        {searchTerm && (
          <p className="text-sm text-muted-foreground">
            Searching for: <span className="font-medium text-black dark:text-white">"{searchTerm}"</span>
          </p>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-black dark:text-white">
                Unable to Load Projects
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <Briefcase className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Projects</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {projects.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <FileText className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatBudget(totalBudget)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Urgent Projects</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {urgentProjects}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="p-12 border-yellow-400/20 text-center">
          <Briefcase className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            {searchTerm || Object.keys(filters).length > 0
              ? "No Projects Found"
              : "No Open Projects"}
          </h3>
          <p className="text-muted-foreground">
            {searchTerm || Object.keys(filters).length > 0
              ? "Try adjusting your search criteria or filters"
              : "There are currently no open projects available for bidding."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <EnhancedProjectCard
              key={project.id}
              project={project}
              onCreateProposal={handleCreateProposal}
              onViewDetails={handleViewDetails}
              isCreatingProposal={creatingProposalId === project.id}
            />
          ))}
        </div>
      )}

      {/* Project Detail View Modal */}
      <ProjectDetailView
        projectId={selectedProjectId}
        isOpen={isDetailViewOpen}
        onClose={handleCloseDetailView}
        onCreateProposal={handleCreateProposal}
        isCreatingProposal={creatingProposalId === selectedProjectId}
      />
    </div>
  )
}
