-- ============================================================
-- DIAGNOSTIC: Check Proposal Data
-- ============================================================

-- Check the proposal itself
SELECT 
    'PROPOSAL' as type,
    id,
    project_id,
    lead_id,
    status,
    title,
    created_at,
    submitted_at
FROM public.proposals 
WHERE id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Check proposal versions
SELECT 
    'PROPOSAL_VERSION' as type,
    id,
    proposal_id,
    version_number,
    created_by,
    created_at,
    jsonb_pretty(content) as content_preview,
    jsonb_pretty(sections_snapshot) as sections_snapshot_preview,
    jsonb_pretty(documents_snapshot) as documents_snapshot_preview
FROM public.proposal_versions 
WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
ORDER BY version_number DESC;

-- Check if there's a workspace for this proposal's project
SELECT 
    'WORKSPACE' as type,
    w.id as workspace_id,
    w.project_id,
    w.name,
    w.lead_id,
    p.id as proposal_id,
    p.title as proposal_title
FROM public.workspaces w
JOIN public.proposals p ON p.project_id = w.project_id
WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Check workspace documents
SELECT 
    'WORKSPACE_DOCUMENT' as type,
    wd.id as document_id,
    wd.workspace_id,
    wd.title,
    wd.created_by,
    wd.created_at,
    w.project_id,
    p.id as proposal_id
FROM public.workspace_documents wd
JOIN public.workspaces w ON w.id = wd.workspace_id
JOIN public.proposals p ON p.project_id = w.project_id
WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Check document sections
SELECT 
    'DOCUMENT_SECTION' as type,
    ds.id as section_id,
    ds.document_id,
    ds.title,
    ds."order",
    ds.status,
    ds.assigned_to,
    wd.title as document_title,
    p.id as proposal_id
FROM public.document_sections ds
JOIN public.workspace_documents wd ON wd.id = ds.document_id
JOIN public.workspaces w ON w.id = wd.workspace_id
JOIN public.proposals p ON p.project_id = w.project_id
WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
ORDER BY ds."order";

-- Check file attachments (documents table)
SELECT 
    'FILE_ATTACHMENT' as type,
    id,
    proposal_id,
    url,
    doc_type,
    created_by,
    created_at
FROM public.documents
WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Check proposal team members
SELECT 
    'TEAM_MEMBER' as type,
    ptm.id,
    ptm.proposal_id,
    ptm.user_id,
    ptm.role,
    u.email,
    u.raw_user_meta_data->>'full_name' as name
FROM public.proposal_team_members ptm
JOIN auth.users u ON u.id = ptm.user_id
WHERE ptm.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Summary
SELECT 
    'SUMMARY' as type,
    (SELECT COUNT(*) FROM public.proposal_versions WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as version_count,
    (SELECT COUNT(*) FROM public.document_sections ds 
     JOIN public.workspace_documents wd ON wd.id = ds.document_id
     JOIN public.workspaces w ON w.id = wd.workspace_id
     JOIN public.proposals p ON p.project_id = w.project_id
     WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as section_count,
    (SELECT COUNT(*) FROM public.documents WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as document_count,
    (SELECT COUNT(*) FROM public.proposal_team_members WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as team_member_count;
