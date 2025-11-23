import { createClient } from "@/lib/supabase/server"
import { UserRole } from "@/lib/roles/constants"
import type { UserProfileData } from "@/types/user"
import type { User } from "@supabase/supabase-js"

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

/**
 * Get user with full profile information
 * @param userId - Optional user ID, defaults to current user
 */
export async function getUserWithProfile(userId?: string): Promise<UserProfileData | null> {
  const supabase = await createClient()
  
  let user: User | null = null
  
  if (userId) {
    // If userId is provided, we'd need admin access to fetch other users
    // For now, just get current user
    const { data } = await supabase.auth.getUser()
    user = data.user
  } else {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  
  if (!user) return null
  
  const metadata = user.user_metadata
  
  // Build profile based on role
  const baseProfile = {
    id: user.id,
    email: user.email!,
    role: metadata?.role as UserRole,
    full_name: metadata?.full_name || '',
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
  
  if (metadata?.role === 'client') {
    return {
      ...baseProfile,
      role: 'client',
      client_type: metadata.client_type,
      business_name: metadata.business_name,
      company_registration: metadata.company_registration,
    }
  } else if (metadata?.role === 'bidding_lead' || metadata?.role === 'bidding_member') {
    return {
      ...baseProfile,
      role: metadata.role,
      professional_title: metadata.professional_title,
      company_name: metadata.company_name,
    }
  } else if (metadata?.role === 'admin') {
    return {
      ...baseProfile,
      role: 'admin',
    }
  }
  
  return null
}

/**
 * Get the current user's role
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const user = await getUser()
  return user?.user_metadata?.role as UserRole || null
}
