# URGENT FIX: Proposal Submission Error

## Problem
Proposal submission is failing with error:
```
Failed to update proposal: relation "public.bid_team_members" does not exist
```

## Root Cause
The database was migrated from `bid_team_members` to `proposal_team_members`, but some RLS policies and functions still reference the old table name.

## Solution

### Option 1: Run the Migration Script (RECOMMENDED)
Run the existing migration that should have been applied:

```bash
# Apply the migration
psql -d your_database < db/migrations/031_update_rls_policies_to_proposal_team_members.sql
```

### Option 2: Run the Comprehensive Fix Script
If migration 031 doesn't fully resolve the issue, run the comprehensive fix:

```bash
# Apply the comprehensive fix
psql -d your_database < fix-bid-team-members-references.sql
```

### Option 3: Quick Manual Fix via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Run this query to find all problematic policies:

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    definition
FROM pg_policies 
WHERE definition LIKE '%bid_team_members%';
```

3. For each policy found, drop and recreate it using `proposal_team_members` instead

4. Drop the old table:
```sql
DROP TABLE IF EXISTS public.bid_team_members CASCADE;
```

## Verification

After applying the fix, verify with:

```sql
-- Should return 0 rows
SELECT * FROM pg_policies 
WHERE definition LIKE '%bid_team_members%';

-- Should show policies using proposal_team_members
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE definition LIKE '%proposal_team_members%'
ORDER BY tablename, policyname;
```

## Files Created
- `fix-bid-team-members-references.sql` - Comprehensive fix script

## Next Steps
1. Apply one of the fix options above
2. Test proposal submission
3. Verify team member access works correctly
