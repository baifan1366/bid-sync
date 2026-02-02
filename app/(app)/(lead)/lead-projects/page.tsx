"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { 
  ProjectSearchBar, 
  ProjectFilterControls, 
  EnhancedProjectCard,
  ProjectCardSkeleton,
  ProjectDetailView
} from "@/components/lead"
import type { ProjectFilterValues } from "@/components/lead/project-filter-controls"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, AlertCircle } from "lucide-react"
import type { Project } from "@/types/project"
import { GET_OPEN_PROJECTS } from "@/lib/graphql/queries"
import { CREATE_PROPOSAL } from "@/lib/graphql/mutations"

interface ProjectFilter {
  budgetMin?: number
  budgetMax?: number
  deadlineBefore?: Date
  deadlineAfter?: Date
  category?: string
  searchTerm?: string
  status?: string
}

export default function ProjectsDiscoveryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<ProjectFilterValues>({})
  const [creatingProposalId, setCreatingProposalId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false)

  // Load projects on mount and when filters change
  React.useEffect(() => {
    loadProjects()
  }, [filters, searchQuery])

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const projectFilter: ProjectFilter = {
        ...filters,
        searchTerm: searchQuery || undefined,
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
      const documentId = result.data?.createProposal?.documentId

      if (proposalId && documentId) {
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['lead-proposals'] })
        
        // Close detail view if open
        setIsDetailViewOpen(false)
        
        // Navigate to editor to start working on the proposal
        router.push(`/editor/${documentId}`)
        
        toast({
          title: "Proposal created successfully",
          description: "You can now start working on your proposal",
        })
      } else if (proposalId && !documentId) {
        // Fallback: navigate to proposals list if documentId is missing
        toast({
          title: "Proposal created",
          description: "Redirecting to proposals dashboard...",
        })
        router.push('/lead-proposals')
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      toast({
        title: "Failed to create proposal",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
              Project Marketplace
            </h1>
            <p className="text-muted-foreground">
              Discover and bid on open projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-yellow-400/40 text-yellow-400">
              {projects.length} Projects Available
            </Badge>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProjectSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              placeholder="Search projects by title, description, or requirements..."
            />
          </div>
          <ProjectFilterControls
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />
        </div>
        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            Searching for: <span className="font-medium text-black dark:text-white">"{searchQuery}"</span>
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

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: Project) => (
            <EnhancedProjectCard 
              key={project.id} 
              project={project}
              onCreateProposal={handleCreateProposal}
              onViewDetails={handleViewDetails}
              isCreatingProposal={creatingProposalId === project.id}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 border-yellow-400/20 text-center">
          <Briefcase className="h-12 w-12 text-yellow-400 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            {searchQuery || Object.keys(filters).length > 0
              ? "No Projects Found"
              : "No Open Projects"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || Object.keys(filters).length > 0
              ? "Try adjusting your search criteria or filters"
              : "There are currently no open projects available for bidding."}
          </p>
        </Card>
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
