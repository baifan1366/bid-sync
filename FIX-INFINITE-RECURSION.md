# Fix: Infinite Recursion in proposal_team_members RLS

## Problem

When creating a proposal, you encountered this error:
```
Error creating workspace: {
  code: '42P17',
  details: null,
  hint: null,
  message: 'infinite recursion detected in policy for relation "proposal_team_members"'
}
```

## Root Cause

The RLS policies on `proposal_team_members` table were self-referencing, causing infinite recursion:

```sql
-- BAD: This causes infinite recursion
CREATE POLICY "proposal_team_members_read" ON public.proposal_team_members
FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.proposal_team_members ptm  -- ❌ Self-reference!
        WHERE ptm.proposal_id = proposal_team_members.proposal_id 
        AND ptm.user_id = auth.uid()
    )
);
```

## Solution

The policies now reference the `proposals` table instead:

```sql
-- GOOD: References proposals table
CREATE POLICY "proposal_team_members_read" ON public.proposal_team_members
FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.proposals p  -- ✅ No self-reference
        WHERE p.id = proposal_team_members.proposal_id 
        AND p.lead_id = auth.uid()
    )
);
```

## How to Apply the Fix

### Option 1: Run Migration Script (Recommended)

```bash
# In Supabase SQL Editor, run:
db/migrations/fix-proposal-team-members-rls.sql
```

### Option 2: Manual Fix

1. Go to Supabase Dashboard → SQL Editor
2. Run the migration script content
3. Verify with:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'proposal_team_members';
```

## UI Fix

The button text has also been updated from "Submit Proposal" to "Create Proposal" to better reflect that users are creating a draft proposal first, not submitting it immediately.

**Before:** "Submit Proposal"  
**After:** "Create Proposal"

## Testing

After applying the fix:

1. Navigate to `/lead-projects`
2. Click "Create Proposal" on any project
3. Should successfully create a proposal and redirect to workspace
4. No more infinite recursion errors

## Files Changed

- `db/bidsync.sql` - Updated RLS policies
- `db/migrations/fix-proposal-team-members-rls.sql` - Migration script
- `components/lead/enhanced-project-card.tsx` - Button text updated
