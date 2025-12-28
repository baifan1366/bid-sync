-- ============================================================
-- MIGRATION 021: SYSTEM SETTINGS TABLE
-- ============================================================

-- System Settings Table for admin configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    email JSONB NOT NULL DEFAULT '{
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_user": "",
        "from_email": "noreply@bidsync.com"
    }'::jsonb,
    notifications JSONB NOT NULL DEFAULT '{
        "enable_email_notifications": true,
        "enable_proposal_notifications": true,
        "enable_project_notifications": true,
        "enable_admin_notifications": true
    }'::jsonb,
    security JSONB NOT NULL DEFAULT '{
        "require_email_verification": true,
        "require_client_verification": true,
        "session_timeout_minutes": 60,
        "max_login_attempts": 5
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    CONSTRAINT system_settings_single_row CHECK (id = 1)
);

-- Insert default settings row
INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can read/write
-- Use auth.jwt() to avoid permission issues with auth.users table
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

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_system_settings_timestamp ON public.system_settings;
CREATE TRIGGER trigger_update_system_settings_timestamp
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_system_settings_timestamp();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_updated ON public.system_settings(updated_at DESC);

COMMENT ON TABLE public.system_settings IS 'Stores system-wide configuration settings for the platform. Only one row allowed (id=1).';
COMMENT ON COLUMN public.system_settings.email IS 'Email/SMTP configuration settings';
COMMENT ON COLUMN public.system_settings.notifications IS 'Global notification settings';
COMMENT ON COLUMN public.system_settings.security IS 'Security-related settings';
