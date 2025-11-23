"use client"

import { Filter } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProjectStatus } from "@/types/project"

interface FilterControlsProps {
  value: ProjectStatus | 'all'
  onChange: (value: ProjectStatus | 'all') => void
}

const statusLabels: Record<ProjectStatus | 'all', string> = {
  all: 'All Projects',
  PENDING_REVIEW: 'Pending Review',
  OPEN: 'Open',
  CLOSED: 'Closed',
  AWARDED: 'Awarded',
}

export function FilterControls({ value, onChange }: FilterControlsProps) {
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{statusLabels.all}</SelectItem>
          <SelectItem value="PENDING_REVIEW">{statusLabels.PENDING_REVIEW}</SelectItem>
          <SelectItem value="OPEN">{statusLabels.OPEN}</SelectItem>
          <SelectItem value="CLOSED">{statusLabels.CLOSED}</SelectItem>
          <SelectItem value="AWARDED">{statusLabels.AWARDED}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
