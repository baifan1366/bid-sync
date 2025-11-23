-- ============================================================
-- CREATE DEFAULT ADMIN USER
-- ============================================================
-- This migration creates a default admin user for initial system access
-- 
-- Default Credentials:
-- Email: admin@bidsync.com
-- Password: Admin123!@#
-- 
-- IMPORTANT: Change this password immediately after first login!
-- ============================================================

-- Create default admin user
-- Note: This uses Supabase's admin_create_user function
-- If this function is not available, you'll need to create the user
-- through the Supabase Dashboard or Auth API

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check if admin user already exists
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'weixuan.chong@gmail.com';
    
    IF v_user_id IS NULL THEN
        -- Create the admin user
        -- Note: In production Supabase, you may need to use the Auth API instead
        SELECT auth.admin_create_user(
            email := 'weixuan.chong@gmail.com',
            password := 'Admin123!@#',
            email_confirm := true,
            user_metadata := jsonb_build_object(
                'role', 'admin',
                'full_name', 'System Administrator',
                'verification_status', 'verified',
                'is_suspended', false,
                'last_activity_at', now()::text
            )
        ) INTO v_user_id;
        
        RAISE NOTICE 'Default admin user created successfully with ID: %', v_user_id;
        RAISE NOTICE 'Email: weixuan.chong@gmail.com';
        RAISE NOTICE 'Password: Admin123!@#';
        RAISE NOTICE 'IMPORTANT: Please change this password immediately after first login!';
    ELSE
        RAISE NOTICE 'Admin user already exists with ID: %', v_user_id;
    END IF;
END $$;

-- ============================================================
-- ALTERNATIVE: Manual User Creation (if auth.admin_create_user is not available)
-- ============================================================
-- If the above doesn't work, you can create the user manually through:
-- 
-- 1. Supabase Dashboard:
--    - Go to Authentication > Users
--    - Click "Add User"
--    - Email: admin@bidsync.com
--    - Password: Admin123!@#
--    - Auto Confirm User: Yes
--    - User Metadata (JSON):
--      {
--        "role": "admin",
--        "full_name": "System Administrator",
--        "verification_status": "verified",
--        "is_suspended": false
--      }
--
-- 2. Or use the Supabase Auth API from your application
--
-- ============================================================

-- Log the admin creation in activity logs (if user was created)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'admin@bidsync.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Log the initial admin creation
        INSERT INTO public.user_activity_logs (
            user_id,
            action,
            resource_type,
            metadata
        ) VALUES (
            v_user_id,
            'admin_account_created',
            'user',
            jsonb_build_object(
                'created_by', 'system',
                'is_default_admin', true,
                'note', 'Default admin user created during system initialization'
            )
        );
    END IF;
END $$;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
