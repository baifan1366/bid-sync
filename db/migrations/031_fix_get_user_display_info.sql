-- ============================================================
-- MIGRATION 031: FIX GET USER DISPLAY INFO FUNCTION
-- ============================================================
-- Fixes type mismatch error by casting email to TEXT

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_display_info(UUID);

-- Recreate function with proper type casting
CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        COALESCE(
            u.raw_user_meta_data->>'name',
            u.raw_user_meta_data->>'full_name',
            u.email::TEXT,
            'Unknown User'
        ) as name,
        u.email::TEXT as email
    FROM auth.users u
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_display_info(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_user_display_info IS 'Returns basic display information for a user (name and email). Used for showing uploader info in attachments and comments.';

-- ============================================================
-- END OF MIGRATION 031
-- ============================================================
