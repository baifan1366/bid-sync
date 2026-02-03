import { gql } from 'graphql-request';

/**
 * Approve a proposal (Admin only)
 * Changes status from pending_approval to submitted
 */
export const APPROVE_PROPOSAL = gql`
  mutation ApproveProposal($proposalId: ID!, $notes: String) {
    approveProposal(proposalId: $proposalId, notes: $notes) {
      success
      message
      error
    }
  }
`;

/**
 * Reject a proposal submission (Admin only)
 * Changes status from pending_approval to rejected
 */
export const REJECT_PROPOSAL_SUBMISSION = gql`
  mutation RejectProposalSubmission($proposalId: ID!, $reason: String!) {
    rejectProposalSubmission(proposalId: $proposalId, reason: $reason) {
      success
      message
      error
    }
  }
`;

/**
 * Get proposals pending approval (Admin only)
 */
export const GET_PENDING_PROPOSALS = gql`
  query GetPendingProposals {
    proposals(where: { status: { _eq: "pending_approval" } }) {
      id
      title
      budgetEstimate
      timelineEstimate
      executiveSummary
      submittedAt
      lead {
        id
        name
        email
      }
      project {
        id
        title
        description
        client {
          id
          name
          email
        }
      }
      proposalTeamMembers {
        id
        user {
          id
          name
          email
        }
        role
      }
    }
  }
`;
