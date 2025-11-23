/**
 * Example usage of ProposalRankingCard component
 * 
 * This component displays a single proposal ranking card with:
 * - Rank badge with yellow-400 accent
 * - Proposal summary information (title, lead, budget)
 * - Total score display prominently
 * - Scoring status indicator badge
 * - "Score Proposal" or "View Scores" button (yellow-400)
 * - Card component with hover effects
 */

import { ProposalRankingCard } from "./proposal-ranking-card"
import { ProposalRanking } from "@/lib/graphql/types"

// Example 1: Fully scored proposal (rank #1)
const fullyScored: ProposalRanking = {
  id: "ranking-1",
  projectId: "project-123",
  proposal: {
    id: "proposal-1",
    title: "Modern Web Application Development",
    biddingTeamName: "Tech Innovators",
    biddingLead: {
      id: "user-1",
      name: "John Smith",
      email: "john@techinnovators.com",
      avatarUrl: null,
      role: "lead",
      assignedSections: [],
    },
    teamSize: 5,
    budgetEstimate: 75000,
    timelineEstimate: "3 months",
    executiveSummary: "We propose a cutting-edge solution...",
    submissionDate: "2024-01-15T10:00:00Z",
    status: "submitted",
    complianceScore: 95,
    unreadMessages: 0,
    additionalInfo: [],
  },
  totalScore: 92.5,
  rank: 1,
  isFullyScored: true,
  calculatedAt: "2024-01-20T14:30:00Z",
}

// Example 2: Partially scored proposal (rank #2)
const partiallyScored: ProposalRanking = {
  id: "ranking-2",
  projectId: "project-123",
  proposal: {
    id: "proposal-2",
    title: "Enterprise Software Solution",
    biddingTeamName: "Digital Solutions Inc",
    biddingLead: {
      id: "user-2",
      name: "Sarah Johnson",
      email: "sarah@digitalsolutions.com",
      avatarUrl: null,
      role: "lead",
      assignedSections: [],
    },
    teamSize: 8,
    budgetEstimate: 95000,
    timelineEstimate: "4 months",
    executiveSummary: "Our team specializes in enterprise solutions...",
    submissionDate: "2024-01-16T09:00:00Z",
    status: "submitted",
    complianceScore: 88,
    unreadMessages: 2,
    additionalInfo: [],
  },
  totalScore: 45.0,
  rank: 2,
  isFullyScored: false,
  calculatedAt: "2024-01-20T14:30:00Z",
}

// Example 3: Not scored proposal (rank #3)
const notScored: ProposalRanking = {
  id: "ranking-3",
  projectId: "project-123",
  proposal: {
    id: "proposal-3",
    title: "Agile Development Services",
    biddingTeamName: "Agile Masters",
    biddingLead: {
      id: "user-3",
      name: "Michael Chen",
      email: "michael@agilemasters.com",
      avatarUrl: null,
      role: "lead",
      assignedSections: [],
    },
    teamSize: 6,
    budgetEstimate: 68000,
    timelineEstimate: "2.5 months",
    executiveSummary: "We follow agile methodologies...",
    submissionDate: "2024-01-17T11:00:00Z",
    status: "submitted",
    complianceScore: 92,
    unreadMessages: 1,
    additionalInfo: [],
  },
  totalScore: 0,
  rank: 3,
  isFullyScored: false,
  calculatedAt: "2024-01-20T14:30:00Z",
}

// Example 4: Proposal without budget
const noBudget: ProposalRanking = {
  id: "ranking-4",
  projectId: "project-123",
  proposal: {
    id: "proposal-4",
    title: "Custom Software Development",
    biddingTeamName: "Code Crafters",
    biddingLead: {
      id: "user-4",
      name: "Emily Davis",
      email: "emily@codecrafters.com",
      avatarUrl: null,
      role: "lead",
      assignedSections: [],
    },
    teamSize: 4,
    budgetEstimate: null,
    timelineEstimate: "3 months",
    executiveSummary: "We craft custom solutions...",
    submissionDate: "2024-01-18T08:00:00Z",
    status: "submitted",
    complianceScore: 85,
    unreadMessages: 0,
    additionalInfo: [],
  },
  totalScore: 78.3,
  rank: 4,
  isFullyScored: true,
  calculatedAt: "2024-01-20T14:30:00Z",
}

export function ProposalRankingCardExamples() {
  const handleScoreProposal = (proposalId: string) => {
    console.log("Score proposal:", proposalId)
    // Navigate to scoring interface or open scoring modal
  }

  return (
    <div className="p-8 space-y-8 bg-white dark:bg-black">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">
          Proposal Ranking Card Examples
        </h2>
        <p className="text-muted-foreground mb-6">
          Different states of the ProposalRankingCard component
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Example 1: Fully Scored */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Fully Scored (Rank #1)
          </h3>
          <ProposalRankingCard
            ranking={fullyScored}
            onScoreProposal={handleScoreProposal}
          />
        </div>

        {/* Example 2: Partially Scored */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Partially Scored (Rank #2)
          </h3>
          <ProposalRankingCard
            ranking={partiallyScored}
            onScoreProposal={handleScoreProposal}
          />
        </div>

        {/* Example 3: Not Scored */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Not Scored (Rank #3)
          </h3>
          <ProposalRankingCard
            ranking={notScored}
            onScoreProposal={handleScoreProposal}
          />
        </div>

        {/* Example 4: No Budget */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            No Budget (Rank #4)
          </h3>
          <ProposalRankingCard
            ranking={noBudget}
            onScoreProposal={handleScoreProposal}
          />
        </div>
      </div>

      <div className="border-t border-yellow-400/20 pt-6 space-y-4">
        <h3 className="text-lg font-semibold text-black dark:text-white">
          Component Features
        </h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Rank Badge:</strong> Yellow-400 accent badge displaying the
            proposal's rank
          </li>
          <li>
            <strong>Scoring Status:</strong> Color-coded badges (green for fully
            scored, yellow for partially scored, outline for not scored)
          </li>
          <li>
            <strong>Proposal Info:</strong> Title, bidding lead name, and budget
            estimate
          </li>
          <li>
            <strong>Total Score:</strong> Prominently displayed in yellow-400 with
            large font
          </li>
          <li>
            <strong>Action Button:</strong> Context-aware button (yellow for
            scoring, outline for viewing)
          </li>
          <li>
            <strong>Hover Effects:</strong> Card scales and shadow increases on
            hover
          </li>
          <li>
            <strong>Responsive:</strong> Works on mobile, tablet, and desktop
          </li>
        </ul>
      </div>
    </div>
  )
}
