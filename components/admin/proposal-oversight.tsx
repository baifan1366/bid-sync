"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Eye, Calendar, User, Briefcase } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Proposal {
  id: string
  title: string
  project_title: string
  team_name: string
  lead_name: string
  status: string
  submitted_at: string
  budget: number
  timeline: string
}

async function fetchProposals(status?: string, search?: string): Promise<Proposal[]> {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.append('status', status)
  if (search) params.append('search', search)
  
  const response = await fetch(`/api/admin/proposals?${params}`)
  if (!response.ok) throw new Error('Failed to fetch proposals')
  return response.json()
}

export function ProposalOversight() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)

  const { data: proposals, isLoading, error } = useQuery({
    queryKey: ['admin-proposals', statusFilter, searchQuery],
    queryFn: () => fetchProposals(statusFilter, searchQuery),
  })

  if (isLoading) {
    return <ProposalsSkeleton />
  }

  if (error) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6">
          <p className="text-red-500">Failed to load proposals</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Filter Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, team, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals && proposals.length === 0 ? (
          <Card className="border-yellow-400/20">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                No proposals found matching your criteria
              </p>
            </CardContent>
          </Card>
        ) : (
          proposals?.map((proposal) => (
            <Card key={proposal.id} className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{proposal.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Briefcase className="h-3 w-3" />
                      {proposal.project_title}
                    </CardDescription>
                  </div>
                  <Badge 
                    className={getStatusColor(proposal.status)}
                  >
                    {proposal.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-yellow-400" />
                    <span className="text-muted-foreground">Team:</span>
                    <span className="font-medium">{proposal.team_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-yellow-400" />
                    <span className="text-muted-foreground">Lead:</span>
                    <span className="font-medium">{proposal.lead_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-yellow-400" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span className="font-medium">
                      {new Date(proposal.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Budget:</span>
                    <span className="font-medium text-yellow-400">
                      ${proposal.budget.toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProposal(proposal)}
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Proposal Details Dialog */}
      <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProposal?.title}</DialogTitle>
            <DialogDescription>
              Full proposal details and history
            </DialogDescription>
          </DialogHeader>
          {selectedProposal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Project</p>
                  <p className="font-medium">{selectedProposal.project_title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="font-medium">{selectedProposal.team_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lead</p>
                  <p className="font-medium">{selectedProposal.lead_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedProposal.status)}>
                    {selectedProposal.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-medium text-yellow-400">
                    ${selectedProposal.budget.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timeline</p>
                  <p className="font-medium">{selectedProposal.timeline}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-yellow-400/20">
                <p className="text-sm text-muted-foreground mb-2">Admin Actions</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-400/20"
                  >
                    View Full Proposal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-400/20"
                  >
                    View Comments
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-yellow-400/20"
                  >
                    View History
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500 hover:bg-gray-600',
    submitted: 'bg-blue-500 hover:bg-blue-600',
    under_review: 'bg-yellow-400 hover:bg-yellow-500 text-black',
    accepted: 'bg-green-500 hover:bg-green-600',
    rejected: 'bg-red-500 hover:bg-red-600',
  }
  return colors[status] || 'bg-gray-500'
}

function ProposalsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="border-yellow-400/20">
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
