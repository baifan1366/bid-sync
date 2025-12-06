"use client"

import * as React from "react"
import { X, DollarSign, Users, Clock, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProposalDetail } from "@/lib/graphql/types"
import { 
  alignProposalSections, 
  detectProposalDifferences, 
  calculateComparisonMetrics,
  getComparisonSummary 
} from "@/lib/comparison-utils"
import { formatProposalBudget } from "@/lib/proposal-utils"
import { cn } from "@/lib/utils"

interface ProposalComparisonViewProps {
  proposalIds: string[]
  onClose: () => void
}

export function ProposalComparisonView({ proposalIds, onClose }: ProposalComparisonViewProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [proposals, setProposals] = React.useState<ProposalDetail[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // TODO: Fetch proposal details for all proposalIds
    // For now, using placeholder data
    setIsLoading(false)
  }, [proposalIds])

  // Synchronized scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    const scrollLeft = e.currentTarget.scrollLeft
    
    // Sync all proposal columns
    const columns = scrollContainerRef.current?.querySelectorAll('[data-proposal-column]')
    columns?.forEach((column) => {
      if (column !== e.currentTarget) {
        column.scrollTop = scrollTop
      }
    })
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black">
        <div className="flex h-full items-center justify-center">
          <div className="text-muted-foreground">Loading comparison...</div>
        </div>
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black">
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">No proposals available for comparison</p>
          <Button onClick={onClose} className="bg-yellow-400 text-black hover:bg-yellow-500">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const alignedSections = alignProposalSections(proposals)
  const differences = detectProposalDifferences(proposals)
  const comparisonSummary = getComparisonSummary(
    proposals.map((p) => ({
      id: p.id,
      title: p.title,
      biddingTeamName: p.biddingTeam.lead.name,
      biddingLead: p.biddingTeam.lead,
      teamSize: p.biddingTeam.members.length + 1,
      budgetEstimate: null,
      timelineEstimate: null,
      executiveSummary: null,
      submissionDate: p.submissionDate,
      status: p.status,
      complianceScore: p.complianceChecklist.length > 0
        ? Math.round(
            (p.complianceChecklist.filter((item) => item.completed).length /
              p.complianceChecklist.length) *
              100
          )
        : 0,
      unreadMessages: 0,
      additionalInfo: [],
    }))
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-black">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-yellow-400/20 bg-white dark:bg-black">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white">
                Compare Proposals
              </h2>
              <p className="text-sm text-muted-foreground">
                Comparing {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-yellow-400/10 focus-visible:outline-yellow-400"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close comparison</span>
            </Button>
          </div>

          {/* Comparison Summary */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
              <p className="text-xs text-muted-foreground">Team Size Range</p>
              <p className="text-sm font-semibold text-black dark:text-white">
                {comparisonSummary.teamSizeRange.min} - {comparisonSummary.teamSizeRange.max} members
              </p>
            </div>
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
              <p className="text-xs text-muted-foreground">Compliance Range</p>
              <p className="text-sm font-semibold text-black dark:text-white">
                {comparisonSummary.complianceRange.min}% - {comparisonSummary.complianceRange.max}%
              </p>
            </div>
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
              <p className="text-xs text-muted-foreground">Key Differences</p>
              <p className="text-sm font-semibold text-black dark:text-white">
                {differences.filter((d) => d.hasDifference).length} metric{differences.filter((d) => d.hasDifference).length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
          {/* Desktop: Side-by-side layout */}
          <div className="hidden lg:block">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${proposals.length}, 1fr)` }}>
              {proposals.map((proposal) => (
                <ProposalColumn
                  key={proposal.id}
                  proposal={proposal}
                  alignedSections={alignedSections}
                  differences={differences}
                  onScroll={handleScroll}
                  allProposals={proposals}
                />
              ))}
            </div>
          </div>

          {/* Mobile/Tablet: Stacked layout */}
          <div className="space-y-6 lg:hidden">
            {proposals.map((proposal) => (
              <ProposalColumn
                key={proposal.id}
                proposal={proposal}
                alignedSections={alignedSections}
                differences={differences}
                onScroll={handleScroll}
                allProposals={proposals}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProposalColumnProps {
  proposal: ProposalDetail
  alignedSections: ReturnType<typeof alignProposalSections>
  differences: ReturnType<typeof detectProposalDifferences>
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  allProposals?: ProposalDetail[]
}

function ProposalColumn({ proposal, alignedSections, differences, onScroll, allProposals = [] }: ProposalColumnProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'accepted' || statusLower === 'approved') {
      return 'bg-green-500 text-white'
    }
    if (statusLower === 'rejected') {
      return 'bg-red-500 text-white'
    }
    if (statusLower === 'submitted') {
      return 'bg-yellow-400 text-black'
    }
    if (statusLower === 'under_review' || statusLower === 'reviewing') {
      return 'bg-blue-500 text-white'
    }
    return 'bg-gray-500 text-white'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const teamSize = proposal.biddingTeam.members.length + 1
  const compliancePercentage = proposal.complianceChecklist.length > 0
    ? Math.round(
        (proposal.complianceChecklist.filter((item) => item.completed).length /
          proposal.complianceChecklist.length) *
          100
      )
    : 0

  // Find differences for this proposal
  const budgetDiff = differences.find((d) => d.field === 'budget')
  const timelineDiff = differences.find((d) => d.field === 'timeline')
  const teamSizeDiff = differences.find((d) => d.field === 'teamSize')
  const complianceDiff = differences.find((d) => d.field === 'complianceScore')

  // Calculate rankings
  const teamSizes = allProposals.map((p) => p.biddingTeam.members.length + 1)
  const complianceScores = allProposals.map((p) => {
    return p.complianceChecklist.length > 0
      ? Math.round(
          (p.complianceChecklist.filter((item) => item.completed).length /
            p.complianceChecklist.length) *
            100
        )
      : 0
  })

  const teamSizeRank = teamSizes.filter((ts) => ts < teamSize).length + 1
  const complianceRank = complianceScores.filter((cs) => cs > compliancePercentage).length + 1

  // Determine if this proposal is best/worst for each metric
  const isBestTeamSize = teamSize === Math.min(...teamSizes)
  const isWorstTeamSize = teamSize === Math.max(...teamSizes)
  const isBestCompliance = compliancePercentage === Math.max(...complianceScores)
  const isWorstCompliance = compliancePercentage === Math.min(...complianceScores)

  return (
    <div
      data-proposal-column
      className="flex flex-col overflow-auto"
      onScroll={onScroll}
    >
      <Card className="border-yellow-400/20">
        {/* Sticky Proposal Header */}
        <CardHeader className="sticky top-0 z-10 border-b border-yellow-400/20 bg-white dark:bg-black">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-black dark:text-white">
                {proposal.title || 'Untitled Proposal'}
              </h3>
              <Badge className={cn("shrink-0", getStatusColor(proposal.status))}>
                {proposal.status}
              </Badge>
            </div>

            {/* Bidding Lead */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={proposal.biddingTeam.lead.avatarUrl || undefined} />
                <AvatarFallback className="bg-yellow-400 text-black">
                  {getInitials(proposal.biddingTeam.lead.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-black dark:text-white">
                  {proposal.biddingTeam.lead.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {proposal.biddingTeam.lead.role}
                </p>
              </div>
            </div>

            {/* Submission Date */}
            <p className="text-sm text-muted-foreground">
              Submitted {formatDate(proposal.submissionDate)}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Key Metrics Comparison */}
          <div className="space-y-4">
            <h4 className="font-semibold text-black dark:text-white">Key Metrics</h4>

            {/* Budget */}
            <ComparisonMetric
              icon={<DollarSign className="h-4 w-4" />}
              label="Budget"
              value="Not specified"
              hasDifference={budgetDiff?.hasDifference || false}
            />

            {/* Timeline */}
            <ComparisonMetric
              icon={<Clock className="h-4 w-4" />}
              label="Timeline"
              value="Not specified"
              hasDifference={timelineDiff?.hasDifference || false}
            />

            {/* Team Size */}
            <ComparisonMetric
              icon={<Users className="h-4 w-4" />}
              label="Team Size"
              value={`${teamSize} ${teamSize === 1 ? 'member' : 'members'}`}
              hasDifference={teamSizeDiff?.hasDifference || false}
              isBest={isBestTeamSize}
              isWorst={isWorstTeamSize}
              rank={teamSizeRank}
              total={allProposals.length}
            />

            {/* Compliance Score */}
            <ComparisonMetric
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Compliance"
              value={`${compliancePercentage}%`}
              hasDifference={complianceDiff?.hasDifference || false}
              isBest={isBestCompliance}
              isWorst={isWorstCompliance}
              rank={complianceRank}
              total={allProposals.length}
            />
          </div>

          {/* Sections Comparison */}
          <div className="space-y-4">
            <h4 className="font-semibold text-black dark:text-white">Proposal Sections</h4>
            {alignedSections.map((alignedSection) => {
              const proposalSection = alignedSection.proposals.find(
                (p) => p.proposalId === proposal.id
              )?.section

              return (
                <div
                  key={alignedSection.title}
                  className="rounded-lg border border-yellow-400/20 p-4"
                >
                  <h5 className="mb-2 font-medium text-black dark:text-white">
                    {alignedSection.title}
                  </h5>
                  {proposalSection ? (
                    <div
                      className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: proposalSection.content }}
                    />
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Section not included
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Visual Comparison Bars */}
          <div className="space-y-4">
            <h4 className="font-semibold text-black dark:text-white">Visual Comparison</h4>
            
            {/* Team Size Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Team Size</span>
                <span className="font-medium text-black dark:text-white">{teamSize}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isBestTeamSize ? "bg-green-500" : isWorstTeamSize ? "bg-red-500" : "bg-yellow-400"
                  )}
                  style={{
                    width: `${Math.min((teamSize / Math.max(...teamSizes)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Compliance Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Compliance</span>
                <span className="font-medium text-black dark:text-white">{compliancePercentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isBestCompliance ? "bg-green-500" : isWorstCompliance ? "bg-red-500" : "bg-yellow-400"
                  )}
                  style={{
                    width: `${compliancePercentage}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Documents Count */}
          <div className="rounded-lg border border-yellow-400/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-black dark:text-white">
                Documents
              </span>
              <Badge variant="outline" className="border-yellow-400/40 text-yellow-400">
                {proposal.documents.length} file{proposal.documents.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface ComparisonMetricProps {
  icon: React.ReactNode
  label: string
  value: string
  hasDifference: boolean
  isBest?: boolean
  isWorst?: boolean
  rank?: number
  total?: number
}

function ComparisonMetric({ 
  icon, 
  label, 
  value, 
  hasDifference, 
  isBest = false, 
  isWorst = false,
  rank,
  total
}: ComparisonMetricProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3",
        hasDifference
          ? "border-yellow-400 bg-yellow-400/5"
          : "border-yellow-400/20",
        isBest && "border-green-500 bg-green-500/5",
        isWorst && "border-red-500 bg-red-500/5"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "text-yellow-400",
          isBest && "text-green-500",
          isWorst && "text-red-500"
        )}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{label}</span>
          {rank && total && (
            <span className="text-xs text-muted-foreground">
              Rank {rank} of {total}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-black dark:text-white">{value}</span>
        {isBest && <TrendingUp className="h-4 w-4 text-green-500" />}
        {isWorst && <TrendingDown className="h-4 w-4 text-red-500" />}
        {!isBest && !isWorst && hasDifference && <Minus className="h-4 w-4 text-yellow-400" />}
      </div>
    </div>
  )
}
