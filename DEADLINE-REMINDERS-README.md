# Deadline Reminder System

## Overview

The Deadline Reminder System automatically sends notifications to users about approaching deadlines for projects and document sections. This ensures users stay informed and can complete their work on time.

## Features

### Project Deadline Reminders
- **Client Notifications**: Project clients receive daily reminders when a project deadline is within 7 days
- **Team Notifications**: For awarded projects, all team members receive daily reminders when the deadline is within 7 days
- **Priority Escalation**: Reminders become high-priority when deadlines are 2 days or less away

### Section Deadline Reminders
- **Assignee Notifications**: Team members assigned to document sections receive daily reminders when a section deadline is within 3 days
- **Priority Escalation**: Reminders become high-priority when deadlines are 1 day or less away

## Implementation

### Service: `DeadlineReminderService`

Located at: `lib/deadline-reminder-service.ts`

**Main Methods:**
- `sendAllDeadlineReminders()`: Sends all deadline reminders (called by cron job)
- `sendProjectDeadlineReminders()`: Sends project deadline reminders
- `sendSectionDeadlineReminders()`: Sends section deadline reminders

### Cron Job

**Route**: `/api/cron/deadline-reminders`
**Schedule**: Daily at 9:00 AM UTC
**Configuration**: `vercel.json`

```json
{
  "path": "/api/cron/deadline-reminders",
  "schedule": "0 9 * * *"
}
```

## Notification Details

### Project Deadline Notification

**Type**: `project_deadline_approaching`

**Recipients**:
- Project client (always)
- All team members (if project is awarded)

**Notification Data**:
```typescript
{
  projectId: string;
  projectTitle: string;
  deadline: string;
  daysRemaining: number;
  proposalId?: string; // Only for team member notifications
}
```

**Example**:
- **Title**: "Project Deadline Approaching"
- **Body**: "Your project 'Website Revamp' is due in 5 days."

### Section Deadline Notification

**Type**: `section_deadline_approaching`

**Recipients**:
- Assigned team member

**Notification Data**:
```typescript
{
  documentId: string;
  documentTitle: string;
  sectionId: string;
  sectionTitle: string;
  deadline: string;
  daysRemaining: number;
  workspaceId: string;
}
```

**Example**:
- **Title**: "Section Deadline Approaching"
- **Body**: "Your assigned section 'Executive Summary' in document 'Proposal Draft' is due in 2 days."

## Deadline Calculation Logic

### Project Deadlines
- **Threshold**: 7 days
- **Calculation**: Checks projects with deadlines between today and 7 days from now
- **Status Filter**: Only `open` and `awarded` projects

### Section Deadlines
- **Threshold**: 3 days
- **Calculation**: Checks sections with deadlines between today and 3 days from now
- **Assignment Filter**: Only sections with an assigned user

### Days Remaining
- Calculated as: `Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))`
- Always returns 0 or positive (never negative)
- Rounded up to ensure users have full days notice

## Delivery Channels

All deadline reminders are sent via:
1. **In-App Notification**: Displayed in the notification bell
2. **Email**: Sent to user's registered email address (subject to user preferences)

## User Preferences

Users can control deadline reminders through their notification preferences:
- **Preference Field**: `deadline_reminders`
- **Default**: Enabled
- **Override**: Critical notifications bypass preferences

## Testing

### Manual Testing

Test the cron job locally:

```bash
curl -X GET http://localhost:3000/api/cron/deadline-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Expected Response

```json
{
  "success": true,
  "projectReminders": 5,
  "sectionReminders": 12,
  "totalReminders": 17,
  "errors": [],
  "duration": 1234
}
```

## Monitoring

### Success Metrics
- Number of project reminders sent
- Number of section reminders sent
- Total reminders sent
- Execution duration

### Error Handling
- Errors are logged but don't stop processing
- Partial success is possible (some reminders sent, some failed)
- All errors are returned in the response for monitoring

### Logs

Check Vercel logs for cron job execution:
```
[Cron] Starting deadline reminders...
[Cron] Deadline reminders completed in 1234ms: {
  projectReminders: 5,
  sectionReminders: 12,
  totalReminders: 17,
  errors: 0
}
```

## Requirements Mapping

This implementation satisfies the following requirements from the notification-system spec:

- **9.1**: Project deadline reminders (7 days, daily, to client)
- **9.2**: Awarded project deadline reminders (7 days, daily, to all team members)
- **9.3**: Section deadline reminders (3 days, daily, to assigned member)
- **9.4**: Include days remaining in notifications
- **9.5**: Send both in-app and email notifications

## Future Enhancements

Potential improvements:
- Configurable reminder thresholds per project/section
- Multiple reminder intervals (e.g., 7 days, 3 days, 1 day)
- Digest emails for users with many deadlines
- Snooze functionality for reminders
- Deadline extension requests
