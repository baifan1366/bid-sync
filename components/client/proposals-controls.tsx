"use client"

import { Filter, ArrowUpDown, ArrowUp, ArrowDown, GitCompare } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ProposalStatus = 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
type SortField = 'submission_date' | 'budget' | 'team_size'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'list' | 'comparison'

interface ProposalsControlsProps {
  filterStatus: ProposalStatus | 'all'
  onFilterChange: (status: ProposalStatus | 'all') => void
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField, order: SortOrder) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedProposals: string[]
  onCompareClick: () => void
}

const statusLabels: Record<ProposalStatus | 'all', string> = {
  all: 'All Proposals',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const sortFieldLabels: Record<SortField, string> = {
  submission_date: 'Submission Date',
  budget: 'Budget',
  team_size: 'Team Size',
}

export function ProposalsControls({
  filterStatus,
  onFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  selectedProposals,
  onCompareClick,
}: ProposalsControlsProps) {
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    onSortChange(sortBy, newOrder)
  }

  const handleSortFieldChange = (field: SortField) => {
    onSortChange(field, sortOrder)
  }

  const handleComparisonToggle = () => {
    if (viewMode === 'list') {
      onViewModeChange('comparison')
      onCompareClick()
    } else {
      onViewModeChange('list')
    }
  }

  const canCompare = selectedProposals.length >= 2 && selectedProposals.length <= 4

  return (
    <div 
      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-white dark:bg-black border border-yellow-400/20 rounded-lg"
      role="toolbar"
      aria-label="Proposals filtering and sorting controls"
    >
      {/* Filter by Status */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <Select value={filterStatus} onValueChange={onFilterChange}>
          <SelectTrigger 
            className="w-full sm:w-[180px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
            aria-label="Filter proposals by status"
          >
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{statusLabels.all}</SelectItem>
            <SelectItem value="draft">{statusLabels.draft}</SelectItem>
            <SelectItem value="submitted">{statusLabels.submitted}</SelectItem>
            <SelectItem value="under_review">{statusLabels.under_review}</SelectItem>
            <SelectItem value="accepted">{statusLabels.accepted}</SelectItem>
            <SelectItem value="rejected">{statusLabels.rejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Select value={sortBy} onValueChange={handleSortFieldChange}>
          <SelectTrigger 
            className="flex-1 sm:w-[160px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
            aria-label="Sort proposals by field"
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submission_date">{sortFieldLabels.submission_date}</SelectItem>
            <SelectItem value="budget">{sortFieldLabels.budget}</SelectItem>
            <SelectItem value="team_size">{sortFieldLabels.team_size}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          className="shrink-0 hover:bg-yellow-400/10 hover:border-yellow-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
        >
          {sortOrder === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Comparison Mode Toggle */}
      <div className="flex items-center gap-3 ml-auto">
        {selectedProposals.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <Badge 
              variant="secondary" 
              className={
                canCompare
                  ? "bg-green-500 text-white"
                  : "bg-yellow-400 text-black hover:bg-yellow-500"
              }
            >
              {selectedProposals.length} selected
            </Badge>
            {!canCompare && (
              <span className="text-xs text-muted-foreground">
                {selectedProposals.length < 2
                  ? `Select ${2 - selectedProposals.length} more`
                  : `Deselect ${selectedProposals.length - 4}`}
              </span>
            )}
          </div>
        )}
        <Button
          variant={viewMode === 'comparison' ? 'default' : 'outline'}
          size="sm"
          onClick={handleComparisonToggle}
          disabled={viewMode === 'list' && !canCompare}
          aria-label={viewMode === 'comparison' ? 'Exit comparison mode' : 'Compare selected proposals'}
          className={
            viewMode === 'comparison'
              ? 'bg-yellow-400 hover:bg-yellow-500 text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400'
              : 'hover:bg-yellow-400/10 hover:border-yellow-400/40 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400'
          }
        >
          <GitCompare className="h-4 w-4 mr-2" />
          {viewMode === 'comparison' ? 'Exit Compare' : 'Compare'}
        </Button>
      </div>
    </div>
  )
}
