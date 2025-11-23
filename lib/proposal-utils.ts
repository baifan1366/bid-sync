import { ProposalSummary } from './graphql/types'

/**
 * Calculate proposal counts by status
 * @param proposals Array of proposal summaries
 * @returns Object with counts for each status
 */
export function calculateProposalCounts(proposals: ProposalSummary[]) {
  const counts = {
    total: proposals.length,
    draft: 0,
    submitted: 0,
    under_review: 0,
    accepted: 0,
    rejected: 0,
  }

  proposals.forEach((proposal) => {
    const status = proposal.status.toLowerCase()
    if (status === 'draft') counts.draft++
    else if (status === 'submitted') counts.submitted++
    else if (status === 'under_review' || status === 'reviewing') counts.under_review++
    else if (status === 'accepted' || status === 'approved') counts.accepted++
    else if (status === 'rejected') counts.rejected++
  })

  return counts
}

/**
 * Format proposal budget with currency symbol and proper formatting
 * @param budget Budget amount in dollars
 * @param currency Currency code (default: MYR)
 * @returns Formatted budget string
 */
export function formatProposalBudget(
  budget: number | null | undefined,
  currency: string = 'MYR'
): string {
  if (budget === null || budget === undefined) {
    return 'Not specified'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(budget)
}

/**
 * Calculate team size from bidding team
 * @param proposal Proposal summary with team information
 * @returns Total team size (lead + members)
 */
export function calculateTeamSize(proposal: ProposalSummary): number {
  return proposal.teamSize || 0
}

/**
 * Determine proposal urgency based on submission date and project deadline
 * @param submissionDate Proposal submission date
 * @param projectDeadline Project deadline (optional)
 * @returns Urgency level: 'high', 'medium', 'low', or 'none'
 */
export function determineProposalUrgency(
  submissionDate: string,
  projectDeadline?: string | null
): 'high' | 'medium' | 'low' | 'none' {
  if (!projectDeadline) {
    return 'none'
  }

  const now = new Date()
  const deadline = new Date(projectDeadline)
  const daysUntilDeadline = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysUntilDeadline < 0) {
    return 'none' // Deadline passed
  } else if (daysUntilDeadline <= 2) {
    return 'high'
  } else if (daysUntilDeadline <= 7) {
    return 'medium'
  } else {
    return 'low'
  }
}

/**
 * Format budget range for display
 * @param minBudget Minimum budget
 * @param maxBudget Maximum budget
 * @param currency Currency code
 * @returns Formatted budget range string
 */
export function formatBudgetRange(
  minBudget: number | null | undefined,
  maxBudget: number | null | undefined,
  currency: string = 'MYR'
): string {
  if (!minBudget && !maxBudget) {
    return 'Not specified'
  }

  if (minBudget && !maxBudget) {
    return `From ${formatProposalBudget(minBudget, currency)}`
  }

  if (!minBudget && maxBudget) {
    return `Up to ${formatProposalBudget(maxBudget, currency)}`
  }

  return `${formatProposalBudget(minBudget, currency)} - ${formatProposalBudget(maxBudget, currency)}`
}
