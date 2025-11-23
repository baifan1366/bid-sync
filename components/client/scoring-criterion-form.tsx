"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X, GripVertical } from "lucide-react"

export interface ScoringCriterionFormData {
  id?: string
  name: string
  description?: string
  weight: number
  orderIndex: number
}

interface ScoringCriterionFormProps {
  criterion: ScoringCriterionFormData
  index: number
  onUpdate: (index: number, updates: Partial<ScoringCriterionFormData>) => void
  onRemove: (index: number) => void
  onDragStart?: (index: number) => void
  onDragOver?: (e: React.DragEvent, index: number) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

export function ScoringCriterionForm({
  criterion,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging = false,
}: ScoringCriterionFormProps) {
  return (
    <div
      draggable={!!onDragStart}
      onDragStart={() => onDragStart?.(index)}
      onDragOver={(e) => onDragOver?.(e, index)}
      onDragEnd={onDragEnd}
      className={`border border-yellow-400/20 rounded-lg p-4 space-y-3 ${
        onDragStart ? 'cursor-move' : ''
      } hover:border-yellow-400/40 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {onDragStart && (
          <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
        )}
        
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor={`criterion-name-${index}`} className="text-sm">
                Criterion Name *
              </Label>
              <Input
                id={`criterion-name-${index}`}
                placeholder="e.g., Technical Approach"
                value={criterion.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
                required
                className="focus-visible:ring-yellow-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`criterion-weight-${index}`} className="text-sm">
                Weight (%) *
              </Label>
              <Input
                id={`criterion-weight-${index}`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                value={criterion.weight || ""}
                onChange={(e) => onUpdate(index, { weight: parseFloat(e.target.value) || 0 })}
                required
                className="focus-visible:ring-yellow-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`criterion-description-${index}`} className="text-sm">
              Description (optional)
            </Label>
            <Textarea
              id={`criterion-description-${index}`}
              placeholder="Describe what this criterion evaluates..."
              value={criterion.description || ""}
              onChange={(e) => onUpdate(index, { description: e.target.value })}
              rows={2}
              className="focus-visible:ring-yellow-400"
            />
          </div>

          {/* Order Index Display */}
          <div className="text-xs text-muted-foreground">
            Order: {criterion.orderIndex + 1}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="shrink-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
          aria-label={`Delete criterion ${criterion.name || 'at position ' + (index + 1)}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
