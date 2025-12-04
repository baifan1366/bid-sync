# Real-Time Notification Service

## Overview

The Real-Time Notification Service provides instant notification delivery to users' active sessions using Supabase Realtime. It handles connection management, automatic reconnection with exponential backoff, and syncing of missed notifications.

## Requirements

This implementation satisfies the following requirements from the notification-system spec:

- **3.1**: Establish Supabase Realtime subscription when user is logged in
- **3.2**: Push new notifications to active sessions immediately
- **3.4**: Automatically reconnect and sync missed notifications on connection loss
- **3.5**: Unsubscribe from notification channel when user logs out

## Architecture

### Service Layer

**`RealtimeNotificationService`** (`lib/realtime-notification-service.ts`)
- Manages Supabase Realtime channels for user-specific notifications
- Handles subscription lifecycle (subscribe/unsubscribe)
- Implements connection recovery with exponential backoff
- Syncs missed notifications after reconnection
- Broadcasts notification events to active sessions

### Hook Layer

**`useRealtimeNotifications`** (`hooks/use-realtime-notifications.ts`)
- React hook for subscribing to real-time notifications
- Manages connection status
- Handles new notification events
- Automatically syncs missed notifications
- Provides reconnect functionality

## Usage

### Basic Usage

```typescript
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { useToast } from '@/components/ui/use-toast'

function NotificationComponent({ userId }: { userId: string }) {
  const { toast } = useToast()

  const {
    connectionStatus,
    isSubscribed,
    missedNotifications,
    reconnect,
  } = useRealtimeNotifications({
    userId,
    enabled: true,
    onNewNotification: (notification) => {
      // Display toast notification
      toast({
        title: notification.title,
        description: notification.body,
      })
    },
    onNotificationRead: (notificationId) => {
      // Handle notification read event
      console.log('Notification read:', notificationId)
    },
    onNotificationDeleted: (notificationId) => {
      // Handle notification deleted event
      console.log('Notification deleted:', notificationId)
    },
  })

  return (
    <div>
      <p>Status: {connectionStatus}</p>
      <p>Subscribed: {isSubscribed ? 'Yes' : 'No'}</p>
      {connectionStatus === 'disconnected' && (
        <button onClick={reconnect}>Reconnect</button>
      )}
    </div>
  )
}
```

### Integration with NotificationService

The `NotificationService` automatically broadcasts new notifications to users' active sessions:

```typescript
import { NotificationService } from '@/lib/notification-service'

// Create a notification
const result = await NotificationService.createNotification({
  userId: 'user-123',
  type: 'proposal_submitted',
  title: 'New Proposal Submitted',
  body: 'A new proposal has been submitted for your project',
  data: { proposalId: 'proposal-456' },
  sendEmail: true,
})

// The notification is automatically broadcast to the user's active sessions
// No additional code needed!
```

## Connection Management

### Automatic Reconnection

The service implements exponential backoff for reconnection attempts:

1. **First attempt**: 1 second delay
2. **Second attempt**: 2 seconds delay
3. **Third attempt**: 4 seconds delay
4. **Fourth attempt**: 8 seconds delay
5. **Fifth attempt**: 16 seconds delay

After 5 failed attempts, reconnection stops and must be triggered manually.

### Missed Notification Sync

When a connection is restored, the service automatically:

1. Fetches all notifications created since the last sync timestamp
2. Returns them to the client via the `missedNotifications` state
3. Triggers the `onNewNotification` callback for each missed notification

## Event Types

### New Notification Event

Triggered when a new notification is created for the user.

```typescript
interface NewNotificationPayload {
  notification: Notification
}
```

### Notification Read Event

Triggered when a notification is marked as read.

```typescript
interface NotificationReadPayload {
  notificationId: string
  userId: string
  readAt: string
}
```

### Notification Deleted Event

Triggered when a notification is deleted.

```typescript
interface NotificationDeletedPayload {
  notificationId: string
  userId: string
}
```

## Connection Status

The service tracks three connection states:

- **`connected`**: Successfully subscribed to notification channel
- **`connecting`**: Attempting to establish connection
- **`disconnected`**: Not connected to notification channel

## Best Practices

### 1. Enable/Disable Based on Authentication

```typescript
const { user } = useUser()

const { connectionStatus } = useRealtimeNotifications({
  userId: user?.id || '',
  enabled: !!user, // Only enable when user is authenticated
  onNewNotification: handleNewNotification,
})
```

### 2. Handle Missed Notifications

```typescript
useEffect(() => {
  if (missedNotifications.length > 0) {
    // Show a summary notification
    toast({
      title: 'Synced Notifications',
      description: `You have ${missedNotifications.length} new notification(s)`,
    })

    // Process each missed notification
    missedNotifications.forEach((notification) => {
      // Add to local state, update UI, etc.
    })
  }
}, [missedNotifications])
```

### 3. Provide Manual Reconnect

```typescript
{connectionStatus === 'disconnected' && (
  <Button onClick={reconnect}>
    Reconnect to Notifications
  </Button>
)}
```

### 4. Display Connection Status

```typescript
const getStatusColor = () => {
  switch (connectionStatus) {
    case 'connected': return 'green'
    case 'connecting': return 'yellow'
    case 'disconnected': return 'red'
  }
}

<Badge color={getStatusColor()}>
  {connectionStatus}
</Badge>
```

## Testing

### Unit Tests

Test the service methods:

```typescript
describe('RealtimeNotificationService', () => {
  it('should subscribe to user notifications', () => {
    const cleanup = realtimeNotificationService.subscribeToNotifications(
      'user-123',
      {
        onNewNotification: jest.fn(),
      }
    )

    expect(realtimeNotificationService.isSubscribed('user-123')).toBe(true)

    cleanup()
    expect(realtimeNotificationService.isSubscribed('user-123')).toBe(false)
  })
})
```

### Integration Tests

Test the full notification flow:

```typescript
it('should receive notification in real-time', async () => {
  const onNewNotification = jest.fn()

  const { result } = renderHook(() =>
    useRealtimeNotifications({
      userId: 'user-123',
      enabled: true,
      onNewNotification,
    })
  )

  // Create a notification
  await NotificationService.createNotification({
    userId: 'user-123',
    type: 'project_created',
    title: 'Test Notification',
  })

  // Wait for real-time delivery
  await waitFor(() => {
    expect(onNewNotification).toHaveBeenCalled()
  })
})
```

## Troubleshooting

### Notifications Not Received

1. **Check subscription status**: Ensure `isSubscribed` is `true`
2. **Check connection status**: Ensure `connectionStatus` is `'connected'`
3. **Check user ID**: Ensure the correct user ID is being used
4. **Check Supabase configuration**: Ensure Realtime is enabled in Supabase project settings

### Connection Keeps Dropping

1. **Check network stability**: Ensure stable internet connection
2. **Check Supabase status**: Check Supabase status page for outages
3. **Check browser console**: Look for WebSocket errors
4. **Increase reconnection attempts**: Modify `maxReconnectAttempts` if needed

### Missed Notifications Not Syncing

1. **Check last sync timestamp**: Ensure timestamp is being stored correctly
2. **Check database query**: Ensure notifications are being fetched correctly
3. **Check callback**: Ensure `onNewNotification` is being called for missed notifications

## Performance Considerations

### Channel Management

- Each user has a single notification channel
- Channels are automatically cleaned up on unsubscribe
- Reconnection state is managed per user

### Broadcast Efficiency

- Broadcasts are non-blocking and don't affect notification creation
- Failed broadcasts are logged but don't throw errors
- Server-side broadcasts are skipped (handled by client subscriptions)

### Memory Management

- Channels are stored in a Map for efficient lookup
- Reconnection timeouts are cleared on cleanup
- Sync timestamps are removed on unsubscribe

## Related Documentation

- [Notification Service](./notification-service.ts)
- [Notification Preferences Service](./notification-preferences-service.ts)
- [Email Service](./email/service.ts)
- [Realtime Document Service](./realtime-document-service.ts)
