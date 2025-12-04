# Settings Components

This directory contains components for the BidSync settings pages, including user profile settings and notification preferences.

## Components

### NotificationPreferences

A comprehensive UI component for managing user notification preferences.

**Location:** `components/settings/notification-preferences.tsx`

**Requirements Implemented:**
- **4.1**: Display all available notification categories
- **4.2**: Save preference toggles to database

#### Features

1. **Notification Categories**
   - Email Notifications (master toggle)
   - Project Updates
   - New Messages
   - Proposal Updates
   - Q&A Notifications
   - Deadline Reminders
   - Team Notifications
   - Completion Notifications
   - Scoring Notifications

2. **User Experience**
   - Real-time preference updates
   - Optimistic UI updates with rollback on error
   - Loading and error states
   - Visual feedback with toast notifications
   - Disabled state when email is globally off
   - Reset to defaults functionality

3. **Design System Compliance**
   - Yellow accent colors (#FBBF24)
   - Black/white theme support
   - Consistent with BidSync design system
   - Responsive layout
   - Accessible UI with proper labels

#### Usage

```tsx
import { NotificationPreferences } from '@/components/settings/notification-preferences'

function SettingsPage() {
  const userId = 'user-id-here'
  
  return (
    <div>
      <NotificationPreferences userId={userId} />
    </div>
  )
}
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | `string` | Yes | The ID of the user whose preferences to manage |

#### API Integration

The component integrates with the following API endpoints:

- `GET /api/notifications/preferences` - Fetch user preferences
- `PATCH /api/notifications/preferences` - Update preferences
- `POST /api/notifications/preferences/reset` - Reset to defaults

#### State Management

The component manages its own state internally:
- Fetches preferences on mount
- Optimistic updates for better UX
- Automatic rollback on errors
- Toast notifications for user feedback

#### Accessibility

- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- Focus management
- Semantic HTML

#### Error Handling

- Network errors are caught and displayed
- Failed updates are rolled back
- User-friendly error messages
- Retry functionality

## API Routes

### GET /api/notifications/preferences

Fetches the current user's notification preferences.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "preferences": {
    "id": "pref-id",
    "userId": "user-id",
    "emailNotifications": true,
    "projectUpdates": true,
    "newMessages": true,
    "proposalUpdates": true,
    "qaNotifications": true,
    "deadlineReminders": true,
    "teamNotifications": true,
    "completionNotifications": true,
    "scoringNotifications": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### PATCH /api/notifications/preferences

Updates one or more notification preferences.

**Authentication:** Required

**Request Body:**
```json
{
  "emailNotifications": false,
  "projectUpdates": true
}
```

**Response:**
```json
{
  "success": true,
  "preferences": {
    // Updated preferences object
  }
}
```

### POST /api/notifications/preferences/reset

Resets all preferences to default values.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "preferences": {
    // Reset preferences object (all true)
  }
}
```

## Database Schema

The notification preferences are stored in the `user_notification_preferences` table:

```sql
CREATE TABLE public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    project_updates BOOLEAN DEFAULT true,
    new_messages BOOLEAN DEFAULT true,
    proposal_updates BOOLEAN DEFAULT true,
    qa_notifications BOOLEAN DEFAULT true,
    deadline_reminders BOOLEAN DEFAULT true,
    team_notifications BOOLEAN DEFAULT true,
    completion_notifications BOOLEAN DEFAULT true,
    scoring_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Testing

See `notification-preferences.example.tsx` for usage examples and test scenarios.

## Future Enhancements

Potential improvements for future iterations:

1. **Notification Scheduling**
   - Quiet hours configuration
   - Digest email preferences (daily/weekly)

2. **Channel Preferences**
   - Separate toggles for in-app vs email
   - Browser notification preferences

3. **Advanced Filtering**
   - Project-specific preferences
   - Priority-based filtering

4. **Notification History**
   - View past notifications
   - Notification analytics

## Related Files

- Service: `lib/notification-preferences-service.ts`
- API Routes: `app/api/notifications/preferences/`
- Database Schema: `db/migrations/notification_system_schema.sql`
- Examples: `components/settings/notification-preferences.example.tsx`
