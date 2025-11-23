# ComparisonProposalColumn Component

## Overview

The `ComparisonProposalColumn` component displays a single proposal's scores in a side-by-side comparison view. It's designed to be used within the `ScoringComparisonView` component to enable clients to compare multiple proposals (2-4) simultaneously.

## Features

- **Proposal Header**: Displays rank badge, total score, proposal title, lead name, budget, and scoring status
- **Criteria Scores List**: Shows all scoring criteria with raw scores, weighted scores, and progress bars
- **Visual Indicators**: Highlights best scores in green and worst scores in red
- **Scoring Status Badge**: Indicates whether the proposal is fully scored or partially scored
- **Responsive Design**: Adapts to different screen sizes with sticky header for better UX
- **BidSync Design System**: Uses yellow-400 accent color, Card components, and consistent styling

## Requirements

This component validates the following requirements:
- **6.2**: Display all scoring criteria with raw scores and weighted scores for each proposal
- **6.3**: Highlight the highest score in green and the lowest score in red
- **6.5**: Indicate which proposals are fully scored versus partially scored

## Props

```typescript
interface ComparisonProposalColumnProps {
  proposalData: ProposalWithScores
  criteria: ScoringCriterion[]
  isBestScore: (criterionId: string, proposalId: string) => boolean
  isWorstScore: (criterionId: string, proposalId: string) => boolean
}
```

### `proposalData`
- Type: `ProposalWithScores`
- Description: Contains the proposal information, scores, total score, rank, and scoring status

### `criteria`
- Type: `ScoringCriterion[]`
- Description: Array of all scoring criteria for the project's scoring template

### `isBestScore`
- Type: `(criterionId: string, proposalId: string) => boolean`
- Description: Function to determine if a score is the best among all compared proposals for a criterion

### `isWorstScore`
- Type: `(criterionId: string, proposalId: string) => boolean`
- Description: Function to determine if a score is the worst among all compared proposals for a criterion

## Usage

The component is typically used within the `ScoringComparisonView` component:

```tsx
import { ComparisonProposalColumn } from "./comparison-proposal-column"

// In desktop view with side-by-side columns
<div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${proposals.length}, 1fr)` }}>
  {proposals.map((proposalData) => (
    <ScrollArea key={proposalData.proposal.id} className="h-[800px]">
      <ComparisonProposalColumn
        proposalData={proposalData}
        criteria={criteria}
        isBestScore={isBestScore}
        isWorstScore={isWorstScore}
      />
    </ScrollArea>
  ))}
</div>

// In mobile view with tabs
<Tabs defaultValue={proposals[0]?.proposal.id}>
  <TabsList>
    {proposals.map((proposalData) => (
      <TabsTrigger key={proposalData.proposal.id} value={proposalData.proposal.id}>
        #{proposalData.rank}
      </TabsTrigger>
    ))}
  </TabsList>
  {proposals.map((proposalData) => (
    <TabsContent key={proposalData.proposal.id} value={proposalData.proposal.id}>
      <ComparisonProposalColumn
        proposalData={proposalData}
        criteria={criteria}
        isBestScore={isBestScore}
        isWorstScore={isWorstScore}
      />
    </TabsContent>
  ))}
</Tabs>
```

## Component Structure

### Header Section
- **Sticky positioning**: Remains visible during scrolling
- **Rank badge**: Yellow badge with rank number
- **Total score**: Large, prominent display in yellow-400
- **Proposal title**: Truncated to 2 lines with line-clamp
- **Lead information**: Name and budget estimate
- **Status badge**: Green for fully scored, outlined for partial

### Criteria Cards
Each criterion is displayed in a card with:
- **Criterion name and description**
- **Weight percentage**: Displayed in yellow-400
- **Best/Worst indicators**: Green badge with TrendingUp icon or red badge with TrendingDown icon
- **Raw score**: Displayed as "X.X / 10" with progress bar
- **Weighted score**: Calculated value displayed below raw score
- **Not Scored badge**: Shown when criterion hasn't been scored yet

### Visual Feedback
- **Best scores**: Green background (`bg-green-500/10`) and green border (`border-green-500/40`)
- **Worst scores**: Red background (`bg-red-500/10`) and red border (`border-red-500/40`)
- **Progress bars**: Visual representation of raw scores (0-10 scale)

## Design System Compliance

The component follows the BidSync design system:
- **Primary accent**: Yellow-400 (`#FBBF24`)
- **Card borders**: `border-yellow-400/20`
- **Badges**: Yellow for primary, green for success, red for warnings
- **Typography**: Consistent font sizes and weights
- **Spacing**: Standard padding and gaps
- **Dark mode**: Full support with appropriate color adjustments

## Accessibility

- Semantic HTML structure with proper heading hierarchy
- ARIA-compliant badges and progress bars
- High contrast for best/worst indicators
- Keyboard navigation support through Card components
- Screen reader friendly with descriptive labels

## Performance Considerations

- Efficient rendering with React keys
- Minimal re-renders through proper prop structure
- Sticky header optimized for scroll performance
- Progress bars use CSS transforms for smooth animations

## Related Components

- **ScoringComparisonView**: Parent component that orchestrates the comparison
- **ProposalScoringInterface**: Component for scoring individual proposals
- **ProposalRankingsList**: Component for viewing all proposal rankings
- **ScoreCriterionCard**: Similar card used in the scoring interface

## Example

See `comparison-proposal-column.example.tsx` for a complete working example with sample data.
