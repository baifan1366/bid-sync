# Admin Workflow Notification Integration

## Overview

This document summarizes the integration of notifications into admin workflows for the BidSync notification system.

## Implementation Summary

### 1. Project Creation Notifications (Requirement 10.1)

**Location**: `lib/graphql/resolvers.ts` - `createProject` mutation

**Implementation**:
- When a client creates a project, all administrators are notified
- Notification type: `project_created`
- Channel: In-app only (no email per requirement 10.4)
- Data includes: projectId, clientId, title, budget, deadline

**Code**:
```typescript
// Get all admin users
const adminClient = createAdminClient();
const { data: allUsers } = await adminClient.auth.admin.listUsers();
const admins = allUsers?.users.filter((u: any) => u.user_metadata?.role === 'admin') || [];

// Send notification to each admin (in-app only per requirement 10.4)
for (const admin of admins) {
  await NotificationService.createNotification({
    userId: admin.id,
    type: 'project_created',
    title: `New Project Created: ${project.title}`,
    body: `A new project "${project.title}" has been created by ${user.user_metadata?.full_name || user.email} and requires review.`,
    data: {
      projectId: project.id,
      clientId: user.id,
      title: project.title,
      budget: project.budget,
      deadline: project.deadline,
    },
    sendEmail: false, // Requirement 10.4: In-app only
  });
}
```

### 2. Proposal Submission Admin Oversight (Requirements 10.2, 10.3, 10.5)

**Location**: `lib/proposal-service.ts` - `sendSubmissionNotifications` method

**Implementation**:
- When a proposal is submitted, all administrators are notified for oversight
- Notification type: `proposal_submitted`
- Channel: In-app only (no email per requirement 10.5)
- Data includes: proposalId, projectId, projectTitle, leadId, clientId (requirement 10.3)

**Code**:
```typescript
// Requirement 10.2, 10.3, 10.5: Notify all admins (in-app only)
const { data: admins } = await supabase
  .from('users')
  .select('id')
  .eq('role', 'admin');

if (admins && admins.length > 0) {
  for (const admin of admins) {
    const adminNotification = await NotificationService.createNotification({
      userId: admin.id,
      type: 'proposal_submitted',
      title: `New Proposal Submitted: ${projectTitle}`,
      body: `A proposal has been submitted for project "${projectTitle}". Review required.`,
      data: {
        proposalId,
        projectId,
        projectTitle,
        leadId,
        clientId, // Requirement 10.3: Include relevant entity IDs
      },
      sendEmail: false, // Requirement 10.5: In-app only
    });
  }
}
```

### 3. Account Verification Approval (Requirements 11.1, 11.4, 11.5)

**Location**: `lib/graphql/resolvers.ts` - `verifyClient` mutation

**Implementation**:
- When an administrator approves account verification, the user is notified
- Notification type: `verification_approved`
- Channel: Both in-app and email (requirement 11.4)
- Priority: Critical (bypasses user preferences per requirement 11.5)
- Data includes: verifiedAt, verifiedBy

**Code**:
```typescript
await NotificationService.createNotification({
  userId: userId,
  type: 'verification_approved',
  title: 'Account Verified',
  body: 'Your account has been verified! You can now create projects and access all platform features.',
  data: {
    verifiedAt: updatedUser.user.user_metadata?.verified_at,
    verifiedBy: user.id,
  },
  sendEmail: true, // Requirement 11.4: Send both in-app and email
  priority: 'critical', // Requirement 11.5: Critical notifications bypass preferences
});
```

### 4. Account Verification Rejection (Requirements 11.2, 11.4, 11.5)

**Location**: `lib/graphql/resolvers.ts` - `verifyClient` mutation

**Implementation**:
- When an administrator rejects account verification, the user is notified with the reason
- Notification type: `verification_rejected`
- Channel: Both in-app and email (requirement 11.4)
- Priority: Critical (bypasses user preferences per requirement 11.5)
- Data includes: reason, rejectedBy

**Code**:
```typescript
await NotificationService.createNotification({
  userId: userId,
  type: 'verification_rejected',
  title: 'Account Verification Rejected',
  body: `Your account verification request has been rejected. Reason: ${reason || 'Your verification request did not meet our requirements.'}`,
  data: {
    reason: reason || 'Your verification request did not meet our requirements.',
    rejectedBy: user.id,
  },
  sendEmail: true, // Requirement 11.4: Send both in-app and email
  priority: 'critical', // Requirement 11.5: Critical notifications bypass preferences
});
```

### 5. Account Suspension (Requirements 11.3, 11.5)

**Location**: `lib/graphql/resolvers.ts` - `suspendUser` mutation

**Implementation**:
- When an account is suspended, the user is notified immediately with the reason
- Notification type: `account_suspended`
- Channel: Both in-app and email
- Priority: Critical (bypasses user preferences per requirement 11.5)
- Data includes: reason, suspendedAt, suspendedBy

**Code**:
```typescript
await NotificationService.createNotification({
  userId: userId,
  type: 'account_suspended',
  title: 'Account Suspended',
  body: `Your account has been suspended. Reason: ${reason}`,
  data: {
    reason: reason,
    suspendedAt: updatedUser.user.user_metadata?.suspended_at,
    suspendedBy: user.id,
  },
  sendEmail: true,
  priority: 'critical', // Requirement 11.5: Critical notifications bypass preferences
});
```

## Requirements Coverage

### Requirement 10: Admin Project Notifications
- ✅ 10.1: Notify all administrators when a client creates a project
- ✅ 10.2: Notify administrators when a proposal is submitted (for oversight)
- ✅ 10.3: Include relevant entity IDs in notification data
- ✅ 10.4: Send in-app notifications only for project creation
- ✅ 10.5: Send in-app notifications only for proposal submission

### Requirement 11: Account Status Notifications
- ✅ 11.1: Notify user when administrator approves account verification
- ✅ 11.2: Notify user when administrator rejects account verification (with reason)
- ✅ 11.3: Notify user immediately when account is suspended (with reason)
- ✅ 11.4: Send both in-app and email notifications for verification approval
- ✅ 11.5: Critical notifications (verification, suspension) bypass user preferences

## Error Handling

All notification calls are wrapped in try-catch blocks to ensure they are non-blocking:
- If a notification fails to send, an error is logged but the main business logic continues
- This follows requirement 15.1: Non-blocking notification creation

## Testing Considerations

The following property-based tests should be implemented (marked as optional in tasks):

1. **Property 28**: Admin project creation notifications
   - For any project created by a client, notifications should be created for all administrators

2. **Property 29**: Admin notification data completeness
   - For any admin notification, the notification data should include all relevant entity IDs

3. **Property 15**: Critical notification bypass
   - For any critical notification (account_suspended, verification_rejected, verification_approved), the notification should be sent regardless of user preference settings

## Files Modified

1. `lib/graphql/resolvers.ts`
   - Added notifications to `createProject` mutation
   - Added notifications to `verifyClient` mutation
   - Added notifications to `suspendUser` mutation

2. `lib/proposal-service.ts`
   - Updated admin notifications in `sendSubmissionNotifications` to be in-app only
   - Added clientId to notification data

## Next Steps

1. Run the application to verify notifications are created correctly
2. Test each workflow:
   - Create a project as a client and verify admins receive notifications
   - Submit a proposal and verify admins receive notifications
   - Approve/reject verification and verify users receive notifications
   - Suspend an account and verify user receives notification
3. Verify that critical notifications bypass user preferences
4. Verify that admin notifications are in-app only (no emails)
