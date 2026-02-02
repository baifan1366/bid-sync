'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createGraphQLClient, ADMIN_PENDING_PROPOSALS, ADMIN_APPROVE_PROPOSAL, ADMIN_REJECT_PROPOSAL } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  FileText,
  Loader2,
  User,
  Briefcase
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ProposalApprovalQueueSkeleton } from './proposal-approval-queue-skeleton'

interface Proposal {
  id: string
  title: string
  status: string
  budgetEstimate: number | null
  timelineEstimate: string | null
  submissionDate: string
  project: {
    id: string
    title: string
  }
  biddingLead: {
    id: string
    fullName: string | null
    email: string
  }
  biddingTeam: {
    id: string
    name: string
  } | null
}

export function ProposalApprovalQueue() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['adminPendingProposals'],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<{ adminPendingProposals: Proposal[] }>(ADMIN_PENDING_PROPOSALS)
    }
  })

  const approveMutation = useMutation({
    mutationFn: async ({ proposalId, notes }: { proposalId: string; notes?: string }) => {
      const client = createGraphQLClient()
      return await client.request(ADMIN_APPROVE_PROPOSAL, { proposalId, notes })
    },
    onSuccess: () => {
      toast({
        title: 'Proposal approved',
        description: 'The proposal has been approved and is now visible to the client.',
      })
      queryClient.invalidateQueries({ queryKey: ['adminPendingProposals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-proposals'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({
        title: 'Approval failed',
        description: error.message || 'Failed to approve proposal',
        variant: 'destructive',
      })
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: string; reason: string }) => {
      const client = createGraphQLClient()
      return await client.request(ADMIN_REJECT_PROPOSAL, { proposalId, reason })
    },
    onSuccess: () => {
      toast({
        title: 'Proposal rejected',
        description: 'The lead has been notified of the rejection.',
      })
      queryClient.invalidateQueries({ queryKey: ['adminPendingProposals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-proposals'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({
        title: 'Rejection failed',
        description: error.message || 'Failed to reject proposal',
        variant: 'destructive',
      })
    }
  })

  const handleApprove = (proposal: Proposal) => {
    setSelectedProposal(proposal)
    setActionType('approve')
    setNotes('')
  }

  const handleReject = (proposal: Proposal) => {
    setSelectedProposal(proposal)
    setActionType('reject')
    setNotes('')
  }

  const handleCloseDialog = () => {
    setSelectedProposal(null)
    setActionType(null)
    setNotes('')
  }

  const handleConfirm = () => {
    if (!selectedProposal) return

    if (actionType === 'approve') {
      approveMutation.mutate({ proposalId: selectedProposal.id, notes: notes || undefined })
    } else if (actionType === 'reject') {
      if (!notes.trim()) {
        toast({
          title: 'Reason required',
          description: 'Please provide a reason for rejection',
          variant: 'destructive',
        })
        return
      }
      rejectMutation.mutate({ proposalId: selectedProposal.id, reason: notes })
    }
  }

  if (isLoading) {
    return <ProposalApprovalQueueSkeleton />
  }

  const proposals = data?.adminPendingProposals || []

  if (proposals.length === 0) {
    return (
      <Card className="border-yellow-400/20">
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              There are no proposals pending approval at the moment.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4">
        {proposals.map((proposal) => (
          <Card key={proposal.id} className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{proposal.title}</CardTitle>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-yellow-400" />
                      <span>Project: {proposal.project.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-yellow-400" />
                      <span>By {proposal.biddingLead.fullName || proposal.biddingLead.email}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(proposal.submissionDate), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-yellow-400 text-black">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Review
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {proposal.budgetEstimate && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Budget Estimate</p>
                      <p className="font-medium">${proposal.budgetEstimate.toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {proposal.timelineEstimate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Timeline</p>
                      <p className="font-medium">{proposal.timelineEstimate}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-yellow-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">Awaiting Approval</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleApprove(proposal)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(proposal)}
                  variant="outline"
                  className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedProposal} onOpenChange={handleCloseDialog}>
        <DialogContent className="border-yellow-400/20">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Proposal' : 'Reject Proposal'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'This proposal will be published and visible to the client.'
                : 'Please provide a reason for rejecting this proposal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedProposal && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="font-medium">{selectedProposal.title}</p>
                <p className="text-sm text-muted-foreground">
                  Project: {selectedProposal.project.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Lead: {selectedProposal.biddingLead.fullName || selectedProposal.biddingLead.email}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="notes">
                {actionType === 'approve' ? 'Notes (Optional)' : 'Rejection Reason *'}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Add any notes for the lead...'
                    : 'Explain why this proposal is being rejected...'
                }
                className="border-yellow-400/20 focus-visible:ring-yellow-400 mt-2"
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCloseDialog}
                variant="outline"
                className="flex-1 border-yellow-400/20"
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className={
                  actionType === 'approve'
                    ? 'flex-1 bg-green-500 hover:bg-green-600 text-white'
                    : 'flex-1 bg-red-500 hover:bg-red-600 text-white'
                }
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {(approveMutation.isPending || rejectMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {actionType === 'approve' ? 'Approve Proposal' : 'Reject Proposal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
