import { UserRole, ROLES } from './constants'

export function isAdmin(role?: string | null) {
  return role === ROLES.ADMIN
}

export function isClient(role?: string | null) {
  return role === ROLES.CLIENT
}

export function isBiddingLead(role?: string | null) {
  return role === ROLES.BIDDING_LEAD
}

export function isBiddingMember(role?: string | null) {
  return role === ROLES.BIDDING_MEMBER
}

export function isBiddingTeam(role?: string | null) {
  return role === ROLES.BIDDING_LEAD || role === ROLES.BIDDING_MEMBER
}

export function hasRole(userRole: string | undefined | null, requiredRole: UserRole) {
  return userRole === requiredRole
}

/**
 * Check if user can access admin panel
 */
export function canAccessAdminPanel(role?: string | null): boolean {
  return role === ROLES.ADMIN
}

/**
 * Check if user can create projects (clients only)
 */
export function canCreateProject(role?: string | null): boolean {
  return role === ROLES.CLIENT || role === ROLES.ADMIN
}

/**
 * Check if user can submit proposals (bidding team)
 */
export function canSubmitProposal(role?: string | null): boolean {
  return role === ROLES.BIDDING_LEAD || role === ROLES.BIDDING_MEMBER || role === ROLES.ADMIN
}

/**
 * Check if user can manage team (bidding lead)
 */
export function canManageTeam(role?: string | null): boolean {
  return role === ROLES.BIDDING_LEAD || role === ROLES.ADMIN
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRole: string | undefined | null, roles: UserRole[]): boolean {
  if (!userRole) return false
  return roles.includes(userRole as UserRole)
}
