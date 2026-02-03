-- ============================================================
-- SEED TEST DATA FOR PROPOSAL
-- ============================================================
-- This script creates test data for proposal 6515207e-dbb8-466d-8426-caebbefbb2e5
-- Run this to populate the proposal with versions, sections, and documents

DO $$
DECLARE
    v_proposal_id UUID := '6515207e-dbb8-466d-8426-caebbefbb2e5';
    v_project_id UUID;
    v_lead_id UUID;
    v_workspace_id UUID;
    v_document_id UUID;
    v_section1_id UUID;
    v_section2_id UUID;
    v_section3_id UUID;
BEGIN
    -- Get proposal details
    SELECT project_id, lead_id 
    INTO v_project_id, v_lead_id
    FROM public.proposals 
    WHERE id = v_proposal_id;
    
    RAISE NOTICE 'Proposal ID: %, Project ID: %, Lead ID: %', v_proposal_id, v_project_id, v_lead_id;
    
    -- Check if workspace exists for this project
    SELECT id INTO v_workspace_id
    FROM public.workspaces
    WHERE project_id = v_project_id
    LIMIT 1;
    
    -- Create workspace if it doesn't exist
    IF v_workspace_id IS NULL THEN
        INSERT INTO public.workspaces (project_id, lead_id, name, description)
        VALUES (
            v_project_id,
            v_lead_id,
            'Proposal Workspace',
            'Collaborative workspace for proposal development'
        )
        RETURNING id INTO v_workspace_id;
        
        RAISE NOTICE 'Created workspace: %', v_workspace_id;
    ELSE
        RAISE NOTICE 'Using existing workspace: %', v_workspace_id;
    END IF;
    
    -- Check if document exists
    SELECT id INTO v_document_id
    FROM public.workspace_documents
    WHERE workspace_id = v_workspace_id
    LIMIT 1;
    
    -- Create workspace document if it doesn't exist
    IF v_document_id IS NULL THEN
        INSERT INTO public.workspace_documents (
            workspace_id,
            title,
            description,
            content,
            created_by,
            last_edited_by
        )
        VALUES (
            v_workspace_id,
            'Main Proposal Document',
            'Primary proposal document with all sections',
            '{"type": "doc", "content": []}'::jsonb,
            v_lead_id,
            v_lead_id
        )
        RETURNING id INTO v_document_id;
        
        RAISE NOTICE 'Created document: %', v_document_id;
    ELSE
        RAISE NOTICE 'Using existing document: %', v_document_id;
    END IF;
    
    -- Create document sections
    INSERT INTO public.document_sections (
        document_id,
        title,
        "order",
        status,
        content
    )
    VALUES 
        (v_document_id, 'Executive Summary', 1, 'in_progress', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "This is the executive summary section."}]}]}'::jsonb),
        (v_document_id, 'Technical Approach', 2, 'not_started', '{"type": "doc", "content": []}'::jsonb),
        (v_document_id, 'Budget & Timeline', 3, 'not_started', '{"type": "doc", "content": []}'::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_section1_id;
    
    RAISE NOTICE 'Created sections';
    
    -- Get section IDs for snapshot
    SELECT id INTO v_section1_id FROM public.document_sections WHERE document_id = v_document_id AND "order" = 1;
    SELECT id INTO v_section2_id FROM public.document_sections WHERE document_id = v_document_id AND "order" = 2;
    SELECT id INTO v_section3_id FROM public.document_sections WHERE document_id = v_document_id AND "order" = 3;
    
    -- Create proposal version with snapshots
    INSERT INTO public.proposal_versions (
        proposal_id,
        version_number,
        content,
        sections_snapshot,
        documents_snapshot,
        change_summary,
        created_by
    )
    VALUES (
        v_proposal_id,
        1,
        jsonb_build_object(
            'title', 'Proposal for Object Oriented Analysis Design',
            'summary', 'Initial draft of the proposal',
            'sections', jsonb_build_array(
                jsonb_build_object(
                    'id', v_section1_id,
                    'title', 'Executive Summary',
                    'order', 1,
                    'content', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "This is the executive summary section."}]}]}'::jsonb
                ),
                jsonb_build_object(
                    'id', v_section2_id,
                    'title', 'Technical Approach',
                    'order', 2,
                    'content', '{"type": "doc", "content": []}'::jsonb
                ),
                jsonb_build_object(
                    'id', v_section3_id,
                    'title', 'Budget & Timeline',
                    'order', 3,
                    'content', '{"type": "doc", "content": []}'::jsonb
                )
            )
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', v_section1_id,
                'title', 'Executive Summary',
                'order', 1,
                'status', 'in_progress',
                'content', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "This is the executive summary section."}]}]}'::jsonb
            ),
            jsonb_build_object(
                'id', v_section2_id,
                'title', 'Technical Approach',
                'order', 2,
                'status', 'not_started',
                'content', '{"type": "doc", "content": []}'::jsonb
            ),
            jsonb_build_object(
                'id', v_section3_id,
                'title', 'Budget & Timeline',
                'order', 3,
                'status', 'not_started',
                'content', '{"type": "doc", "content": []}'::jsonb
            )
        ),
        '[]'::jsonb, -- Empty documents snapshot for now
        'Initial version with three sections',
        v_lead_id
    )
    ON CONFLICT (proposal_id, version_number) DO UPDATE
    SET 
        sections_snapshot = EXCLUDED.sections_snapshot,
        documents_snapshot = EXCLUDED.documents_snapshot,
        content = EXCLUDED.content;
    
    RAISE NOTICE 'Created/updated proposal version 1';
    
    -- Add document collaborator for the lead
    INSERT INTO public.document_collaborators (
        document_id,
        user_id,
        role,
        added_by
    )
    VALUES (
        v_document_id,
        v_lead_id,
        'owner',
        v_lead_id
    )
    ON CONFLICT (document_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Added document collaborator';
    
    RAISE NOTICE 'Test data seeding complete!';
    
END $$;

-- Verify the data was created
SELECT 
    'Verification' as step,
    (SELECT COUNT(*) FROM public.proposal_versions WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as versions,
    (SELECT COUNT(*) FROM public.document_sections ds 
     JOIN public.workspace_documents wd ON wd.id = ds.document_id
     JOIN public.workspaces w ON w.id = wd.workspace_id
     JOIN public.proposals p ON p.project_id = w.project_id
     WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as sections,
    (SELECT COUNT(*) FROM public.workspaces w
     JOIN public.proposals p ON p.project_id = w.project_id
     WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as workspaces;
