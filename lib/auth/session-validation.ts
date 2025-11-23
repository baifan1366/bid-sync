import { createClient } from '@/lib/supabase/server'

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  // Maximum session age in seconds (24 hours)
  MAX_SESSION_AGE: 24 * 60 * 60,
  // Warning threshold for session expiration (1 hour before expiry)
  EXPIRY_WARNING_THRESHOLD: 60 * 60,
}

export interface SessionStatus {
  isValid: boolean
  isExpired: boolean
  expiresAt: Date | null
  needsRefresh: boolean
  warningThreshold: boolean
}

/**
 * Check if the current session is valid and not expired
 * 
 * @returns SessionStatus object with session information
 */
export async function validateSession(): Promise<SessionStatus> {
  try {
    const supabase = await createClient()
    
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    // No session or error
    if (error || !session) {
      return {
        isValid: false,
        isExpired: true,
        expiresAt: null,
        needsRefresh: true,
        warningThreshold: false,
      }
    }

    // Check expiration
    const expiresAt = new Date(session.expires_at! * 1000)
    const now = new Date()
    const timeUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000

    const isExpired = timeUntilExpiry <= 0
    const warningThreshold = timeUntilExpiry <= SESSION_CONFIG.EXPIRY_WARNING_THRESHOLD
    const needsRefresh = timeUntilExpiry <= SESSION_CONFIG.EXPIRY_WARNING_THRESHOLD

    return {
      isValid: !isExpired,
      isExpired,
      expiresAt,
      needsRefresh,
      warningThreshold,
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return {
      isValid: false,
      isExpired: true,
      expiresAt: null,
      needsRefresh: true,
      warningThreshold: false,
    }
  }
}

/**
 * Refresh the current session
 * Should be called when session is near expiration
 * 
 * @returns true if refresh successful, false otherwise
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error || !data.session) {
      console.error('Session refresh failed:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Session refresh error:', error)
    return false
  }
}

/**
 * Require valid session for admin actions
 * Checks session validity and refreshes if needed
 * 
 * @throws Error if session is invalid or expired
 * @returns SessionStatus if valid
 */
export async function requireValidSession(): Promise<SessionStatus> {
  const status = await validateSession()

  // Session expired - require re-authentication
  if (status.isExpired) {
    throw new Error('SESSION_EXPIRED: Re-authentication required')
  }

  // Session near expiration - try to refresh
  if (status.needsRefresh) {
    const refreshed = await refreshSession()
    if (!refreshed) {
      throw new Error('SESSION_REFRESH_FAILED: Re-authentication required')
    }
  }

  return status
}

/**
 * Get time until session expiration in seconds
 * 
 * @returns seconds until expiration, or null if no session
 */
export async function getSessionTimeRemaining(): Promise<number | null> {
  const status = await validateSession()
  
  if (!status.expiresAt) return null
  
  const now = new Date()
  const timeRemaining = (status.expiresAt.getTime() - now.getTime()) / 1000
  
  return Math.max(0, timeRemaining)
}

/**
 * Check if session needs refresh (within warning threshold)
 * 
 * @returns true if session should be refreshed
 */
export async function shouldRefreshSession(): Promise<boolean> {
  const status = await validateSession()
  return status.needsRefresh && !status.isExpired
}
