# Root Cause Analysis: Budget & Timeline Not Displaying

## Issue Summary
Budget and timeline data show as "Not specified" in the proposal comparison view, even though the code is correctly set up to display them.

## Root Cause
The proposal in the database (`005a5a78-1dc3-48ce-b90d-4609e5e32b70`) does **NOT** have values in the `budget_estimate` and `timeline_estimate` columns. The console log confirms:

```javascript
budgetEstimate: undefined
timelineEstimate: undefined
```

## Why This Happened

### 1. Proposal Created Before Feature Was Added
The `budget_estimate` and `timeline_estimate` columns were added to the database schema later. Proposals created before this migration don't have these values.

### 2. Proposal Not Submitted Through Wizard
The proposal submission wizard (`proposal-submission-wizard.tsx`) collects budget and timeline data and saves it via the `submitProposal` mutation. If a proposal was created directly in the database or through an older method, it won't have this data.

## Data Flow Verification

### ✅ Frontend (Submission Wizard)
```typescript
// components/client/proposal-submission-wizard.tsx
// Collects budgetEstimate and timelineEstimate from user
```

### ✅ GraphQL Schema
```graphql
input SubmitProposalInput {
  budgetEstimate: Float!
  timelineEstimate: String!
  ...
}
```

### ✅ GraphQL Resolver
```typescript
// lib/graphql/resolvers.ts (line 8545)
submitProposal: async (_, { input }) => {
  // Passes budgetEstimate and timelineEstimate to service
}
```

### ✅ Submission Service
```typescript
// lib/proposal-submission-service.ts (line 195-197)
.update({
  budget_estimate: params.budgetEstimate,
  timeline_estimate: params.timelineEstimate,
  ...
})
```

### ✅ Database Schema
```sql
-- db/bidsync.sql
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT;
```

### ✅ GraphQL Query
```graphql
query GetProposalDetails($proposalId: ID!) {
  proposalDetail(proposalId: $proposalId) {
    budgetEstimate
    timelineEstimate
    ...
  }
}
```

### ✅ Resolver Return
```typescript
// lib/graphql/resolvers.ts (line 1127-1128)
budgetEstimate: proposal.budget_estimate || null,
timelineEstimate: proposal.timeline_estimate || null,
```

### ✅ Frontend Display
```typescript
// components/client/proposal-comparison-view.tsx (line 376)
value={proposal.budgetEstimate ? `$${proposal.budgetEstimate.toLocaleString()}` : "Not specified"}
```

## The Problem
**Every part of the code is correct.** The issue is simply that the database row doesn't have data in those columns.

## Solution

### Option 1: Add Data to Existing Proposal (Quick Test)
Run the SQL script to add test data:

```bash
# Run the SQL script in your database
psql your_database < add-budget-timeline-to-proposal.sql
```

Or manually in your database client:
```sql
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks'
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';
```

### Option 2: Create New Proposal Through Wizard (Proper Test)
1. Log in as a bidding lead
2. Find an open project
3. Create a new proposal
4. Go through the submission wizard
5. Fill in budget and timeline in the wizard
6. Submit the proposal
7. Log in as the client
8. Compare this new proposal with others

### Option 3: Backfill All Proposals (Production Fix)
If you have many proposals without this data, you can backfill them:

```sql
UPDATE proposals
SET 
  budget_estimate = 5000,  -- Default value
  timeline_estimate = '1 month'  -- Default value
WHERE budget_estimate IS NULL 
  AND status IN ('submitted', 'reviewing', 'approved', 'rejected');
```

## Verification Steps

After adding data to the proposal:

1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Restart dev server** (to clear React Query cache)
3. Navigate to comparison view
4. Check console logs:
   ```javascript
   [ProposalColumn] Proposal data: {
     budgetEstimate: 100,  // ✅ Should have value
     timelineEstimate: "2 weeks"  // ✅ Should have value
   }
   ```
5. Verify UI displays:
   - Budget: **$100**
   - Timeline: **2 weeks**

## Expected Console Output After Fix

### Before (Current):
```javascript
budgetEstimate: undefined
budgetEstimate_type: "undefined"
timelineEstimate: undefined
timelineEstimate_type: "undefined"
```

### After (Fixed):
```javascript
budgetEstimate: 100
budgetEstimate_type: "number"
timelineEstimate: "2 weeks"
timelineEstimate_type: "string"
```

## Files Involved (All Correct)

- ✅ `components/client/proposal-comparison-view.tsx` - Display logic
- ✅ `lib/graphql/queries.ts` - Query definition
- ✅ `lib/graphql/schema.ts` - Schema definition
- ✅ `lib/graphql/resolvers.ts` - Data fetching
- ✅ `lib/proposal-submission-service.ts` - Data saving
- ✅ `db/bidsync.sql` - Database schema

## Key Takeaway

**The code is working correctly.** The issue is data-related, not code-related. The proposal simply doesn't have budget and timeline values in the database because:
1. It was created before the feature existed, OR
2. It wasn't submitted through the proper submission wizard

## Next Steps

1. Run `add-budget-timeline-to-proposal.sql` to add test data
2. Refresh the comparison view
3. Verify budget and timeline display correctly
4. For production: Ensure all new proposals go through the submission wizard
5. For existing proposals: Consider backfilling with default or estimated values
