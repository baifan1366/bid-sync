# ScoreRevisionDialog Component

## Overview

The `ScoreRevisionDialog` component provides a user interface for clients to revise previously submitted proposal scores. It includes validation, audit trail requirements, and warnings for proposals that have already been accepted or rejected.

## Features

- **Current Score Display**: Shows the existing score with weighted calculation
- **Interactive Score Adjustment**: Slider control for updating raw scores (1-10 scale)
- **Notes Management**: Optional field for updating evaluation notes
- **Mandatory Reason**: Required field for documenting why the score is being revised
- **Locked Proposal Warning**: Alert displayed when revising scores for accepted/rejected proposals
- **Change Summary**: Visual display of what's changing (score and/or notes)
- **Real-time Calculations**: Automatic weighted score calculation as slider moves
- **Validation**: Ensures reason is provided and changes are made before submission
- **Audit Trail**: All revisions are logged in the score history table

## Props

```typescript
interface ScoreRevisionDialogProps {
  open: boolean                          // Controls dialog visibility
  onOpenChange: (open: boolean) => void  // Callback when dialog open state changes
  proposalId: string                     // ID of the proposal being scored
  criterion: ScoringCriterion            // The criterion being revised
  currentScore: ProposalScore            // The existing score to be revised
  onRevisionComplete?: () => void        // Optional callback after successful revision
}
```

## Usage

```tsx
import { ScoreRevisionDialog } from "@/components/client/score-revision-dialog"
import { useState } from "react"

function MyComponent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        Revise Score
      </Button>
      
      <ScoreRevisionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        proposalId="proposal-123"
        criterion={criterion}
        currentScore={currentScore}
        onRevisionComplete={() => {
          console.log("Score revised successfully")
        }}
      />
    </>
  )
}
```

## GraphQL Integration

The component uses the following GraphQL operations:

### Mutation: `REVISE_SCORE`
```graphql
mutation ReviseScore($input: ReviseScoreInput!) {
  reviseScore(input: $input) {
    id
    proposalId
    criterion { ... }
    rawScore
    weightedScore
    notes
    scoredBy { ... }
    scoredAt
    isFinal
  }
}
```

### Query: `GET_PROPOSAL_DETAILS`
Used to check if the proposal is accepted/rejected to display appropriate warnings.

## Validation Rules

1. **Reason Required**: A reason must be provided for all score revisions
2. **Changes Required**: At least one change (score or notes) must be made
3. **Score Range**: Raw scores must be between 1 and 10
4. **Locked Proposals**: Warning displayed (but not blocked) for accepted/rejected proposals

## Design System Compliance

- **Primary Action Button**: Yellow-400 background (`bg-yellow-400 hover:bg-yellow-500`)
- **Warning Alerts**: Yellow-500 border for locked proposal warnings
- **Change Summary**: Blue-500 border for change indicators
- **Required Fields**: Red-500 styling for the mandatory reason field
- **Consistent Spacing**: Follows BidSync spacing patterns

## State Management

The component manages the following local state:
- `rawScore`: The new score value (initialized from current score)
- `notes`: The new notes text (initialized from current score)
- `reason`: The revision reason (required, starts empty)

State is reset when the dialog opens to ensure fresh data.

## Cache Invalidation

After a successful revision, the component invalidates the following React Query caches:
- `proposalScores` - To refresh the scores list
- `proposalScoreHistory` - To show the new history entry
- `proposalRankings` - To update rankings based on new scores

## Accessibility

- Proper ARIA labels on all form controls
- Keyboard navigation support via Dialog component
- Focus management when dialog opens/closes
- Screen reader friendly error messages

## Requirements Validation

This component satisfies the following requirements:

- **Requirement 8.1**: Allows clients to unlock and edit finalized scores
- **Requirement 8.2**: Creates new entry in score history with reason
- **Requirement 8.5**: Displays warning for accepted/rejected proposals

## Related Components

- `ProposalScoringInterface` - Main scoring interface
- `ScoreHistoryViewer` - Displays revision history
- `ScoreCriterionCard` - Individual criterion scoring card

## Example

See `score-revision-dialog.example.tsx` for a complete working example.
