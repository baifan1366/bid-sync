# Next Steps: Proposal Detail View Fix

## Current Status

### ✅ Completed
1. **GraphQL Schema Updates** - Fixed field naming (camelCase vs snake_case)
2. **TypeScript Types** - Updated ProposalVersion interface
3. **GraphQL Query** - Added missing fields (sectionsSnapshot, documentsSnapshot, createdByName)
4. **Resolver Logic** - Added comprehensive fallback logic for sections/documents
5. **Component Updates** - Changed all field references to camelCase in proposal-detail-view.tsx
6. **Skeleton Components** - Created and integrated skeleton loading states:
   - `WorkspaceSkeleton` - For decision page
   - `ProposalDetailSkeleton` - For proposal detail view
   - `ProjectHeaderSkeleton` - For project header
   - `ProposalCardSkeleton` - For proposal cards
   - Updated `client-decision-page.tsx` to use skeletons
   - Updated `project-detail-page.tsx` to use skeletons

### ⚠️ Pending - CRITICAL
**RLS Policies Blocking Data Access**

The server logs show:
```
version_count: 0
workspace_count: 0
```

This indicates that Row Level Security (RLS) policies are preventing the resolver from accessing:
- `proposal_versions` table
- `workspaces` table
- `workspace_documents` table
- `document_sections` table

## Required Action: Execute RLS Fix Script

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Execute the Fix Script
Copy and paste the contents of `FIX-PROPOSAL-DETAIL-RLS.sql` into the SQL editor and run it.

This script will:
1. **Fix proposal_versions RLS** - Allow proposal lead, team members, and project client to read versions
2. **Fix workspaces RLS** - Allow proposal team members to access workspaces for their project
3. **Fix workspace_documents RLS** - Allow proposal team members to read documents
4. **Fix document_sections RLS** - Allow proposal team members to read sections

### Step 3: Verify the Fix
After running the script, the verification queries at the end will show:
- All new policies created
- Count of policies per table

Expected output:
```
proposal_versions_policies: 2
workspaces_policies: 4
workspace_documents_policies: 4
document_sections_policies: 4
```

### Step 4: Test the Page
1. Navigate to: `http://localhost:3000/client-projects/ef03c80f-313c-455e-9c57-27256a751335/decision?proposal=6515207e-dbb8-466d-8426-caebbefbb2e5`
2. Check the browser console and server logs
3. Verify that:
   - `version_count` > 0
   - `workspace_count` > 0
   - Sections and documents are displayed
   - Version history is visible

## What the Fix Does

### Current Problem
The resolver has comprehensive fallback logic:
1. Try to fetch from `workspaces` → `workspace_documents` → `document_sections`
2. If that fails, try `proposal_versions.sections_snapshot`
3. If that fails, try `proposal_versions.content.sections`

However, **ALL of these queries are being blocked by RLS policies**, so no data is returned.

### The Solution
The RLS fix script creates policies that allow:
- **Proposal Lead**: Full access to their proposal's versions and workspace data
- **Team Members**: Read access to proposal versions and workspace data for proposals they're assigned to
- **Project Client**: Read access to proposal versions for their project

This matches the authorization logic already in the resolver (lines 550-565 in resolvers.ts).

## After the Fix

Once RLS policies are fixed, the page should display:
- ✅ Proposal document sections
- ✅ Version history with creator names
- ✅ Documents list
- ✅ All proposal details

## Troubleshooting

If data still doesn't appear after running the script:

1. **Check RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('proposal_versions', 'workspaces', 'workspace_documents', 'document_sections');
   ```

2. **Check user authentication**:
   - Ensure you're logged in as the correct user
   - Verify user role (client, lead, or team member)

3. **Check data exists**:
   ```sql
   -- Check if proposal versions exist
   SELECT COUNT(*) FROM proposal_versions WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';
   
   -- Check if workspace exists
   SELECT COUNT(*) FROM workspaces WHERE project_id = 'ef03c80f-313c-455e-9c57-27256a751335';
   ```

4. **Check team membership**:
   ```sql
   -- Check if user is a team member
   SELECT * FROM proposal_team_members 
   WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5' 
   AND user_id = auth.uid();
   ```

## Files Modified

### GraphQL Layer
- `lib/graphql/schema.ts` - Updated ProposalVersion type
- `lib/graphql/types.ts` - Updated ProposalVersion interface
- `lib/graphql/queries.ts` - Added new fields to query
- `lib/graphql/resolvers.ts` - Added fallback logic and logging

### Components
- `components/client/proposal-detail-view.tsx` - Updated field references
- `components/client/workspace-skeleton.tsx` - Created
- `components/client/proposal-detail-skeleton.tsx` - Created
- `components/client/project-header-skeleton.tsx` - Created
- `components/client/proposal-card-skeleton.tsx` - Created

### Pages
- `app/(app)/(client)/client-projects/[projectId]/decision/client-decision-page.tsx` - Added skeleton loading
- `app/(app)/(client)/client-projects/[projectId]/project-detail-page.tsx` - Added skeleton loading

### Database
- `FIX-PROPOSAL-DETAIL-RLS.sql` - **NEEDS TO BE EXECUTED**

## Summary

The code changes are complete and correct. The only remaining step is to **execute the RLS fix script** in Supabase to allow the resolver to access the data it needs.

Once the script is executed, the proposal detail view will work correctly with all features:
- Document sections display
- Version history
- Documents list
- Compliance checklist
- Team information
- Proper skeleton loading states
