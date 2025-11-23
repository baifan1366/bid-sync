import { UserRole, ClientType } from '@/lib/roles/constants'

// Base user profile interface
export interface UserProfile {
  id: string
  email: string
  role: UserRole
  full_name: string
  created_at?: string
  updated_at?: string
}

// Client-specific profile
export interface ClientProfile extends UserProfile {
  role: 'client'
  client_type: ClientType
  business_name?: string
  company_registration?: string
}

// Bidding team member profile
export interface BiddingTeamProfile extends UserProfile {
  role: 'bidding_lead' | 'bidding_member'
  professional_title?: string
  company_name?: string
}

// Admin profile
export interface AdminProfile extends UserProfile {
  role: 'admin'
}

// Discriminated union of all profile types
export type UserProfileData = ClientProfile | BiddingTeamProfile | AdminProfile

// Profile update data (fields that can be updated)
export interface ProfileUpdateData {
  full_name?: string
  professional_title?: string
  company_name?: string
  business_name?: string
  company_registration?: string
}

// API response types
export interface GetProfileResponse {
  success: boolean
  profile?: UserProfileData
  error?: string
}

export interface UpdateProfileResponse {
  success: boolean
  profile?: UserProfileData
  error?: string
}
