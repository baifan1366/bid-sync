# Fix: Proposal Submission Error

## Problem
When submitting a proposal, you encountered this error:
```json
{
  "errors": ["Failed to update proposal: relation \"public.bid_team_members\" does not exist"]
}
```

## Root Cause
The database schema had references to a deprecated `bid_team_members` table that was never created. The correct architecture uses `proposal_team_members` (proposal-level teams) instead of project-level teams.

## Solution Applied

### 1. Updated Database Schema (`db/bidsync.sql`)
✅ Removed all `bid_team_members` table definitions and policies
✅ Updated all RLS policies to use `proposal_team_members`
✅ Fixed references in:
- Proposal additional info policies
- Proposal versions policies  
- Project deliverables policies
- Project completions policies
- Project archives policies
- Completion revisions policies
- Project exports policies
- Document permission functions

### 2. Created Migration Scripts

**`db/migrations/drop-bid-team-members-policies.sql`**
- Safely drops all old policies and the deprecated table
- Run this on existing databases before applying the updated schema

**`db/migrations/verify-no-bid-team-members.sql`**
- Verification script to confirm all references are removed
- Should return 0 rows if successful

### 3. New Helper Functions
Created proposal-level authorization functions:
- `is_proposal_lead(p_proposal_id UUID, p_user_id UUID)` - Check if user is proposal lead
- `is_proposal_team_member(p_proposal_id UUID, p_user_id UUID)` - Check if user is team member

## How to Fix Your Database

### Step 1: Drop Old References
```bash
psql -U postgres -d bidsync -f db/migrations/drop-bid-team-members-policies.sql
```

### Step 2: Verify Cleanup
```bash
psql -U postgres -d bidsync -f db/migrations/verify-no-bid-team-members.sql
```
Expected output: 0 rows (meaning no references found)

### Step 3: Apply Updated Schema (if needed)
If you need to recreate policies:
```bash
psql -U postgres -d bidsync -f db/bidsync.sql
```

## Testing

After applying the fix, test proposal submission:

1. **Create a proposal** as a bidding lead
2. **Add team members** to the proposal
3. **Submit the proposal** - should work without errors
4. **Verify team access** - team members should see the proposal

## Architecture Change

### Before (Incorrect)
```
Project → bid_team_members (project-level teams)
         ↓
      Proposals
```

### After (Correct)
```
Project → Proposals → proposal_team_members (proposal-level teams)
```

## Why This Is Better

✅ **Correct isolation**: Each proposal has its own team
✅ **Better permissions**: Team access is proposal-specific
✅ **Clearer logic**: Teams belong to proposals, not projects
✅ **Matches business logic**: Multiple teams can bid on the same project

## Files Modified

- ✅ `db/bidsync.sql` - Main schema (all references removed)
- ✅ `db/migrations/drop-bid-team-members-policies.sql` - Cleanup script
- ✅ `db/migrations/verify-no-bid-team-members.sql` - Verification script
- ✅ `MIGRATION-BID-TEAM-MEMBERS-REMOVAL.md` - Detailed migration guide
- ✅ `FIX-PROPOSAL-SUBMISSION-ERROR.md` - This document

## Next Steps

1. Run the cleanup script on your database
2. Test proposal submission
3. Verify team member access works correctly
4. Delete old diagnostic SQL files (they're no longer needed):
   - `fix-bid-team-members-references.sql`
   - `diagnose-bid-team-members-issue.sql`
   - `simple-diagnose.sql`
   - `ultra-simple-fix.sql`
   - `safe-fix.sql`
   - `complete-bid-team-members-fix.sql`
   - `find-all-bid-team-members.sql`
   - `check-proposals-policies.sql`
   - `fix-policies-only.sql`

## Support

If you encounter any issues:
1. Check the verification script output
2. Review the migration guide: `MIGRATION-BID-TEAM-MEMBERS-REMOVAL.md`
3. Ensure `proposal_team_members` table exists and has data
