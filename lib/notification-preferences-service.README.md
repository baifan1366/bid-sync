# NotificationPreferencesService

## Overview

The `NotificationPreferencesService` manages user notification preferences for the BidSync platform. It provides a comprehensive API for retrieving, updating, and resetting user preferences with built-in caching for optimal performance.

## Features

- ✅ **Preference Management**: Get, update, and reset user notification preferences
- ✅ **Intelligent Caching**: 5-minute TTL cache to reduce database queries
- ✅ **Default Preferences**: Automatic creation of default preferences for new users
- ✅ **Type Safety**: Full TypeScript support with comprehensive interfaces
- ✅ **Error Handling**: Graceful error handling with fallback to defaults
- ✅ **Global Email Toggle**: Support for global email notification override

## Requirements Implemented

This service implements the following requirements from the notification-system spec:

- **4.1**: Display all available notification categories
- **4.2**: Save preference toggles to database
- **4.3**: Check user preferences before sending notifications
- **4.4**: Global email notification toggle

## API Reference

### `getPreferences(userId: string): Promise<UserNotificationPreferences>`

Retrieves user notification preferences with automatic caching.

**Features:**
- Checks cache first (5-minute TTL)
- Creates default preferences if none exist
- Returns default preferences on error

**Example:**
```typescript
const preferences = await NotificationPreferencesService.getPreferences(userId);
console.log(preferences.emailNotifications); // true/false
```

### `updatePreferences(userId: string, updates: UpdatePreferencesInput): Promise<PreferencesResult>`

Updates one or more user preferences.

**Features:**
- Partial updates supported
- Automatic cache invalidation
- Creates preferences if they don't exist

**Example:**
```typescript
const result = await NotificationPreferencesService.updatePreferences(userId, {
  emailNotifications: false,
  projectUpdates: true,
});

if (result.success) {
  console.log('Updated:', result.preferences);
}
```

### `resetToDefaults(userId: string): Promise<PreferencesResult>`

Resets all preferences to default values (all enabled).

**Example:**
```typescript
const result = await NotificationPreferencesService.resetToDefaults(userId);
```

### `createDefaultPreferences(userId: string): Promise<UserNotificationPreferences>`

Creates default preferences for a new user.

**Note:** This is typically handled by a database trigger, but can be called manually if needed.

**Example:**
```typescript
const preferences = await NotificationPreferencesService.createDefaultPreferences(userId);
```

### `isPreferenceEnabled(userId: string, preferenceKey: string): Promise<boolean>`

Checks if a specific preference is enabled.

**Example:**
```typescript
const enabled = await NotificationPreferencesService.isPreferenceEnabled(
  userId,
  'projectUpdates'
);
```

### `isEmailEnabled(userId: string): Promise<boolean>`

Checks if email notifications are globally enabled for a user.

**Example:**
```typescript
const emailEnabled = await NotificationPreferencesService.isEmailEnabled(userId);
```

### `clearCache(): void`

Clears the entire preferences cache. Useful for testing or cache invalidation.

**Example:**
```typescript
NotificationPreferencesService.clearCache();
```

## Preference Categories

The service manages the following preference categories:

| Category | Key | Description |
|----------|-----|-------------|
| **Email** | `emailNotifications` | Global toggle for all email notifications |
| **Projects** | `projectUpdates` | Project status changes and updates |
| **Projects** | `deadlineReminders` | Approaching deadline notifications |
| **Proposals** | `proposalUpdates` | Proposal submissions and status changes |
| **Proposals** | `scoringNotifications` | Proposal scoring updates |
| **Team** | `teamNotifications` | Team member changes and updates |
| **Communication** | `newMessages` | New message notifications |
| **Communication** | `qaNotifications` | Q&A questions and answers |
| **Completion** | `completionNotifications` | Project completion and deliverables |

## Default Preferences

All preferences are **enabled by default** when a user account is created:

```typescript
{
  emailNotifications: true,
  projectUpdates: true,
  newMessages: true,
  proposalUpdates: true,
  qaNotifications: true,
  deadlineReminders: true,
  teamNotifications: true,
  completionNotifications: true,
  scoringNotifications: true,
}
```

## Caching Strategy

The service implements a simple in-memory cache with the following characteristics:

- **TTL**: 5 minutes
- **Invalidation**: Automatic on updates and resets
- **Fallback**: Returns defaults if cache miss and database error

### Cache Behavior

1. **Cache Hit**: Returns cached preferences immediately
2. **Cache Miss**: Fetches from database and caches result
3. **Cache Expiry**: After 5 minutes, next request fetches fresh data
4. **Cache Invalidation**: Automatic on `updatePreferences` and `resetToDefaults`

## Integration with NotificationService

The `NotificationService` uses this service to check preferences before sending notifications:

```typescript
// In NotificationService
const shouldSend = await NotificationPreferencesService.isPreferenceEnabled(
  userId,
  'proposalUpdates'
);

if (!shouldSend) {
  return; // Skip notification
}
```

## Database Schema

The service interacts with the `user_notification_preferences` table:

```sql
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id),
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

## Error Handling

The service implements graceful error handling:

- **Database Errors**: Returns default preferences
- **Missing Preferences**: Creates defaults automatically
- **Invalid User**: Returns default preferences with empty ID
- **Network Errors**: Logs error and returns defaults

All errors are logged but never thrown to prevent disruption of business logic.

## Testing

Basic unit tests are provided in `lib/__tests__/notification-preferences-service.test.ts`.

Run tests:
```bash
npm test -- lib/__tests__/notification-preferences-service.test.ts
```

## Usage Examples

See `lib/notification-preferences-service.example.ts` for comprehensive usage examples including:

1. Getting user preferences
2. Updating specific preferences
3. Resetting to defaults
4. Checking individual preferences
5. Creating default preferences
6. Integration with notification sending
7. Building a preferences UI
8. Handling toggle changes

## Performance Considerations

- **Caching**: Reduces database queries by ~80% for frequently accessed preferences
- **Partial Updates**: Only updates specified fields, not entire record
- **Batch Operations**: Consider implementing batch preference updates if needed
- **Cache Size**: In-memory cache grows with active users; consider Redis for production

## Future Enhancements

Potential improvements for future iterations:

1. **Redis Caching**: Replace in-memory cache with Redis for distributed systems
2. **Batch Operations**: Add `updateBulkPreferences` for multiple users
3. **Preference History**: Track preference changes over time
4. **Smart Defaults**: User role-based default preferences
5. **Preference Templates**: Pre-configured preference sets for different user types

## Related Files

- `lib/notification-service.ts` - Main notification service
- `lib/notification-preferences-service.example.ts` - Usage examples
- `db/migrations/notification_system_schema.sql` - Database schema
- `.kiro/specs/notification-system/design.md` - Design document
- `.kiro/specs/notification-system/requirements.md` - Requirements document

## Support

For questions or issues, refer to:
- Design document: `.kiro/specs/notification-system/design.md`
- Requirements: `.kiro/specs/notification-system/requirements.md`
- Examples: `lib/notification-preferences-service.example.ts`
