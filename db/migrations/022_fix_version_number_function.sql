-- Migration: Fix get_next_version_number function for document versions
-- This creates the correct function with p_document_id parameter

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_next_version_number(UUID);

-- Create the function with correct parameter name
CREATE FUNCTION public.get_next_version_number(p_document_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO v_next_version 
    FROM public.document_versions 
    WHERE document_id = p_document_id;
    
    RETURN v_next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_next_version_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_version_number(UUID) TO service_role;

COMMENT ON FUNCTION public.get_next_version_number(UUID) IS 'Gets the next version number for a document';
