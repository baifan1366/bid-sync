# Migration: Remove bid_team_members References

## Summary
This migration removes all references to the deprecated `bid_team_members` table and replaces them with `proposal_team_members`. The old architecture used project-level teams, but the correct architecture uses proposal-level teams.

## Changes Made

### 1. Database Schema (db/bidsync.sql)
- ✅ Removed `bid_team_members` table definition and policies
- ✅ Updated all RLS policies to use `proposal_team_members`
- ✅ Updated helper functions to use proposal-level team checks
- ✅ Fixed all references in:
  - Project deliverables policies
  - Project completions policies
  - Project archives policies
  - Completion revisions policies
  - Project exports policies
  - Document permission functions

### 2. Migration Script
Created `db/migrations/fix-all-bid-team-members-refs.sql` which:
- Drops all old policies referencing `bid_team_members`
- Drops the `bid_team_members` table
- Creates new policies using `proposal_team_members`
- Creates new helper functions for proposal-level authorization

## Key Architecture Changes

### Before (Project-Level Teams)
```sql
-- Old approach: Teams belonged to projects
SELECT 1 FROM public.bid_team_members btm
WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
```

### After (Proposal-Level Teams)
```sql
-- New approach: Teams belong to proposals
SELECT 1 FROM public.proposals pr
JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
```

## New Helper Functions

### `is_proposal_lead(p_proposal_id UUID, p_user_id UUID)`
Checks if a user is the lead of a specific proposal.

### `is_proposal_team_member(p_proposal_id UUID, p_user_id UUID)`
Checks if a user is a member of a specific proposal team.

## How to Apply

### Recommended Approach (For Existing Databases)

**Step 1:** Drop old policies and table
```bash
psql -U your_user -d your_database -f db/migrations/drop-bid-team-members-policies.sql
```

**Step 2:** The updated schema in `db/bidsync.sql` will create the correct policies when you next apply it.

### For Fresh Database Setup
Simply run the updated schema:
```bash
psql -U your_user -d your_database -f db/bidsync.sql
```

The schema now has all `bid_team_members` references removed and uses `proposal_team_members` throughout.

## Verification

After applying the migration, verify:

1. No `bid_team_members` table exists:
```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'bid_team_members';
-- Should return 0 rows
```

2. All policies use `proposal_team_members`:
```sql
SELECT policyname, definition 
FROM pg_policies 
WHERE definition LIKE '%bid_team_members%';
-- Should return 0 rows
```

3. Proposal submission works correctly:
- Test submitting a proposal
- Verify team members can access proposal data
- Verify RLS policies allow proper access

## Impact

### Breaking Changes
- Any code referencing `bid_team_members` table will fail
- Any custom queries using project-level team checks need updating

### Benefits
- ✅ Correct architecture: Teams belong to proposals, not projects
- ✅ Better isolation: Each proposal has its own team
- ✅ Clearer permissions: Team access is proposal-specific
- ✅ Fixes the "relation does not exist" error on proposal submission

## Related Files
- `db/bidsync.sql` - Main schema file (updated)
- `db/migrations/fix-all-bid-team-members-refs.sql` - Migration script
- `MIGRATION-BID-TEAM-MEMBERS-REMOVAL.md` - This document

## Notes
- The `proposal_team_members` table was already correctly implemented
- This migration only removes the old, unused `bid_team_members` references
- All team invitation logic already uses `proposal_team_members`
