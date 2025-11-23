-- ============================================================
-- PERFORMANCE OPTIMIZATION MIGRATION
-- ============================================================
-- This migration adds indexes to optimize common queries for
-- user management, filtering, and search operations

-- ============================================================
-- 1. INDEXES ON AUTH.USERS METADATA
-- ============================================================

-- Index for filtering by role (used in user list filtering)
-- This uses a GIN index on the JSONB column for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_role 
ON auth.users USING GIN ((raw_user_meta_data->'role'));

-- Index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_users_verification_status 
ON auth.users USING GIN ((raw_user_meta_data->'verification_status'));

-- Index for filtering by suspension status
CREATE INDEX IF NOT EXISTS idx_users_is_suspended 
ON auth.users USING GIN ((raw_user_meta_data->'is_suspended'));

-- ============================================================
-- 2. COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================================

-- Composite index for role + verification status filtering
-- This optimizes queries that filter by both role and verification status
CREATE INDEX IF NOT EXISTS idx_users_role_verification 
ON auth.users USING GIN (
  (raw_user_meta_data->'role'),
  (raw_user_meta_data->'verification_status')
);

-- Index for email search (case-insensitive)
-- This optimizes search queries on email field
CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON auth.users (LOWER(email));

-- Index for created_at for date range filtering and sorting
CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON auth.users (created_at DESC);

-- Index for last_sign_in_at for activity tracking
CREATE INDEX IF NOT EXISTS idx_users_last_sign_in 
ON auth.users (last_sign_in_at DESC NULLS LAST);

-- ============================================================
-- 3. FULL TEXT SEARCH INDEXES
-- ============================================================

-- Index for full name search in metadata
CREATE INDEX IF NOT EXISTS idx_users_full_name 
ON auth.users USING GIN (
  to_tsvector('english', COALESCE(raw_user_meta_data->>'full_name', ''))
);

-- Index for company name search in metadata
CREATE INDEX IF NOT EXISTS idx_users_company_name 
ON auth.users USING GIN (
  to_tsvector('english', COALESCE(raw_user_meta_data->>'company_name', ''))
);

-- ============================================================
-- 4. HELPER FUNCTION FOR OPTIMIZED USER SEARCH
-- ============================================================

-- Function to search users efficiently across multiple fields
CREATE OR REPLACE FUNCTION public.search_users(
  search_query TEXT,
  filter_role TEXT DEFAULT NULL,
  filter_verification_status TEXT DEFAULT NULL,
  filter_is_suspended BOOLEAN DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  verification_status TEXT,
  full_name TEXT,
  company_name TEXT,
  is_suspended BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'role' as role,
    u.raw_user_meta_data->>'verification_status' as verification_status,
    u.raw_user_meta_data->>'full_name' as full_name,
    u.raw_user_meta_data->>'company_name' as company_name,
    COALESCE((u.raw_user_meta_data->>'is_suspended')::BOOLEAN, false) as is_suspended,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  WHERE 
    -- Search filter
    (
      search_query IS NULL OR
      search_query = '' OR
      LOWER(u.email) LIKE LOWER('%' || search_query || '%') OR
      LOWER(u.raw_user_meta_data->>'full_name') LIKE LOWER('%' || search_query || '%') OR
      LOWER(u.raw_user_meta_data->>'company_name') LIKE LOWER('%' || search_query || '%')
    )
    -- Role filter
    AND (filter_role IS NULL OR u.raw_user_meta_data->>'role' = filter_role)
    -- Verification status filter
    AND (filter_verification_status IS NULL OR u.raw_user_meta_data->>'verification_status' = filter_verification_status)
    -- Suspension filter
    AND (filter_is_suspended IS NULL OR COALESCE((u.raw_user_meta_data->>'is_suspended')::BOOLEAN, false) = filter_is_suspended)
  ORDER BY u.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. STATISTICS HELPER FUNCTIONS
-- ============================================================

-- Function to get user statistics (optimized with indexes)
CREATE OR REPLACE FUNCTION public.get_user_statistics()
RETURNS TABLE (
  total_users BIGINT,
  total_clients BIGINT,
  total_leads BIGINT,
  total_members BIGINT,
  total_admins BIGINT,
  pending_verifications BIGINT,
  verified_users BIGINT,
  suspended_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'client') as total_clients,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'bidding_lead') as total_leads,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'bidding_member') as total_members,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'admin') as total_admins,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'verification_status' = 'pending_verification') as pending_verifications,
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'verification_status' = 'verified') as verified_users,
    COUNT(*) FILTER (WHERE COALESCE((raw_user_meta_data->>'is_suspended')::BOOLEAN, false) = true) as suspended_users
  FROM auth.users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON FUNCTION public.search_users IS 'Optimized function for searching and filtering users with pagination';
COMMENT ON FUNCTION public.get_user_statistics IS 'Returns aggregated statistics about users for dashboard display';

-- ============================================================
-- 7. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================

-- Update statistics for the query planner to use the new indexes effectively
ANALYZE auth.users;
ANALYZE public.admin_invitations;
ANALYZE public.user_activity_logs;
ANALYZE public.admin_actions;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
