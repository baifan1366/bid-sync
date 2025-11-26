"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  AlertCircle,
  FileText,
  Users,
  Clock,
  TrendingUp,
  Calendar,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Archive,
} from "lucide-react"
import { ProposalFilterControls, ProposalFilterValues } from "./proposal-filter-controls"
import { formatDistanceToNow } from "date-fns"

interface ProposalDashboardItem {
  id: string
  projectId: string
  projectName: string
  projectDeadline: string | null
  status: string
  completionPercentage: number
  teamSize: number
  unreadMessages: number
  lastActivity: string
  createdAt: string
  updatedAt: string
}

interface AggregateStatistics {
  totalProposals: number
  activeProposals: number
  draftProposals: number
  submittedProposals: number
  approvedProposals: number
  rejectedProposals: number
  archivedProposals: number
  averageCompletionRate: number
  upcomingDeadlines: number
  overdueProposals: number
  totalTeamMembers: number
  averageTeamSize: number
}

export function ProposalsDashboard() {
  const router = useRouter()
  
  const [proposals, setProposals] = useState<ProposalDashboardItem[]>([])
  const [statistics, setStatistics] = useState<AggregateStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState<ProposalFilterValues>({
    sortBy: 'updated_at',
    sortOrder: 'desc',
  })

  useEffect(() => {
    loadDashboard()
  }, [filters])

  const loadDashboard = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (filters.status) params.append('filterStatus', filters.status)
      if (filters.deadlineBefore) {
        params.append('filterDeadlineBefore', filters.deadlineBefore.toISOString())
      }
      if (filters.deadlineAfter) {
        params.append('filterDeadlineAfter', filters.deadlineAfter.toISOString())
      }
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)

      // Fetch proposals
      const proposalsResponse = await fetch(`/api/proposals/dashboard?${params.toString()}`)
      const proposalsData = await proposalsResponse.json()
      
      // Handle both success and error cases gracefully
      if (proposalsData.proposals) {
        setProposals(proposalsData.proposals)
      } else {
        setProposals([])
        if (proposalsData.error) {
          console.warn('Proposals API warning:', proposalsData.error)
        }
      }

      // Fetch statistics
      const statsResponse = await fetch('/api/proposals/statistics')
      const statsData = await statsResponse.json()
      
      // Handle statistics gracefully
      if (statsData && !statsData.error) {
        setStatistics(statsData)
      } else {
        // Set default statistics if fetch fails
        setStatistics({
          totalProposals: 0,
          activeProposals: 0,
          draftProposals: 0,
          submittedProposals: 0,
          approvedProposals: 0,
          rejectedProposals: 0,
          archivedProposals: 0,
          averageCompletionRate: 0,
          upcomingDeadlines: 0,
          overdueProposals: 0,
          totalTeamMembers: 0,
          averageTeamSize: 0,
        })
        if (statsData?.error) {
          console.warn('Statistics API warning:', statsData.error)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiltersChange = (newFilters: ProposalFilterValues) => {
    setFilters(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({
      sortBy: 'updated_at',
      sortOrder: 'desc',
    })
  }

  const handleViewProposal = (proposalId: string) => {
    router.push(`/workspace?proposal=${proposalId}`)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />
      case 'submitted':
        return <Clock className="h-4 w-4" />
      case 'reviewing':
        return <TrendingUp className="h-4 w-4" />
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'archived':
        return <Archive className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'reviewing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'archived':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }

  const isDeadlineUrgent = (deadline: string | null) => {
    if (!deadline) return false
    const daysUntil = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7 && daysUntil >= 0
  }

  const isDeadlineOverdue = (deadline: string | null, status: string) => {
    if (!deadline || ['submitted', 'approved', 'rejected', 'archived'].includes(status)) {
      return false
    }
    return new Date(deadline) < new Date()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px] space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          My Proposals
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage all your active and archived proposals
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-black dark:text-white">
                Unable to Load Dashboard
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-yellow-400/20">
                  <FileText className="h-7 w-7 text-yellow-400" />
                </div>
                <Badge variant="outline" className="border-yellow-400/40 text-yellow-400">
                  Total
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Proposals</p>
                <p className="text-3xl font-bold text-black dark:text-white">
                  {statistics.totalProposals}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {statistics.activeProposals} active
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-green-500/20">
                  <TrendingUp className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                  Progress
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Avg. Completion</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {statistics.averageCompletionRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Across all proposals
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-orange-500/20">
                  <AlertTriangle className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                </div>
                <Badge variant="outline" className="border-orange-500/40 text-orange-600 dark:text-orange-400">
                  Urgent
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Upcoming Deadlines</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {statistics.upcomingDeadlines}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Within 7 days
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
                  Team
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Team Members</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {statistics.totalTeamMembers}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Avg {statistics.averageTeamSize.toFixed(1)} per proposal
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <ProposalFilterControls
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Proposals Grid */}
      {proposals.length === 0 ? (
        <Card className="p-16 border-yellow-400/20 text-center bg-gradient-to-br from-yellow-400/5 to-transparent">
          <div className="max-w-md mx-auto">
            <div className="p-4 rounded-full bg-yellow-400/20 w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <FileText className="h-10 w-10 text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-3">
              No Proposals Found
            </h3>
            <p className="text-muted-foreground mb-6">
              {filters.status || filters.deadlineBefore || filters.deadlineAfter
                ? "Try adjusting your filters to see more proposals"
                : "Start by browsing open projects and creating your first proposal"}
            </p>
            {!filters.status && !filters.deadlineBefore && !filters.deadlineAfter && (
              <Button
                onClick={() => router.push('/lead-projects')}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                Browse Projects
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="group border-yellow-400/20 bg-white dark:bg-black hover:border-yellow-400/50 transition-all hover:shadow-xl hover:scale-[1.02] cursor-pointer overflow-hidden"
              onClick={() => handleViewProposal(proposal.id)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold text-black dark:text-white line-clamp-2 group-hover:text-yellow-400 transition-colors">
                      {proposal.projectName}
                    </CardTitle>
                  </div>
                  <Badge className={`${getStatusColor(proposal.status)} flex items-center gap-1.5 shrink-0 font-medium`}>
                    {getStatusIcon(proposal.status)}
                    <span className="capitalize">{proposal.status}</span>
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Completion Progress */}
                <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Completion</span>
                    <span className="text-sm font-bold text-yellow-400">
                      {proposal.completionPercentage}%
                    </span>
                  </div>
                  <Progress value={proposal.completionPercentage} className="h-2.5 bg-yellow-400/20" />
                </div>

                {/* Info Grid */}
                <div className="space-y-3">
                  {/* Deadline */}
                  {proposal.projectDeadline && (
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-yellow-400/5 transition-colors">
                      <div className="p-2 rounded-lg bg-yellow-400/10">
                        <Calendar className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className={`text-sm font-semibold truncate ${
                          isDeadlineOverdue(proposal.projectDeadline, proposal.status)
                            ? 'text-red-500'
                            : isDeadlineUrgent(proposal.projectDeadline)
                            ? 'text-orange-500'
                            : 'text-black dark:text-white'
                        }`}>
                          {isDeadlineOverdue(proposal.projectDeadline, proposal.status)
                            ? '⚠️ Overdue'
                            : formatDistanceToNow(new Date(proposal.projectDeadline), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Team Size */}
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-yellow-400/5 transition-colors">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Team</p>
                      <p className="text-sm font-semibold text-black dark:text-white">
                        {proposal.teamSize} member{proposal.teamSize !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Unread Messages */}
                  {proposal.unreadMessages > 0 && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                      <div className="p-2 rounded-lg bg-yellow-400/20">
                        <MessageSquare className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Messages</p>
                        <p className="text-sm font-bold text-yellow-400">
                          {proposal.unreadMessages} unread
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Last Activity */}
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-yellow-400/5 transition-colors">
                    <div className="p-2 rounded-lg bg-gray-500/10">
                      <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="text-sm font-medium text-black dark:text-white truncate">
                        {formatDistanceToNow(new Date(proposal.lastActivity), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* View Button */}
                <Button
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/30 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewProposal(proposal.id)
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Workspace
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
