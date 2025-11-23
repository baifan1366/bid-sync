/**
 * Example usage of ComparisonProposalColumn component
 * 
 * This component is designed to be used within the ScoringComparisonView
 * to display individual proposal scores in a comparison layout.
 */

import { ComparisonProposalColumn } from "./comparison-proposal-column"
import type { ProposalWithScores, ScoringCriterion } from "@/lib/graphql/types"

// Example data
const exampleCriteria: ScoringCriterion[] = [
  {
    id: "crit-1",
    templateId: "template-1",
    name: "Technical Approach",
    description: "Quality and feasibility of the technical solution",
    weight: 30,
    orderIndex: 0,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "crit-2",
    templateId: "template-1",
    name: "Budget Competitiveness",
    description: "Value for money and cost effectiveness",
    weight: 25,
    orderIndex: 1,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "crit-3",
    templateId: "template-1",
    name: "Timeline",
    description: "Proposed delivery schedule and milestones",
    weight: 20,
    orderIndex: 2,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "crit-4",
    templateId: "template-1",
    name: "Team Expertise",
    description: "Experience and qualifications of the team",
    weight: 25,
    orderIndex: 3,
    createdAt: "2024-01-01T00:00:00Z",
  },
]

const exampleProposalData: ProposalWithScores = {
  proposal: {
    id: "prop-1",
    title: "Modern Web Application Development",
    biddingTeamName: "Tech Solutions Inc.",
    biddingLead: {
      id: "user-1",
      name: "John Smith",
      email: "john@techsolutions.com",
      avatarUrl: null,
      role: "bidding_lead",
      assignedSections: [],
    },
    teamSize: 5,
    budgetEstimate: 150000,
    timelineEstimate: "6 months",
    executiveSummary: "Comprehensive solution for modern web development",
    submissionDate: "2024-01-15T10:00:00Z",
    status: "submitted",
    complianceScore: 95,
    unreadMessages: 0,
    additionalInfo: [],
  },
  scores: [
    {
      id: "score-1",
      proposalId: "prop-1",
      criterion: exampleCriteria[0],
      rawScore: 8.5,
      weightedScore: 2.55, // 8.5 * 0.30
      notes: "Strong technical approach with modern architecture",
      scoredBy: {
        id: "client-1",
        email: "client@example.com",
        emailVerified: true,
        role: "client",
        verificationStatus: "verified",
        verificationReason: null,
        fullName: "Jane Doe",
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null,
        lastActivityAt: "2024-01-20T10:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-20T10:00:00Z",
      },
      scoredAt: "2024-01-20T10:00:00Z",
      isFinal: true,
    },
    {
      id: "score-2",
      proposalId: "prop-1",
      criterion: exampleCriteria[1],
      rawScore: 7.0,
      weightedScore: 1.75, // 7.0 * 0.25
      scoredBy: {
        id: "client-1",
        email: "client@example.com",
        emailVerified: true,
        role: "client",
        verificationStatus: "verified",
        verificationReason: null,
        fullName: "Jane Doe",
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null,
        lastActivityAt: "2024-01-20T10:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-20T10:00:00Z",
      },
      scoredAt: "2024-01-20T10:00:00Z",
      isFinal: true,
    },
    {
      id: "score-3",
      proposalId: "prop-1",
      criterion: exampleCriteria[2],
      rawScore: 9.0,
      weightedScore: 1.8, // 9.0 * 0.20
      notes: "Excellent timeline with realistic milestones",
      scoredBy: {
        id: "client-1",
        email: "client@example.com",
        emailVerified: true,
        role: "client",
        verificationStatus: "verified",
        verificationReason: null,
        fullName: "Jane Doe",
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null,
        lastActivityAt: "2024-01-20T10:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-20T10:00:00Z",
      },
      scoredAt: "2024-01-20T10:00:00Z",
      isFinal: true,
    },
    {
      id: "score-4",
      proposalId: "prop-1",
      criterion: exampleCriteria[3],
      rawScore: 8.0,
      weightedScore: 2.0, // 8.0 * 0.25
      scoredBy: {
        id: "client-1",
        email: "client@example.com",
        emailVerified: true,
        role: "client",
        verificationStatus: "verified",
        verificationReason: null,
        fullName: "Jane Doe",
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null,
        lastActivityAt: "2024-01-20T10:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-20T10:00:00Z",
      },
      scoredAt: "2024-01-20T10:00:00Z",
      isFinal: true,
    },
  ],
  totalScore: 8.1, // Sum of weighted scores
  rank: 1,
  isFullyScored: true,
}

// Helper functions for best/worst score identification
const isBestScore = (criterionId: string, proposalId: string): boolean => {
  // In a real scenario, this would check against all proposals
  // For this example, we'll mark the Timeline criterion as best
  return criterionId === "crit-3" && proposalId === "prop-1"
}

const isWorstScore = (criterionId: string, proposalId: string): boolean => {
  // In a real scenario, this would check against all proposals
  // For this example, we'll mark the Budget criterion as worst
  return criterionId === "crit-2" && proposalId === "prop-1"
}

export function ComparisonProposalColumnExample() {
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Comparison Proposal Column Example</h2>
      <p className="text-muted-foreground mb-6">
        This component displays a single proposal's scores in a comparison view.
        It shows the proposal header, total score, rank, and individual criterion scores
        with visual indicators for best and worst scores.
      </p>
      
      <ComparisonProposalColumn
        proposalData={exampleProposalData}
        criteria={exampleCriteria}
        isBestScore={isBestScore}
        isWorstScore={isWorstScore}
      />
    </div>
  )
}

/**
 * Usage Notes:
 * 
 * 1. The component is typically used within a grid or tabs layout in ScoringComparisonView
 * 2. The isBestScore and isWorstScore functions should compare across all proposals
 * 3. Visual indicators (green for best, red for worst) help identify standout scores
 * 4. The component handles both fully scored and partially scored proposals
 * 5. Progress bars provide visual representation of raw scores
 * 6. The header is sticky to remain visible during scrolling
 */
