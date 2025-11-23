# ScoreRevisionDialog Integration Guide

## Integration with ProposalScoringInterface

Here's how to integrate the `ScoreRevisionDialog` into the existing `ProposalScoringInterface` component to allow score revisions:

```tsx
// Add to ProposalScoringInterface component

import { ScoreRevisionDialog } from "./score-revision-dialog"
import { Edit } from "lucide-react"

// Add state for revision dialog
const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
const [selectedCriterion, setSelectedCriterion] = useState<ScoringCriterion | null>(null)
const [selectedScore, setSelectedScore] = useState<ProposalScore | null>(null)

// Add revision button to each criterion card
{isFinalized && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setSelectedCriterion(criterion)
      setSelectedScore(existingScoresData?.find(s => s.criterion.id === criterion.id) || null)
      setRevisionDialogOpen(true)
    }}
    className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
  >
    <Edit className="mr-2 h-4 w-4" />
    Revise
  </Button>
)}

// Add dialog at the end of the component
{selectedCriterion && selectedScore && (
  <ScoreRevisionDialog
    open={revisionDialogOpen}
    onOpenChange={setRevisionDialogOpen}
    proposalId={proposalId}
    criterion={selectedCriterion}
    currentScore={selectedScore}
    onRevisionComplete={() => {
      // Optionally refresh data or show success message
      queryClient.invalidateQueries({ queryKey: ['proposalScores', proposalId] })
    }}
  />
)}
```

## Integration with ProposalRankingCard

Add a revision option to the ranking card for quick access:

```tsx
// In ProposalRankingCard component

import { ScoreRevisionDialog } from "./score-revision-dialog"
import { Edit } from "lucide-react"

// Add state
const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
const [selectedCriterion, setSelectedCriterion] = useState<ScoringCriterion | null>(null)

// Add button in the card actions
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => {
      // Open revision dialog for a specific criterion
      setRevisionDialogOpen(true)
    }}>
      <Edit className="mr-2 h-4 w-4" />
      Revise Scores
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Integration with Score History Viewer

Allow users to click on a history entry to revise back to that score:

```tsx
// In ScoreHistoryViewer component

import { ScoreRevisionDialog } from "./score-revision-dialog"

// Add button to history entries
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    // Pre-fill dialog with historical values
    setRevisionDialogOpen(true)
  }}
>
  Revert to this version
</Button>
```

## Standalone Page Integration

Create a dedicated score revision page:

```tsx
// app/(app)/(client)/projects/[projectId]/proposals/[proposalId]/revise-score/page.tsx

import { ScoreRevisionDialog } from "@/components/client/score-revision-dialog"

export default function ReviseScorePage({ params }: { params: { proposalId: string } }) {
  const [isOpen, setIsOpen] = useState(true)
  
  return (
    <div className="container mx-auto py-8">
      <ScoreRevisionDialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) {
            // Navigate back when dialog closes
            router.back()
          }
        }}
        proposalId={params.proposalId}
        criterion={criterion}
        currentScore={currentScore}
      />
    </div>
  )
}
```

## Batch Revision Support

For revising multiple criteria at once:

```tsx
// Create a wrapper component for batch revisions

function BatchScoreRevisionDialog({ 
  proposalId, 
  criteria, 
  currentScores 
}: BatchRevisionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  return (
    <>
      {criteria.map((criterion, index) => (
        <ScoreRevisionDialog
          key={criterion.id}
          open={index === currentIndex}
          onOpenChange={(open) => {
            if (!open && index < criteria.length - 1) {
              setCurrentIndex(index + 1)
            }
          }}
          proposalId={proposalId}
          criterion={criterion}
          currentScore={currentScores[index]}
          onRevisionComplete={() => {
            if (index < criteria.length - 1) {
              setCurrentIndex(index + 1)
            }
          }}
        />
      ))}
    </>
  )
}
```

## Permission Checks

Add permission checks before showing revision options:

```tsx
// Only show revision button to clients who own the project
const { data: user } = useUser()
const canReviseScores = user?.role === 'client' && project?.clientId === user?.id

{canReviseScores && isFinalized && (
  <Button onClick={() => setRevisionDialogOpen(true)}>
    Revise Score
  </Button>
)}
```

## Notification Integration

Send notifications when scores are revised:

```tsx
// In the onRevisionComplete callback

onRevisionComplete={() => {
  // Send notification to bidding lead
  sendNotification({
    userId: proposal.leadId,
    type: 'score_revised',
    message: `Your proposal score for "${criterion.name}" has been updated`,
    link: `/proposals/${proposalId}/scores`
  })
}
```

## Analytics Tracking

Track score revisions for analytics:

```tsx
// In the mutation onSuccess callback

onSuccess: (data) => {
  // Track revision event
  trackEvent('score_revised', {
    proposalId,
    criterionId: criterion.id,
    oldScore: currentScore.rawScore,
    newScore: data.rawScore,
    reason: reason
  })
}
```

## Best Practices

1. **Always provide context**: Show users what they're revising and why it matters
2. **Validate permissions**: Ensure only authorized users can revise scores
3. **Audit trail**: The required reason field ensures accountability
4. **User feedback**: Use toast notifications to confirm successful revisions
5. **Cache management**: Invalidate relevant queries to keep UI in sync
6. **Error handling**: Provide clear error messages if revision fails
7. **Loading states**: Show loading indicators during mutation
8. **Accessibility**: Ensure keyboard navigation and screen reader support

## Testing Considerations

When testing the integration:

1. Test with finalized scores
2. Test with accepted/rejected proposals (should show warning)
3. Test validation (empty reason should be blocked)
4. Test with no changes (submit should be disabled)
5. Test cache invalidation (scores should update after revision)
6. Test error scenarios (network failures, permission errors)
7. Test concurrent revisions (multiple users revising same score)
