"use client"

import * as React from "react"
import { ProposalCard } from "./proposal-card"
import { ProposalCardSkeleton } from "./proposal-card-skeleton"
import { ProposalSummary } from "@/lib/graphql/types"
import { FileQuestion, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProposalsListProps {
  proposals: ProposalSummary[]
  isLoading?: boolean
  selectedProposals: string[]
  onProposalSelect: (id: string) => void
  onProposalClick: (id: string) => void
  filterStatus?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  pageSize?: number
  enableInfiniteScroll?: boolean
  onAccept?: (proposalId: string) => void
  onReject?: (proposalId: string) => void
  onMarkUnderReview?: (proposalId: string) => void
  showQuickActions?: boolean
}

export function ProposalsList({
  proposals,
  isLoading = false,
  selectedProposals,
  onProposalSelect,
  onProposalClick,
  filterStatus = 'all',
  sortBy = 'submission_date',
  sortOrder = 'desc',
  pageSize = 20,
  enableInfiniteScroll = false,
  onAccept,
  onReject,
  onMarkUnderReview,
  showQuickActions = false,
}: ProposalsListProps) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const [displayedCount, setDisplayedCount] = React.useState(pageSize)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  // Apply filtering
  const filteredProposals = proposals.filter((proposal) => {
    if (filterStatus === 'all') return true
    return proposal.status.toLowerCase() === filterStatus.toLowerCase()
  })

  // Apply sorting
  const sortedProposals = [...filteredProposals].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'submission_date':
        comparison = new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime()
        break
      case 'budget':
        const budgetA = a.budgetEstimate || 0
        const budgetB = b.budgetEstimate || 0
        comparison = budgetA - budgetB
        break
      case 'team_size':
        comparison = a.teamSize - b.teamSize
        break
      case 'score':
        const scoreA = a.totalScore ?? -1
        const scoreB = b.totalScore ?? -1
        comparison = scoreA - scoreB
        break
      case 'rank':
        const rankA = a.rank ?? 999999
        const rankB = b.rank ?? 999999
        comparison = rankA - rankB
        break
      default:
        comparison = 0
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Reset pagination when filters/sorts change
  React.useEffect(() => {
    setCurrentPage(1)
    setDisplayedCount(pageSize)
  }, [filterStatus, sortBy, sortOrder, pageSize])

  // Infinite scroll implementation
  React.useEffect(() => {
    if (!enableInfiniteScroll || !loadMoreRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < sortedProposals.length) {
          setDisplayedCount((prev) => Math.min(prev + pageSize, sortedProposals.length))
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [enableInfiniteScroll, displayedCount, sortedProposals.length, pageSize])

  // Calculate pagination
  const totalPages = Math.ceil(sortedProposals.length / pageSize)
  const startIndex = enableInfiniteScroll ? 0 : (currentPage - 1) * pageSize
  const endIndex = enableInfiniteScroll ? displayedCount : currentPage * pageSize
  const paginatedProposals = sortedProposals.slice(startIndex, endIndex)

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoadMore = () => {
    setDisplayedCount((prev) => Math.min(prev + pageSize, sortedProposals.length))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProposalCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  // Empty state
  if (sortedProposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-yellow-400/10 p-6 mb-4">
          <FileQuestion className="h-12 w-12 text-yellow-400" />
        </div>
        <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
          No proposals found
        </h3>
        <p className="text-muted-foreground max-w-md">
          {filterStatus !== 'all'
            ? `There are no proposals with status "${filterStatus}". Try adjusting your filters.`
            : 'No proposals have been submitted for this project yet. Check back later for updates.'}
        </p>
      </div>
    )
  }

  // Check if selection is at max (4 proposals)
  const isSelectionAtMax = selectedProposals.length >= 4

  // Proposals grid
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {paginatedProposals.map((proposal) => {
          const isSelected = selectedProposals.includes(proposal.id)
          const isDisabled = isSelectionAtMax && !isSelected

          return (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              isSelected={isSelected}
              onSelect={onProposalSelect}
              onClick={onProposalClick}
              isSelectionDisabled={isDisabled}
              onAccept={onAccept}
              onReject={onReject}
              onMarkUnderReview={onMarkUnderReview}
              showQuickActions={showQuickActions}
            />
          )
        })}
      </div>

      {/* Pagination Controls */}
      {!enableInfiniteScroll && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-yellow-400/20 pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedProposals.length)} of {sortedProposals.length} proposals
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="border-yellow-400/40 hover:bg-yellow-400/10 disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCurrentPage(pageNum)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={
                      currentPage === pageNum
                        ? "bg-yellow-400 text-black hover:bg-yellow-500"
                        : "border-yellow-400/40 hover:bg-yellow-400/10"
                    }
                    aria-label={`Page ${pageNum}`}
                    aria-current={currentPage === pageNum ? "page" : undefined}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="border-yellow-400/40 hover:bg-yellow-400/10 disabled:opacity-50"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Infinite Scroll - Load More Button & Observer Target */}
      {enableInfiniteScroll && displayedCount < sortedProposals.length && (
        <div className="flex flex-col items-center gap-4 pt-4">
          <div ref={loadMoreRef} className="h-4" />
          <Button
            variant="outline"
            onClick={handleLoadMore}
            className="border-yellow-400/40 hover:bg-yellow-400/10"
            aria-label="Load more proposals"
          >
            Load More ({sortedProposals.length - displayedCount} remaining)
          </Button>
        </div>
      )}

      {/* Infinite Scroll - End Message */}
      {enableInfiniteScroll && displayedCount >= sortedProposals.length && sortedProposals.length > pageSize && (
        <div className="text-center text-sm text-muted-foreground pt-4 border-t border-yellow-400/20">
          All proposals loaded
        </div>
      )}
    </div>
  )
}
