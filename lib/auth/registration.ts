import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { RegistrationData, TeamInvitation } from '@/types/registration'

/**
 * Generate a random 8-digit invitation code
 */
export function generateInvitationCode(): string {
  const min = 10000000 // 10,000,000
  const max = 99999999 // 99,999,999
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

/**
 * Format an 8-digit code for display (e.g., "1234 5678")
 */
export function formatInvitationCode(code: string): string {
  if (code.length !== 8) return code
  return `${code.slice(0, 4)} ${code.slice(4)}`
}

/**
 * Parse a formatted invitation code back to 8 digits
 */
export function parseInvitationCode(formatted: string): string {
  return formatted.replace(/\s+/g, '')
}

/**
 * Check if user has completed registration
 */
export function isRegistrationComplete(user: User | null): boolean {
  if (!user) return false
  
  const role = user.user_metadata?.role
  if (!role) return false
  
  // Check if user has full_name
  if (!user.user_metadata?.full_name) return false
  
  // For clients, check client_type
  if (role === 'client' && !user.user_metadata?.client_type) {
    return false
  }
  
  // For business clients, check business_name
  if (
    role === 'client' &&
    user.user_metadata?.client_type === 'business' &&
    !user.user_metadata?.business_name
  ) {
    return false
  }
  
  return true
}

/**
 * Complete user registration by updating metadata
 */
export async function completeUserRegistration(
  userId: string,
  data: RegistrationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    // Update user metadata
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: data,
    })
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Validate an invitation by code or token
 */
export async function validateInvitation(
  codeOrToken: string
): Promise<{
  valid: boolean
  invitation?: TeamInvitation
  error?: 'expired' | 'used' | 'not_found' | 'unknown'
}> {
  try {
    const supabase = await createClient()
    
    // Check if it's a code (8 digits) or token (UUID)
    const isCode = /^\d{8}$/.test(codeOrToken)
    
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq(isCode ? 'code' : 'token', codeOrToken)
      .single()
    
    if (error || !invitation) {
      return { valid: false, error: 'not_found' }
    }
    
    // Check if expired
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (now > expiresAt) {
      return { valid: false, invitation, error: 'expired' }
    }
    
    // Check if used (and not multi-use)
    if (invitation.used_by && !invitation.is_multi_use) {
      return { valid: false, invitation, error: 'used' }
    }
    
    return { valid: true, invitation }
  } catch (error) {
    console.error('Error validating invitation:', error)
    return { valid: false, error: 'unknown' }
  }
}

/**
 * Get default expiry time for invitation type
 */
export function getDefaultExpiry(type: 'link' | 'code'): Date {
  const now = new Date()
  const hours = type === 'link' ? 24 * 7 : 24 // 7 days for links, 24 hours for codes
  return new Date(now.getTime() + hours * 60 * 60 * 1000)
}

/**
 * Generate a shareable invitation URL
 */
export function generateInvitationUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/join/${token}`
}
