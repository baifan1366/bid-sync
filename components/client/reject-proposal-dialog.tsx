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
import { Textarea } from '@/components/ui/textarea'
import { useGraphQLMutation } from '@/hooks/use-graphql'
import { REJECT_PROPOSAL } from '@/lib/graphql/mutations'
import { useToast } from '@/components/ui/use-toast'
import { XCircle } from 'lucide-react'

interface RejectProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  projectId: string
  proposalTitle: string
  biddingTeamName: string
  onSuccess?: () => void
}

export function RejectProposalDialog({
  open,
  onOpenChange,
  proposalId,
  projectId,
  proposalTitle,
  biddingTeamName,
  onSuccess,
}: RejectProposalDialogProps) {
  const { toast } = useToast()
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const rejectMutation = useGraphQLMutation(
    REJECT_PROPOSAL,
    [['project', projectId], ['proposals', projectId]]
  )

  const handleReject = async () => {
    // Validate feedback is non-empty
    const trimmedFeedback = feedback.trim()
    if (!trimmedFeedback) {
      setError('Please provide a reason for rejection')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await rejectMutation.mutateAsync({
        proposal_id: proposalId,
        project_id: projectId,
        feedback: trimmedFeedback,
      })

      toast({
        title: 'Proposal Rejected',
        description: `You have rejected the proposal from ${biddingTeamName}. Your feedback has been sent to the team.`,
        variant: 'default',
      })

      // Reset form and close dialog
      setFeedback('')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error rejecting proposal:', error)
      toast({
        title: 'Error',
        description: 'Failed to reject proposal. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      // Reset form when closing
      setFeedback('')
      setError('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-yellow-400/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Reject Proposal
          </DialogTitle>
          <DialogDescription>
            Please provide feedback explaining why you are rejecting this proposal.
            This will help the bidding team improve future submissions.
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
          </div>

          {/* Feedback Form */}
          <div className="space-y-2">
            <label htmlFor="feedback" className="text-sm font-medium">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="feedback"
              placeholder="Please explain why this proposal doesn't meet your requirements..."
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value)
                if (error) setError('')
              }}
              aria-required="true"
              aria-invalid={!!error}
              aria-describedby={error ? "feedback-error" : "feedback-help"}
              className={`min-h-[120px] focus-visible:ring-2 focus-visible:ring-offset-2 ${
                error ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-yellow-400'
              }`}
              disabled={isSubmitting}
            />
            {error && (
              <p id="feedback-error" className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}
            <p id="feedback-help" className="text-xs text-muted-foreground">
              Your feedback will be shared with the bidding team to help them understand
              your decision.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            aria-label="Cancel rejection"
            className="border-yellow-400/20 hover:border-yellow-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            disabled={isSubmitting}
            variant="destructive"
            aria-label="Confirm proposal rejection"
            className="bg-red-600 hover:bg-red-700 text-white border-2 border-yellow-400/30 hover:border-yellow-400/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
          >
            {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
