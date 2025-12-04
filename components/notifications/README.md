# Notification Components

Frontend notification components for the BidSync notification system.

## Overview

This directory contains all frontend components for displaying and managing notifications in the BidSync application. The components integrate with the notification service and real-time notification system to provide a seamless notification experience.

## Components

### NotificationCenter

The main notification component that integrates all notification features.

**Features:**
- Displays notification bell with unread badge
- Opens dropdown with notification list
- Subscribes to real-time notification updates
- Shows toast notifications for new notifications
- Handles connection status and reconnection
- Syncs missed notifications after reconnection

**Usage:**
```tsx
import { NotificationCenter } from '@/components/notifications'

<NotificationCenter userId={user.id} />
```

**Requirements Implemented:**
- 1.2: Display unread notification count in header
- 1.3: Display dropdown list of recent notifications
- 1.4: Mark notification as read and navigate
- 1.5: Display visual indicator (badge) on notification bell
- 3.1: Establish Realtime subscription when user is logged in
- 3.2: Receive new notifications immediately
- 3.3: Display toast notification
- 3.4: Automatically reconnect and sync missed notifications
- 3.5: Unsubscribe when component unmounts

### NotificationBell

Displays a notification bell icon with unread badge.

**Props:**
- `unreadCount: number` - Number of unread notifications
- `onClick: () => void` - Click handler
- `isOpen: boolean` - Whether dropdown is open
- `className?: string` - Optional CSS classes

**Usage:**
```tsx
<NotificationBell
  unreadCount={5}
  onClick={() => setIsOpen(!isOpen)}
  isOpen={isOpen}
/>
```

### NotificationDropdown

Displays a dropdown list of notifications with filtering and actions.

**Props:**
- `userId: string` - User ID
- `notifications: Notification[]` - Array of notifications
- `onNotificationsChange: () => void` - Callback when notifications change
- `className?: string` - Optional CSS classes

**Features:**
- Filter by All/Unread
- Mark all as read
- Scroll area for long lists
- Empty state display

**Usage:**
```tsx
<NotificationDropdown
  userId={user.id}
  notifications={notifications}
  onNotificationsChange={handleRefresh}
/>
```

### NotificationItem

Displays a single notification with read/delete actions.

**Props:**
- `notification: Notification` - Notification object
- `onMarkAsRead: (id: string) => Promise<void>` - Mark as read handler
- `onDelete: (id: string) => Promise<void>` - Delete handler

**Features:**
- Visual distinction between read/unread
- Click to navigate to relevant page
- Delete button (visible on hover)
- Time ago display
- Email sent indicator

**Usage:**
```tsx
<NotificationItem
  notification={notification}
  onMarkAsRead={handleMarkAsRead}
  onDelete={handleDelete}
/>
```

### NotificationToast

Displays toast notifications for real-time updates.

**Props:**
- `notification: Notification | null` - Notification to display
- `onDismiss?: () => void` - Callback after showing toast

**Usage:**
```tsx
<NotificationToast
  notification={newNotification}
  onDismiss={() => setNewNotification(null)}
/>
```

## Integration

### Header Integration

The NotificationCenter is integrated into the HeaderActions component:

```tsx
// components/layout/header-actions.tsx
import { NotificationCenter } from '@/components/notifications'

export function HeaderActions() {
  const { user } = useUser()
  
  return (
    <div className="flex items-center gap-1">
      {user && <NotificationCenter userId={user.id} />}
      {/* Other header actions */}
    </div>
  )
}
```

### Real-time Updates

The components use the `useRealtimeNotifications` hook to subscribe to real-time updates:

```tsx
const {
  connectionStatus,
  isSubscribed,
  missedNotifications,
} = useRealtimeNotifications({
  userId,
  enabled: true,
  onNewNotification: (notification) => {
    // Handle new notification
  },
  onNotificationRead: (notificationId) => {
    // Handle notification read
  },
  onNotificationDeleted: (notificationId) => {
    // Handle notification deleted
  },
})
```

## Styling

All components follow the BidSync design system:
- Yellow accent color (#FBBF24)
- Black/white theme support
- Consistent spacing and borders
- Hover states with yellow tint
- Smooth transitions

## Accessibility

- ARIA labels for screen readers
- Keyboard navigation support
- Focus states
- Semantic HTML
- Role attributes

## Testing

See `notification-center-demo.tsx` for a comprehensive demo component that showcases all features.

## Requirements Coverage

### Requirement 1.2 - Display unread notification count
✓ Implemented in NotificationBell and NotificationCenter

### Requirement 1.3 - Display dropdown list
✓ Implemented in NotificationDropdown

### Requirement 1.4 - Mark as read and navigate
✓ Implemented in NotificationItem

### Requirement 1.5 - Visual indicator (badge)
✓ Implemented in NotificationBell

### Requirement 3.1 - Establish Realtime subscription
✓ Implemented in NotificationCenter using useRealtimeNotifications

### Requirement 3.2 - Receive notifications immediately
✓ Implemented in NotificationCenter real-time handlers

### Requirement 3.3 - Display toast notification
✓ Implemented in NotificationToast

### Requirement 3.4 - Reconnect and sync
✓ Implemented in useRealtimeNotifications hook

### Requirement 3.5 - Unsubscribe on unmount
✓ Implemented in useRealtimeNotifications cleanup

### Requirement 13.2 - Mark all as read
✓ Implemented in NotificationDropdown

### Requirement 13.4 - Visual distinction
✓ Implemented in NotificationItem styling

### Requirement 20.1 - Delete notification
✓ Implemented in NotificationItem delete button

## Future Enhancements

- Browser notification support (Requirement 16.x)
- Notification preferences UI (Requirement 4.x)
- Notification grouping by type
- Notification search/filter
- Notification archive
- Notification sound effects
- Desktop notification support
