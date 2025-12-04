# Notification Components Architecture

## Component Hierarchy

```
NotificationCenter (Main Container)
├── NotificationBell (Trigger)
│   └── Badge (Unread Count)
├── DropdownMenu
│   └── NotificationDropdown (Content)
│       ├── Tabs (All/Unread Filter)
│       ├── Mark All Read Button
│       └── ScrollArea
│           └── NotificationItem[] (List)
│               ├── Unread Indicator Dot
│               ├── Title & Body
│               ├── Time Ago
│               ├── Email Indicator
│               └── Delete Button
└── NotificationToast (Real-time Toasts)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│                  (notification_queue)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Realtime Channel                       │
│            (notifications:{userId})                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         useRealtimeNotifications Hook                        │
│  • Subscribes to channel                                     │
│  • Handles connection status                                 │
│  • Syncs missed notifications                                │
│  • Provides callbacks                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              NotificationCenter                              │
│  • Manages notification state                                │
│  • Loads initial notifications                               │
│  • Handles real-time updates                                 │
│  • Coordinates child components                              │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐
│    Bell     │  │    Dropdown     │  │      Toast       │
│  (Trigger)  │  │   (Content)     │  │  (Real-time)     │
└─────────────┘  └─────────────────┘  └──────────────────┘
```

## Event Flow

### New Notification Received

```
1. Business Logic
   └─> NotificationService.createNotification()
       └─> Database Insert
           └─> Supabase Realtime Broadcast
               └─> useRealtimeNotifications.onNewNotification()
                   ├─> Update notifications array
                   ├─> Increment unread count
                   └─> Show toast notification
```

### Mark as Read

```
1. User clicks notification
   └─> NotificationItem.handleClick()
       └─> NotificationService.markAsRead()
           └─> Database Update
               ├─> Update local state
               ├─> Decrement unread count
               └─> Navigate to page
```

### Delete Notification

```
1. User clicks delete button
   └─> NotificationItem.handleDelete()
       └─> NotificationService.deleteNotification()
           └─> Database Delete (with ownership check)
               ├─> Remove from local state
               └─> Update unread count (if was unread)
```

### Connection Recovery

```
1. Connection Lost
   └─> useRealtimeNotifications detects disconnect
       └─> Set status to 'disconnected'
           └─> Attempt reconnection with exponential backoff
               └─> Connection Restored
                   └─> Sync missed notifications
                       └─> Fetch notifications created since last sync
                           └─> Add to local state
                               └─> Show toast for missed notifications
```

## State Management

### NotificationCenter State

```typescript
{
  isOpen: boolean,              // Dropdown open/closed
  notifications: Notification[], // All notifications
  unreadCount: number,          // Unread count
  newNotification: Notification | null, // For toast
  isLoading: boolean            // Initial load state
}
```

### Real-time Hook State

```typescript
{
  connectionStatus: 'connected' | 'connecting' | 'disconnected',
  isSubscribed: boolean,
  missedNotifications: Notification[],
  reconnect: () => void
}
```

## Component Props

### NotificationCenter
```typescript
{
  userId: string,
  className?: string
}
```

### NotificationBell
```typescript
{
  unreadCount: number,
  onClick: () => void,
  isOpen: boolean,
  className?: string
}
```

### NotificationDropdown
```typescript
{
  userId: string,
  notifications: Notification[],
  onNotificationsChange: () => void,
  className?: string
}
```

### NotificationItem
```typescript
{
  notification: Notification,
  onMarkAsRead: (id: string) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}
```

### NotificationToast
```typescript
{
  notification: Notification | null,
  onDismiss?: () => void
}
```

## Styling Architecture

### Color Scheme
- **Primary**: Yellow-400 (#FBBF24)
- **Borders**: Yellow-400/20 (20% opacity)
- **Hover**: Yellow-400/10 (10% opacity)
- **Background (unread)**: Yellow-400/5 (5% opacity)

### Component Styling

```
NotificationBell
├── Ghost button variant
├── Yellow icon when unread
├── Muted icon when no unread
└── Yellow badge with black text

NotificationDropdown
├── White/black background
├── Yellow border (20% opacity)
├── Shadow-lg
└── 400px width

NotificationItem (Unread)
├── Yellow border (40% opacity)
├── Yellow background (5% opacity)
├── Yellow dot indicator
└── Hover: Yellow background (10% opacity)

NotificationItem (Read)
├── Gray border
├── Default background
├── No dot indicator
└── Hover: Subtle shadow
```

## Accessibility Features

### ARIA Labels
- Bell button: "Notifications (X unread)"
- Badge: "X unread notifications"
- Delete button: "Delete notification"
- Dropdown: role="menu"

### Keyboard Navigation
- Tab to bell button
- Enter/Space to open dropdown
- Arrow keys to navigate items
- Enter to click notification
- Escape to close dropdown

### Screen Reader Support
- Semantic HTML elements
- ARIA roles and labels
- Live region announcements
- Focus management

## Performance Optimizations

1. **Memoization**: Components use React.memo
2. **Callbacks**: useCallback for stable references
3. **Lazy Loading**: Limit 50 notifications
4. **Scroll Area**: Virtual scrolling for long lists
5. **Debouncing**: Debounced state updates
6. **Optimistic Updates**: Immediate UI feedback

## Error Handling

1. **Try-Catch Blocks**: All async operations
2. **Console Logging**: Errors logged to console
3. **Graceful Degradation**: UI remains functional
4. **Non-Blocking**: Errors don't crash app
5. **User Feedback**: Toast messages for errors

## Testing Strategy

### Unit Tests
- Component rendering
- Props handling
- Event handlers
- State updates

### Integration Tests
- Real-time subscription
- Mark as read flow
- Delete flow
- Navigation

### E2E Tests
- Full notification flow
- Connection recovery
- Multi-tab sync
- Browser notifications

## Future Enhancements

1. **Notification Grouping**: Group by type/date
2. **Search/Filter**: Search notification content
3. **Archive**: Archive old notifications
4. **Sound Effects**: Audio notifications
5. **Desktop Notifications**: Native OS notifications
6. **Notification Preferences**: Per-type settings
7. **Notification History**: View all past notifications
8. **Notification Templates**: Custom templates per type
