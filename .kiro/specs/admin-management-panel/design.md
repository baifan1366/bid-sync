# Design Document: Admin Management Panel

## Overview

The Admin Management Panel is a comprehensive administrative interface that enables system administrators to manage other administrators, oversee all platform users, verify client registrations, and maintain platform security. This feature is critical for the BidSync platform's operational integrity, as it ensures that only verified clients can post projects and that administrative responsibilities can be properly delegated.

The panel consists of two primary sections:
1. **Admin Management** - For managing administrator accounts and privileges
2. **User Management** - For overseeing all platform users, verifying clients, and managing user accounts

This design integrates seamlessly with the existing Supabase Auth system, GraphQL API, and follows the established BidSync design patterns using Next.js App Router, TanStack Query, and the yellow-black-white color scheme.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard Page                     │
│                  /admin-dashboard/page.tsx                   │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌────────▼────────┐
│  Admin Mgmt Tab │            │  User Mgmt Tab  │
│                 │            │                 │
│ - Admin List    │            │ - User List     │
│ - Add Admin     │            │ - Verification  │
│ - Remove Admin  │            │ - Role Changes  │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
         ┌───────────────▼───────────────┐
         │      GraphQL Resolvers        │
         │                               │
         │ - adminManagement             │
         │ - userManagement              │
         │ - verifyClient                │
         │ - changeUserRole              │
         └───────────────┬───────────────┘
                         │
         ┌───────────────▼───────────────┐
         │    Supabase Database          │
         │                               │
         │ - auth.users                  │
         │ - public.admin_invitations    │
         │ - public.user_activity_logs   │
         │ - public.admin_actions        │
         └───────────────────────────────┘
```

### Component Hierarchy

```
AdminDashboardPage
├── AdminManagementSection
│   ├── AdminList
│   │   ├── AdminCard
│   │   └── RemoveAdminDialog
│   └── AddAdminDialog
│       ├── EmailInput
│       └── InvitationPreview
└── UserManagementSection
    ├── UserFilters
    │   ├── RoleFilter
    │   ├── StatusFilter
    │   └── SearchInput
    ├── UserTable
    │   ├── UserRow
    │   │   ├── UserInfo
    │   │   ├── StatusBadge
    │   │   └── ActionMenu
    │   └── Pagination
    ├── VerificationDialog
    │   ├── DocumentViewer
    │   ├── BusinessInfoDisplay
    │   └── ApprovalActions
    ├── RoleChangeDialog
    └── SuspendUserDialog
```

## Components and Interfaces

### 1. Admin Management Components

#### AdminManagementSection
Main container for admin management functionality.

```typescript
interface AdminManagementSectionProps {
  currentAdminId: string
}

// Displays:
// - List of all admins
// - Add admin button
// - Admin statistics
```

#### AdminList
Displays all administrators with their details.

```typescript
interface Admin {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  lastLoginAt: string | null
  invitedBy: string | null
}

interface AdminListProps {
  admins: Admin[]
  currentAdminId: string
  onRemoveAdmin: (adminId: string) => Promise<void>
}
```

#### AddAdminDialog
Modal for inviting new administrators.

```typescript
interface AddAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (email: string) => Promise<void>
}

interface AdminInvitation {
  email: string
  invitedBy: string
  token: string
  expiresAt: string
}
```

#### RemoveAdminDialog
Confirmation dialog for removing admin privileges.

```typescript
interface RemoveAdminDialogProps {
  admin: Admin
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  isLastAdmin: boolean
  isSelf: boolean
}
```

### 2. User Management Components

#### UserManagementSection
Main container for user management functionality.

```typescript
interface UserManagementSectionProps {
  currentAdminId: string
}
```

#### UserFilters
Filter controls for the user list.

```typescript
interface UserFiltersProps {
  filters: UserFilters
  onFiltersChange: (filters: UserFilters) => void
}

interface UserFilters {
  role: UserRole | 'all'
  verificationStatus: VerificationStatus | 'all'
  searchQuery: string
  dateRange: {
    from: Date | null
    to: Date | null
  }
}

type UserRole = 'client' | 'bidding_lead' | 'bidding_member' | 'admin'
type VerificationStatus = 'pending_verification' | 'verified' | 'rejected'
```

#### UserTable
Table displaying all users with pagination.

```typescript
interface User {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  verificationStatus: VerificationStatus
  verificationReason: string | null
  createdAt: string
  lastActivityAt: string | null
  isActive: boolean
  isSuspended: boolean
}

interface UserTableProps {
  users: User[]
  totalCount: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onUserAction: (userId: string, action: UserAction) => void
}

type UserAction = 
  | { type: 'verify'; approved: boolean; reason?: string }
  | { type: 'changeRole'; newRole: UserRole }
  | { type: 'suspend'; reason: string }
  | { type: 'reactivate' }
  | { type: 'viewActivity' }
```

#### VerificationDialog
Dialog for reviewing and approving/rejecting client verifications.

```typescript
interface VerificationDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onDecision: (approved: boolean, reason?: string) => Promise<void>
}

interface VerificationData {
  businessName: string
  businessType: string
  registrationNumber: string
  documents: VerificationDocument[]
  submittedAt: string
}

interface VerificationDocument {
  id: string
  name: string
  type: 'business_registration' | 'tax_certificate' | 'id_proof' | 'other'
  url: string
  uploadedAt: string
}
```

#### RoleChangeDialog
Dialog for changing a user's role.

```typescript
interface RoleChangeDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newRole: UserRole) => Promise<void>
}
```

#### SuspendUserDialog
Dialog for suspending or deactivating user accounts.

```typescript
interface SuspendUserDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void>
}
```

#### UserActivityLog
Component for viewing detailed user activity.

```typescript
interface UserActivityLogProps {
  userId: string
}

interface ActivityLogEntry {
  id: string
  userId: string
  action: string
  resourceType: string | null
  resourceId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, any>
  createdAt: string
}
```

## Data Models

### Database Schema Extensions

```sql
-- Admin invitations table
CREATE TABLE public.admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES auth.users(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_invitations_email ON public.admin_invitations(email);
CREATE INDEX idx_admin_invitations_token ON public.admin_invitations(token);

-- User activity logs table
CREATE TABLE public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_logs_user ON public.user_activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON public.user_activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.user_activity_logs(action);

-- Admin actions audit log
CREATE TABLE public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX idx_admin_actions_target ON public.admin_actions(target_user_id);
CREATE INDEX idx_admin_actions_created ON public.admin_actions(created_at DESC);

-- Extend auth.users metadata structure
-- The following fields will be stored in raw_user_meta_data:
-- {
--   "role": "client" | "bidding_lead" | "bidding_member" | "admin",
--   "verification_status": "pending_verification" | "verified" | "rejected",
--   "verification_reason": "string",
--   "full_name": "string",
--   "is_suspended": boolean,
--   "suspended_reason": "string",
--   "suspended_at": "timestamp",
--   "suspended_by": "uuid"
-- }
```

### GraphQL Schema Extensions

```graphql
# Extend existing User type
type User {
  id: ID!
  email: String!
  role: UserRole!
  verificationStatus: VerificationStatus!
  verificationReason: String
  fullName: String
  isSuspended: Boolean!
  suspendedReason: String
  suspendedAt: String
  lastActivityAt: String
  createdAt: String!
  updatedAt: String!
}

# Admin-specific types
type Admin {
  id: ID!
  email: String!
  fullName: String
  createdAt: String!
  lastLoginAt: String
  invitedBy: String
}

type AdminInvitation {
  id: ID!
  email: String!
  invitedBy: String!
  token: String!
  expiresAt: String!
  createdAt: String!
}

type UserActivityLog {
  id: ID!
  userId: ID!
  action: String!
  resourceType: String
  resourceId: ID
  ipAddress: String
  userAgent: String
  metadata: JSON
  createdAt: String!
}

type AdminAction {
  id: ID!
  adminId: ID!
  actionType: String!
  targetUserId: ID
  previousValue: JSON
  newValue: JSON
  reason: String
  createdAt: String!
}

type UserListResult {
  users: [User!]!
  totalCount: Int!
  page: Int!
  pageSize: Int!
}

# Queries
extend type Query {
  # Admin management
  allAdmins: [Admin!]!
  adminInvitations: [AdminInvitation!]!
  
  # User management
  allUsers(
    page: Int
    pageSize: Int
    role: UserRole
    verificationStatus: VerificationStatus
    searchQuery: String
  ): UserListResult!
  
  user(id: ID!): User
  userActivityLogs(userId: ID!, limit: Int, offset: Int): [UserActivityLog!]!
  adminActions(limit: Int, offset: Int): [AdminAction!]!
}

# Mutations
extend type Mutation {
  # Admin management
  inviteAdmin(email: String!): AdminInvitation!
  removeAdminPrivileges(userId: ID!): User!
  acceptAdminInvitation(token: String!): User!
  
  # User management
  verifyClient(userId: ID!, approved: Boolean!, reason: String): User!
  changeUserRole(userId: ID!, newRole: UserRole!): User!
  suspendUser(userId: ID!, reason: String!): User!
  reactivateUser(userId: ID!): User!
  
  # Activity logging (called automatically by system)
  logUserActivity(
    userId: ID!
    action: String!
    resourceType: String
    resourceId: ID
    metadata: JSON
  ): UserActivityLog!
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Admin invitation creates valid token
*For any* valid email address provided by an admin, when an admin invitation is created, the system should generate a unique token that expires in the future and can be used exactly once to grant admin privileges.
**Validates: Requirements 1.2, 1.3**

### Property 2: Duplicate admin prevention
*For any* email address that already has admin role, attempting to invite that email as an admin should be rejected without creating a new invitation.
**Validates: Requirements 1.4**

### Property 3: Self-demotion prevention
*For any* admin user, attempting to remove their own admin privileges should be rejected and the user should retain admin role.
**Validates: Requirements 3.3**

### Property 4: Last admin protection
*For any* system state where only one admin exists, attempting to remove that admin's privileges should be rejected to ensure at least one admin always exists.
**Validates: Requirements 3.4**

### Property 5: Admin action logging completeness
*For any* admin action (invite, remove, verify, role change, suspend), the system should create a corresponding audit log entry with timestamp, admin identifier, and action details.
**Validates: Requirements 1.5, 3.5, 5.5, 6.5, 7.5**

### Property 6: User list filtering consistency
*For any* combination of filters (role, verification status, search query), the returned user list should contain only users that match all applied filter criteria.
**Validates: Requirements 4.4, 8.2**

### Property 7: Verification status transition validity
*For any* user with pending verification status, when an admin approves verification, the user status should transition to verified and enable role-specific capabilities; when rejected, status should transition to rejected and capabilities should remain disabled.
**Validates: Requirements 5.3, 5.4**

### Property 8: Role change permission update
*For any* user whose role is changed, the system should immediately update that user's permissions to match the new role's permission set.
**Validates: Requirements 6.2**

### Property 9: Suspended user access prevention
*For any* user account that is suspended, all authentication attempts should be rejected until the account is reactivated.
**Validates: Requirements 7.1, 7.2**

### Property 10: Search result highlighting accuracy
*For any* search query applied to the user list, all displayed results should contain the search term in at least one searchable field (email, name, or company), and the matching text should be highlighted.
**Validates: Requirements 8.3**

### Property 11: Authorization enforcement for admin routes
*For any* request to admin-only routes or mutations, the system should verify the requesting user has admin role before processing the request, and reject requests from non-admin users.
**Validates: Requirements 10.1, 10.3, 10.4**

### Property 12: Pagination consistency
*For any* paginated user list with page size N, each page should contain exactly N users (except the last page which may contain fewer), and no user should appear on multiple pages or be skipped.
**Validates: Requirements 4.3, 8.5**

## Error Handling

### Client-Side Error Handling

1. **Network Errors**
   - Display toast notification with retry option
   - Maintain form state for retry attempts
   - Show connection status indicator

2. **Validation Errors**
   - Inline field validation with error messages
   - Prevent form submission until errors are resolved
   - Clear, actionable error messages

3. **Permission Errors**
   - Redirect to unauthorized page
   - Display appropriate message
   - Log unauthorized access attempts

4. **State Errors**
   - Handle stale data with refetch
   - Optimistic updates with rollback on failure
   - Loading states for all async operations

### Server-Side Error Handling

1. **Authentication Errors**
   ```typescript
   if (!user || user.role !== 'admin') {
     throw new Error('UNAUTHORIZED: Admin access required')
   }
   ```

2. **Validation Errors**
   ```typescript
   if (!isValidEmail(email)) {
     throw new Error('VALIDATION_ERROR: Invalid email format')
   }
   ```

3. **Business Logic Errors**
   ```typescript
   if (isLastAdmin && action === 'remove') {
     throw new Error('BUSINESS_LOGIC_ERROR: Cannot remove last admin')
   }
   ```

4. **Database Errors**
   ```typescript
   try {
     await supabase.from('admin_invitations').insert(data)
   } catch (error) {
     logger.error('Database error:', error)
     throw new Error('DATABASE_ERROR: Failed to create invitation')
   }
   ```

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

// Example error codes:
// - UNAUTHORIZED
// - VALIDATION_ERROR
// - BUSINESS_LOGIC_ERROR
// - DATABASE_ERROR
// - NOT_FOUND
// - CONFLICT
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases for individual functions and components:

1. **Component Tests**
   - AdminList renders correctly with empty and populated data
   - AddAdminDialog validates email format
   - RemoveAdminDialog shows appropriate warnings for self-removal and last admin
   - UserTable displays correct user information and status badges
   - VerificationDialog displays documents and business information

2. **Utility Function Tests**
   - Email validation accepts valid emails and rejects invalid ones
   - Filter logic correctly combines multiple filter criteria
   - Pagination calculations return correct page ranges
   - Date formatting displays correct relative times

3. **GraphQL Resolver Tests**
   - inviteAdmin creates invitation with valid token
   - removeAdminPrivileges updates user role correctly
   - verifyClient updates verification status
   - changeUserRole updates role and logs action
   - suspendUser marks account as suspended

4. **Edge Cases**
   - Empty user list displays appropriate message
   - Last admin cannot be removed
   - Admin cannot remove self
   - Expired invitations cannot be used
   - Duplicate email invitations are rejected

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** (JavaScript/TypeScript property-based testing library). Each test will run a minimum of 100 iterations.

1. **Property Test: Admin invitation token uniqueness**
   - Generate random email addresses
   - Create invitations for each
   - Verify all tokens are unique
   - **Validates: Property 1**

2. **Property Test: Filter combination correctness**
   - Generate random user datasets
   - Apply random filter combinations
   - Verify all results match all filter criteria
   - **Validates: Property 6**

3. **Property Test: Pagination completeness**
   - Generate random user datasets of varying sizes
   - Paginate with random page sizes
   - Verify all users appear exactly once across all pages
   - **Validates: Property 12**

4. **Property Test: Role change permission consistency**
   - Generate random users with random roles
   - Change to random new roles
   - Verify permissions match new role's permission set
   - **Validates: Property 8**

5. **Property Test: Admin action logging**
   - Generate random admin actions
   - Execute actions
   - Verify corresponding log entries exist with correct data
   - **Validates: Property 5**

6. **Property Test: Suspended user access denial**
   - Generate random user accounts
   - Suspend random subset
   - Verify suspended users cannot authenticate
   - **Validates: Property 9**

7. **Property Test: Search highlighting accuracy**
   - Generate random user datasets
   - Apply random search queries
   - Verify all results contain search term
   - **Validates: Property 10**

### Integration Testing

1. **Admin Management Flow**
   - Admin invites new admin → invitation created → new user accepts → gains admin role
   - Admin removes privileges → user loses admin access → action logged

2. **User Verification Flow**
   - Client registers → admin reviews → admin approves → client can create projects
   - Client registers → admin reviews → admin rejects → client cannot create projects

3. **Role Change Flow**
   - Admin changes user role → permissions updated → user can access new role features

4. **Suspension Flow**
   - Admin suspends user → user cannot log in → admin reactivates → user can log in

### End-to-End Testing

1. **Complete Admin Workflow**
   - Log in as admin
   - Navigate to admin panel
   - Invite new admin
   - Verify client registration
   - Change user role
   - Suspend user
   - View activity logs

2. **Authorization Testing**
   - Non-admin attempts to access admin panel → redirected
   - Admin session expires → required to re-authenticate
   - Suspended user attempts login → denied

## Security Considerations

### Authentication & Authorization

1. **Role-Based Access Control**
   - All admin routes protected by middleware
   - Server-side role verification on every request
   - JWT token validation with role claims

2. **Session Management**
   - Admin sessions expire after inactivity
   - Sensitive actions require re-authentication
   - Session invalidation on role changes

### Data Protection

1. **Sensitive Data Handling**
   - Verification documents stored securely in Supabase Storage
   - Access URLs are signed and time-limited
   - Personal information encrypted at rest

2. **Audit Logging**
   - All admin actions logged with full context
   - Logs are immutable and tamper-evident
   - Regular audit log reviews

### Input Validation

1. **Server-Side Validation**
   - Email format validation
   - Role value validation against enum
   - SQL injection prevention via parameterized queries

2. **Rate Limiting**
   - Limit admin invitation sends per hour
   - Limit failed login attempts
   - Throttle API requests per admin

### Attack Prevention

1. **CSRF Protection**
   - CSRF tokens on all state-changing operations
   - SameSite cookie attributes

2. **XSS Prevention**
   - Input sanitization
   - Content Security Policy headers
   - React's built-in XSS protection

3. **Privilege Escalation Prevention**
   - Cannot grant higher privileges than own role
   - Last admin protection
   - Self-demotion prevention

## Performance Considerations

### Database Optimization

1. **Indexing Strategy**
   - Index on user role for filtering
   - Index on verification status
   - Index on created_at for sorting
   - Composite index on (role, verification_status) for common queries

2. **Query Optimization**
   - Pagination to limit result sets
   - Select only required fields
   - Use database views for complex joins

### Caching Strategy

1. **Client-Side Caching**
   - TanStack Query caching with 5-minute stale time
   - Optimistic updates for immediate feedback
   - Background refetching for data freshness

2. **Server-Side Caching**
   - Cache admin list (low change frequency)
   - Cache user counts and statistics
   - Invalidate cache on mutations

### UI Performance

1. **Virtualization**
   - Virtual scrolling for large user lists
   - Lazy loading of user activity logs

2. **Code Splitting**
   - Lazy load admin panel components
   - Separate bundles for admin features

3. **Optimistic Updates**
   - Immediate UI feedback on actions
   - Rollback on server errors

## Accessibility

1. **Keyboard Navigation**
   - All interactive elements keyboard accessible
   - Logical tab order
   - Keyboard shortcuts for common actions

2. **Screen Reader Support**
   - ARIA labels on all controls
   - Semantic HTML structure
   - Status announcements for async actions

3. **Visual Accessibility**
   - High contrast mode support
   - Focus indicators on all interactive elements
   - Color not sole indicator of status

4. **Responsive Design**
   - Mobile-friendly admin panel
   - Touch-friendly controls
   - Responsive tables with horizontal scroll

## Implementation Notes

### Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **State Management**: TanStack Query v5
- **Styling**: TailwindCSS with BidSync design system (yellow-black-white)
- **UI Components**: shadcn/ui components
- **Backend**: Next.js API Routes with GraphQL
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Testing**: Vitest, React Testing Library, fast-check

### File Structure

```
app/
├── (app)/
│   └── (admin)/
│       └── admin-dashboard/
│           ├── page.tsx                    # Main admin dashboard
│           ├── admin-management/
│           │   └── page.tsx                # Admin management tab
│           └── user-management/
│               └── page.tsx                # User management tab
│
components/
├── admin/
│   ├── admin-list.tsx
│   ├── admin-card.tsx
│   ├── add-admin-dialog.tsx
│   ├── remove-admin-dialog.tsx
│   ├── user-table.tsx
│   ├── user-row.tsx
│   ├── user-filters.tsx
│   ├── verification-dialog.tsx
│   ├── role-change-dialog.tsx
│   ├── suspend-user-dialog.tsx
│   └── user-activity-log.tsx
│
lib/
├── graphql/
│   ├── schema.ts                          # Extended with admin types
│   ├── resolvers.ts                       # Admin resolvers
│   └── types.ts                           # TypeScript types
├── auth/
│   └── admin-guards.ts                    # Admin authorization
└── utils/
    └── admin-utils.ts                     # Helper functions
```

### Migration Path

1. Create database tables (admin_invitations, user_activity_logs, admin_actions)
2. Extend GraphQL schema with admin types and mutations
3. Implement GraphQL resolvers
4. Create admin UI components
5. Add admin routes with authorization
6. Implement activity logging
7. Add tests
8. Deploy and monitor

## Future Enhancements

1. **Advanced Analytics**
   - User growth charts
   - Verification approval rates
   - Admin activity heatmaps

2. **Bulk Operations**
   - Bulk user role changes
   - Bulk verification approvals
   - CSV import/export

3. **Advanced Filtering**
   - Saved filter presets
   - Complex query builder
   - Custom field filtering

4. **Notification System**
   - Email notifications for admin actions
   - In-app notifications for users
   - Webhook integrations

5. **Audit Trail Enhancements**
   - Detailed change history
   - Rollback capabilities
   - Compliance reporting
