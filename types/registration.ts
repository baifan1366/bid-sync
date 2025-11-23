// Registration and invitation type definitions

export type ClientType = 'business' | 'individual'

export interface ClientRegistration {
  role: 'client'
  client_type: ClientType
  full_name: string
  business_name?: string  // Required for business type
  company_registration?: string
}

export interface BiddingTeamRegistration {
  role: 'bidding_lead' | 'bidding_member'
  full_name: string
  professional_title?: string
  company_name?: string
}

export type RegistrationData = ClientRegistration | BiddingTeamRegistration

export interface TeamInvitation {
  id: string
  project_id: string
  created_by: string
  code: string
  token: string
  expires_at: string
  used_by?: string
  used_at?: string
  is_multi_use: boolean
  created_at: string
}

export interface InvitationValidation {
  valid: boolean
  invitation?: TeamInvitation
  error?: 'expired' | 'used' | 'not_found' | 'unknown'
  project?: {
    id: string
    title: string
  }
  team?: {
    lead_name: string
    member_count: number
  }
}

export interface CreateInvitationRequest {
  project_id: string
  type: 'link' | 'code'
  is_multi_use?: boolean
  custom_expiry_hours?: number
}

export interface CreateInvitationResponse {
  invitation: TeamInvitation
  share_url?: string  // Full URL for link type
  display_code?: string  // Formatted code for code type
}
