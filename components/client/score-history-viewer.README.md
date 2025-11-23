# ScoreHistoryViewer Component

## Overview

The `ScoreHistoryViewer` component displays a comprehensive audit trail of all score revisions made to a proposal. It provides clients with full transparency into how scores have changed over time, who made the changes, and why they were made.

## Features

- **Chronological Display**: Shows all revisions in reverse chronological order (newest first)
- **Visual Diff**: Highlights score changes with color-coded previous (red) and new (green) values
- **Weighted Scores**: Displays both raw scores and calculated weighted scores for context
- **Notes Tracking**: Shows additions, removals, and changes to evaluation notes with visual diff
- **Audit Trail**: Records who made each change and when
- **Revision Reasons**: Displays the mandatory reason provided for each score revision
- **Criterion Filter**: Dropdown to filter history by specific scoring criterion
- **Scrollable**: Uses ScrollArea for handling long revision histories
- **Loading States**: Appropriate loading, error, and empty states

## Props

```typescript
interface ScoreHistoryViewerProps {
  proposalId: string  // The ID of the proposal to view history for
}
```

## Usage

### Basic Usage

```tsx
import { ScoreHistoryViewer } from "@/components/client/score-history-viewer"

function ProposalScoresPage({ proposalId }: { proposalId: string }) {
  return (
    <div>
      <h2>Score Revision History</h2>
      <ScoreHistoryViewer proposalId={proposalId} />
    </div>
  )
}
```

### In a Tabbed Interface

```tsx
import { ScoreHistoryViewer } from "@/components/client/score-history-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function ProposalDetailPage({ proposalId }: { proposalId: string }) {
  return (
    <Tabs defaultValue="scores">
      <TabsList>
        <TabsTrigger value="scores">Current Scores</TabsTrigger>
        <TabsTrigger value="history">Score History</TabsTrigger>
      </TabsList>
      <TabsContent value="scores">
        {/* Current scores display */}
      </TabsContent>
      <TabsContent value="history">
        <ScoreHistoryViewer proposalId={proposalId} />
      </TabsContent>
    </Tabs>
  )
}
```

## Data Structure

The component fetches data using the `GET_PROPOSAL_SCORE_HISTORY` GraphQL query, which returns:

```typescript
interface ProposalScoreHistory {
  id: string
  proposalId: string
  criterion: ScoringCriterion
  previousRawScore?: number
  newRawScore: number
  previousNotes?: string
  newNotes?: string
  changedBy: User
  changedAt: string
  reason?: string
}
```

## Visual Elements

### Score Change Display

Each revision entry shows:
- **Criterion Badge**: Yellow badge with criterion name and weight
- **Timestamp**: Date and time of the revision
- **Score Comparison**: Side-by-side display of previous (red) and new (green) scores
- **Weighted Scores**: Calculated weighted scores for both previous and new values
- **Revision Reason**: Highlighted box with the reason for the change
- **Notes Diff**: Visual diff showing additions (green), removals (red), or changes
- **Changed By**: User who made the revision

### Filter Controls

- **Criterion Dropdown**: Filter to show only revisions for a specific criterion
- **"All Criteria" Option**: Default view showing all revisions

## States

### Loading State
- Displays a centered spinner with yellow accent color

### Error State
- Shows error message in a red-bordered alert box

### Empty State
- Displays a history icon with message "No score revisions have been made yet"

### No Results State (after filtering)
- Shows message "No revisions found for the selected criterion"

## Styling

The component follows the BidSync design system:
- **Primary Accent**: Yellow-400 for badges, icons, and highlights
- **Score Changes**: Red for previous values, green for new values
- **Cards**: Yellow-bordered cards with hover effects
- **Theme Support**: Full light/dark mode support

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast color choices for score diffs
- Screen reader friendly timestamps and user information

## Performance

- Uses React Query for efficient data fetching and caching
- Query key: `['proposalScoreHistory', proposalId]`
- Automatic cache invalidation when scores are revised
- Efficient filtering using client-side array operations

## Integration Points

### GraphQL Query
```graphql
query GetProposalScoreHistory($proposalId: ID!) {
  proposalScoreHistory(proposalId: $proposalId) {
    id
    proposalId
    criterion { ... }
    previousRawScore
    newRawScore
    previousNotes
    newNotes
    changedBy { ... }
    changedAt
    reason
  }
}
```

### Cache Invalidation

The component's query cache is automatically invalidated when:
- A score is revised via `ScoreRevisionDialog`
- Rankings are recalculated

## Requirements Validation

This component validates **Requirement 8.4**:
> WHEN a client views score history, THE BidSync Platform SHALL display all previous versions with timestamps and changed values

The component ensures:
- ✅ All revisions are displayed chronologically
- ✅ Timestamps are shown for each revision
- ✅ Previous and new values are clearly displayed
- ✅ User who made changes is identified
- ✅ Reasons for revisions are recorded and displayed
- ✅ Notes changes are tracked with visual diff
- ✅ Filtering by criterion is supported

## Related Components

- **ScoreRevisionDialog**: Creates new entries in the score history
- **ProposalScoringInterface**: Where initial scores are created
- **ScoreCriterionCard**: Displays individual criterion scores

## Future Enhancements

- Export history to PDF or CSV
- Search functionality for revision reasons
- Date range filtering
- Comparison view between any two revisions
- Rollback to previous score version
- Bulk revision history for multiple proposals
