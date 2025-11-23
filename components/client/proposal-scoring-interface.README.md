# ProposalScoringInterface Component

## Overview

The `ProposalScoringInterface` component provides a comprehensive UI for clients to score proposals using a project's scoring template. It implements all the requirements from the proposal scoring system specification.

## Features

### Core Functionality
- ✅ Fetches scoring template and existing scores via GraphQL
- ✅ Displays all criteria from project's scoring template
- ✅ Uses shadcn/ui Slider for raw scores (1-10 scale)
- ✅ Real-time weighted score calculation display
- ✅ Textarea for notes on each criterion
- ✅ Total score display prominently at top with yellow accent
- ✅ Auto-save draft scores functionality with debouncing (1 second)
- ✅ Finalize scoring button (yellow-400 primary button)
- ✅ Loading and error states

### Requirements Validated
- **3.1**: Displays all scoring criteria from the project's scoring template
- **3.2**: Accepts raw scores on a scale of 1 to 10 using sliders
- **3.3**: Calculates and displays weighted scores in real-time
- **3.4**: Calculates and displays total score
- **3.5**: Saves draft scores automatically with debouncing
- **3.6**: Allows finalization of scores with timestamp recording
- **4.1**: Provides text field for optional notes
- **4.2**: Saves notes with scores
- **4.3**: Displays notes alongside scores

## Usage

```tsx
import { ProposalScoringInterface } from "@/components/client/proposal-scoring-interface"

function ProposalDetailPage() {
  return (
    <ProposalScoringInterface
      projectId="project-uuid"
      proposalId="proposal-uuid"
      onScoreFinalized={() => {
        // Optional callback when scoring is finalized
        console.log("Scoring finalized!")
      }}
    />
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | The ID of the project to fetch the scoring template |
| `proposalId` | `string` | Yes | The ID of the proposal being scored |
| `onScoreFinalized` | `() => void` | No | Callback function called when scoring is finalized |

## Component Structure

### 1. Total Score Display
- Prominently displays the calculated total score at the top
- Yellow accent styling (bg-yellow-400/5, border-yellow-400)
- Shows number of criteria

### 2. Auto-save Indicator
- Shows "Saving changes..." when auto-save is in progress
- Shows "Changes will be saved automatically" when there are unsaved changes
- Blue accent styling for visibility

### 3. Finalized Indicator
- Shows when scoring has been finalized
- Green accent styling with checkmark icon
- Prevents further editing

### 4. Scoring Criteria Cards
Each criterion is displayed in a card with:
- **Header**: Criterion name, description, and weight percentage
- **Score Slider**: 1-10 scale with real-time value display
- **Weighted Score**: Calculated automatically (raw_score × weight / 100)
- **Notes Textarea**: Optional notes field for evaluation reasoning

### 5. Finalize Button
- Yellow-400 primary button at the bottom
- Disabled when scoring is already finalized
- Shows loading state during finalization
- Validates that all criteria are scored before allowing finalization

## State Management

### Local State
- `scores`: Map of criterion IDs to score data (rawScore, notes)
- `isSaving`: Boolean indicating auto-save in progress
- `saveTimeout`: Timeout reference for debouncing
- `hasUnsavedChanges`: Boolean indicating unsaved changes

### GraphQL Queries
- `GET_SCORING_TEMPLATE`: Fetches the scoring template for the project
- `GET_PROPOSAL_SCORES`: Fetches existing scores for the proposal

### GraphQL Mutations
- `SCORE_PROPOSAL`: Saves a score for a specific criterion
- `FINALIZE_SCORING`: Marks all scores as final

## Auto-save Behavior

The component implements intelligent auto-save with debouncing:

1. When a user changes a score or notes, the change is stored locally
2. A 1-second debounce timer starts
3. If no further changes occur within 1 second, the score is saved to the database
4. If another change occurs, the timer resets
5. Visual feedback shows "Saving changes..." during the save operation

This approach:
- Reduces database writes
- Provides smooth UX without lag
- Ensures no data loss
- Shows clear feedback to users

## Finalization Process

When the user clicks "Finalize Scoring":

1. Validates that all criteria have been scored
2. Saves any pending changes first
3. Calls the `finalizeScoring` mutation
4. Marks all scores as final (prevents further editing)
5. Invalidates relevant queries to refresh data
6. Shows success toast notification
7. Calls optional `onScoreFinalized` callback

## Error Handling

The component handles several error scenarios:

- **Template not found**: Shows alert prompting user to create a template
- **Failed to load template**: Shows error alert with retry suggestion
- **Failed to load scores**: Shows error alert with retry suggestion
- **Failed to save score**: Shows error toast notification
- **Failed to finalize**: Shows error toast notification
- **Incomplete scoring**: Prevents finalization and shows error toast

## Styling

The component follows the BidSync design system:

- **Primary accent**: Yellow-400 (#FBBF24)
- **Card borders**: Yellow-400/20 with hover states
- **Buttons**: Yellow-400 background with black text
- **Alerts**: Color-coded by type (blue for info, green for success, red for error)
- **Dark mode**: Full support with appropriate color adjustments

## Accessibility

- Proper label associations for all form inputs
- Keyboard navigation support via native HTML elements
- ARIA labels on interactive elements
- Focus states on all interactive elements
- Screen reader friendly structure

## Performance Considerations

- Debounced auto-save reduces API calls
- Query caching via React Query
- Optimistic UI updates for smooth UX
- Efficient re-renders using React hooks
- Memoized calculations where appropriate

## Integration Points

This component integrates with:

1. **GraphQL API**: For fetching templates and scores, saving scores
2. **React Query**: For data fetching and caching
3. **Toast System**: For user notifications
4. **Scoring Template Manager**: Users must create a template first
5. **Proposal Rankings**: Finalized scores trigger ranking recalculation

## Future Enhancements

Potential improvements for future iterations:

- Bulk score import/export
- Score comparison with other proposals
- AI-assisted scoring suggestions
- Collaborative scoring (multiple evaluators)
- Score history and revision tracking
- Custom score scales (beyond 1-10)
- Score templates/presets
- Mobile-optimized touch controls
