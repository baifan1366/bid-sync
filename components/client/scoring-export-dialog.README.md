# ScoringExportDialog Component

## Overview

The `ScoringExportDialog` component provides a user interface for exporting proposal scoring data and rankings as a comprehensive PDF report. It displays a preview of the export contents, generates the report via GraphQL mutation, and provides a download link with expiration notice.

## Features

- **Export Preview**: Shows project details, proposal counts, and scoring status before generation
- **PDF Generation**: Creates comprehensive report via `exportScoring` GraphQL mutation
- **Download Management**: Provides download link with 24-hour expiration notice
- **Loading States**: Shows loading indicators during data fetching and export generation
- **Toast Notifications**: Success and error messages for user feedback
- **Responsive Design**: Works well on all screen sizes
- **BidSync Design System**: Uses yellow-400 accent colors and consistent styling

## Props

```typescript
interface ScoringExportDialogProps {
  open: boolean              // Controls dialog visibility
  onOpenChange: (open: boolean) => void  // Callback when dialog state changes
  projectId: string          // ID of the project to export scoring for
}
```

## Usage

### Basic Usage

```tsx
import { useState } from "react"
import { ScoringExportDialog } from "@/components/client/scoring-export-dialog"
import { Button } from "@/components/ui/button"

function ProjectPage({ projectId }: { projectId: string }) {
  const [showExport, setShowExport] = useState(false)

  return (
    <>
      <Button onClick={() => setShowExport(true)}>
        Export Scoring Report
      </Button>

      <ScoringExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        projectId={projectId}
      />
    </>
  )
}
```

### In Rankings View

```tsx
import { ScoringExportDialog } from "@/components/client/scoring-export-dialog"

function RankingsView({ projectId }: { projectId: string }) {
  const [showExport, setShowExport] = useState(false)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2>Proposal Rankings</h2>
        <Button
          onClick={() => setShowExport(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Rankings list */}

      <ScoringExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        projectId={projectId}
      />
    </div>
  )
}
```

## Export Contents

The generated PDF report includes:

1. **Project Information**
   - Project name and description
   - Client details
   - Export date and timestamp

2. **Scoring Template**
   - All criteria with names and descriptions
   - Weight percentages for each criterion
   - Total weight validation (100%)

3. **Proposal Scores**
   - All proposals with their scores
   - Raw scores and weighted scores per criterion
   - Total scores and rankings
   - Client notes for each score

4. **Unscored Summary**
   - List of proposals that haven't been scored yet
   - Count of unscored proposals

## States

### Loading State
- Displays spinner while fetching project and rankings data
- Disables export button during loading

### Preview State
- Shows export contents preview
- Displays proposal counts (total, scored, unscored)
- Shows warning if there are unscored proposals
- Lists what will be included in the report

### Generating State
- Shows "Generating..." text with spinner
- Disables all buttons during generation

### Success State
- Displays success message
- Shows download link with file details
- Displays expiration notice (24 hours)
- Provides download button

### Error State
- Shows error toast notification
- Allows user to retry export

## GraphQL Integration

### Queries Used

```graphql
# Get project details
query GetProject($id: ID!) {
  project(id: $id) {
    id
    title
    description
    # ... other fields
  }
}

# Get proposal rankings
query GetProposalRankings($projectId: ID!) {
  proposalRankings(projectId: $projectId) {
    id
    rank
    totalScore
    isFullyScored
    # ... other fields
  }
}
```

### Mutation Used

```graphql
mutation ExportScoring($projectId: ID!) {
  exportScoring(projectId: $projectId) {
    url
    expiresAt
  }
}
```

## Design System Compliance

- **Primary Button**: `bg-yellow-400 hover:bg-yellow-500 text-black`
- **Borders**: `border-yellow-400/20`
- **Backgrounds**: `bg-yellow-400/5`
- **Icons**: Lucide React icons with yellow-400 accent
- **Alerts**: Color-coded for different message types
- **Typography**: Consistent with BidSync design system

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Screen reader friendly
- High contrast mode compatible
- Focus management for modal dialog

## Error Handling

- Network errors: Shows error toast with retry option
- GraphQL errors: Displays specific error message
- Missing data: Gracefully handles missing project or rankings
- Export failures: Provides clear error feedback

## Dependencies

- `@tanstack/react-query`: Data fetching and caching
- `date-fns`: Date formatting
- `lucide-react`: Icons
- `@/components/ui/*`: shadcn/ui components
- `@/lib/graphql/*`: GraphQL queries and mutations

## Related Components

- `ProposalRankingsList`: Displays rankings that can be exported
- `ScoringComparisonView`: Another view that might trigger exports
- `ProposalScoringInterface`: Where scores are created

## Requirements Validation

This component validates **Requirement 7.1**:
- ✅ WHEN a client requests a scoring export, THE BidSync Platform SHALL generate a downloadable report in PDF format

## Notes

- Export links expire after 24 hours
- PDF generation is handled server-side by the scoring-export-service
- Component automatically fetches latest data when opened
- Download opens in new tab for better UX
- Supports projects with partially scored proposals
