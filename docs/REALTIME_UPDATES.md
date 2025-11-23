# Real-time Updates Implementation

## Overview

The proposal scoring system implements real-time updates for proposal rankings, ensuring that all clients see the latest scores and rankings as they are updated. This document describes the implementation details and usage patterns.

## Architecture

### Components

1. **useRealtimeRankings Hook** (`hooks/use-realtime-rankings.ts`)
   - Custom React hook for subscribing to proposal_rankings table changes
   - Implements automatic reconnection with exponential backoff
   - Provides connection status monitoring
   - Handles INSERT, UPDATE, and DELETE events

2. **ProposalRankingsList Component** (`components/client/proposal-rankings-list.tsx`)
   - Displays proposal rankings with real-time updates
   - Shows connection status indicator
   - Automatically refetches data when rankings change

3. **ProposalScoringInterface Component** (`components/client/proposal-scoring-interface.tsx`)
   - Implements optimistic UI updates for scoring operations
   - Auto-saves scores with debouncing (1.5 seconds)
   - Rolls back changes on operation failure
   - Shows save status and error indicators

## Features

### Real-time Subscription

The `useRealtimeRankings` hook subscribes to the `proposal_rankings` table for a specific project:

```typescript
const { connectionStatus, reconnect } = useRealtimeRankings({
  projectId,
  onRankingUpdated: () => refetch(),
  onRankingInserted: () => refetch(),
  onRankingDeleted: () => refetch(),
})
```

### Connection Status

The system displays connection status with three states:
- **Connected**: Green badge with WiFi icon
- **Connecting**: Yellow badge with spinning loader
- **Disconnected**: Red badge with WiFi-off icon and reconnect button

### Automatic Reconnection

When connection is lost, the system automatically attempts to reconnect with exponential backoff:
- Attempt 1: 1 second delay
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- Attempt 4: 8 seconds delay
- Attempt 5: 16 seconds delay
- After 5 attempts: Manual reconnection required

### Optimistic Updates

The scoring interface implements optimistic updates for better UX:

1. **Score Updates**:
   - UI updates immediately when user changes a score
   - Change is sent to server in background
   - If server request fails, UI rolls back to previous state
   - User sees error notification

2. **Finalize Scoring**:
   - UI marks scores as final immediately
   - Server request sent in background
   - Rollback on failure with error notification

### Debounced Auto-save

Score changes are automatically saved with a 1.5-second debounce:
- User makes changes to scores or notes
- Timer starts (1.5 seconds)
- If user makes another change, timer resets
- After 1.5 seconds of inactivity, changes are saved
- Visual indicator shows "Saving..." during save operation

## Usage

### In Proposal Rankings List

```tsx
import { ProposalRankingsList } from "@/components/client/proposal-rankings-list"

function MyComponent() {
  return (
    <ProposalRankingsList
      projectId={projectId}
      onScoreProposal={(proposalId) => {
        // Navigate to scoring interface
      }}
    />
  )
}
```

### In Proposal Scoring Interface

```tsx
import { ProposalScoringInterface } from "@/components/client/proposal-scoring-interface"

function MyComponent() {
  return (
    <ProposalScoringInterface
      projectId={projectId}
      proposalId={proposalId}
      onScoreFinalized={() => {
        // Handle finalization
      }}
    />
  )
}
```

## Database Setup

The real-time updates rely on Supabase Realtime, which requires:

1. **Row Level Security (RLS)** policies on `proposal_rankings` table
2. **Realtime enabled** for the `proposal_rankings` table
3. **Proper indexes** for efficient queries

These are already configured in the migration file `012_proposal_scoring_system.sql`.

## Performance Considerations

### Debouncing

Auto-save uses a 1.5-second debounce to reduce database writes:
- Prevents excessive writes during rapid score changes
- Balances responsiveness with server load
- Can be adjusted in `proposal-scoring-interface.tsx`

### Query Invalidation

When rankings update, only affected queries are invalidated:
- `proposalRankings` query for the specific project
- `proposalScores` query for the specific proposal
- React Query handles efficient refetching

### Connection Management

The real-time hook manages connections efficiently:
- Single channel per project
- Automatic cleanup on unmount
- Reconnection only when needed

## Error Handling

### Connection Errors

- Automatic reconnection with exponential backoff
- Visual indicator shows disconnected state
- Manual reconnect button after max attempts

### Save Errors

- Optimistic updates rolled back on failure
- Error toast notification shown to user
- User can retry the operation

### Network Errors

- Changes queued locally during offline periods
- Automatic retry when connection restored
- Visual feedback for save status

## Testing

To test real-time updates:

1. Open the proposal rankings list in two browser windows
2. Score a proposal in one window
3. Verify the ranking updates in the other window
4. Check connection status indicator
5. Test reconnection by disabling/enabling network

## Requirements Validation

This implementation satisfies:
- **Requirement 5.5**: Real-time ranking updates when scores change
- **Task 13**: All sub-tasks completed:
  - ✅ Supabase Realtime subscriptions for proposal_rankings
  - ✅ Optimistic UI updates for scoring operations
  - ✅ Debouncing for auto-save operations
  - ✅ Rollback on operation failure
  - ✅ Connection status indicator

## Future Enhancements

Potential improvements:
- Offline queue for changes made while disconnected
- Conflict resolution for concurrent edits
- Real-time notifications for score updates
- WebSocket connection pooling for multiple projects
