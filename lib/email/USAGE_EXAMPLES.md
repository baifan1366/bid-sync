# Email Notification System - Usage Examples

## Basic Email Sending

### Send Immediate Email

```typescript
import { sendEmail } from '@/lib/email';

const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to BidSync',
  html: '<p>Welcome to our platform!</p>',
  text: 'Welcome to our platform!',
  priority: 'immediate',
});

if (result.success) {
  console.log('Email sent successfully:', result.messageId);
} else {
  console.error('Failed to send email:', result.error);
}
```

### Send Batched Email

```typescript
import { sendEmail } from '@/lib/email';

// This email will be queued and processed by the cron job
const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Weekly Update',
  html: '<p>Here is your weekly update...</p>',
  text: 'Here is your weekly update...',
  priority: 'batched',
});
```

## Notification Integration

### Create Notification with Email

```typescript
import { NotificationService } from '@/lib/notification-service';

// The email will be sent automatically using the appropriate template
const result = await NotificationService.createNotification({
  userId: 'user_123',
  type: 'proposal_submitted',
  title: 'New Proposal Submitted',
  body: 'A team has submitted a proposal for your project.',
  data: {
    projectId: 'proj_456',
    projectTitle: 'Website Redesign',
    proposalId: 'prop_789',
    proposalTitle: 'Modern UI Proposal',
    teamName: 'Design Team Alpha',
  },
  sendEmail: true, // Email will be sent automatically
  priority: 'high',
});
```

## Using Email Templates

### Notification Email Template

```typescript
import { getNotificationEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getNotificationEmail('proposal_scored', {
  userName: 'John Doe',
  title: 'Your Proposal Has Been Scored',
  body: 'The client has evaluated your proposal.',
  data: {
    projectTitle: 'Mobile App Development',
    proposalTitle: 'iOS App Proposal',
    totalScore: 87.5,
    rank: 2,
  },
  actionUrl: 'https://bidsync.com/proposals/123',
  actionText: 'View Your Scores',
});

// Send the email
await sendEmail({
  to: 'john@example.com',
  subject,
  html,
  text,
  priority: 'immediate',
});
```

### Project Notification Email

```typescript
import { getProjectNotificationEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getProjectNotificationEmail({
  userName: 'Jane Smith',
  projectTitle: 'E-commerce Platform',
  projectId: 'proj_123',
  type: 'approved',
  additionalInfo: 'Your project has been approved and is now visible to bidding teams.',
});

await sendEmail({
  to: 'jane@example.com',
  subject,
  html,
  text,
});
```

### Deadline Reminder Email

```typescript
import { getDeadlineReminderEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getDeadlineReminderEmail({
  userName: 'Bob Johnson',
  itemTitle: 'Executive Summary Section',
  itemType: 'section',
  daysRemaining: 2,
  deadline: '2024-12-31T23:59:59Z',
  itemUrl: 'https://bidsync.com/editor/doc_123',
});

await sendEmail({
  to: 'bob@example.com',
  subject,
  html,
  text,
  priority: 'immediate',
});
```

## Batch Processing

### Send Multiple Emails

```typescript
import { sendBulkEmails } from '@/lib/email';

const emails = [
  {
    to: 'user1@example.com',
    subject: 'Project Update',
    html: '<p>Your project has been updated.</p>',
    text: 'Your project has been updated.',
  },
  {
    to: 'user2@example.com',
    subject: 'New Message',
    html: '<p>You have a new message.</p>',
    text: 'You have a new message.',
  },
  {
    to: 'user3@example.com',
    subject: 'Team Invitation',
    html: '<p>You have been invited to join a team.</p>',
    text: 'You have been invited to join a team.',
  },
];

const results = await sendBulkEmails(emails);

const successCount = results.filter(r => r.success).length;
const failureCount = results.filter(r => !r.success).length;

console.log(`Sent ${successCount} emails successfully`);
console.log(`Failed to send ${failureCount} emails`);
```

### Process Email Queue (Cron Job)

```typescript
// app/api/cron/process-email-queue/route.ts
import { processQueue } from '@/lib/email';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await processQueue();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing email queue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process queue' },
      { status: 500 }
    );
  }
}
```

## Monitoring and Metrics

### Check Queue Status

```typescript
import { getEmailQueueStatus } from '@/lib/email';

const status = getEmailQueueStatus();

console.log('Queue Status:');
console.log('- Queue Length:', status.queueLength);
console.log('- Success Count:', status.successCount);
console.log('- Failure Count:', status.failureCount);
console.log('- Pending Emails:', status.pendingEmails.length);

// Check failure rate
const totalEmails = status.successCount + status.failureCount;
if (totalEmails > 0) {
  const failureRate = (status.failureCount / totalEmails) * 100;
  console.log(`- Failure Rate: ${failureRate.toFixed(2)}%`);
  
  if (failureRate > 5) {
    console.error('⚠️ High failure rate detected!');
    // Trigger alert
  }
}

// List pending emails
status.pendingEmails.forEach(email => {
  console.log(`\nPending Email: ${email.id}`);
  console.log(`  To: ${email.to}`);
  console.log(`  Subject: ${email.subject}`);
  console.log(`  Priority: ${email.priority}`);
  console.log(`  Attempts: ${email.attempts}`);
  if (email.error) {
    console.log(`  Error: ${email.error}`);
  }
});
```

### Retry Failed Emails

```typescript
import { retryFailedEmails } from '@/lib/email';

// Manually retry all failed emails
const retriedCount = await retryFailedEmails();
console.log(`Retried ${retriedCount} failed emails`);
```

## Business Logic Integration

### Proposal Submission

```typescript
// When a proposal is submitted
async function handleProposalSubmission(proposalId: string) {
  // ... business logic to submit proposal ...
  
  // Send notifications (non-blocking)
  NotificationService.createNotification({
    userId: clientId,
    type: 'proposal_submitted',
    title: 'New Proposal Submitted',
    body: `${teamName} has submitted a proposal for your project.`,
    data: {
      projectId,
      projectTitle,
      proposalId,
      proposalTitle,
      teamName,
    },
    sendEmail: true,
  }).catch(error => {
    console.error('Failed to send notification:', error);
    // Business logic continues even if notification fails
  });
  
  return { success: true };
}
```

### Proposal Scoring

```typescript
// When a proposal is scored
async function handleProposalScoring(proposalId: string, scores: any) {
  // ... business logic to save scores ...
  
  // Send notification to lead
  NotificationService.createNotification({
    userId: leadId,
    type: 'proposal_scored',
    title: 'Your Proposal Has Been Scored',
    body: `The client has evaluated your proposal with a total score of ${totalScore.toFixed(2)}.`,
    data: {
      projectId,
      projectTitle,
      proposalId,
      proposalTitle,
      totalScore,
      rank,
    },
    sendEmail: true,
    priority: 'high',
  }).catch(error => {
    console.error('Failed to send notification:', error);
  });
  
  return { success: true };
}
```

### Deadline Reminders (Cron Job)

```typescript
// app/api/cron/deadline-reminders/route.ts
import { NotificationService } from '@/lib/notification-service';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Find projects with deadlines within 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .lte('deadline', sevenDaysFromNow.toISOString())
      .gte('deadline', new Date().toISOString());
    
    // Send deadline reminders
    for (const project of projects || []) {
      const daysRemaining = Math.ceil(
        (new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      await NotificationService.createNotification({
        userId: project.client_id,
        type: 'project_deadline_approaching',
        title: 'Project Deadline Approaching',
        body: `Your project "${project.title}" is due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
        data: {
          projectId: project.id,
          projectTitle: project.title,
          deadline: project.deadline,
          daysRemaining,
        },
        sendEmail: true,
        priority: 'high',
      });
    }
    
    return NextResponse.json({ success: true, count: projects?.length || 0 });
  } catch (error) {
    console.error('Error sending deadline reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}
```

## Testing

### Unit Test Example

```typescript
import { sendEmail, clearEmailQueue, getEmailQueueStatus } from '@/lib/email';

describe('EmailService', () => {
  beforeEach(() => {
    clearEmailQueue();
  });

  it('should send immediate email successfully', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<p>Test content</p>',
      text: 'Test content',
      priority: 'immediate',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });

  it('should queue batched emails', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Batched Email',
      html: '<p>Batched content</p>',
      text: 'Batched content',
      priority: 'batched',
    });

    expect(result.success).toBe(true);
    
    const status = getEmailQueueStatus();
    expect(status.queueLength).toBeGreaterThan(0);
  });

  it('should track success count', async () => {
    await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    });

    const status = getEmailQueueStatus();
    expect(status.successCount).toBeGreaterThan(0);
  });
});
```

### Integration Test Example

```typescript
import { NotificationService } from '@/lib/notification-service';
import { getEmailQueueStatus, clearEmailQueue } from '@/lib/email';

describe('Email Integration', () => {
  beforeEach(() => {
    clearEmailQueue();
  });

  it('should send email when notification is created', async () => {
    const result = await NotificationService.createNotification({
      userId: 'test_user_123',
      type: 'proposal_submitted',
      title: 'Test Notification',
      body: 'Test body',
      data: {
        projectTitle: 'Test Project',
        proposalTitle: 'Test Proposal',
        teamName: 'Test Team',
      },
      sendEmail: true,
    });

    expect(result.success).toBe(true);

    const status = getEmailQueueStatus();
    expect(status.successCount).toBeGreaterThan(0);
  });
});
```

## Environment Configuration

### Development (.env.local)

```bash
# Development mode - emails logged to console
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EMAIL_FROM=noreply@localhost
```

### Production (.env.production)

```bash
# Production mode - emails sent via SMTP
NODE_ENV=production
EMAIL_PROVIDER=smtp
SMTP_HOSTNAME=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@bidsync.com
EMAIL_FROM=noreply@bidsync.com
NEXT_PUBLIC_SITE_URL=https://bidsync.com
```

## Common Patterns

### Non-Blocking Notification

```typescript
// Fire and forget - don't wait for email to send
NotificationService.createNotification({
  userId: 'user_123',
  type: 'team_member_joined',
  title: 'New Team Member',
  sendEmail: true,
}).catch(error => {
  console.error('Notification failed:', error);
  // Log error but don't block business logic
});
```

### Conditional Email Sending

```typescript
// Only send email for high-priority notifications
const shouldSendEmail = priority === 'high' || priority === 'critical';

await NotificationService.createNotification({
  userId: 'user_123',
  type: 'proposal_status_changed',
  title: 'Proposal Status Updated',
  sendEmail: shouldSendEmail,
  priority,
});
```

### Bulk Notification with Emails

```typescript
// Send notifications to multiple users
const userIds = ['user_1', 'user_2', 'user_3'];

for (const userId of userIds) {
  await NotificationService.createNotification({
    userId,
    type: 'team_member_joined',
    title: 'New Team Member Joined',
    body: `${memberName} has joined the team.`,
    data: {
      projectTitle,
      memberName,
      role,
    },
    sendEmail: true,
  });
}
```

## Troubleshooting

### Check Email Queue

```typescript
import { getEmailQueueStatus } from '@/lib/email';

const status = getEmailQueueStatus();

if (status.queueLength > 100) {
  console.warn('Email queue is building up!');
}

if (status.failureCount > 0) {
  console.error('Some emails have failed:', status.failureCount);
  
  // Check pending emails for errors
  status.pendingEmails.forEach(email => {
    if (email.error) {
      console.error(`Email ${email.id} failed:`, email.error);
    }
  });
}
```

### Manual Retry

```typescript
import { retryFailedEmails } from '@/lib/email';

// Retry all failed emails manually
const retriedCount = await retryFailedEmails();

if (retriedCount > 0) {
  console.log(`Retried ${retriedCount} failed emails`);
}
```

### Clear Queue (Testing Only)

```typescript
import { clearEmailQueue } from '@/lib/email';

// Clear the queue (use only in tests!)
clearEmailQueue();
```
