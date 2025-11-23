# BidSync Email Notification System

This module provides email notification functionality for the BidSync admin management panel.

## Features

- ✅ Admin invitation emails
- ✅ Client verification approval emails
- ✅ Client verification rejection emails
- ✅ Account suspension emails
- ✅ Retry logic with exponential backoff
- ✅ Development mode (logs to console)
- ✅ Production-ready with multiple provider support

## Email Templates

All email templates follow the BidSync design system with the yellow-black-white color scheme:

1. **Admin Invitation Email** - Sent when an admin invites a new administrator
2. **Verification Approval Email** - Sent when a client's account is verified
3. **Verification Rejection Email** - Sent when a client's verification is rejected
4. **Account Suspension Email** - Sent when a user account is suspended

## Usage

### Basic Usage

```typescript
import {
  sendAdminInvitationEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendAccountSuspensionEmail,
} from '@/lib/email';

// Send admin invitation
await sendAdminInvitationEmail({
  inviteeEmail: 'newadmin@example.com',
  inviterName: 'John Doe',
  invitationToken: 'abc123...',
  expiresAt: '2024-12-31T23:59:59Z',
});

// Send verification approval
await sendVerificationApprovedEmail({
  clientName: 'Jane Smith',
  clientEmail: 'jane@company.com',
});

// Send verification rejection
await sendVerificationRejectedEmail({
  clientName: 'Jane Smith',
  clientEmail: 'jane@company.com',
  reason: 'Incomplete business documentation',
});

// Send account suspension
await sendAccountSuspensionEmail({
  userName: 'John Doe',
  userEmail: 'john@example.com',
  reason: 'Violation of terms of service',
  suspendedAt: new Date().toISOString(),
});
```

### Advanced Usage

```typescript
import { sendEmail } from '@/lib/email';

// Send custom email
await sendEmail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<h1>HTML Content</h1>',
  text: 'Plain text content',
});
```

## Configuration

### Development Mode

By default, emails are logged to the console in development mode. No additional configuration is needed.

### Production Mode

To send emails in production, configure one of the supported email providers:

#### Option 1: Resend (Recommended)

1. Install the package:
   ```bash
   npm install resend
   ```

2. Add environment variables to `.env`:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=your_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   ```

3. Sign up at [resend.com](https://resend.com) to get your API key

#### Option 2: SendGrid

1. Install the package:
   ```bash
   npm install @sendgrid/mail
   ```

2. Add environment variables to `.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   ```

3. Sign up at [sendgrid.com](https://sendgrid.com) to get your API key

#### Option 3: AWS SES

1. Install the package:
   ```bash
   npm install @aws-sdk/client-ses
   ```

2. Add environment variables to `.env`:
   ```env
   EMAIL_PROVIDER=ses
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   EMAIL_FROM=noreply@yourdomain.com
   ```

3. Configure AWS SES in your AWS account

## Error Handling

The email service includes automatic retry logic:

- **Max Attempts**: 3
- **Retry Delay**: 5 seconds
- **Error Logging**: All failures are logged to console

```typescript
const result = await sendAdminInvitationEmail({...});

if (!result.success) {
  console.error('Email failed:', result.error);
}
```

## Monitoring

Check the email queue status:

```typescript
import { getEmailQueueStatus } from '@/lib/email';

const status = getEmailQueueStatus();
console.log('Queue length:', status.queueLength);
console.log('Pending emails:', status.pendingEmails);
```

## Testing

For testing purposes, you can clear the email queue:

```typescript
import { clearEmailQueue } from '@/lib/email';

clearEmailQueue();
```

## Integration with GraphQL Resolvers

The email system is automatically integrated with the following GraphQL mutations:

- `inviteAdmin` - Sends admin invitation email
- `verifyClient` - Sends verification approval/rejection email
- `suspendUser` - Sends account suspension email

No additional code is needed; emails are sent automatically when these mutations are called.

## Customization

### Custom Email Templates

To create custom email templates, use the template functions:

```typescript
import { getAdminInvitationEmail } from '@/lib/email';

const { subject, html, text } = getAdminInvitationEmail({
  inviteeEmail: 'admin@example.com',
  inviterName: 'John Doe',
  invitationToken: 'token123',
  expiresAt: '2024-12-31',
});

// Modify the template as needed
const customHtml = html.replace('BidSync', 'Your Company');
```

### Adding New Email Providers

To add support for a new email provider:

1. Add a new case in `sendEmailViaProvider()` in `lib/email/service.ts`
2. Implement the provider-specific sending logic
3. Update the environment variable documentation

## Requirements Validation

This implementation satisfies the following requirements:

- ✅ **Requirement 1.2**: Admin invitation emails with registration instructions
- ✅ **Requirement 5.4**: Verification approval/rejection notifications
- ✅ **Requirement 7.2**: Account suspension notifications
- ✅ **Retry Logic**: Handles failures with automatic retry
- ✅ **Queue Management**: In-memory queue for email jobs

## Future Enhancements

Potential improvements for production use:

- [ ] Use a proper message queue (Bull, AWS SQS, etc.)
- [ ] Add email delivery tracking
- [ ] Implement email templates with variables
- [ ] Add support for attachments
- [ ] Create admin dashboard for email monitoring
- [ ] Add email analytics and reporting
