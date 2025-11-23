export type UserRole = 'client' | 'bidding_member' | 'bidding_lead' | 'admin'
export type ClientType = 'business' | 'individual'

export const ROLES = {
  CLIENT: 'client' as UserRole,
  BIDDING_MEMBER: 'bidding_member' as UserRole,
  BIDDING_LEAD: 'bidding_lead' as UserRole,
  ADMIN: 'admin' as UserRole,
} as const

export const CLIENT_TYPES = {
  BUSINESS: 'business' as ClientType,
  INDIVIDUAL: 'individual' as ClientType,
} as const
