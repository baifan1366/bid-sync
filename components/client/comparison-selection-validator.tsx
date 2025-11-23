"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { validateComparisonSelection } from "@/lib/comparison-utils"
import { cn } from "@/lib/utils"

interface ComparisonSelectionValidatorProps {
  selectedIds: string[]
  onCompare: () => void
  onClear?: () => void
}

export function ComparisonSelectionValidator({
  selectedIds,
  onCompare,
  onClear,
}: ComparisonSelectionValidatorProps) {
  const validation = validateComparisonSelection(selectedIds)
  const hasSelection = selectedIds.length > 0

  if (!hasSelection) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border p-4 shadow-lg transition-all",
        "bg-white dark:bg-black",
        validation.valid
          ? "border-green-500 bg-green-500/5"
          : "border-yellow-400 bg-yellow-400/5"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Icon and Message */}
        <div className="flex items-center gap-3">
          {validation.valid ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          )}
          <div>
            <p className="font-medium text-black dark:text-white">
              {selectedIds.length} proposal{selectedIds.length !== 1 ? 's' : ''} selected
            </p>
            {!validation.valid && validation.error && (
              <p className="text-sm text-muted-foreground">{validation.error}</p>
            )}
            {validation.valid && (
              <p className="text-sm text-muted-foreground">
                Ready to compare
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="border-yellow-400/40 hover:bg-yellow-400/10"
            >
              Clear
            </Button>
          )}
          <Button
            size="sm"
            onClick={onCompare}
            disabled={!validation.valid}
            className="bg-yellow-400 text-black hover:bg-yellow-500 disabled:opacity-50"
          >
            Compare
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ComparisonSelectionBadgeProps {
  selectedCount: number
  maxCount?: number
}

export function ComparisonSelectionBadge({
  selectedCount,
  maxCount = 4,
}: ComparisonSelectionBadgeProps) {
  if (selectedCount === 0) {
    return null
  }

  const isValid = selectedCount >= 2 && selectedCount <= maxCount
  const isAtMax = selectedCount >= maxCount

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        isValid
          ? "border-green-500 bg-green-500/10 text-green-500"
          : "border-yellow-400 bg-yellow-400/10 text-yellow-400"
      )}
    >
      <span>
        {selectedCount} / {maxCount}
      </span>
      {isAtMax && (
        <span className="text-xs">(Max reached)</span>
      )}
    </div>
  )
}

interface ComparisonSelectionHintProps {
  selectedCount: number
  minCount?: number
  maxCount?: number
}

export function ComparisonSelectionHint({
  selectedCount,
  minCount = 2,
  maxCount = 4,
}: ComparisonSelectionHintProps) {
  if (selectedCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select {minCount}-{maxCount} proposals to compare
      </p>
    )
  }

  if (selectedCount < minCount) {
    const remaining = minCount - selectedCount
    return (
      <p className="text-sm text-yellow-400">
        Select {remaining} more proposal{remaining !== 1 ? 's' : ''} to compare
      </p>
    )
  }

  if (selectedCount > maxCount) {
    const excess = selectedCount - maxCount
    return (
      <p className="text-sm text-red-500">
        Please deselect {excess} proposal{excess !== 1 ? 's' : ''}
      </p>
    )
  }

  return (
    <p className="text-sm text-green-500">
      Ready to compare {selectedCount} proposals
    </p>
  )
}
