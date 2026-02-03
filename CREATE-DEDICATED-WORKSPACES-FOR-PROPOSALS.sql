-- ============================================================
-- Create Dedicated Workspaces for Each Proposal
-- ============================================================
-- This script ensures each proposal has its own workspace
-- with its own copy of documents and sections
-- ============================================================

-- Step 1: Identify proposals that need dedicated workspaces
DO $$
DECLARE
    proposal_rec RECORD;
    new_workspace_id UUID;
    source_workspace_id UUID;
    doc_rec RECORD;
    new_doc_id UUID;
BEGIN
    RAISE NOTICE '=== Starting Workspace Creation for Proposals ===';
    
    -- For each proposal that doesn't have a dedicated workspace
    FOR proposal_rec IN 
        SELECT p.* 
        FROM proposals p
        WHERE NOT EXISTS (
            SELECT 1 FROM workspaces w 
            WHERE w.proposal_id = p.id
        )
        AND p.lead_id IS NOT NULL
        ORDER BY p.project_id, p.created_at
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '--- Processing Proposal: % (ID: %)', proposal_rec.title, proposal_rec.id;
        RAISE NOTICE '    Project ID: %', proposal_rec.project_id;
        RAISE NOTICE '    Lead ID: %', proposal_rec.lead_id;
        
        -- Find a source workspace from the same project to copy from
        SELECT id INTO source_workspace_id
        FROM workspaces
        WHERE project_id = proposal_rec.project_id
        ORDER BY created_at
        LIMIT 1;
        
        IF source_workspace_id IS NOT NULL THEN
            RAISE NOTICE '    Found source workspace: %', source_workspace_id;
            
            -- Create new workspace for this proposal
            new_workspace_id := gen_random_uuid();
            
            INSERT INTO workspaces (
                id,
                project_id,
                lead_id,
                proposal_id,
                name,
                description,
                created_at,
                updated_at
            ) VALUES (
                new_workspace_id,
                proposal_rec.project_id,
                proposal_rec.lead_id,
                proposal_rec.id,
                COALESCE(proposal_rec.title, 'Proposal Workspace'),
                'Dedicated workspace for proposal: ' || COALESCE(proposal_rec.title, proposal_rec.id::text),
                now(),
                now()
            );
            
            RAISE NOTICE '    ✅ Created new workspace: %', new_workspace_id;
            
            -- Copy workspace documents from source workspace
            FOR doc_rec IN 
                SELECT * FROM workspace_documents 
                WHERE workspace_id = source_workspace_id
            LOOP
                new_doc_id := gen_random_uuid();
                
                -- Insert new document
                INSERT INTO workspace_documents (
                    id,
                    workspace_id,
                    title,
                    description,
                    content,
                    created_by,
                    last_edited_by,
                    created_at,
                    updated_at
                ) VALUES (
                    new_doc_id,
                    new_workspace_id,
                    doc_rec.title,
                    doc_rec.description,
                    doc_rec.content,
                    doc_rec.created_by,
                    doc_rec.last_edited_by,
                    now(),
                    now()
                );
                
                RAISE NOTICE '       Copied document: % (new ID: %)', doc_rec.title, new_doc_id;
                
                -- Copy document sections
                INSERT INTO document_sections (
                    document_id,
                    title,
                    content,
                    "order",
                    status,
                    assigned_to,
                    deadline,
                    created_at,
                    updated_at
                )
                SELECT 
                    new_doc_id,
                    title,
                    content,
                    "order",
                    status,
                    assigned_to,
                    deadline,
                    now(),
                    now()
                FROM document_sections
                WHERE document_id = doc_rec.id;
                
                RAISE NOTICE '       Copied sections for document: %', doc_rec.title;
            END LOOP;
            
        ELSE
            -- No source workspace found, create empty workspace
            RAISE NOTICE '    ⚠️  No source workspace found, creating empty workspace';
            
            new_workspace_id := gen_random_uuid();
            
            INSERT INTO workspaces (
                id,
                project_id,
                lead_id,
                proposal_id,
                name,
                description,
                created_at,
                updated_at
            ) VALUES (
                new_workspace_id,
                proposal_rec.project_id,
                proposal_rec.lead_id,
                proposal_rec.id,
                COALESCE(proposal_rec.title, 'Proposal Workspace'),
                'Dedicated workspace for proposal: ' || COALESCE(proposal_rec.title, proposal_rec.id::text),
                now(),
                now()
            );
            
            RAISE NOTICE '    ✅ Created empty workspace: %', new_workspace_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Workspace Creation Complete ===';
END $$;

-- Step 2: Verify the results
SELECT 
    '=== Verification Results ===' as info;

SELECT 
    'Total Proposals' as metric,
    COUNT(*) as count
FROM proposals;

SELECT 
    'Proposals with Dedicated Workspace' as metric,
    COUNT(*) as count
FROM proposals p
WHERE EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.proposal_id = p.id
);

SELECT 
    'Proposals WITHOUT Dedicated Workspace' as metric,
    COUNT(*) as count
FROM proposals p
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.proposal_id = p.id
);

-- Step 3: Show workspace distribution
SELECT 
    'Workspace Distribution' as info,
    w.project_id,
    COUNT(DISTINCT w.id) as workspace_count,
    COUNT(DISTINCT w.proposal_id) as proposals_with_workspace,
    COUNT(DISTINCT p.id) as total_proposals_in_project,
    array_agg(DISTINCT w.id) as workspace_ids,
    array_agg(DISTINCT p.id) as proposal_ids
FROM workspaces w
JOIN proposals p ON p.project_id = w.project_id
GROUP BY w.project_id
ORDER BY total_proposals_in_project DESC;

-- Step 4: Final check - ensure no proposals share sections
SELECT 
    'Final Check: Proposals Sharing Sections' as check_type,
    COUNT(*) as shared_section_count
FROM (
    SELECT 
        ds.id as section_id,
        COUNT(DISTINCT p.id) as proposal_count
    FROM document_sections ds
    JOIN workspace_documents wd ON wd.id = ds.document_id
    JOIN workspaces w ON w.id = wd.workspace_id
    JOIN proposals p ON p.project_id = w.project_id
    GROUP BY ds.id
    HAVING COUNT(DISTINCT p.id) > 1
) shared_sections;

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM proposals WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE workspaces.proposal_id = proposals.id)) = 0
        THEN '✅ SUCCESS: All proposals now have dedicated workspaces!'
        ELSE '❌ INCOMPLETE: Some proposals still need workspaces'
    END as final_status;
