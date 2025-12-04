# BidSync Email Notification System

Comprehensive email service implementing notification-system requirements with queue management, retry logic, and BidSync design system compliance.

## Features

### Core Capabilities

- **Multi-Priority Email Delivery**: Immediate, batched, and digest modes
- **Exponential Backoff Retry**: Automatic retry with 1s, 2s, 4s delays
- **Queue Management**: In-memory queue with batch processing support
- **BidSync Design System**: Yellow-black-white color scheme, mobile-responsive
- **Comprehensive Templates**: Type-specific email templates for all notification types
- **Metrics Tracking**: Success/failure counts for monitoring

### Requirements Implemented

- **2.1**: High-priority email delivery
- **2.2**: Email templates following BidSync design system
- **2.3**: Retry logic with exponential backoff (up to 3 attempts)
- **2.5**: Email sent flag update
- **15.1**: Non-blocking execution
- **15.2**: Error logging without exceptions
- **17.1**: Success and failure tracking
- **18.1-18.5**: BidSync design system compliance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NotificationService                       │
│                  (Creates notifications)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      EmailService                            │
│  • Queue management                                          │
│  • Priority routing                                          │
│  • Retry with exponential backoff                           │
│  • Metrics tracking                                          │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  Immediate  │  │    Batched      │  │     Digest       │
│   Queue     │  │     Queue       │  │     Queue        │
└─────────────┘  └─────────────────┘  └──────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Email Provider                            │
│              (SMTP, Resend, SendGrid, etc.)                  │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Email Sending

```typescript
import { sendEmail } from '@/lib/email';

// Send immediate email
const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to BidSync',
  html: '<p>Welcome!</p>',
  text: 'Welcome!',
  priority: 'immediate', // 'immediate' | 'batched' | 'digest'
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### Batch Email Sending

```typescript
import { sendBulkEmails } from '@/lib/email';

const emails = [
  {
    to: 'user1@example.com',
    subject: 'Update 1',
    html: '<p>Content 1</p>',
    text: 'Content 1',
  },
  {
    to: 'user2@example.com',
    subject: 'Update 2',
    html: '<p>Content 2</p>',
    text: 'Content 2',
  },
];

const results = await sendBulkEmails(emails);
console.log(`Sent ${results.filter(r => r.success).length} emails`);
```

### Queue Processing (Cron Job)

```typescript
import { processQueue } from '@/lib/email';

// Call this from a cron job to process batched emails
await processQueue();
```

### Monitoring

```typescript
import { getEmailQueueStatus } from '@/lib/email';

const status = getEmailQueueStatus();
console.log('Queue length:', status.queueLength);
console.log('Success count:', status.successCount);
console.log('Failure count:', status.failureCount);
console.log('Pending emails:', status.pendingEmails);
```

### Retry Failed Emails

```typescript
import { retryFailedEmails } from '@/lib/email';

const retriedCount = await retryFailedEmails();
console.log(`Retried ${retriedCount} failed emails`);
```

## Email Templates

### Notification Email Template

The system automatically generates emails for all notification types using the BidSync design system:

```typescript
import { getNotificationEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getNotificationEmail('proposal_submitted', {
  userName: 'John Doe',
  title: 'New Proposal Submitted',
  body: 'A team has submitted a proposal for your project.',
  data: {
    projectTitle: 'Website Redesign',
    proposalTitle: 'Modern UI Proposal',
    teamName: 'Design Team Alpha',
  },
  actionUrl: 'https://bidsync.com/proposals/123',
  actionText: 'View Proposal',
});
```

### Project Notification Email

```typescript
import { getProjectNotificationEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getProjectNotificationEmail({
  userName: 'Jane Smith',
  projectTitle: 'Mobile App Development',
  projectId: 'proj_123',
  type: 'approved',
  additionalInfo: 'Your project has been approved and is now live.',
});
```

### Deadline Reminder Email

```typescript
import { getDeadlineReminderEmail } from '@/lib/email/notification-templates';

const { subject, html, text } = getDeadlineReminderEmail({
  userName: 'Bob Johnson',
  itemTitle: 'Executive Summary',
  itemType: 'section',
  daysRemaining: 2,
  deadline: '2024-12-31T23:59:59Z',
  itemUrl: 'https://bidsync.com/editor/doc_123',
});
```

## Design System Compliance

All email templates follow the BidSync design system:

### Colors
- **Primary Accent**: Yellow (#FBBF24)
- **Background**: White (#FFFFFF)
- **Text**: Black (#000000) for headings, Gray (#374151) for body
- **Borders**: Yellow with 20% opacity

### Components
- **Logo**: Yellow background with black text
- **Buttons**: Yellow background (#FBBF24) with black text, hover state (#F59E0B)
- **Info Boxes**: Light yellow background with yellow left border
- **Cards**: White background with yellow border

### Responsive Design
- Mobile-first approach
- Breakpoint at 600px
- Stacked layout on mobile
- Full-width buttons on mobile

## Configuration

### Environment Variables

```bash
# Email Provider (optional, defaults to development mode)
EMAIL_PROVIDER=smtp

# SMTP Configuration (if using SMTP)
SMTP_HOSTNAME=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@bidsync.com

# Email From Address (fallback)
EMAIL_FROM=noreply@bidsync.com

# Site URL for email links
NEXT_PUBLIC_SITE_URL=https://bidsync.com
```

### Development Mode

In development mode (when `NODE_ENV=development` or `EMAIL_PROVIDER` is not set), emails are logged to the console instead of being sent:

```
📧 Email (Development Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: user@example.com
From: noreply@bidsync.com
Subject: New Proposal Submitted
Priority: immediate
Attempt: 1/3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Text Content:
[Email text content]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTML Content Length: 2543 characters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Retry Logic

The email service implements exponential backoff retry logic:

1. **First Attempt**: Immediate
2. **Second Attempt**: After 1 second (if first fails)
3. **Third Attempt**: After 2 seconds (if second fails)
4. **Fourth Attempt**: After 4 seconds (if third fails)

After 3 failed attempts, the email is removed from the queue and marked as failed.

## Priority Levels

### Immediate
- Sent immediately upon creation
- Used for critical notifications (account suspension, verification)
- Used for high-priority events (proposal accepted, project awarded)
- Used for deadline reminders

### Batched
- Added to queue for batch processing
- Processed by cron job or background worker
- Used for regular notifications (proposal submitted, team updates)

### Digest
- Reserved for future digest email functionality
- Currently treated same as batched

## Monitoring and Metrics

The email service tracks:

- **Queue Length**: Number of emails waiting to be sent
- **Success Count**: Total successful email deliveries
- **Failure Count**: Total failed email deliveries (after all retries)
- **Pending Emails**: Details of emails in queue (ID, recipient, subject, attempts, errors)

### Failure Rate Alerting

Monitor the failure rate to ensure email delivery health:

```typescript
const status = getEmailQueueStatus();
const totalEmails = status.successCount + status.failureCount;
const failureRate = totalEmails > 0 ? status.failureCount / totalEmails : 0;

if (failureRate > 0.05) {
  console.error(`Email failure rate is ${(failureRate * 100).toFixed(2)}%`);
  // Trigger alert (Requirement 17.2)
}
```

## Integration with Notification System

The email service is automatically integrated with the NotificationService:

```typescript
import { NotificationService } from '@/lib/notification-service';

// Create notification with email
await NotificationService.createNotification({
  userId: 'user_123',
  type: 'proposal_submitted',
  title: 'New Proposal Submitted',
  body: 'A team has submitted a proposal for your project.',
  data: {
    projectTitle: 'Website Redesign',
    proposalTitle: 'Modern UI Proposal',
    teamName: 'Design Team Alpha',
  },
  sendEmail: true, // Email will be sent automatically
  priority: 'high',
});
```

The NotificationService will:
1. Check user email preferences
2. Generate appropriate email template
3. Determine email priority based on notification type
4. Send email via EmailService
5. Mark notification as sent_via_email if successful

## Testing

### Unit Tests

Test individual email functions:

```typescript
import { sendEmail, clearEmailQueue } from '@/lib/email';

describe('EmailService', () => {
  beforeEach(() => {
    clearEmailQueue();
  });

  it('should send email successfully', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});
```

### Integration Tests

Test email integration with notification system:

```typescript
import { NotificationService } from '@/lib/notification-service';
import { getEmailQueueStatus } from '@/lib/email';

describe('Email Integration', () => {
  it('should send email when notification is created', async () => {
    const result = await NotificationService.createNotification({
      userId: 'test_user',
      type: 'proposal_submitted',
      title: 'Test Notification',
      sendEmail: true,
    });

    expect(result.success).toBe(true);

    const status = getEmailQueueStatus();
    expect(status.successCount).toBeGreaterThan(0);
  });
});
```

## Production Deployment

### SMTP Provider Setup

1. Configure SMTP credentials in environment variables
2. Set `EMAIL_PROVIDER=smtp`
3. Test email delivery in staging environment
4. Monitor failure rates and queue length

### Cron Job Setup

Set up a cron job to process batched emails:

```bash
# Process batched emails every 5 minutes
*/5 * * * * curl https://your-domain.com/api/cron/process-email-queue
```

Or use Vercel Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Monitoring Setup

1. Set up alerts for high failure rates (>5%)
2. Monitor queue length to detect bottlenecks
3. Track email delivery times
4. Set up logging for failed emails

## Troubleshooting

### Emails Not Sending

1. Check `EMAIL_PROVIDER` environment variable
2. Verify SMTP credentials
3. Check email queue status: `getEmailQueueStatus()`
4. Review error logs for failed attempts

### High Failure Rate

1. Verify SMTP server is accessible
2. Check for rate limiting issues
3. Review error messages in queue status
4. Consider increasing retry delays

### Queue Buildup

1. Ensure cron job is running for batched emails
2. Check for SMTP server performance issues
3. Consider increasing batch processing frequency
4. Monitor for email provider rate limits

## Future Enhancements

- [ ] Database-backed queue for persistence
- [ ] Support for additional email providers (SendGrid, AWS SES, Resend)
- [ ] Email digest functionality
- [ ] Advanced email analytics
- [ ] Email template versioning
- [ ] A/B testing for email templates
- [ ] Unsubscribe link management
- [ ] Email bounce handling
