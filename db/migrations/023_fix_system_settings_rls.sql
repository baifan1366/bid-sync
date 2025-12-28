-- ============================================================
-- MIGRATION 023: FIX SYSTEM SETTINGS RLS POLICIES
-- ============================================================
-- Fixes "permission denied for table users" error by using auth.jwt()
-- instead of querying auth.users directly

-- Drop existing policies
DROP POLICY IF EXISTS "system_settings_admin_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_update" ON public.system_settings;

-- Recreate policies using auth.jwt() to avoid permission issues
CREATE POLICY "system_settings_admin_select" ON public.system_settings
FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "system_settings_admin_update" ON public.system_settings
FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
) WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Add INSERT policy for initial setup (if needed)
CREATE POLICY "system_settings_admin_insert" ON public.system_settings
FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

COMMENT ON POLICY "system_settings_admin_select" ON public.system_settings IS 'Allow admins to read system settings using JWT metadata';
COMMENT ON POLICY "system_settings_admin_update" ON public.system_settings IS 'Allow admins to update system settings using JWT metadata';
COMMENT ON POLICY "system_settings_admin_insert" ON public.system_settings IS 'Allow admins to insert system settings using JWT metadata';
