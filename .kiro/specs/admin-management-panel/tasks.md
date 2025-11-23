# Implementation Plan

- [x] 1. Set up database schema and migrations





  - Create admin_invitations table with indexes
  - Create user_activity_logs table with indexes
  - Create admin_actions audit log table
  - Add migration for user metadata fields (verification_status, is_suspended, etc.)
  - _Requirements: 1.2, 1.5, 3.5, 5.5, 6.5, 7.5, 9.2, 9.5_

-

- [x] 2. Extend GraphQL schema and types



  - Add Admin, AdminInvitation, UserActivityLog, AdminAction types
  - Add UserListResult type with pagination
  - Extend User type with verification and suspension fields
  - Add admin management queries (allAdmins, adminInvitations)
  - Add user management queries (allUsers, user, userActivityLogs, adminActions)
  - Add admin management mutations (inviteAdmin, removeAdminPrivileges, acceptAdminInvitation)
  - Add user management mutations (verifyClient, changeUserRole, suspendUser, reactivateUser)

  - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.1, 7.1_

- [x] 3. Implement GraphQL resolvers for admin management




- [x] 3.1 Implement inviteAdmin mutation


  - Validate email format
  - Check for duplicate admin emails
  - Generate unique invitation token
  - Set expiration timestamp
  - Send invitation email
  - Log admin action
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ]* 3.2 Write property test for admin invitation
  - **Property 1: Admin invitation creates valid token**
  - **Validates: Requirements 1.2, 1.3**

- [ ]* 3.3 Write property test for duplicate admin prevention
  - **Property 2: Duplicate admin prevention**
  - **Validates: Requirements 1.4**

- [x] 3.4 Implement removeAdminPrivileges mutation

  - Check if user is removing self (prevent)
  - Check if user is last admin (prevent)
  - Update user role to standard user
  - Log admin action
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ]* 3.5 Write property test for self-demotion prevention
  - **Property 3: Self-demotion prevention**
  - **Validates: Requirements 3.3**

- [ ]* 3.6 Write property test for last admin protection
  - **Property 4: Last admin protection**
  - **Validates: Requirements 3.4**

- [x] 3.7 Implement acceptAdminInvitation mutation

  - Validate invitation token
  - Check token expiration
  - Update user role to admin
  - Mark invitation as used
  - _Requirements: 1.3_

- [x] 3.8 Implement allAdmins query

  - Fetch all users with admin role
  - Include last login timestamp
  - Include invited_by information
  - Support pagination
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.9 Implement admin search functionality

  - Filter by email or name
  - Return matching results
  - _Requirements: 2.4_

- [x] 4. Implement GraphQL resolvers for user management





- [x] 4.1 Implement allUsers query


  - Support pagination with configurable page size
  - Support role filtering
  - Support verification status filtering
  - Support date range filtering
  - Support search across email, name, company
  - Support sorting by multiple columns
  - Return total count for pagination
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.4_

- [ ]* 4.2 Write property test for user list filtering
  - **Property 6: User list filtering consistency**
  - **Validates: Requirements 4.4, 8.2**

- [ ]* 4.3 Write property test for pagination consistency
  - **Property 12: Pagination consistency**
  - **Validates: Requirements 4.3, 8.5**

- [x] 4.4 Implement verifyClient mutation


  - Update verification status (approved/rejected)
  - Store verification reason
  - Enable/disable project creation capability
  - Send notification to user
  - Log admin action with decision details
  - _Requirements: 5.3, 5.4, 5.5_

- [ ]* 4.5 Write property test for verification status transitions
  - **Property 7: Verification status transition validity**
  - **Validates: Requirements 5.3, 5.4**

- [x] 4.6 Implement changeUserRole mutation

  - Validate new role value
  - Update user role
  - Update permissions immediately
  - Invalidate user session for re-authentication
  - Log admin action with previous and new role
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ]* 4.7 Write property test for role change permissions
  - **Property 8: Role change permission update**
  - **Validates: Requirements 6.2**

- [x] 4.8 Implement suspendUser mutation

  - Mark account as suspended
  - Store suspension reason
  - Prevent login attempts
  - Log admin action
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 4.9 Implement reactivateUser mutation

  - Remove suspension flag
  - Restore full access
  - Log admin action
  - _Requirements: 7.3, 7.5_

- [ ]* 4.10 Write property test for suspended user access
  - **Property 9: Suspended user access prevention**
  - **Validates: Requirements 7.1, 7.2**

- [x] 4.11 Implement userActivityLogs query


  - Fetch activity logs for specific user
  - Support pagination
  - Support date range filtering
  - Include all log metadata
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 4.12 Implement activity log export functionality


  - Generate CSV format
  - Include all relevant fields
  - _Requirements: 9.4_
-

- [x] 5. Implement authorization middleware




- [x] 5.1 Create admin role guard


  - Verify user is authenticated
  - Verify user has admin role
  - Redirect non-admins to unauthorized page
  - Log unauthorized access attempts
  - _Requirements: 10.1, 10.3, 10.4, 10.5_

- [ ]* 5.2 Write property test for authorization enforcement
  - **Property 11: Authorization enforcement for admin routes**
  - **Validates: Requirements 10.1, 10.3, 10.4**

- [x] 5.3 Implement session validation


  - Check session expiration
  - Require re-authentication for expired sessions
  - _Requirements: 10.2_

- [x] 6. Create admin management UI components





- [x] 6.1 Create AdminManagementSection component


  - Display admin statistics
  - Show add admin button
  - Render admin list
  - Handle loading and error states
  - _Requirements: 1.1, 2.1_

- [x] 6.2 Create AdminList component

  - Display all admins in cards/table
  - Show email, registration date, last login
  - Show invited_by information
  - Implement pagination controls
  - Handle empty state
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6.3 Create AddAdminDialog component

  - Email input with validation
  - Invitation preview
  - Submit button with loading state
  - Success/error feedback
  - _Requirements: 1.1, 1.2_

- [x] 6.4 Create RemoveAdminDialog component

  - Confirmation message
  - Warning for self-removal attempt
  - Warning for last admin removal
  - Reason input field
  - Confirm/cancel buttons
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 6.5 Create admin search functionality

  - Search input field
  - Real-time filtering
  - Clear search button
  - _Requirements: 2.4_
-

- [x] 7. Create user management UI components




- [x] 7.1 Create UserManagementSection component


  - Display user statistics
  - Render filters
  - Render user table
  - Handle loading and error states
  - _Requirements: 4.1_

- [x] 7.2 Create UserFilters component


  - Role filter dropdown
  - Verification status filter
  - Search input
  - Date range picker
  - Clear filters button
  - _Requirements: 4.4, 8.1, 8.2, 8.4_

- [x] 7.3 Create UserTable component


  - Display users in table format
  - Show all user fields (email, role, status, dates)
  - Status badges with appropriate colors
  - Action menu for each user
  - Pagination controls
  - Sort by column headers
  - Handle empty state
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 7.4 Create VerificationDialog component


  - Display user information
  - Show business details
  - Document viewer for verification documents
  - Approve/reject buttons
  - Reason input for rejection
  - _Requirements: 5.2, 5.3, 5.4_

- [x] 7.5 Create RoleChangeDialog component


  - Current role display
  - New role selector
  - Confirmation message
  - Warning about permission changes
  - _Requirements: 6.1, 6.2_

- [x] 7.6 Create SuspendUserDialog component


  - User information display
  - Reason input (required)
  - Confirmation message
  - Suspend/cancel buttons
  - _Requirements: 7.1, 7.5_

- [x] 7.7 Create UserActivityLog component


  - Display activity timeline
  - Show action type, timestamp, IP, user agent
  - Pagination for long logs
  - Export to CSV button
  - Date range filter
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 7.8 Implement search result highlighting


  - Highlight matching text in results
  - Support multiple search terms
  - _Requirements: 8.3_

- [ ]* 7.9 Write property test for search highlighting
  - **Property 10: Search result highlighting accuracy**
  - **Validates: Requirements 8.3**
- [x] 8. Create admin dashboard page



- [ ] 8. Create admin dashboard page

- [x] 8.1 Create main admin dashboard layout


  - Tab navigation (Admin Management, User Management)
  - Header with admin info
  - Responsive layout
  - _Requirements: 1.1, 4.1_

- [x] 8.2 Implement admin management tab

  - Integrate AdminManagementSection
  - Handle tab switching
  - _Requirements: 1.1, 2.1_

- [x] 8.3 Implement user management tab

  - Integrate UserManagementSection
  - Handle tab switching
  - _Requirements: 4.1_

- [x] 8.4 Add route protection

  - Apply admin guard middleware
  - Redirect non-admins
  - _Requirements: 10.1_
-

- [x] 9. Implement activity logging system



- [x] 9.1 Create activity logging utility


  - Log function with standard format
  - Capture IP address and user agent
  - Store metadata as JSON
  - _Requirements: 9.2, 9.5_

- [x] 9.2 Integrate logging into all admin actions


  - Log admin invitations
  - Log privilege removals
  - Log verification decisions
  - Log role changes
  - Log suspensions/reactivations
  - _Requirements: 1.5, 3.5, 5.5, 6.5, 7.5_

- [ ]* 9.3 Write property test for admin action logging
  - **Property 5: Admin action logging completeness**
  - **Validates: Requirements 1.5, 3.5, 5.5, 6.5, 7.5**

- [x] 10. Add email notification system





- [x] 10.1 Create email templates


  - Admin invitation email
  - Verification approval email
  - Verification rejection email
  - Account suspension email
  - _Requirements: 1.2, 5.4, 7.2_

- [x] 10.2 Implement email sending service


  - Integration with email provider
  - Queue email jobs
  - Handle failures with retry
  - _Requirements: 1.2, 5.4_
-

- [x] 11. Implement performance optimizations





- [x] 11.1 Add database indexes

  - Index on user role
  - Index on verification status
  - Composite indexes for common queries
  - _Requirements: 8.5_


- [x] 11.2 Implement caching strategy

  - Cache admin list with TanStack Query
  - Cache user statistics
  - Invalidate cache on mutations
  - _Requirements: 8.5_


- [x] 11.3 Add virtual scrolling for large lists

  - Implement for user table
  - Implement for activity logs
  - _Requirements: 4.3, 9.3_
-

- [x] 12. Add accessibility features




- [x] 12.1 Implement keyboard navigation


  - Tab order for all interactive elements
  - Keyboard shortcuts for common actions
  - Focus management in dialogs
  - _Requirements: All UI requirements_

- [x] 12.2 Add ARIA labels and semantic HTML


  - Label all form controls
  - Use semantic HTML elements
  - Add status announcements
  - _Requirements: All UI requirements_

- [x] 12.3 Ensure responsive design


  - Mobile-friendly layouts
  - Touch-friendly controls
  - Responsive tables
  - _Requirements: All UI requirements_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
