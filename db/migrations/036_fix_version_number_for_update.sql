-- ============================================================
-- Migration: Fix version number generation FOR UPDATE issue
-- Description: Fix the get_next_version_number function to avoid
--              using FOR UPDATE with aggregate functions
-- ============================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_next_version_number(UUID);

-- Create improved function without FOR UPDATE on aggregate
-- Instead, we lock the document row itself
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_document_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_version INT;
BEGIN
    -- Lock the document row to prevent concurrent version creation
    PERFORM 1 FROM public.workspace_documents 
    WHERE id = p_document_id 
    FOR UPDATE;
    
    -- Now safely get the next version number
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

COMMENT ON FUNCTION public.get_next_version_number(UUID) IS 
'Gets the next version number for a document by locking the document row to prevent race conditions';

-- Also fix the create_document_version_safe function
DROP FUNCTION IF EXISTS public.create_document_version_safe(UUID, JSONB, UUID, TEXT, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.create_document_version_safe(
    p_document_id UUID,
    p_content JSONB,
    p_created_by UUID,
    p_changes_summary TEXT DEFAULT NULL,
    p_is_rollback BOOLEAN DEFAULT FALSE,
    p_rolled_back_from UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_version_id UUID;
    v_version_number INT;
    v_retry_count INT := 0;
    v_max_retries INT := 3;
BEGIN
    -- Retry loop to handle race conditions
    LOOP
        BEGIN
            -- Lock the document row to prevent concurrent version creation
            PERFORM 1 FROM public.workspace_documents 
            WHERE id = p_document_id 
            FOR UPDATE;
            
            -- Get next version number
            SELECT COALESCE(MAX(version_number), 0) + 1 
            INTO v_version_number 
            FROM public.document_versions 
            WHERE document_id = p_document_id;
            
            -- Insert the version
            INSERT INTO public.document_versions (
                document_id,
                version_number,
                content,
                created_by,
                changes_summary,
                is_rollback,
                rolled_back_from
            ) VALUES (
                p_document_id,
                v_version_number,
                p_content,
                p_created_by,
                p_changes_summary,
                p_is_rollback,
                p_rolled_back_from
            )
            RETURNING id INTO v_version_id;
            
            -- Success - exit loop
            EXIT;
            
        EXCEPTION
            WHEN unique_violation THEN
                -- Duplicate key error - retry if we haven't exceeded max retries
                v_retry_count := v_retry_count + 1;
                
                IF v_retry_count >= v_max_retries THEN
                    -- Max retries exceeded - raise error
                    RAISE EXCEPTION 'Failed to create version after % retries due to concurrent updates', v_max_retries;
                END IF;
                
                -- Wait a tiny bit before retrying (helps with high concurrency)
                PERFORM pg_sleep(0.01 * v_retry_count);
        END;
    END LOOP;
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_document_version_safe(UUID, JSONB, UUID, TEXT, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_document_version_safe(UUID, JSONB, UUID, TEXT, BOOLEAN, UUID) TO service_role;

COMMENT ON FUNCTION public.create_document_version_safe IS 
'Safely creates a document version with automatic retry on race conditions';
