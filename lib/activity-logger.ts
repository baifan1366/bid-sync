import { createClient, createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Activity logging utility for tracking user and admin actions
 * Captures IP address, user agent, and metadata in a standard format
 */

export interface LogActivityParams {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs a user activity to the database
 * Automatically captures IP address and user agent from request headers
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const { userId, action, resourceType, resourceId, metadata } = params;

  try {
    // Use admin client to bypass RLS for logging
    const supabase = createAdminClient();
    const headersList = await headers();

    // Capture IP address from headers
    const ipAddress = 
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      null;

    // Capture user agent
    const userAgent = headersList.get('user-agent') || null;

    // Insert activity log
    const { error } = await supabase
      .from('user_activity_logs')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: metadata || null,
      });

    if (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * Logs an admin action to the admin_actions audit table
 */
export interface LogAdminActionParams {
  adminId: string;
  actionType: string;
  targetUserId?: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  reason?: string;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const { adminId, actionType, targetUserId, previousValue, newValue, reason } = params;

  try {
    // Use admin client to bypass RLS for logging
    const supabase = createAdminClient();

    // Insert admin action log
    const { error } = await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminId,
        action_type: actionType,
        target_user_id: targetUserId || null,
        previous_value: previousValue || null,
        new_value: newValue || null,
        reason: reason || null,
      });

    if (error) {
      console.error('Failed to log admin action:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  } catch (error) {
    console.error('Error in logAdminAction:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}
