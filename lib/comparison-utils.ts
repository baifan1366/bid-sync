import { ProposalDetail, ProposalSection, ProposalSummary } from './graphql/types'

/**
 * Aligned section for comparison view
 */
export interface AlignedSection {
  title: string
  proposals: Array<{
    proposalId: string
    section: ProposalSection | null
  }>
}

/**
 * Align proposal sections for side-by-side comparison
 * @param proposals Array of proposal details
 * @returns Array of aligned sections
 */
export function alignProposalSections(proposals: ProposalDetail[]): AlignedSection[] {
  // Collect all unique section titles across all proposals
  const sectionTitlesSet = new Set<string>()
  const sectionOrderMap = new Map<string, number>()

  proposals.forEach((proposal) => {
    proposal.sections.forEach((section) => {
      sectionTitlesSet.add(section.title)
      // Use the lowest order number for each title
      if (!sectionOrderMap.has(section.title) || section.order < sectionOrderMap.get(section.title)!) {
        sectionOrderMap.set(section.title, section.order)
      }
    })
  })

  // Sort section titles by order
  const sortedTitles = Array.from(sectionTitlesSet).sort((a, b) => {
    const orderA = sectionOrderMap.get(a) || 0
    const orderB = sectionOrderMap.get(b) || 0
    return orderA - orderB
  })

  // Create aligned sections
  const alignedSections: AlignedSection[] = sortedTitles.map((title) => {
    return {
      title,
      proposals: proposals.map((proposal) => {
        const section = proposal.sections.find((s) => s.title === title) || null
        return {
          proposalId: proposal.id,
          section,
        }
      }),
    }
  })

  return alignedSections
}

/**
 * Difference type for comparison
 */
export interface ProposalDifference {
  field: string
  label: string
  values: Array<{
    proposalId: string
    value: string | number | null
  }>
  hasDifference: boolean
}

/**
 * Detect differences between proposals
 * @param proposals Array of proposal summaries or details
 * @returns Array of differences
 */
export function detectProposalDifferences(
  proposals: (ProposalSummary | ProposalDetail)[]
): ProposalDifference[] {
  if (proposals.length < 2) {
    return []
  }

  const differences: ProposalDifference[] = []

  // Compare budgets
  const budgetValues = proposals.map((p) => ({
    proposalId: p.id,
    value: 'budgetEstimate' in p ? p.budgetEstimate : null,
  }))
  const budgetDiff = budgetValues.some((v, i, arr) => v.value !== arr[0].value)
  differences.push({
    field: 'budget',
    label: 'Budget Estimate',
    values: budgetValues,
    hasDifference: budgetDiff,
  })

  // Compare timelines
  const timelineValues = proposals.map((p) => ({
    proposalId: p.id,
    value: 'timelineEstimate' in p ? p.timelineEstimate : null,
  }))
  const timelineDiff = timelineValues.some((v, i, arr) => v.value !== arr[0].value)
  differences.push({
    field: 'timeline',
    label: 'Timeline Estimate',
    values: timelineValues,
    hasDifference: timelineDiff,
  })

  // Compare team sizes
  const teamSizeValues = proposals.map((p) => ({
    proposalId: p.id,
    value: 'teamSize' in p ? p.teamSize : ('biddingTeam' in p ? p.biddingTeam.members.length + 1 : 0),
  }))
  const teamSizeDiff = teamSizeValues.some((v, i, arr) => v.value !== arr[0].value)
  differences.push({
    field: 'teamSize',
    label: 'Team Size',
    values: teamSizeValues,
    hasDifference: teamSizeDiff,
  })

  // Compare compliance scores (if available)
  if (proposals.every((p) => 'complianceScore' in p)) {
    const complianceValues = proposals.map((p) => ({
      proposalId: p.id,
      value: 'complianceScore' in p ? p.complianceScore : null,
    }))
    const complianceDiff = complianceValues.some((v, i, arr) => v.value !== arr[0].value)
    differences.push({
      field: 'complianceScore',
      label: 'Compliance Score',
      values: complianceValues,
      hasDifference: complianceDiff,
    })
  }

  return differences
}

/**
 * Comparison metrics for proposals
 */
export interface ComparisonMetrics {
  proposalId: string
  budgetRank: number // 1 = lowest budget
  timelineRank: number // 1 = shortest timeline
  teamSizeRank: number // 1 = smallest team
  complianceRank: number // 1 = highest compliance
  overallScore: number // Weighted average of ranks
}

/**
 * Calculate comparison metrics for proposals
 * @param proposals Array of proposal summaries
 * @param weights Optional weights for scoring (default: equal weights)
 * @returns Array of comparison metrics
 */
export function calculateComparisonMetrics(
  proposals: ProposalSummary[],
  weights: {
    budget?: number
    timeline?: number
    teamSize?: number
    compliance?: number
  } = {}
): ComparisonMetrics[] {
  const {
    budget: budgetWeight = 0.3,
    timeline: timelineWeight = 0.3,
    teamSize: teamSizeWeight = 0.2,
    compliance: complianceWeight = 0.2,
  } = weights

  // Sort by budget (ascending - lower is better)
  const budgetSorted = [...proposals].sort((a, b) => {
    if (a.budgetEstimate === null) return 1
    if (b.budgetEstimate === null) return -1
    return a.budgetEstimate - b.budgetEstimate
  })

  // Sort by timeline (ascending - shorter is better)
  const timelineSorted = [...proposals].sort((a, b) => {
    if (!a.timelineEstimate) return 1
    if (!b.timelineEstimate) return -1
    return a.timelineEstimate.localeCompare(b.timelineEstimate)
  })

  // Sort by team size (ascending - smaller is better for cost efficiency)
  const teamSizeSorted = [...proposals].sort((a, b) => a.teamSize - b.teamSize)

  // Sort by compliance (descending - higher is better)
  const complianceSorted = [...proposals].sort((a, b) => b.complianceScore - a.complianceScore)

  // Calculate metrics for each proposal
  const metrics: ComparisonMetrics[] = proposals.map((proposal) => {
    const budgetRank = budgetSorted.findIndex((p) => p.id === proposal.id) + 1
    const timelineRank = timelineSorted.findIndex((p) => p.id === proposal.id) + 1
    const teamSizeRank = teamSizeSorted.findIndex((p) => p.id === proposal.id) + 1
    const complianceRank = complianceSorted.findIndex((p) => p.id === proposal.id) + 1

    // Calculate weighted score (lower is better, so we invert compliance rank)
    const maxRank = proposals.length
    const normalizedBudget = budgetRank / maxRank
    const normalizedTimeline = timelineRank / maxRank
    const normalizedTeamSize = teamSizeRank / maxRank
    const normalizedCompliance = (maxRank - complianceRank + 1) / maxRank // Invert for compliance

    const overallScore =
      normalizedBudget * budgetWeight +
      normalizedTimeline * timelineWeight +
      normalizedTeamSize * teamSizeWeight +
      normalizedCompliance * complianceWeight

    return {
      proposalId: proposal.id,
      budgetRank,
      timelineRank,
      teamSizeRank,
      complianceRank,
      overallScore,
    }
  })

  return metrics
}

/**
 * Validate proposal selection for comparison
 * @param selectedIds Array of selected proposal IDs
 * @returns Validation result with error message if invalid
 */
export function validateComparisonSelection(selectedIds: string[]): {
  valid: boolean
  error?: string
} {
  if (selectedIds.length < 2) {
    return {
      valid: false,
      error: 'Please select at least 2 proposals to compare',
    }
  }

  if (selectedIds.length > 4) {
    return {
      valid: false,
      error: 'You can compare a maximum of 4 proposals at once',
    }
  }

  return { valid: true }
}

/**
 * Get comparison summary statistics
 * @param proposals Array of proposal summaries
 * @returns Summary statistics
 */
export function getComparisonSummary(proposals: ProposalSummary[]) {
  const budgets = proposals
    .map((p) => p.budgetEstimate)
    .filter((b): b is number => b !== null)

  const teamSizes = proposals.map((p) => p.teamSize)
  const complianceScores = proposals.map((p) => p.complianceScore)

  return {
    budgetRange: {
      min: budgets.length > 0 ? Math.min(...budgets) : null,
      max: budgets.length > 0 ? Math.max(...budgets) : null,
      avg: budgets.length > 0 ? budgets.reduce((a, b) => a + b, 0) / budgets.length : null,
    },
    teamSizeRange: {
      min: Math.min(...teamSizes),
      max: Math.max(...teamSizes),
      avg: teamSizes.reduce((a, b) => a + b, 0) / teamSizes.length,
    },
    complianceRange: {
      min: Math.min(...complianceScores),
      max: Math.max(...complianceScores),
      avg: complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length,
    },
  }
}
