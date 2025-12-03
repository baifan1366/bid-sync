/**
 * Supabase Service Role Client
 * 
 * This module provides a Supabase client with service role privileges
 * for use in background jobs, cron tasks, and server-side operations
 * that don't have access to user sessions or cookies.
 * 
 * IMPORTANT: This client bypasses Row Level Security (RLS) policies.
 * Use with caution and only in trusted server-side code.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service role key
 * 
 * This client:
 * - Bypasses RLS policies
 * - Has full database access
 * - Should only be used in server-side code
 * - Does not require user authentication
 * 
 * Use cases:
 * - Background jobs
 * - Cron tasks
 * - Admin operations
 * - System maintenance
 * 
 * @returns Supabase client with service role privileges
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase credentials. Required environment variables:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL\n' +
      '  - SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Alias for createServiceRoleClient for consistency with existing code
 */
export const createAdminClient = createServiceRoleClient;
