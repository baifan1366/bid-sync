"use client"

import { useState } from "react"
import { Filter, X, DollarSign, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"

export interface ProjectFilterValues {
  budgetMin?: number
  budgetMax?: number
  deadlineBefore?: Date
  deadlineAfter?: Date
}

interface ProjectFilterControlsProps {
  filters: ProjectFilterValues
  onFiltersChange: (filters: ProjectFilterValues) => void
  onClearFilters: () => void
}

export function ProjectFilterControls({
  filters,
  onFiltersChange,
  onClearFilters,
}: ProjectFilterControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<ProjectFilterValues>(filters)

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== ""
  ).length

  const handleApplyFilters = () => {
    // Validate budget range
    if (
      localFilters.budgetMin !== undefined &&
      localFilters.budgetMax !== undefined &&
      localFilters.budgetMin > localFilters.budgetMax
    ) {
      // Show error toast or inline error
      return
    }

    // Validate deadline range
    if (
      localFilters.deadlineAfter &&
      localFilters.deadlineBefore &&
      localFilters.deadlineAfter > localFilters.deadlineBefore
    ) {
      // Show error toast or inline error
      return
    }

    onFiltersChange(localFilters)
    setIsOpen(false)
  }

  const handleClearFilters = () => {
    setLocalFilters({})
    onClearFilters()
    setIsOpen(false)
  }

  const maxBudget = 100000 // RM 100,000 max
  const budgetRange = [
    localFilters.budgetMin ?? 0,
    localFilters.budgetMax ?? maxBudget
  ]

  const handleBudgetRangeChange = (values: number[]) => {
    setLocalFilters({
      ...localFilters,
      budgetMin: values[0] === 0 ? undefined : values[0],
      budgetMax: values[1] === maxBudget ? undefined : values[1]
    })
  }

  const formatBudget = (value: number) => {
    if (value >= 1000) {
      return `RM ${(value / 1000).toFixed(0)}k`
    }
    return `RM ${value}`
  }

  const handleDeadlineBeforeChange = (value: string) => {
    const dateValue = value ? new Date(value) : undefined
    setLocalFilters({ ...localFilters, deadlineBefore: dateValue })
  }

  const handleDeadlineAfterChange = (value: string) => {
    const dateValue = value ? new Date(value) : undefined
    setLocalFilters({ ...localFilters, deadlineAfter: dateValue })
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="border-yellow-400/40 text-black dark:text-white hover:bg-yellow-400/10 relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-yellow-400 text-black hover:bg-yellow-500">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-white dark:bg-black border-yellow-400/20">
        <SheetHeader className="border-b border-yellow-400/20 pb-4">
          <SheetTitle className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <Filter className="h-5 w-5 text-yellow-400" />
            Filter Projects
          </SheetTitle>
          <SheetDescription className="text-sm">
            Refine your project search with advanced filters
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          {/* Budget Range */}
          <div className="space-y-4 p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold text-black dark:text-white">
                <DollarSign className="h-5 w-5 text-yellow-400" />
                Budget Range
              </Label>
              <span className="text-sm font-medium text-yellow-400">
                {formatBudget(budgetRange[0])} - {budgetRange[1] === maxBudget ? 'No limit' : formatBudget(budgetRange[1])}
              </span>
            </div>
            <div className="pt-2 pb-1">
              <Slider
                value={budgetRange}
                onValueChange={handleBudgetRangeChange}
                min={0}
                max={maxBudget}
                step={1000}
                className="**:data-[slot=slider-range]:bg-yellow-400[&_data-[slot=slider-thumb]]:border-yellow-400"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>RM 0</span>
              <span>RM 100k+</span>
            </div>
          </div>

          {/* Deadline Range */}
          <div className="space-y-4 p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
            <Label className="flex items-center gap-2 text-base font-semibold text-black dark:text-white">
              <Calendar className="h-5 w-5 text-yellow-400" />
              Deadline Range
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deadlineAfter" className="text-xs font-medium text-muted-foreground">
                  After
                </Label>
                <Input
                  id="deadlineAfter"
                  type="date"
                  value={
                    localFilters.deadlineAfter
                      ? localFilters.deadlineAfter.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => handleDeadlineAfterChange(e.target.value)}
                  className="border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadlineBefore" className="text-xs font-medium text-muted-foreground">
                  Before
                </Label>
                <Input
                  id="deadlineBefore"
                  type="date"
                  value={
                    localFilters.deadlineBefore
                      ? localFilters.deadlineBefore.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => handleDeadlineBeforeChange(e.target.value)}
                  className="border-yellow-400/30 focus:border-yellow-400 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-black pb-4">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 border-yellow-400/40 hover:bg-yellow-400/10 font-medium"
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button
              onClick={handleApplyFilters}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
