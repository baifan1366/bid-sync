# Scoring System Email Notifications

This module provides email notification functionality for the proposal scoring system, ensuring that leads and clients are kept informed about scoring activities.

## Overview

The scoring notification system sends automated emails for three key events:

1. **Lead Notification - Proposal Scored**: When a client finalizes scoring for a proposal
2. **Lead Notification - Scores Updated**: When a client revises scores for a proposal
3. **Client Notification - All Proposals Scored**: When all proposals for a project have been fully scored

## Requirements

Implements **Requirement 9.5**: "WHEN scores are updated, THE BidSync Platform SHALL send a notification to the bidding lead"

## Notification Functions

### `sendLeadScoredNotification(params)`

Sends an email to the proposal lead when their proposal is scored for the first time.

**Parameters:**
```typescript
{
  proposalId: string;
  projectId: string;
}
```

**Email Content:**
- Total score achieved
- Current ranking position
- Link to view detailed scores
- Next steps guidance

**Example:**
```typescript
await sendLeadScoredNotification({
  proposalId: 'prop-123',
  projectId: 'proj-456',
});
```

### `sendLeadScoreUpdatedNotification(params)`

Sends an email to the proposal lead when their scores are revised by the client.

**Parameters:**
```typescript
{
  proposalId: string;
  projectId: string;
  previousScore: number;
  newScore: number;
  previousRank: number;
  newRank: number;
}
```

**Email Content:**
- Previous and new total scores
- Score change (with visual indicators)
- Previous and new ranking positions
- Rank change indicators (⬆️ improved, ⬇️ declined, ➡️ unchanged)
- Link to view updated scores

**Example:**
```typescript
await sendLeadScoreUpdatedNotification({
  proposalId: 'prop-123',
  projectId: 'proj-456',
  previousScore: 75.5,
  newScore: 85.0,
  previousRank: 3,
  newRank: 2,
});
```

### `sendClientAllScoredNotification(params)`

Sends an email to the client when all proposals for their project have been fully scored.

**Parameters:**
```typescript
{
  projectId: string;
}
```

**Email Content:**
- Total number of proposals scored
- Top-ranked proposal details
- Link to view complete rankings
- Next steps for making a decision

**Example:**
```typescript
await sendClientAllScoredNotification({
  projectId: 'proj-456',
});
```

### `areAllProposalsScored(projectId)`

Helper function to check if all proposals for a project are fully scored.

**Parameters:**
- `projectId: string` - The project ID to check

**Returns:**
- `Promise<boolean>` - True if all proposals are fully scored

**Example:**
```typescript
const allScored = await areAllProposalsScored('proj-456');
if (allScored) {
  // Send notification to client
}
```

## Integration Points

### GraphQL Resolvers

The notification functions are integrated into the following GraphQL mutations:

#### `finalizeScoring` Mutation

When a client finalizes scoring for a proposal:
1. Marks all scores as final
2. Recalculates project rankings
3. **Sends notification to the lead** that their proposal has been scored
4. **Checks if all proposals are scored** and notifies the client if complete

```typescript
// In lib/graphql/resolvers.ts - finalizeScoring mutation
await sendLeadScoredNotification({
  proposalId: input.proposalId,
  projectId: proposal.project_id,
});

const allScored = await areAllProposalsScored(proposal.project_id);
if (allScored) {
  await sendClientAllScoredNotification({
    projectId: proposal.project_id,
  });
}
```

#### `reviseScore` Mutation

When a client revises scores for a proposal:
1. Captures previous ranking
2. Updates the score
3. Recalculates project rankings
4. **Sends notification to the lead** with before/after comparison

```typescript
// In lib/graphql/resolvers.ts - reviseScore mutation
await sendLeadScoreUpdatedNotification({
  proposalId: input.proposalId,
  projectId: proposal.project_id,
  previousScore,
  newScore,
  previousRank,
  newRank,
});
```

## Email Templates

All email templates follow the BidSync design system with:
- Yellow accent color (#FBBF24)
- Black and white theme
- Professional, clean layout
- Mobile-responsive design
- Both HTML and plain text versions

### Template Features

1. **Proposal Scored Email**
   - Congratulatory tone
   - Clear score and rank display
   - Actionable CTA button
   - Guidance on next steps

2. **Score Updated Email**
   - Visual indicators for score changes (📈/📉)
   - Rank change indicators (⬆️/⬇️/➡️)
   - Before/after comparison
   - Contextual messaging based on improvement

3. **All Proposals Scored Email**
   - Celebration of completion
   - Summary of top proposal
   - Clear next steps for decision-making
   - Links to rankings and comparison tools

## Error Handling

All notification functions are designed to fail gracefully:

- **Non-blocking**: Notification failures do not prevent scoring operations from completing
- **Logging**: All errors are logged for monitoring and debugging
- **Retry logic**: The underlying email service includes retry logic for transient failures
- **Validation**: All required data is validated before attempting to send

```typescript
try {
  await sendLeadScoredNotification(params);
} catch (notificationError) {
  // Log but don't fail the operation
  console.error('Failed to send scoring notifications:', notificationError);
}
```

## Testing

Comprehensive tests are provided in `lib/email/__tests__/scoring-notifications.test.ts`:

- Email template generation
- Content validation
- Score change calculations
- Rank improvement/decline detection
- URL generation
- Singular/plural handling

Run tests:
```bash
npm test -- lib/email/__tests__/scoring-notifications.test.ts --run
```

## Development Mode

In development mode (when `NODE_ENV=development` or `EMAIL_PROVIDER` is not set):
- Emails are logged to the console instead of being sent
- Full email content is displayed for verification
- No actual emails are sent to users

## Production Configuration

To enable email sending in production, configure the email service:

```env
EMAIL_PROVIDER=smtp
SMTP_HOSTNAME=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@bidsync.com
NEXT_PUBLIC_SUPABASE_URL=https://your-domain.com
```

## Future Enhancements

Potential improvements for future iterations:

1. **Notification Preferences**: Allow users to opt-in/opt-out of specific notifications
2. **Digest Emails**: Batch multiple score updates into a single daily digest
3. **In-App Notifications**: Complement emails with in-app notification center
4. **SMS Notifications**: Add SMS option for critical updates
5. **Webhook Support**: Allow third-party integrations via webhooks
6. **Email Analytics**: Track open rates and engagement metrics

## Related Documentation

- [Email Service](./service.ts) - Core email sending functionality
- [Email Templates](./templates.ts) - All email template functions
- [Proposal Notifications](./proposal-notifications.ts) - Proposal submission notifications
- [Scoring System Design](.kiro/specs/proposal-scoring-system/design.md) - Overall system design
