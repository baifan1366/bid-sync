# How to Apply Database Fix - COMPREHENSIVE

## The Problem

You're seeing multiple RLS errors:
```
Error: infinite recursion detected in policy for relation "proposal_team_members"
Error: infinite recursion detected in policy for relation "document_collaborators"
Error: new row violates row-level security policy for table "workspace_documents"
```

These errors occur because:
1. RLS policies reference themselves, creating circular dependencies
2. INSERT policies are too restrictive or missing proper access checks

## The Solution

Run **TWO** migration scripts in order to fix ALL RLS issues using SECURITY DEFINER functions.

## Step-by-Step Instructions

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run First Migration - Fix Recursion**
   - Open: `db/migrations/fix-all-rls-recursion.sql`
   - Copy the entire content
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for "Success. No rows returned"

4. **Run Second Migration - Fix Workspace Documents**
   - Click "New Query" again
   - Open: `db/migrations/fix-workspace-documents-rls.sql`
   - Copy the entire content
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for "Success. No rows returned"

5. **Verify Success**
   - Both migrations should complete without errors
   - All policies are now updated

### Method 2: Supabase CLI

```bash
# Run both migrations in order
supabase db execute --file db/migrations/fix-all-rls-recursion.sql
supabase db execute --file db/migrations/fix-workspace-documents-rls.sql
```

### Method 3: Direct SQL Connection

```bash
# Run both migrations in order
psql "your-database-connection-string" < db/migrations/fix-all-rls-recursion.sql
psql "your-database-connection-string" < db/migrations/fix-workspace-documents-rls.sql
```

## What the Migrations Do

### Migration 1: fix-all-rls-recursion.sql

1. ✅ Create 4 SECURITY DEFINER helper functions:
   - `is_proposal_lead(proposal_id, user_id)` - Check if user is proposal lead
   - `is_user_admin(user_id)` - Check if user is admin
   - `is_document_owner(document_id, user_id)` - Check if user owns document
   - `has_document_role(document_id, user_id, min_role)` - Check user's document role

2. ✅ Fix `proposal_team_members` policies (6 policies)
3. ✅ Fix `document_collaborators` policies (6 policies)
4. ✅ Grant execute permissions on all helper functions
5. ✅ Break ALL circular dependencies

### Migration 2: fix-workspace-documents-rls.sql

1. ✅ Create `can_access_workspace(workspace_id, user_id)` helper function
2. ✅ Fix `workspace_documents` policies (6 policies)
3. ✅ Ensure document owner trigger uses SECURITY DEFINER
4. ✅ Allow proper document creation and access control

## Why This Works

**SECURITY DEFINER functions** execute with the privileges of the function owner (not the caller), which means they bypass RLS policies when querying tables. This completely breaks the infinite recursion loop.

## After Running

Once the migration is applied:

1. **Test Creating Workspace**
   - Go to `/lead-projects`
   - Click "Create Proposal" on any project
   - Should successfully create proposal and redirect to workspace

2. **Expected Behavior**
   - ✅ No more infinite recursion errors
   - ✅ Proposal created successfully
   - ✅ Workspace created successfully
   - ✅ Document created successfully
   - ✅ You're added as team lead and document owner
   - ✅ Redirected to workspace page

## Verification Query

After running the migration, verify everything:

```sql
-- Check helper functions exist
SELECT 
  proname,
  prosecdef
FROM pg_proc 
WHERE proname IN ('is_proposal_lead', 'is_user_admin', 'is_document_owner', 'has_document_role', 'can_access_workspace')
ORDER BY proname;

-- Check proposal_team_members policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'proposal_team_members'
ORDER BY policyname;

-- Check document_collaborators policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'document_collaborators'
ORDER BY policyname;

-- Check workspace_documents policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'workspace_documents'
ORDER BY policyname;
```

Expected results:
- 5 helper functions (all with `prosecdef = true`)
- 6 policies on `proposal_team_members` (ptm_*)
- 6 policies on `document_collaborators` (dc_*)
- 6 policies on `workspace_documents` (wd_*)

## Troubleshooting

### If you see "permission denied"
- Make sure you're logged in as a database admin
- Check that you have the correct database selected

### If you still see recursion errors
1. Verify the migration ran successfully
2. Check that all 4 helper functions were created
3. Verify policies were recreated
4. Try refreshing your application
5. Check Supabase logs for more details

### If functions already exist
- The script uses `CREATE OR REPLACE`, so it's safe to run multiple times

## Need Help?

If you encounter any issues:
1. Check the Supabase dashboard logs
2. Verify your database connection
3. Ensure you have admin privileges
4. Try running the migration again (it's idempotent)
5. Check that both tables exist: `proposal_team_members` and `document_collaborators`
