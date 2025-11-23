import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScoreCriterionCard } from '../score-criterion-card'
import type { ScoringCriterion } from '@/lib/graphql/types'

describe('ScoreCriterionCard', () => {
  const mockCriterion: ScoringCriterion = {
    id: 'criterion-1',
    templateId: 'template-1',
    name: 'Technical Approach',
    description: 'Evaluate the technical approach and methodology',
    weight: 30,
    orderIndex: 0,
    createdAt: '2024-01-01T00:00:00Z',
  }

  it('renders criterion name and description', () => {
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByText('Technical Approach')).toBeInTheDocument()
    expect(screen.getByText('Evaluate the technical approach and methodology')).toBeInTheDocument()
  })

  it('displays weight percentage', () => {
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('displays raw score with one decimal place', () => {
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={7.5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByText('7.5')).toBeInTheDocument()
  })

  it('calculates and displays weighted score correctly', () => {
    // rawScore = 8, weight = 30%
    // weightedScore = 8 * (30 / 100) = 2.40
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={8}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    expect(screen.getByText(/Weighted: 2\.40/)).toBeInTheDocument()
  })

  it('calls onNotesChange when notes are updated', () => {
    const onNotesChange = vi.fn()
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={onNotesChange}
      />
    )

    const textarea = screen.getByPlaceholderText('Add your evaluation notes here...')
    fireEvent.change(textarea, { target: { value: 'Great technical approach' } })

    expect(onNotesChange).toHaveBeenCalledWith('Great technical approach')
  })

  it('displays existing notes', () => {
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes="Excellent methodology"
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
      />
    )

    const textarea = screen.getByDisplayValue('Excellent methodology')
    expect(textarea).toBeInTheDocument()
  })

  it('applies yellow border when hasUnsavedChanges is true', () => {
    const { container } = render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
        hasUnsavedChanges={true}
      />
    )

    const card = container.querySelector('.border-yellow-400')
    expect(card).toBeInTheDocument()
  })

  it('disables inputs when disabled prop is true', () => {
    render(
      <ScoreCriterionCard
        criterion={mockCriterion}
        rawScore={5}
        notes=""
        onScoreChange={vi.fn()}
        onNotesChange={vi.fn()}
        disabled={true}
      />
    )

    const textarea = screen.getByPlaceholderText('Add your evaluation notes here...')
    expect(textarea).toBeDisabled()
  })

  it('calculates weighted score correctly for various inputs', () => {
    const testCases = [
      { rawScore: 1, weight: 25, expected: '0.25' },
      { rawScore: 10, weight: 40, expected: '4.00' },
      { rawScore: 5.5, weight: 20, expected: '1.10' },
      { rawScore: 7.3, weight: 15, expected: '1.09' }, // 7.3 * 0.15 = 1.095 -> 1.09
    ]

    testCases.forEach(({ rawScore, weight, expected }) => {
      const criterion = { ...mockCriterion, weight }
      const { unmount } = render(
        <ScoreCriterionCard
          criterion={criterion}
          rawScore={rawScore}
          notes=""
          onScoreChange={vi.fn()}
          onNotesChange={vi.fn()}
        />
      )

      expect(screen.getByText(new RegExp(`Weighted: ${expected}`))).toBeInTheDocument()
      unmount()
    })
  })
})
