'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle } from 'lucide-react'

interface DecisionActionsProps {
  proposalId: string
  projectId: string
  currentStatus: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
  onAccept: () => void
  onReject: () => void
  isLoading?: boolean
}

export function DecisionActions({
  proposalId,
  projectId,
  currentStatus,
  onAccept,
  onReject,
  isLoading = false,
}: DecisionActionsProps) {
  // Only show buttons for submitted proposals
  if (currentStatus !== 'submitted' && currentStatus !== 'under_review') {
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full" role="group" aria-label="Proposal decision actions">
      <Button
        onClick={onAccept}
        disabled={isLoading}
        aria-label="Accept this proposal"
        className="flex-1 bg-green-600 hover:bg-green-700 text-white border-2 border-yellow-400/30 hover:border-yellow-400/50 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
      >
        <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        Accept Proposal
      </Button>
      <Button
        onClick={onReject}
        disabled={isLoading}
        variant="destructive"
        aria-label="Reject this proposal"
        className="flex-1 bg-red-600 hover:bg-red-700 text-white border-2 border-yellow-400/30 hover:border-yellow-400/50 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
      >
        <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        Reject Proposal
      </Button>
    </div>
  )
}
