# ScoringComparisonView Component

A comprehensive component for side-by-side comparison of 2-4 proposals with their scores across all criteria.

## Features

- **Side-by-side comparison**: Desktop view shows proposals in columns with synchronized scrolling
- **Mobile-responsive**: Stacked layout with tabs on mobile devices
- **Visual indicators**: Best scores highlighted in green, worst scores in red
- **Progress bars**: Visual representation of raw scores for each criterion
- **Real-time data**: Fetches comparison data via GraphQL
- **Scoring status**: Shows whether proposals are fully scored, partially scored, or not scored
- **Summary header**: Quick overview of all proposals with ranks and total scores

## Usage

```tsx
import { ScoringComparisonView } from "@/components/client/scoring-comparison-view"

function MyComponent() {
  const projectId = "project-123"
  const proposalIds = ["proposal-1", "proposal-2", "proposal-3"]

  return (
    <ScoringComparisonView
      projectId={projectId}
      proposalIds={proposalIds}
    />
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | `string` | Yes | The ID of the project containing the proposals |
| `proposalIds` | `string[]` | Yes | Array of 2-4 proposal IDs to compare |

## Requirements Validated

This component validates the following requirements from the design document:

- **6.1**: Side-by-side comparison view for 2-4 proposals
- **6.2**: Display all criteria with raw and weighted scores
- **6.3**: Highlight best (green) and worst (red) scores per criterion
- **6.4**: Show total scores and rankings prominently
- **6.5**: Indicate scoring status for each proposal

## Data Structure

The component fetches data using the `scoringComparison` GraphQL query, which returns:

```typescript
interface ScoringComparison {
  proposals: ProposalWithScores[]
  criteria: ScoringCriterion[]
  bestScores: BestScore[]
  worstScores: WorstScore[]
}
```

## Layout

### Desktop (md and above)
- Grid layout with columns for each proposal
- Synchronized scrolling across all columns
- Sticky proposal headers
- Side-by-side criterion cards

### Mobile (below md)
- Tabs for switching between proposals
- Stacked layout for each proposal
- Full-width criterion cards

## Visual Design

### Colors
- **Yellow accent** (`yellow-400`): Ranks, total scores, weights
- **Green** (`green-500`): Best scores
- **Red** (`red-500`): Worst scores
- **Border**: `border-yellow-400/20` with hover effects

### Components Used
- `Card`, `CardHeader`, `CardTitle`, `CardContent` from shadcn/ui
- `Badge` for ranks and status indicators
- `ScrollArea` for synchronized scrolling
- `Progress` for visual score representation
- `Tabs` for mobile navigation

## States

### Loading
Shows a centered spinner while fetching data.

### Error
Displays an error message if the query fails.

### Empty
Shows a message when no proposals are selected or data is unavailable.

### Success
Renders the full comparison view with all proposals and criteria.

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast for best/worst indicators
- Screen reader friendly

## Performance

- Uses React Query for efficient data fetching and caching
- Memoized filtering and calculations
- Optimized re-renders
- Lazy loading of proposal columns

## Examples

See `scoring-comparison-view.example.tsx` for complete usage examples including:
- Client project detail page with proposal selection
- Simple comparison with pre-selected proposals
- Comparison from rankings list with selection mode

## Integration

This component is typically used in:
1. Client project detail pages
2. Proposal rankings lists
3. Decision-making workflows
4. Export/reporting interfaces

## Notes

- Requires a valid scoring template for the project
- Proposals must have scores to display meaningful comparisons
- Best/worst highlighting only applies when multiple proposals have scores for the same criterion
- Synchronized scrolling works across all visible columns on desktop
