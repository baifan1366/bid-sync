"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBudget, formatDate, cn } from "@/lib/utils"
import {
  Briefcase,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Target,
  Award,
  Activity,
} from "lucide-react"

interface DashboardStats {
  totalProposals: number
  activeProposals: number
  submittedProposals: number
  acceptedProposals: number
  rejectedProposals: number
  winRate: number
  totalBidValue: number
  averageResponseTime: number
}

interface RecentProposal {
  id: string
  projectTitle: string
  status: string
  submittedAt: string
  budgetEstimate: number
}

export function LeadDashboardOverview() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentProposals, setRecentProposals] = useState<RecentProposal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual GraphQL query
      const response = await fetch('/api/lead/dashboard')
      const data = await response.json()
      
      setStats(data.stats)
      setRecentProposals(data.recentProposals || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'approved':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'rejected':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      case 'submitted':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'draft':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      default:
        return 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border-yellow-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'submitted':
        return <Clock className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground">
          Track your proposals and performance metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <FileText className="h-6 w-6 text-yellow-400" />
              </div>
              <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                Active
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Proposals</p>
              <p className="text-3xl font-bold text-black dark:text-white">
                {stats?.totalProposals || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.activeProposals || 0} in progress
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats?.winRate || 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.acceptedProposals || 0} accepted
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Bid Value</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {formatBudget(stats?.totalBidValue || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Across all proposals
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Award className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Response Time</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {stats?.averageResponseTime || 0}h
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Time to submit
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Proposals */}
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardHeader className="border-b border-yellow-400/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-black dark:text-white">
                Recent Proposals
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/lead-proposals')}
                className="text-yellow-400 hover:text-yellow-500 hover:bg-yellow-400/10"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {recentProposals.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-yellow-400 mx-auto mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No proposals yet. Start by browsing open projects!
                </p>
                <Button
                  onClick={() => router.push('/lead-projects')}
                  className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  Browse Projects
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentProposals.slice(0, 5).map((proposal) => (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/proposals/${proposal.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-black dark:text-white truncate mb-1">
                        {proposal.projectTitle}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDate(proposal.submittedAt)}</span>
                        <span>•</span>
                        <span className="text-yellow-400 font-medium">
                          {formatBudget(proposal.budgetEstimate)}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("ml-4 flex items-center gap-1", getStatusColor(proposal.status))}
                    >
                      {getStatusIcon(proposal.status)}
                      {proposal.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardHeader className="border-b border-yellow-400/20">
            <CardTitle className="text-xl font-bold text-black dark:text-white">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Button
                onClick={() => router.push('/lead-projects')}
                className="w-full justify-start h-auto py-4 bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <Briefcase className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Browse Open Projects</div>
                  <div className="text-xs opacity-80">Find new opportunities to bid on</div>
                </div>
              </Button>

              <Button
                onClick={() => router.push('/lead-proposals')}
                variant="outline"
                className="w-full justify-start h-auto py-4 border-yellow-400/40 hover:bg-yellow-400/10"
              >
                <FileText className="h-5 w-5 mr-3 text-yellow-400" />
                <div className="text-left">
                  <div className="font-semibold">Manage Proposals</div>
                  <div className="text-xs text-muted-foreground">View and edit your submissions</div>
                </div>
              </Button>

              <Button
                onClick={() => router.push('/team')}
                variant="outline"
                className="w-full justify-start h-auto py-4 border-yellow-400/40 hover:bg-yellow-400/10"
              >
                <Activity className="h-5 w-5 mr-3 text-yellow-400" />
                <div className="text-left">
                  <div className="font-semibold">Team Management</div>
                  <div className="text-xs text-muted-foreground">Invite and manage team members</div>
                </div>
              </Button>

              <Button
                onClick={() => router.push('/performance')}
                variant="outline"
                className="w-full justify-start h-auto py-4 border-yellow-400/40 hover:bg-yellow-400/10"
              >
                <TrendingUp className="h-5 w-5 mr-3 text-yellow-400" />
                <div className="text-left">
                  <div className="font-semibold">Performance Analytics</div>
                  <div className="text-xs text-muted-foreground">Track your bidding success</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card className="mt-6 border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader className="border-b border-yellow-400/20">
          <CardTitle className="text-xl font-bold text-black dark:text-white">
            Proposal Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-black dark:text-white">Submitted</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.submittedProposals || 0}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
                <span className="font-semibold text-black dark:text-white">In Progress</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {stats?.activeProposals || 0}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-black dark:text-white">Accepted</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats?.acceptedProposals || 0}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="font-semibold text-black dark:text-white">Rejected</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats?.rejectedProposals || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
