/**
 * Example usage of DecisionActions with Accept and Reject dialogs
 * 
 * This file demonstrates how to integrate the decision workflow components.
 * Use this pattern in your proposal detail view or proposal card.
 */

'use client'

import { useState } from 'react'
import { DecisionActions } from './decision-actions'
import { AcceptProposalDialog } from './accept-proposal-dialog'
import { RejectProposalDialog } from './reject-proposal-dialog'

interface DecisionActionsExampleProps {
  proposalId: string
  projectId: string
  proposalTitle: string
  biddingTeamName: string
  budgetEstimate?: number | null
  currentStatus: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
  onDecisionMade?: () => void
}

export function DecisionActionsExample({
  proposalId,
  projectId,
  proposalTitle,
  biddingTeamName,
  budgetEstimate,
  currentStatus,
  onDecisionMade,
}: DecisionActionsExampleProps) {
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  return (
    <>
      <DecisionActions
        proposalId={proposalId}
        projectId={projectId}
        currentStatus={currentStatus}
        onAccept={() => setAcceptDialogOpen(true)}
        onReject={() => setRejectDialogOpen(true)}
      />

      <AcceptProposalDialog
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        proposalId={proposalId}
        projectId={projectId}
        proposalTitle={proposalTitle}
        biddingTeamName={biddingTeamName}
        budgetEstimate={budgetEstimate}
        onSuccess={onDecisionMade}
      />

      <RejectProposalDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        proposalId={proposalId}
        projectId={projectId}
        proposalTitle={proposalTitle}
        biddingTeamName={biddingTeamName}
        onSuccess={onDecisionMade}
      />
    </>
  )
}
