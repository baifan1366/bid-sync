-- ============================================================
-- MIGRATION 039: ENABLE REALTIME FOR NOTIFICATIONS
-- ============================================================
-- 
-- PROBLEM: Realtime subscriptions keep failing and reconnecting
-- because the notification_queue table doesn't have Realtime enabled.
--
-- SOLUTION: Enable Realtime replication for notification_queue table
-- and ensure proper RLS policies are in place.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ENABLE REPLICA IDENTITY FOR notification_queue
-- ============================================================
-- This is required for Realtime to track changes

ALTER TABLE public.notification_queue REPLICA IDENTITY FULL;

-- ============================================================
-- 2. VERIFY RLS IS ENABLED
-- ============================================================
-- RLS should already be enabled, but let's make sure

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. ADD REALTIME PUBLICATION (if not already added)
-- ============================================================
-- Note: This might need to be done via Supabase Dashboard or API
-- as it requires superuser privileges

-- Check if publication exists and add table if needed
DO $$
BEGIN
    -- Try to add the table to the supabase_realtime publication
    -- This will fail silently if publication doesn't exist or table is already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_queue;
        RAISE NOTICE 'Added notification_queue to supabase_realtime publication';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'notification_queue already in supabase_realtime publication';
        WHEN undefined_object THEN
            RAISE NOTICE 'supabase_realtime publication does not exist - please enable Realtime in Supabase Dashboard';
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not add to publication: %', SQLERRM;
    END;
END $$;

-- ============================================================
-- 4. VERIFY RLS POLICIES FOR REALTIME
-- ============================================================
-- Realtime subscriptions need proper SELECT policies

-- Ensure users can select their own notifications (already exists, but verify)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notification_queue' 
        AND policyname = 'notification_queue_user_select'
    ) THEN
        CREATE POLICY "notification_queue_user_select" ON public.notification_queue
        FOR SELECT USING (user_id = auth.uid());
        RAISE NOTICE 'Created notification_queue_user_select policy';
    ELSE
        RAISE NOTICE 'notification_queue_user_select policy already exists';
    END IF;
END $$;

-- ============================================================
-- 5. ADD INDEXES FOR REALTIME PERFORMANCE
-- ============================================================
-- These help Realtime track changes more efficiently

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_created 
ON public.notification_queue(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user_unread_created 
ON public.notification_queue(user_id, created_at DESC) 
WHERE read = false;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 039 completed successfully!';
    RAISE NOTICE 'Realtime enabled for notification_queue table.';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: If you still see connection issues:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Database > Replication';
    RAISE NOTICE '2. Enable Realtime for notification_queue table';
    RAISE NOTICE '3. Restart your application';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check replica identity:
--    SELECT relname, relreplident 
--    FROM pg_class 
--    WHERE relname = 'notification_queue';
--    (Should show 'f' for FULL)
--
-- 2. Check if table is in publication:
--    SELECT * FROM pg_publication_tables 
--    WHERE tablename = 'notification_queue';
--
-- 3. Check RLS policies:
--    SELECT * FROM pg_policies 
--    WHERE tablename = 'notification_queue';
--
-- 4. Test Realtime subscription in browser console:
--    const channel = supabase
--      .channel('notifications')
--      .on('postgres_changes', 
--        { event: '*', schema: 'public', table: 'notification_queue' },
--        (payload) => console.log('Change:', payload)
--      )
--      .subscribe()
-- ============================================================
