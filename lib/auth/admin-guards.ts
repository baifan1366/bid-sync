import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLES } from '@/lib/roles/constants'

/**
 * Log unauthorized access attempts
 */
async function logUnauthorizedAccess(
  userId: string | undefined,
  attemptedPath: string,
  reason: string
) {
  try {
    const supabase = await createClient()
    
    await supabase.from('user_activity_logs').insert({
      user_id: userId || null,
      action: 'unauthorized_access_attempt',
      resource_type: 'admin_route',
      resource_id: null,
      metadata: {
        attempted_path: attemptedPath,
        reason,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Log error but don't throw - logging failure shouldn't block the guard
    console.error('Failed to log unauthorized access:', error)
  }
}

/**
 * Server-side admin guard for page components
 * Verifies user is authenticated and has admin role
 * Redirects non-admins to unauthorized page
 * Logs unauthorized access attempts
 * 
 * @param redirectPath - Optional custom redirect path (defaults to '/unauthorized')
 * @returns User object if authorized
 */
export async function requireAdmin(redirectPath: string = '/unauthorized') {
  const supabase = await createClient()
  
  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // Not authenticated
  if (authError || !user) {
    await logUnauthorizedAccess(
      undefined,
      'admin_route',
      'not_authenticated'
    )
    redirect('/login')
  }

  // Check admin role
  const role = user.user_metadata?.role
  
  if (role !== ROLES.ADMIN) {
    await logUnauthorizedAccess(
      user.id,
      'admin_route',
      `insufficient_permissions: role=${role}`
    )
    redirect(redirectPath)
  }

  return user
}

/**
 * Check if current user is admin without redirecting
 * Useful for conditional rendering
 * 
 * @returns true if user is admin, false otherwise
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const role = user.user_metadata?.role
    return role === ROLES.ADMIN
  } catch {
    return false
  }
}

/**
 * Get current admin user or null
 * Does not redirect, useful for API routes
 * 
 * @returns User object if admin, null otherwise
 */
export async function getAdminUser() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const role = user.user_metadata?.role
    if (role !== ROLES.ADMIN) return null

    return user
  } catch {
    return null
  }
}

/**
 * Verify admin role for API routes
 * Throws error if not authorized
 * 
 * @throws Error with appropriate message if not authorized
 * @returns User object if authorized
 */
export async function verifyAdminForAPI() {
  const supabase = await createClient()
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    await logUnauthorizedAccess(
      undefined,
      'admin_api',
      'not_authenticated'
    )
    throw new Error('UNAUTHORIZED: Authentication required')
  }

  const role = user.user_metadata?.role
  
  if (role !== ROLES.ADMIN) {
    await logUnauthorizedAccess(
      user.id,
      'admin_api',
      `insufficient_permissions: role=${role}`
    )
    throw new Error('UNAUTHORIZED: Admin access required')
  }

  return user
}
