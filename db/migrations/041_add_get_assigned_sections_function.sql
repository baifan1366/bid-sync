-- Migration 041: Add RPC function to get assigned sections with workspace info
-- This avoids Supabase REST API ambiguity issues with nested relationships

CREATE OR REPLACE FUNCTION public.get_assigned_sections_for_user(user_id_param UUID)
RETURNS TABLE (
    section_id UUID,
    section_title TEXT,
    section_status TEXT,
    section_deadline TIMESTAMPTZ,
    document_id UUID,
    document_title TEXT,
    workspace_id UUID,
    workspace_name TEXT,
    project_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $${
    "code": "PGRST116",
    "details": "The result contains 0 rows",
    "hint": null,
    "message": "Cannot coerce the result to a single JSON object"
}
BEGIN
    RETURN QUERY
    SELECT 
        ds.id AS section_id,
        ds.title AS section_title,
        ds.status AS section_status,
        ds.deadline AS section_deadline,
        wd.id AS document_id,
        wd.title AS document_title,
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.project_id AS project_id
    FROM public.document_sections ds
    INNER JOIN public.workspace_documents wd ON ds.document_id = wd.id
    INNER JOIN public.workspaces w ON wd.workspace_id = w.id
    WHERE ds.assigned_to = user_id_param
    ORDER BY ds.deadline ASC NULLS LAST;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_assigned_sections_for_user TO authenticated;

COMMENT ON FUNCTION public.get_assigned_sections_for_user IS 'Returns all sections assigned to a user with their document and workspace information. Avoids Supabase REST API relationship ambiguity.';
