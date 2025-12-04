/**
 * Notification Preferences Component - Usage Example
 * 
 * This file demonstrates how to use the NotificationPreferences component
 * in different contexts within the BidSync application.
 */

import { NotificationPreferences } from './notification-preferences'

/**
 * Example 1: Basic usage in settings page
 * 
 * The most common use case - displaying notification preferences
 * in the user settings page.
 */
export function SettingsPageExample() {
  // Assume we have the user ID from authentication context
  const userId = 'user-123'

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {/* Other settings sections... */}
      
      {/* Notification Preferences */}
      <NotificationPreferences userId={userId} />
      
      {/* More settings sections... */}
    </div>
  )
}

/**
 * Example 2: Standalone notification preferences page
 * 
 * If you want a dedicated page just for notification settings.
 */
export function NotificationSettingsPage() {
  const userId = 'user-123'

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Notification Settings</h1>
          <p className="text-muted-foreground mt-2">
            Control how and when you receive notifications
          </p>
        </div>
        
        <NotificationPreferences userId={userId} />
      </div>
    </div>
  )
}

/**
 * Example 3: Embedded in a modal/dialog
 * 
 * Quick access to notification preferences from anywhere in the app.
 */
export function NotificationPreferencesDialog() {
  const userId = 'user-123'

  return (
    <div className="p-6">
      <NotificationPreferences userId={userId} />
    </div>
  )
}

/**
 * Example 4: With authentication context
 * 
 * Real-world usage with actual user authentication.
 */
export function AuthenticatedNotificationPreferences() {
  // In a real app, you'd get this from your auth context/hook
  // For example: const { user } = useAuth()
  const user = { id: 'user-123' }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">
          Please log in to manage your notification preferences
        </p>
      </div>
    )
  }

  return <NotificationPreferences userId={user.id} />
}

/**
 * Features demonstrated:
 * 
 * 1. Display all notification categories (Requirement 4.1)
 *    - Email notifications (master toggle)
 *    - Project updates
 *    - New messages
 *    - Proposal updates
 *    - Q&A notifications
 *    - Deadline reminders
 *    - Team notifications
 *    - Completion notifications
 *    - Scoring notifications
 * 
 * 2. Save preference toggles (Requirement 4.2)
 *    - Real-time updates to database
 *    - Optimistic UI updates
 *    - Error handling with rollback
 * 
 * 3. Reset to defaults
 *    - One-click reset button
 *    - Restores all preferences to default values
 * 
 * 4. Visual feedback
 *    - Loading states
 *    - Success/error toasts
 *    - Disabled state when email is globally off
 *    - Yellow accent colors following BidSync design system
 * 
 * 5. Accessibility
 *    - Proper labels and descriptions
 *    - Keyboard navigation
 *    - Screen reader support
 */
