# Browser Notification Integration

This document describes the browser notification integration for the BidSync notification system.

## Overview

Browser notifications allow users to receive desktop notifications for high-priority events even when the BidSync application is not in focus or the browser tab is in the background.

## Requirements Implemented

- **16.1**: Request browser notification permission on first login
- **16.2**: Display browser notifications for high-priority notifications
- **16.3**: Include notification title and body in browser notifications
- **16.4**: Handle browser notification clicks (focus app and navigate)
- **16.5**: Gracefully degrade for unsupported browsers

## Architecture

### Core Service: `BrowserNotificationService`

Located in `lib/browser-notification-service.ts`, this singleton service provides:

- **Support Detection**: Check if browser notifications are supported
- **Permission Management**: Request and check notification permissions
- **Notification Display**: Show browser notifications with custom options
- **Click Handling**: Navigate to relevant pages when notifications are clicked
- **Lifecycle Management**: Track and close active notifications

### React Hook: `useBrowserNotifications`

Located in `hooks/use-browser-notifications.ts`, this hook provides:

- **Permission State**: Track current permission status
- **Auto-Request**: Optionally request permission on mount
- **Display Functions**: Show notifications with various priorities
- **Notification Management**: Close individual or all notifications

### Components

#### 1. NotificationCenter (Enhanced)

The main notification center now integrates browser notifications:

```tsx
<NotificationCenter
  userId={userId}
  enableBrowserNotifications={true}
/>
```

When a new real-time notification arrives:
1. It's displayed in the in-app notification dropdown
2. A toast notification is shown
3. If it's high-priority, a browser notification is displayed

#### 2. BrowserNotificationPrompt

A dismissible prompt that requests browser notification permission:

```tsx
<BrowserNotificationPrompt
  autoShow={true}
  onPermissionGranted={() => console.log('Granted')}
  onPermissionDenied={() => console.log('Denied')}
  onDismiss={() => console.log('Dismissed')}
/>
```

Features:
- Shows only when permission is 'default'
- Can be dismissed (stored in localStorage)
- Delayed appearance (2 seconds) to avoid overwhelming users
- Explains benefits of enabling notifications

#### 3. BrowserNotificationSettings

A settings component for managing browser notification preferences:

```tsx
<BrowserNotificationSettings />
```

Features:
- Shows current permission status
- Allows requesting permission
- Displays support status
- Lists what notifications will be shown
- Provides instructions for blocked notifications

## Usage

### Basic Integration

```tsx
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { NotificationPriority } from '@/lib/notification-service'

function MyComponent() {
  const {
    isSupported,
    permission,
    showNotificationForEvent,
  } = useBrowserNotifications({
    autoRequestPermission: true,
  })

  const handleEvent = async (notification) => {
    // Show browser notification for high-priority events
    await showNotificationForEvent(
      notification,
      NotificationPriority.HIGH
    )
  }

  return (
    <div>
      {isSupported && permission === 'granted' && (
        <p>Browser notifications enabled</p>
      )}
    </div>
  )
}
```

### Custom Notifications

```tsx
import { browserNotificationService } from '@/lib/browser-notification-service'

// Show a custom browser notification
await browserNotificationService.showNotification({
  title: 'Custom Notification',
  body: 'This is a custom notification',
  tag: 'custom-1',
  data: {
    url: '/custom-page',
  },
  requireInteraction: false,
})
```

## Notification Priority Mapping

Browser notifications are only shown for high-priority events:

### Critical Priority
- `account_suspended`
- `verification_rejected`

### High Priority
- `proposal_accepted`
- `proposal_rejected`
- `project_deadline_approaching`
- `ready_for_delivery`
- `revision_requested`
- `verification_approved`

### Medium/Low Priority
All other notifications are shown only in-app and via email (if enabled).

## Click Handling

When a user clicks a browser notification, the service automatically:

1. Focuses the browser window
2. Navigates to the relevant page based on notification type and data

### Navigation Mapping

- **Project notifications** → `/client-projects/{projectId}`
- **Proposal notifications** → `/lead/proposals/{proposalId}`
- **Document notifications** → `/editor/{documentId}`
- **Team notifications** → `/workspace/{projectId}`
- **Admin notifications** → `/admin`
- **Default** → `/` (home page)

## Browser Support

Browser notifications are supported in:
- Chrome 22+
- Firefox 22+
- Safari 7+
- Edge 14+
- Opera 25+

The service automatically detects support and gracefully degrades for unsupported browsers.

## Permission States

### `default`
- Permission has not been requested
- Shows permission prompt
- No notifications are displayed

### `granted`
- User has granted permission
- Browser notifications are displayed for high-priority events
- Shows success status in settings

### `denied`
- User has denied permission
- No browser notifications are displayed
- Shows instructions for re-enabling in settings

## Best Practices

### 1. Request Permission Thoughtfully

Don't request permission immediately on page load. Instead:
- Request on first login (after user is authenticated)
- Show a prompt explaining the benefits
- Allow users to dismiss and request later

### 2. Only Show High-Priority Notifications

To avoid notification fatigue:
- Only show browser notifications for high-priority events
- Use in-app notifications for everything else
- Respect user preferences

### 3. Provide Clear Information

In the notification:
- Use clear, concise titles
- Include relevant context in the body
- Add emoji for visual distinction (optional)

### 4. Handle Clicks Appropriately

When a notification is clicked:
- Focus the application window
- Navigate to the most relevant page
- Provide context about what the user is viewing

### 5. Test Across Browsers

Browser notification behavior varies:
- Test in Chrome, Firefox, Safari, and Edge
- Verify click handling works correctly
- Check that notifications appear in the system tray

## Testing

### Manual Testing

1. **Permission Request**
   - Visit the app for the first time
   - Verify permission prompt appears
   - Grant permission and verify status

2. **Notification Display**
   - Trigger a high-priority event
   - Verify browser notification appears
   - Check title and body are correct

3. **Click Handling**
   - Click a browser notification
   - Verify app focuses and navigates correctly

4. **Graceful Degradation**
   - Test in an unsupported browser
   - Verify no errors occur
   - Verify in-app notifications still work

### Automated Testing

See `hooks/__tests__/use-browser-notifications.test.ts` for unit tests.

## Troubleshooting

### Notifications Not Appearing

1. Check permission status in settings
2. Verify browser supports notifications
3. Check browser notification settings (system level)
4. Ensure notification priority is HIGH or CRITICAL
5. Check browser console for errors

### Clicks Not Working

1. Verify navigation URLs are correct
2. Check that data includes necessary IDs
3. Test in different browsers
4. Verify window.focus() is working

### Permission Denied

1. User must manually re-enable in browser settings
2. Provide clear instructions in settings component
3. Consider showing a help dialog

## Future Enhancements

Potential improvements:
- Service Worker integration for offline notifications
- Notification actions (buttons in notifications)
- Notification grouping for multiple events
- Custom notification sounds
- Notification scheduling
- Rich media in notifications (images, progress bars)

## Related Files

- `lib/browser-notification-service.ts` - Core service
- `hooks/use-browser-notifications.ts` - React hook
- `components/notifications/notification-center.tsx` - Main integration
- `components/notifications/browser-notification-prompt.tsx` - Permission prompt
- `components/settings/browser-notification-settings.tsx` - Settings UI
- `components/notifications/browser-notification-example.tsx` - Demo/example
