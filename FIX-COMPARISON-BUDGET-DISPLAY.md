# Fix: Budget and Timeline Not Displaying in Proposal Comparison View

## Issue
Budget and timeline data are being fetched from the database (confirmed in console logs showing `budget_estimate: 100, timeline_estimate: '2 weeks'`) but not displaying in the comparison view UI (showing "Not specified" instead).

## Root Cause Analysis

### Data Flow
1. **GraphQL Resolver** (`lib/graphql/resolvers.ts` lines 1127-1128):
   ```typescript
   budgetEstimate: proposal.budget_estimate || null,
   timelineEstimate: proposal.timeline_estimate || null,
   ```
   ✅ Correctly fetching from database

2. **GraphQL Query** (`lib/graphql/queries.ts`):
   ```graphql
   query GetProposalDetails($proposalId: ID!) {
     proposalDetail(proposalId: $proposalId) {
       budgetEstimate
       timelineEstimate
       ...
     }
   }
   ```
   ✅ Correctly requesting fields

3. **TypeScript Interface** (`lib/graphql/types.ts`):
   ```typescript
   export interface ProposalDetail {
     budgetEstimate: number | null
     timelineEstimate: string | null
     ...
   }
   ```
   ✅ Correctly typed

4. **Comparison View Component** (`components/client/proposal-comparison-view.tsx`):
   - Previously had hardcoded `null` values in the mapping
   - Now correctly maps actual proposal data

## Changes Made

### 1. Fixed Data Mapping in `proposal-comparison-view.tsx`

**Before:**
```typescript
const comparisonSummary = getComparisonSummary(
  proposals.map((p) => ({
    budgetEstimate: null,  // ❌ Hardcoded null
    timelineEstimate: null, // ❌ Hardcoded null
    ...
  }))
)
```

**After:**
```typescript
const comparisonSummary = getComparisonSummary(
  proposals.map((p) => ({
    budgetEstimate: p.budgetEstimate,     // ✅ Actual data
    timelineEstimate: p.timelineEstimate, // ✅ Actual data
    ...
  }))
)
```

### 2. Added Debug Logging

Added console logs to track data flow:
- Log fetched proposals in useEffect
- Log proposals before creating comparison summary
- Log proposal data in ProposalColumn component

## Display Logic

The budget and timeline are displayed in the `ProposalColumn` component:

```typescript
{/* Budget */}
<ComparisonMetric
  icon={<DollarSign className="h-4 w-4" />}
  label="Budget"
  value={proposal.budgetEstimate ? `$${proposal.budgetEstimate.toLocaleString()}` : "Not specified"}
  hasDifference={budgetDiff?.hasDifference || false}
/>

{/* Timeline */}
<ComparisonMetric
  icon={<Clock className="h-4 w-4" />}
  label="Timeline"
  value={proposal.timelineEstimate || "Not specified"}
  hasDifference={timelineDiff?.hasDifference || false}
/>
```

✅ Budget includes dollar sign and thousand separators
✅ Timeline displays as plain text

## Testing Steps

1. Navigate to a project's decision page
2. Select 2-4 proposals
3. Click "Compare Selected" button
4. Check browser console for debug logs:
   - `[ProposalComparison] Fetched proposals:` - Should show budgetEstimate and timelineEstimate values
   - `[ProposalComparison] Proposals for comparison summary:` - Should show the same values
   - `[ProposalColumn] Proposal data:` - Should show values for each proposal column
5. Verify budget displays as "$100" (or actual value with formatting)
6. Verify timeline displays as "2 weeks" (or actual value)

## Expected Results

- Budget should display with dollar sign and thousand separators (e.g., "$100", "$1,000", "$50,000")
- Timeline should display as plain text (e.g., "2 weeks", "1 month", "3 months")
- If values are null/undefined, should display "Not specified"
- Differences should be highlighted with yellow border if values differ between proposals

## Files Modified

1. `components/client/proposal-comparison-view.tsx`
   - Fixed budgetEstimate and timelineEstimate mapping
   - Added debug logging for data flow tracking

## Related Files (No Changes Needed)

- `lib/graphql/resolvers.ts` - Already correctly fetching data
- `lib/graphql/queries.ts` - Already correctly requesting fields
- `lib/graphql/types.ts` - Already correctly typed
- `lib/comparison-utils.ts` - Already correctly processing data

## Next Steps

If the issue persists after these changes:
1. Check console logs to see where data is lost
2. Verify the GraphQL response contains the data
3. Check if there's a caching issue with React Query
4. Verify the proposal objects in the proposals state array
5. Check if there's a type mismatch (number vs string)

## Design System Compliance

✅ Uses yellow-400 accent color for highlights
✅ Maintains light/dark mode support
✅ Uses proper spacing and typography
✅ Follows BidSync design patterns
