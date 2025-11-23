/**
 * Example usage of ScoreCriterionCard component
 * 
 * This file demonstrates how to use the ScoreCriterionCard component
 * in the ProposalScoringInterface or other scoring contexts.
 */

import { useState } from 'react'
import { ScoreCriterionCard } from './score-criterion-card'
import type { ScoringCriterion } from '@/lib/graphql/types'

// Example criterion
const exampleCriterion: ScoringCriterion = {
  id: 'criterion-1',
  templateId: 'template-1',
  name: 'Technical Approach',
  description: 'Evaluate the technical approach and methodology',
  weight: 30,
  orderIndex: 0,
  createdAt: '2024-01-01T00:00:00Z',
}

// Example usage in a component
export function ExampleUsage() {
  const [rawScore, setRawScore] = useState(5)
  const [notes, setNotes] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleScoreChange = (newScore: number) => {
    setRawScore(newScore)
    setHasUnsavedChanges(true)
    // Trigger auto-save logic here
  }

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes)
    setHasUnsavedChanges(true)
    // Trigger auto-save logic here
  }

  return (
    <ScoreCriterionCard
      criterion={exampleCriterion}
      rawScore={rawScore}
      notes={notes}
      onScoreChange={handleScoreChange}
      onNotesChange={handleNotesChange}
      hasUnsavedChanges={hasUnsavedChanges}
      disabled={false}
    />
  )
}

// Example with multiple criteria
export function MultipleScoresExample() {
  const criteria: ScoringCriterion[] = [
    {
      id: 'criterion-1',
      templateId: 'template-1',
      name: 'Technical Approach',
      description: 'Evaluate the technical approach and methodology',
      weight: 30,
      orderIndex: 0,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'criterion-2',
      templateId: 'template-1',
      name: 'Budget',
      description: 'Evaluate the budget competitiveness',
      weight: 25,
      orderIndex: 1,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'criterion-3',
      templateId: 'template-1',
      name: 'Timeline',
      description: 'Evaluate the proposed timeline',
      weight: 20,
      orderIndex: 2,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ]

  const [scores, setScores] = useState<Map<string, { rawScore: number; notes: string }>>(
    new Map(
      criteria.map(c => [c.id, { rawScore: 5, notes: '' }])
    )
  )

  const updateScore = (criterionId: string, rawScore: number) => {
    setScores(prev => {
      const newScores = new Map(prev)
      const existing = newScores.get(criterionId) || { rawScore: 5, notes: '' }
      newScores.set(criterionId, { ...existing, rawScore })
      return newScores
    })
  }

  const updateNotes = (criterionId: string, notes: string) => {
    setScores(prev => {
      const newScores = new Map(prev)
      const existing = newScores.get(criterionId) || { rawScore: 5, notes: '' }
      newScores.set(criterionId, { ...existing, notes })
      return newScores
    })
  }

  return (
    <div className="space-y-4">
      {criteria.map(criterion => {
        const scoreData = scores.get(criterion.id) || { rawScore: 5, notes: '' }
        return (
          <ScoreCriterionCard
            key={criterion.id}
            criterion={criterion}
            rawScore={scoreData.rawScore}
            notes={scoreData.notes}
            onScoreChange={(score) => updateScore(criterion.id, score)}
            onNotesChange={(notes) => updateNotes(criterion.id, notes)}
          />
        )
      })}
    </div>
  )
}
