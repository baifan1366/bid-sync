-- ============================================================
-- ENABLE REALTIME FOR CHAT MESSAGES
-- ============================================================
-- This script enables Supabase Realtime for the chat_messages table
-- so that messages appear instantly without page refresh.
-- ============================================================

-- Step 1: Enable REPLICA IDENTITY FULL
-- This is required for Realtime to track changes
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Step 2: Add table to supabase_realtime publication
-- This tells Supabase to broadcast changes to this table
DO $$
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        -- Add table to publication
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
        RAISE NOTICE 'chat_messages added to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'chat_messages already in supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'supabase_realtime publication does not exist';
        RAISE NOTICE 'Please enable Realtime in Supabase Dashboard first';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- Step 3: Verify the setup
SELECT 
    schemaname,
    tablename,
    'Enabled' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'chat_messages';

-- ============================================================
-- ADDITIONAL TABLES THAT SHOULD HAVE REALTIME ENABLED
-- ============================================================

-- Enable for proposals (for status updates)
ALTER TABLE public.proposals REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'proposals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
        RAISE NOTICE 'proposals added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding proposals: %', SQLERRM;
END $$;

-- Enable for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        RAISE NOTICE 'notifications added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding notifications: %', SQLERRM;
END $$;

-- Enable for notification_queue
ALTER TABLE public.notification_queue REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notification_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_queue;
        RAISE NOTICE 'notification_queue added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding notification_queue: %', SQLERRM;
END $$;

-- Enable for document_versions (for collaborative editing)
ALTER TABLE public.document_versions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'document_versions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.document_versions;
        RAISE NOTICE 'document_versions added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding document_versions: %', SQLERRM;
END $$;

-- Enable for collaboration_sessions (for presence)
ALTER TABLE public.collaboration_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'collaboration_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_sessions;
        RAISE NOTICE 'collaboration_sessions added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding collaboration_sessions: %', SQLERRM;
END $$;

-- Enable for section_locks (for collaborative editing)
ALTER TABLE public.section_locks REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'section_locks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.section_locks;
        RAISE NOTICE 'section_locks added to supabase_realtime publication';
    END IF;
EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN OTHERS THEN RAISE NOTICE 'Error adding section_locks: %', SQLERRM;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- List all tables with Realtime enabled
SELECT 
    schemaname,
    tablename,
    'Enabled' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================
-- After running this script:
-- 1. Restart your application
-- 2. Check the browser console for connection status
-- 3. Test sending a message - it should appear instantly
-- 4. If issues persist, check Supabase Dashboard > Database > Replication
-- ============================================================
