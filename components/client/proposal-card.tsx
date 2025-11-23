"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Calendar, Users, DollarSign, MessageSquare, Star, Award } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { ProposalSummary } from "@/lib/graphql/types"
import { formatProposalBudget, calculateTeamSize } from "@/lib/proposal-utils"
import { cn } from "@/lib/utils"
import { createGraphQLClient } from "@/lib/graphql/client"
import { gql } from "graphql-request"

interface ProposalCardProps {
  proposal: ProposalSummary
  isSelected: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
  isSelectionDisabled?: boolean
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-400 text-black',
  submitted: 'bg-blue-500 text-white',
  under_review: 'bg-yellow-400 text-black',
  reviewing: 'bg-yellow-400 text-black',
  accepted: 'bg-green-500 text-white',
  approved: 'bg-green-500 text-white',
  rejected: 'bg-red-500 text-white',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  reviewing: 'Under Review',
  accepted: 'Accepted',
  approved: 'Accepted',
  rejected: 'Rejected',
}

// GraphQL query for prefetching proposal details
const GET_PROPOSAL_DETAIL = gql`
  query GetProposalDetail($proposalId: ID!) {
    proposalDetail(proposalId: $proposalId) {
      id
      title
      status
      submissionDate
      biddingTeam {
        lead {
          id
          name
          email
          avatarUrl
          role
          assignedSections
        }
        members {
          id
          name
          email
          avatarUrl
          role
          assignedSections
        }
      }
      sections {
        id
        title
        content
        order
      }
      documents {
        id
        name
        fileType
        fileSize
        category
        url
        uploadedAt
        uploadedBy
      }
      complianceChecklist {
        id
        category
        item
        completed
        completedBy
        completedAt
      }
      versions {
        id
        versionNumber
        createdAt
        createdBy
      }
      currentVersion
    }
  }
`

export function ProposalCard({
  proposal,
  isSelected,
  onSelect,
  onClick,
  isSelectionDisabled = false,
}: ProposalCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const queryClient = useQueryClient()

  // Prefetch proposal details on hover
  const handleMouseEnter = () => {
    setIsHovered(true)
    
    // Prefetch proposal details
    queryClient.prefetchQuery({
      queryKey: ['proposal-detail', proposal.id],
      queryFn: async () => {
        const client = createGraphQLClient()
        return client.request(GET_PROPOSAL_DETAIL, { proposalId: proposal.id })
      },
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    })
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking checkbox
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    onClick(proposal.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter or Space to open proposal
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(proposal.id)
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelect(proposal.id)
  }

  const statusKey = proposal.status.toLowerCase()
  const statusColor = statusColors[statusKey] || 'bg-gray-400 text-black'
  const statusLabel = statusLabels[statusKey] || proposal.status

  const teamSize = calculateTeamSize(proposal)
  const formattedBudget = formatProposalBudget(proposal.budgetEstimate)
  const submissionDate = new Date(proposal.submissionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  // Get initials for avatar fallback
  const initials = proposal.biddingLead.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02]",
        "border-yellow-400/20",
        "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-yellow-400",
        isHovered && "border-yellow-400 shadow-lg",
        isSelected && "border-yellow-400 bg-yellow-400/5"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View proposal: ${proposal.title || 'Untitled Proposal'} from ${proposal.biddingTeamName}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Checkbox for comparison selection */}
            <div data-checkbox className="pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                disabled={isSelectionDisabled && !isSelected}
                aria-label={`Select ${proposal.title || 'proposal'} for comparison`}
              />
            </div>

            {/* Proposal Title and Team */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-black dark:text-white truncate">
                {proposal.title || 'Untitled Proposal'}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage 
                    src={proposal.biddingLead.avatarUrl || undefined}
                    alt={`${proposal.biddingLead.name}'s avatar`}
                  />
                  <AvatarFallback className="text-xs bg-yellow-400 text-black">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {proposal.biddingTeamName}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <Badge className={cn("shrink-0", statusColor)}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Budget */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-yellow-400" />
          <span className="font-semibold text-yellow-400">{formattedBudget}</span>
        </div>

        {/* Team Size */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {teamSize} {teamSize === 1 ? 'member' : 'members'}
          </span>
        </div>

        {/* Submission Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Submitted {submissionDate}</span>
        </div>

        {/* Scoring Information */}
        {(proposal.totalScore !== undefined && proposal.totalScore !== null) || proposal.scoringStatus ? (
          <div className="flex items-center gap-2 pt-2 border-t border-yellow-400/20">
            {proposal.rank && (
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4 text-yellow-400" aria-hidden="true" />
                <Badge 
                  className="bg-yellow-400 text-black hover:bg-yellow-500"
                  aria-label={`Rank ${proposal.rank}`}
                >
                  #{proposal.rank}
                </Badge>
              </div>
            )}
            {proposal.totalScore !== undefined && proposal.totalScore !== null && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-yellow-400">
                  {proposal.totalScore.toFixed(2)}
                </span>
              </div>
            )}
            {proposal.scoringStatus && (
              <Badge 
                variant="outline"
                className={cn(
                  "text-xs",
                  proposal.scoringStatus === 'fully_scored' && "border-green-500 text-green-500",
                  proposal.scoringStatus === 'partially_scored' && "border-yellow-400 text-yellow-400",
                  proposal.scoringStatus === 'not_scored' && "border-gray-400 text-gray-400"
                )}
              >
                {proposal.scoringStatus === 'fully_scored' && 'Fully Scored'}
                {proposal.scoringStatus === 'partially_scored' && 'Partially Scored'}
                {proposal.scoringStatus === 'not_scored' && 'Not Scored'}
              </Badge>
            )}
          </div>
        ) : null}

        {/* Unread Messages Badge */}
        {proposal.unreadMessages > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-yellow-400/20">
            <MessageSquare className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            <Badge 
              variant="secondary" 
              className="bg-yellow-400 text-black hover:bg-yellow-500"
              aria-label={`${proposal.unreadMessages} unread ${proposal.unreadMessages === 1 ? 'message' : 'messages'}`}
            >
              {proposal.unreadMessages} unread {proposal.unreadMessages === 1 ? 'message' : 'messages'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
