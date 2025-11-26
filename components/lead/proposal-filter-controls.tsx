"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react"

export interface ProposalFilterValues {
  status?: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'archived'
  deadlineBefore?: Date
  deadlineAfter?: Date
  sortBy?: 'deadline' | 'status' | 'created_at' | 'updated_at' | 'completion'
  sortOrder?: 'asc' | 'desc'
}

interface ProposalFilterControlsProps {
  filters: ProposalFilterValues
  onFiltersChange: (filters: ProposalFilterValues) => void
  onClearFilters: () => void
}

export function ProposalFilterControls({
  filters,
  onFiltersChange,
  onClearFilters,
}: ProposalFilterControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === 'all' ? undefined : value as any,
    })
  }

  const handleSortByChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as any,
    })
  }

  const handleSortOrderChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortOrder: value as any,
    })
  }

  const handleDeadlineBeforeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      deadlineBefore: value ? new Date(value) : undefined,
    })
  }

  const handleDeadlineAfterChange = (value: string) => {
    onFiltersChange({
      ...filters,
      deadlineAfter: value ? new Date(value) : undefined,
    })
  }

  const activeFilterCount = [
    filters.status,
    filters.deadlineBefore,
    filters.deadlineAfter,
  ].filter(Boolean).length

  return (
    <div className="space-y-4 w-full">
      {/* Main Filter Bar */}
      <Card className="p-4 border-yellow-400/20 bg-white dark:bg-black">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter */}
          <div className="flex-1 min-w-[180px]">
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full border-yellow-400/30 bg-white dark:bg-black hover:border-yellow-400/50 focus:ring-yellow-400">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="border-yellow-400/20">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">📝 Draft</SelectItem>
                <SelectItem value="submitted">📤 Submitted</SelectItem>
                <SelectItem value="reviewing">🔍 Reviewing</SelectItem>
                <SelectItem value="approved">✅ Approved</SelectItem>
                <SelectItem value="rejected">❌ Rejected</SelectItem>
                <SelectItem value="archived">📦 Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="flex-1 min-w-[180px]">
            <Select
              value={filters.sortBy || 'updated_at'}
              onValueChange={handleSortByChange}
            >
              <SelectTrigger className="w-full border-yellow-400/30 bg-white dark:bg-black hover:border-yellow-400/50 focus:ring-yellow-400">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="border-yellow-400/20">
                <SelectItem value="updated_at">📅 Last Updated</SelectItem>
                <SelectItem value="created_at">🆕 Created Date</SelectItem>
                <SelectItem value="deadline">⏰ Deadline</SelectItem>
                <SelectItem value="status">🏷️ Status</SelectItem>
                <SelectItem value="completion">📊 Completion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort Order */}
          <div className="min-w-[140px]">
            <Select
              value={filters.sortOrder || 'desc'}
              onValueChange={handleSortOrderChange}
            >
              <SelectTrigger className="w-full border-yellow-400/30 bg-white dark:bg-black hover:border-yellow-400/50 focus:ring-yellow-400">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent className="border-yellow-400/20">
                <SelectItem value="desc">⬇️ Newest First</SelectItem>
                <SelectItem value="asc">⬆️ Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="border-yellow-400/40 hover:bg-yellow-400/10 hover:border-yellow-400/60 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2 text-yellow-400" />
            <span className="hidden sm:inline">More Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-yellow-400 text-black hover:bg-yellow-500 font-bold">
                {activeFilterCount}
              </Badge>
            )}
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 ml-2" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-2" />
            )}
          </Button>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="hover:bg-yellow-400/10 text-yellow-400 hover:text-yellow-500"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <Card className="w-full p-6 border-yellow-400/30 bg-linear-to-br from-yellow-400/5 to-transparent dark:from-yellow-400/10">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-1 rounded-full bg-yellow-400" />
              <h4 className="font-semibold text-black dark:text-white">
                Deadline Filters
              </h4>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* Deadline Before */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-black dark:text-white flex items-center gap-2">
                  <span className="text-yellow-400">📅</span>
                  Deadline Before
                </label>
                <Input
                  type="date"
                  value={filters.deadlineBefore ? filters.deadlineBefore.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDeadlineBeforeChange(e.target.value)}
                  className="border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400 bg-white dark:bg-black"
                />
                {filters.deadlineBefore && (
                  <p className="text-xs text-muted-foreground">
                    Showing proposals due before this date
                  </p>
                )}
              </div>

              {/* Deadline After */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-black dark:text-white flex items-center gap-2">
                  <span className="text-yellow-400">📅</span>
                  Deadline After
                </label>
                <Input
                  type="date"
                  value={filters.deadlineAfter ? filters.deadlineAfter.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleDeadlineAfterChange(e.target.value)}
                  className="border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400 bg-white dark:bg-black"
                />
                {filters.deadlineAfter && (
                  <p className="text-xs text-muted-foreground">
                    Showing proposals due after this date
                  </p>
                )}
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFilterCount > 0 && (
              <div className="mt-4 pt-4 border-t border-yellow-400/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''} applied
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="text-yellow-400 hover:text-yellow-500 hover:bg-yellow-400/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
