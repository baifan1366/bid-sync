-- ============================================================
-- SECTION-BASED LOCKING AND PROGRESS TRACKING MIGRATION
-- ============================================================
-- This migration adds support for section-based locking and progress
-- tracking within collaborative documents, enabling fine-grained
-- editing control and deadline management

-- ============================================================
-- 1. DOCUMENT_SECTIONS TABLE
-- ============================================================
-- Sections within documents that can be locked and tracked independently
CREATE TABLE IF NOT EXISTS public.document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'in_review', 'completed')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT document_sections_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT document_sections_assigned_to_fk FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
    CONSTRAINT document_sections_order_positive CHECK ("order" >= 0)
);

-- ============================================================
-- 2. SECTION_LOCKS TABLE
-- ============================================================
-- Distributed locks for section-based editing coordination
CREATE TABLE IF NOT EXISTS public.section_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT section_locks_section_fk FOREIGN KEY (section_id) REFERENCES public.document_sections(id),
    CONSTRAINT section_locks_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT section_locks_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id),
    CONSTRAINT section_locks_expires_after_acquired CHECK (expires_at > acquired_at)
);

-- ============================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================

-- Document sections indexes
CREATE INDEX IF NOT EXISTS idx_document_sections_document ON public.document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_order ON public.document_sections(document_id, "order");
CREATE INDEX IF NOT EXISTS idx_document_sections_status ON public.document_sections(document_id, status);
CREATE INDEX IF NOT EXISTS idx_document_sections_assigned ON public.document_sections(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_deadline ON public.document_sections(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_updated ON public.document_sections(updated_at DESC);

-- Section locks indexes - critical for lock acquisition performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_locks_active_section ON public.section_locks(section_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_section_locks_document ON public.section_locks(document_id);
CREATE INDEX IF NOT EXISTS idx_section_locks_user ON public.section_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_section_locks_expires ON public.section_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_section_locks_heartbeat ON public.section_locks(last_heartbeat);

-- ============================================================
-- 4. DATABASE FUNCTIONS
-- ============================================================

-- Function to update section updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_section_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update section timestamp
DROP TRIGGER IF EXISTS trigger_update_section_timestamp ON public.document_sections;
CREATE TRIGGER trigger_update_section_timestamp
    BEFORE UPDATE ON public.document_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_section_timestamp();

-- Function to automatically update section status when edited
CREATE OR REPLACE FUNCTION public.auto_update_section_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update status if content changed and status is 'not_started'
    IF NEW.content IS DISTINCT FROM OLD.content AND OLD.status = 'not_started' THEN
        NEW.status = 'in_progress';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update section status
DROP TRIGGER IF EXISTS trigger_auto_update_section_status ON public.document_sections;
CREATE TRIGGER trigger_auto_update_section_status
    BEFORE UPDATE ON public.document_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_update_section_status();

-- Function to acquire a section lock
CREATE OR REPLACE FUNCTION public.acquire_section_lock(
    p_section_id UUID,
    p_document_id UUID,
    p_user_id UUID,
    p_ttl_seconds INT DEFAULT 30
)
RETURNS TABLE(
    success BOOLEAN,
    lock_id UUID,
    locked_by UUID,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_lock_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_existing_lock RECORD;
BEGIN
    -- Clean up expired locks first
    DELETE FROM public.section_locks
    WHERE section_id = p_section_id AND expires_at <= now();
    
    -- Check for existing active lock
    SELECT id, user_id, expires_at INTO v_existing_lock
    FROM public.section_locks
    WHERE section_id = p_section_id AND expires_at > now()
    LIMIT 1;
    
    -- If lock exists and belongs to another user, return failure
    IF v_existing_lock.id IS NOT NULL AND v_existing_lock.user_id != p_user_id THEN
        RETURN QUERY SELECT false, v_existing_lock.id, v_existing_lock.user_id, v_existing_lock.expires_at;
        RETURN;
    END IF;
    
    -- If lock exists and belongs to this user, extend it
    IF v_existing_lock.id IS NOT NULL AND v_existing_lock.user_id = p_user_id THEN
        v_expires_at := now() + (p_ttl_seconds || ' seconds')::INTERVAL;
        UPDATE public.section_locks
        SET expires_at = v_expires_at, last_heartbeat = now()
        WHERE id = v_existing_lock.id;
        
        RETURN QUERY SELECT true, v_existing_lock.id, p_user_id, v_expires_at;
        RETURN;
    END IF;
    
    -- Create new lock
    v_lock_id := gen_random_uuid();
    v_expires_at := now() + (p_ttl_seconds || ' seconds')::INTERVAL;
    
    INSERT INTO public.section_locks (id, section_id, document_id, user_id, expires_at)
    VALUES (v_lock_id, p_section_id, p_document_id, p_user_id, v_expires_at);
    
    RETURN QUERY SELECT true, v_lock_id, p_user_id, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release a section lock
CREATE OR REPLACE FUNCTION public.release_section_lock(
    p_section_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks
    WHERE section_id = p_section_id AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update lock heartbeat
CREATE OR REPLACE FUNCTION public.update_lock_heartbeat(
    p_lock_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_count INT;
BEGIN
    UPDATE public.section_locks
    SET last_heartbeat = now(),
        expires_at = now() + INTERVAL '30 seconds'
    WHERE id = p_lock_id AND user_id = p_user_id AND expires_at > now();
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get lock status for a section
CREATE OR REPLACE FUNCTION public.get_section_lock_status(
    p_section_id UUID
)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_by UUID,
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Clean up expired locks first
    DELETE FROM public.section_locks
    WHERE section_id = p_section_id AND expires_at <= now();
    
    RETURN QUERY
    SELECT 
        true as is_locked,
        sl.user_id as locked_by,
        sl.acquired_at as locked_at,
        sl.expires_at
    FROM public.section_locks sl
    WHERE sl.section_id = p_section_id AND sl.expires_at > now()
    LIMIT 1;
    
    -- If no active lock found, return unlocked status
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS INT AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks
    WHERE expires_at <= now();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release all locks for a user
CREATE OR REPLACE FUNCTION public.release_user_locks(
    p_user_id UUID
)
RETURNS INT AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate document progress
CREATE OR REPLACE FUNCTION public.calculate_document_progress(
    p_document_id UUID
)
RETURNS TABLE(
    total_sections INT,
    not_started INT,
    in_progress INT,
    in_review INT,
    completed INT,
    completion_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_sections,
        COUNT(*) FILTER (WHERE status = 'not_started')::INT as not_started,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INT as in_progress,
        COUNT(*) FILTER (WHERE status = 'in_review')::INT as in_review,
        COUNT(*) FILTER (WHERE status = 'completed')::INT as completed,
        CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        END as completion_percentage
    FROM public.document_sections
    WHERE document_id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get upcoming deadlines
CREATE OR REPLACE FUNCTION public.get_upcoming_deadlines(
    p_document_id UUID,
    p_hours_ahead INT DEFAULT 24
)
RETURNS TABLE(
    section_id UUID,
    title TEXT,
    deadline TIMESTAMPTZ,
    assigned_to UUID,
    status TEXT,
    is_overdue BOOLEAN,
    hours_remaining NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id as section_id,
        ds.title,
        ds.deadline,
        ds.assigned_to,
        ds.status,
        (ds.deadline < now()) as is_overdue,
        ROUND(EXTRACT(EPOCH FROM (ds.deadline - now())) / 3600, 2) as hours_remaining
    FROM public.document_sections ds
    WHERE ds.document_id = p_document_id
        AND ds.deadline IS NOT NULL
        AND ds.deadline <= now() + (p_hours_ahead || ' hours')::INTERVAL
        AND ds.status != 'completed'
    ORDER BY ds.deadline ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_locks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES FOR DOCUMENT_SECTIONS
-- ============================================================

-- Collaborators can view sections of documents they have access to
CREATE POLICY "document_sections_collaborator_select" ON public.document_sections
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Editors and owners can create sections
CREATE POLICY "document_sections_editor_insert" ON public.document_sections
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
);

-- Editors and owners can update sections
CREATE POLICY "document_sections_editor_update" ON public.document_sections
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
);

-- Owners can delete sections
CREATE POLICY "document_sections_owner_delete" ON public.document_sections
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 7. RLS POLICIES FOR SECTION_LOCKS
-- ============================================================

-- Collaborators can view locks on documents they have access to
CREATE POLICY "section_locks_collaborator_select" ON public.section_locks
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = section_locks.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Collaborators can create locks (via function)
CREATE POLICY "section_locks_collaborator_insert" ON public.section_locks
FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = section_locks.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
);

-- Users can update their own locks (heartbeat)
CREATE POLICY "section_locks_user_update" ON public.section_locks
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own locks
CREATE POLICY "section_locks_user_delete" ON public.section_locks
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- END OF MIGRATION
-- ============================================================
