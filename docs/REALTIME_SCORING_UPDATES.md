# Real-Time Scoring Updates Implementation

## Overview

This document describes the real-time updates implementation for the Proposal Scoring System. The system uses Supabase Realtime to provide live updates across all scoring-related components, ensuring users always see the latest data without manual refreshes.

**Requirements:** 5.5 - Real-time ranking updates

## Architecture

### Core Components

1. **useRealtimeRankings Hook** (`hooks/use-realtime-rankings.ts`)
   - Subscribes to `proposal_rankings` table changes
   - Implements automatic reconnection with exponential backoff
   - Provides connection status tracking
   - Handles INSERT, UPDATE, and DELETE events

2. **Connection Status Indicators**
   - `ConnectionStatusIndicator` - Full status display with reconnect button
   - `CompactConnectionStatusIndicator` - Icon-only display
   - Shows: connected, connecting, disconnected states

3. **Optimistic UI Updates**
   - Implemented in `proposal-scoring-interface.tsx`
   - Updates UI immediately before server confirmation
   - Rolls back on failure
   - Provides smooth user experience

4. **Auto-Save with Debouncing**
   - 1.5 second debounce delay
   - Prevents excessive server requests
   - Shows save status to user
   - Queues changes during network issues

## Implementation Details

### Real-Time Subscription Setup

The `useRealtimeRankings` hook provides:

```typescript
interface UseRealtimeRankingsOptions {
  projectId: string
  onRankingUpdated?: (ranking: RankingUpdate) => void
  onRankingInserted?: (ranking: RankingUpdate) => void
  onRankingDeleted?: (ranking: RankingUpdate) => void
}
```

**Features:**
- Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Maximum 5 reconnection attempts
- Connection status tracking
- Manual reconnect capability
- Proper cleanup on unmount

### Components with Real-Time Updates

#### 1. ProposalRankingsList
**Location:** `components/client/proposal-rankings-list.tsx`

**Real-time behavior:**
- Subscribes to ranking changes for the project
- Refetches rankings on any update
- Displays connection status indicator
- Provides manual reconnect button

**User experience:**
- Rankings update automatically when scores change
- Connection status visible at all times
- Can manually reconnect if disconnected

#### 2. ProposalScoringInterface
**Location:** `components/client/proposal-scoring-interface.tsx`

**Real-time behavior:**
- Optimistic UI updates for score changes
- Automatic rollback on failure
- Debounced auto-save (1.5 seconds)
- Shows save status indicators

**User experience:**
- Immediate feedback when scoring
- Clear indication of save status
- Automatic retry on failure
- No data loss on network issues

#### 3. WorkspaceContent (Lead View)
**Location:** `components/client/workspace-content.tsx`

**Real-time behavior:**
- Subscribes to ranking changes
- Refetches scores and rankings on updates
- Updates lead's view of their proposal scores

**User experience:**
- Leads see score updates immediately
- Rankings update in real-time
- No manual refresh needed

#### 4. ScoringExportDialog
**Location:** `components/client/scoring-export-dialog.tsx`

**Real-time behavior:**
- Subscribes to ranking changes when dialog is open
- Refetches ranking counts on updates
- Ensures export data is current

**User experience:**
- Export preview shows latest data
- Counts update automatically
- Accurate export generation

#### 5. ScoringComparisonView
**Location:** `components/client/scoring-comparison-view.tsx`

**Real-time behavior:**
- Subscribes to ranking changes
- Refetches comparison data on updates
- Updates best/worst score highlights

**User experience:**
- Comparison updates when scores change
- Highlights adjust automatically
- Always shows current data

#### 6. ScoreRevisionDialog
**Location:** `components/client/score-revision-dialog.tsx`

**Real-time behavior:**
- Subscribes to ranking changes
- Detects concurrent edits by other users
- Shows warning if score was modified
- Refetches current scores

**User experience:**
- Warned of concurrent edits
- Can review changes before saving
- Prevents overwriting others' work

## Optimistic Updates

### Score Proposal Mutation

**Implementation:**
```typescript
onMutate: async (scoreData) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: ['proposalScores', proposalId] })
  
  // Snapshot previous value
  const previousScores = queryClient.getQueryData(['proposalScores', proposalId])
  
  // Optimistically update cache
  queryClient.setQueryData(['proposalScores', proposalId], optimisticScores)
  
  // Return context for rollback
  return { previousScores }
}

onError: (error, scoreData, context) => {
  // Rollback on error
  if (context?.previousScores) {
    queryClient.setQueryData(['proposalScores', proposalId], context.previousScores)
  }
}
```

**Benefits:**
- Instant UI feedback
- Smooth user experience
- Automatic error recovery
- No data loss

### Finalize Scoring Mutation

**Implementation:**
- Optimistically marks all scores as final
- Rolls back if finalization fails
- Invalidates related queries on success
- Shows appropriate notifications

## Auto-Save Implementation

### Debouncing Strategy

**Configuration:**
- Debounce delay: 1.5 seconds
- Triggers on any score or note change
- Clears previous timeout on new change
- Shows save status to user

**Implementation:**
```typescript
const debouncedSave = useCallback((scoreData: ScoreData) => {
  if (saveTimeout) clearTimeout(saveTimeout)
  
  const timeout = setTimeout(() => {
    setIsSaving(true)
    scoreProposalMutation.mutate(scoreData, {
      onSettled: () => setIsSaving(false),
    })
  }, 1500)
  
  setSaveTimeout(timeout)
}, [saveTimeout, scoreProposalMutation])
```

**User Indicators:**
- "Saving changes..." - Active save in progress
- "Changes will be saved automatically in X seconds" - Pending save
- Error alert if save fails
- Success indicator when saved

## Connection Status

### Status States

1. **Connected** (Green)
   - Active Realtime connection
   - Updates flowing normally
   - No action needed

2. **Connecting** (Yellow)
   - Establishing connection
   - Reconnection in progress
   - Shows spinner animation

3. **Disconnected** (Red)
   - Connection lost
   - Shows reconnect button
   - Displays error message

### Reconnection Logic

**Exponential Backoff:**
- Attempt 1: 1 second delay
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- Attempt 4: 8 seconds delay
- Attempt 5: 16 seconds delay
- After 5 attempts: Manual reconnect only

**Manual Reconnect:**
- Resets attempt counter
- Immediate reconnection attempt
- Available via UI button

## Error Handling

### Network Errors

**Behavior:**
- Optimistic updates roll back
- User notified of failure
- Changes queued for retry
- Connection status updated

**User Experience:**
- Clear error messages
- Automatic retry attempts
- Manual retry option
- No data loss

### Concurrent Edits

**Detection:**
- Real-time subscription detects changes
- Compares current vs. updated values
- Shows warning to user

**Resolution:**
- User warned before saving
- Can review changes
- Decides whether to overwrite
- Prevents accidental conflicts

### Validation Errors

**Handling:**
- Server-side validation
- Clear error messages
- UI remains in edit state
- User can correct and retry

## Performance Considerations

### Subscription Efficiency

**Optimizations:**
- Single subscription per project
- Filtered by project_id
- Automatic cleanup on unmount
- Reuses existing channels

### Query Invalidation

**Strategy:**
- Targeted invalidation
- Only affected queries refetch
- Stale time prevents excessive requests
- Background refetching

### Debouncing

**Benefits:**
- Reduces server load
- Prevents excessive writes
- Batches rapid changes
- Improves performance

## Testing

### Manual Testing Checklist

- [ ] Rankings update when scores change
- [ ] Connection status displays correctly
- [ ] Reconnection works after disconnect
- [ ] Optimistic updates show immediately
- [ ] Rollback works on error
- [ ] Auto-save triggers after 1.5s
- [ ] Concurrent edit warnings appear
- [ ] Export dialog shows latest data
- [ ] Comparison view updates live
- [ ] Lead view updates in real-time

### Edge Cases

- [ ] Multiple users scoring simultaneously
- [ ] Network disconnection during save
- [ ] Rapid score changes
- [ ] Browser tab switching
- [ ] Long-running sessions
- [ ] Slow network conditions

## Future Enhancements

### Potential Improvements

1. **Presence Indicators**
   - Show who else is viewing/scoring
   - Display active users
   - Prevent edit conflicts

2. **Collaborative Scoring**
   - Multiple evaluators
   - Real-time collaboration
   - Shared scoring sessions

3. **Offline Support**
   - Queue changes offline
   - Sync when reconnected
   - Conflict resolution

4. **Performance Monitoring**
   - Track connection quality
   - Monitor update latency
   - Alert on issues

5. **Advanced Notifications**
   - Push notifications
   - Email alerts
   - Slack integration

## Troubleshooting

### Common Issues

**Issue:** Rankings not updating
- Check connection status
- Verify Realtime is enabled in Supabase
- Check RLS policies
- Review browser console for errors

**Issue:** Optimistic updates not rolling back
- Verify error handling in mutations
- Check query key consistency
- Review context return values

**Issue:** Auto-save not triggering
- Check debounce delay
- Verify mutation is defined
- Review timeout cleanup

**Issue:** Connection keeps dropping
- Check network stability
- Review Supabase connection limits
- Verify subscription filters

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Debouncing in React](https://www.freecodecamp.org/news/debouncing-explained/)

## Related Files

- `hooks/use-realtime-rankings.ts` - Core real-time hook
- `hooks/use-realtime-proposals.ts` - Proposal updates hook
- `hooks/use-realtime-messages.ts` - Message updates hook
- `components/editor/connection-status-indicator.tsx` - Status UI
- `components/client/connection-status.tsx` - Alternative status UI
- `components/client/proposal-scoring-interface.tsx` - Scoring with optimistic updates
- `components/client/proposal-rankings-list.tsx` - Rankings with real-time
- `lib/auto-save-service.ts` - Auto-save service
- `hooks/use-auto-save.ts` - Auto-save hook
