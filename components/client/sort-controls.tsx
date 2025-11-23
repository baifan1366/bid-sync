"use client"

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type SortField = 'created_at' | 'deadline' | 'budget'
type SortOrder = 'asc' | 'desc'

interface SortControlsProps {
  sortBy: SortField
  sortOrder: SortOrder
  onSortByChange: (value: SortField) => void
  onSortOrderChange: (value: SortOrder) => void
}

const sortFieldLabels: Record<SortField, string> = {
  created_at: 'Created Date',
  deadline: 'Deadline',
  budget: 'Budget',
}

export function SortControls({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: SortControlsProps) {
  const toggleSortOrder = () => {
    onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="flex-1 sm:w-[160px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">{sortFieldLabels.created_at}</SelectItem>
          <SelectItem value="deadline">{sortFieldLabels.deadline}</SelectItem>
          <SelectItem value="budget">{sortFieldLabels.budget}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleSortOrder}
        aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
        className="shrink-0"
      >
        {sortOrder === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
