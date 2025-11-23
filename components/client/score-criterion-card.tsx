"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import type { ScoringCriterion } from "@/lib/graphql/types"

interface ScoreCriterionCardProps {
  criterion: ScoringCriterion
  rawScore: number
  notes: string
  onScoreChange: (rawScore: number) => void
  onNotesChange: (notes: string) => void
  disabled?: boolean
  hasUnsavedChanges?: boolean
}

export function ScoreCriterionCard({
  criterion,
  rawScore,
  notes,
  onScoreChange,
  onNotesChange,
  disabled = false,
  hasUnsavedChanges = false,
}: ScoreCriterionCardProps) {
  // Calculate weighted score: raw_score × (weight / 100)
  const weightedScore = (rawScore * criterion.weight) / 100

  return (
    <Card 
      className={`border-yellow-400/20 transition-colors ${
        hasUnsavedChanges ? 'border-yellow-400 shadow-lg shadow-yellow-400/10' : ''
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{criterion.name}</CardTitle>
            {criterion.description && (
              <CardDescription className="mt-1">
                {criterion.description}
              </CardDescription>
            )}
          </div>
          <div className="text-right ml-4">
            <div className="text-sm text-muted-foreground">Weight</div>
            <div className="text-lg font-semibold text-yellow-400">
              {criterion.weight}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`score-${criterion.id}`}>
              Raw Score (1-10)
            </Label>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-yellow-400">
                {rawScore.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                Weighted: {weightedScore.toFixed(2)}
              </span>
            </div>
          </div>
          <Slider
            id={`score-${criterion.id}`}
            min={1}
            max={10}
            step={0.1}
            value={[rawScore]}
            onValueChange={([value]) => onScoreChange(value)}
            disabled={disabled}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 (Poor)</span>
            <span>5 (Average)</span>
            <span>10 (Excellent)</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor={`notes-${criterion.id}`}>
            Notes (optional)
          </Label>
          <Textarea
            id={`notes-${criterion.id}`}
            placeholder="Add your evaluation notes here..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="resize-none"
          />
        </div>
      </CardContent>
    </Card>
  )
}
