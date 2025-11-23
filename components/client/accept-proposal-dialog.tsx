'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGraphQLMutation } from '@/hooks/use-graphql'
import { ACCEPT_PROPOSAL } from '@/lib/graphql/mutations'
import { useToast } from '@/components/ui/use-toast'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface AcceptProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  projectId: string
  proposalTitle: string
  biddingTeamName: string
  budgetEstimate?: number | null
  onSuccess?: () => void
}

export function AcceptProposalDialog({
  open,
  onOpenChange,
  proposalId,
  projectId,
  proposalTitle,
  biddingTeamName,
  budgetEstimate,
  onSuccess,
}: AcceptProposalDialogProps) {
  const { toast } = useToast()
  const [isConfirming, setIsConfirming] = useState(false)

  const acceptMutation = useGraphQLMutation(
    ACCEPT_PROPOSAL,
    [['project', projectId], ['proposals', projectId]]
  )

  const handleAccept = async () => {
    setIsConfirming(true)
    try {
      await acceptMutation.mutateAsync({
        proposal_id: proposalId,
        project_id: projectId,
      })

      toast({
        title: 'Proposal Accepted',
        description: `You have successfully accepted the proposal from ${biddingTeamName}.`,
        variant: 'default',
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error accepting proposal:', error)
      toast({
        title: 'Error',
        description: 'Failed to accept proposal. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const formatBudget = (budget: number | null | undefined) => {
    if (!budget) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
    }).format(budget)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-yellow-400/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Accept Proposal
          </DialogTitle>
          <DialogDescription>
            Please confirm that you want to accept this proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Proposal Summary */}
          <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4 space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Proposal</p>
              <p className="font-semibold">{proposalTitle}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bidding Team</p>
              <p className="font-semibold">{biddingTeamName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Estimate</p>
              <p className="font-semibold text-yellow-400">
                {formatBudget(budgetEstimate)}
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-orange-400/20 bg-orange-400/5 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Important</p>
                <p className="text-sm text-muted-foreground">
                  Accepting this proposal will automatically reject all other proposals
                  for this project and mark the project as awarded.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
            aria-label="Cancel acceptance"
            className="border-yellow-400/20 hover:border-yellow-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isConfirming}
            aria-label="Confirm proposal acceptance"
            className="bg-green-600 hover:bg-green-700 text-white border-2 border-yellow-400/30 hover:border-yellow-400/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
          >
            {isConfirming ? 'Accepting...' : 'Confirm Accept'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
