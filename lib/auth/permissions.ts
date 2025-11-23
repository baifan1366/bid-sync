import { UserRole, ROLES } from '@/lib/roles/constants'

// Permission types
export type Permission =
  | 'view_profile'
  | 'edit_profile'
  | 'create_project'
  | 'manage_project'
  | 'submit_proposal'
  | 'manage_team'
  | 'access_admin_panel'
  | 'verify_users'
  | 'view_analytics'

// Permission map for each role
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  client: [
    'view_profile',
    'edit_profile',
    'create_project',
    'manage_project',
  ],
  bidding_member: [
    'view_profile',
    'edit_profile',
    'submit_proposal',
  ],
  bidding_lead: [
    'view_profile',
    'edit_profile',
    'submit_proposal',
    'manage_team',
  ],
  admin: [
    'view_profile',
    'edit_profile',
    'create_project',
    'manage_project',
    'submit_proposal',
    'manage_team',
    'access_admin_panel',
    'verify_users',
    'view_analytics',
  ],
}

/**
 * Check if a user can edit a specific profile
 * Users can only edit their own profiles, admins can edit any profile
 */
export function canEditProfile(
  currentUserId: string,
  targetUserId: string,
  role?: UserRole
): boolean {
  // Users can always edit their own profile
  if (currentUserId === targetUserId) {
    return true
  }
  
  // Admins can edit any profile
  if (role === ROLES.ADMIN) {
    return true
  }
  
  return false
}

/**
 * Check if a user can view a specific profile
 * All authenticated users can view profiles in the same project/team
 * For now, allow all authenticated users to view profiles
 */
export function canViewProfile(
  currentUserId: string,
  targetUserId: string,
  role?: UserRole
): boolean {
  // All authenticated users can view profiles
  return true
}

/**
 * Get all permissions for a given role
 */
export function getUserPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getUserPermissions(role)
  return permissions.includes(permission)
}

/**
 * Check multiple permissions (user must have ALL of them)
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  const userPermissions = getUserPermissions(role)
  return permissions.every(p => userPermissions.includes(p))
}

/**
 * Check multiple permissions (user must have ANY of them)
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const userPermissions = getUserPermissions(role)
  return permissions.some(p => userPermissions.includes(p))
}
