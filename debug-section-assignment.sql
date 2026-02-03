-- ============================================================
-- DEBUG SCRIPT: Section Assignment Issue
-- ============================================================
-- This script helps debug why section assignment isn't working
-- Run this with the workspace_id to check all related data
-- ============================================================

-- Replace this with your actual workspace_id
\set workspace_id 'b35a767b-c7a2-45c3-95be-532f0c994457'
\set user_id 'dc7ac117-f4fa-492a-a7ad-44c0ebe74cbf'

-- 1. Check workspace details
SELECT 
  'WORKSPACE' as check_type,
  id,
  name,
  project_id,
  lead_id,
  proposal_id,
  CASE 
    WHEN proposal_id IS NULL THEN '⚠️ NULL - needs migration 044'
    ELSE '✅ Set'
  END as proposal_id_status
FROM workspaces
WHERE id = :'workspace_id';

-- 2. Check proposals for this workspace
SELECT 
  'PROPOSALS' as check_type,
  p.id as proposal_id,
  p.project_id,
  p.lead_id,
  p.status,
  CASE 
    WHEN p.lead_id = :'user_id' THEN '✅ User is lead_id'
    ELSE '❌ User is NOT lead_id'
  END as is_lead_by_id
FROM workspaces w
JOIN proposals p ON p.project_id = w.project_id
WHERE w.id = :'workspace_id'
ORDER BY p.created_at DESC;

-- 3. Check proposal_team_members
SELECT 
  'TEAM_MEMBERS' as check_type,
  ptm.proposal_id,
  ptm.user_id,
  ptm.role,
  CASE 
    WHEN ptm.user_id = :'user_id' THEN '✅ Current user'
    ELSE 'Other member'
  END as is_current_user,
  CASE 
    WHEN ptm.role = 'lead' THEN '✅ Lead role'
    ELSE 'Member role'
  END as role_status
FROM workspaces w
JOIN proposals p ON p.project_id = w.project_id
JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
WHERE w.id = :'workspace_id'
ORDER BY ptm.role DESC, ptm.joined_at;

-- 4. Check if RPC function exists
SELECT 
  'RPC_FUNCTION' as check_type,
  proname as function_name,
  CASE 
    WHEN proname = 'get_proposal_team_with_users' THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status
FROM pg_proc
WHERE proname = 'get_proposal_team_with_users';

-- 5. Test RPC function with actual proposal_id
-- (This will show team members that should appear in dropdown)
SELECT 
  'RPC_TEST' as check_type,
  *
FROM get_proposal_team_with_users(
  (SELECT proposal_id FROM workspaces WHERE id = :'workspace_id')
);

-- 6. Check document_sections for this workspace
SELECT 
  'SECTIONS' as check_type,
  ds.id as section_id,
  ds.title,
  ds.assigned_to,
  ds.status,
  CASE 
    WHEN ds.assigned_to IS NULL THEN 'Unassigned'
    WHEN ds.assigned_to = :'user_id' THEN '✅ Assigned to you'
    ELSE 'Assigned to other'
  END as assignment_status
FROM workspaces w
JOIN workspace_documents wd ON wd.workspace_id = w.id
JOIN document_sections ds ON ds.document_id = wd.document_id
WHERE w.id = :'workspace_id'
ORDER BY ds.order;

-- 7. Summary
SELECT 
  'SUMMARY' as check_type,
  (SELECT COUNT(*) FROM workspaces WHERE id = :'workspace_id') as workspace_exists,
  (SELECT proposal_id IS NOT NULL FROM workspaces WHERE id = :'workspace_id') as has_proposal_id,
  (SELECT COUNT(*) FROM proposals p JOIN workspaces w ON p.project_id = w.project_id WHERE w.id = :'workspace_id') as proposal_count,
  (SELECT COUNT(*) FROM proposal_team_members ptm JOIN workspaces w ON ptm.proposal_id = (SELECT id FROM proposals WHERE project_id = w.project_id LIMIT 1) WHERE w.id = :'workspace_id') as team_member_count,
  (SELECT COUNT(*) FROM proposal_team_members ptm JOIN workspaces w ON ptm.proposal_id = (SELECT id FROM proposals WHERE project_id = w.project_id LIMIT 1) WHERE w.id = :'workspace_id' AND ptm.user_id = :'user_id' AND ptm.role = 'lead') as user_is_lead_count;

-- ============================================================
-- EXPECTED RESULTS:
-- ============================================================
-- 1. WORKSPACE: Should show proposal_id is set (not NULL)
-- 2. PROPOSALS: Should show 1-3 proposals, one should match user as lead
-- 3. TEAM_MEMBERS: Should show current user with role='lead'
-- 4. RPC_FUNCTION: Should show function exists
-- 5. RPC_TEST: Should show list of team members with names
-- 6. SECTIONS: Should show sections (if any exist)
-- 7. SUMMARY: All counts should be > 0
-- ============================================================
