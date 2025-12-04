/**
 * Example usage of NotificationPreferencesService
 * 
 * This file demonstrates how to use the notification preferences service
 * in various scenarios throughout the BidSync application.
 */

import { NotificationPreferencesService } from './notification-preferences-service';

/**
 * Example 1: Getting user preferences
 * 
 * Retrieves preferences with automatic caching.
 * If preferences don't exist, creates them with defaults.
 */
async function exampleGetPreferences(userId: string) {
  const preferences = await NotificationPreferencesService.getPreferences(userId);
  
  console.log('User preferences:', {
    emailEnabled: preferences.emailNotifications,
    projectUpdates: preferences.projectUpdates,
    proposalUpdates: preferences.proposalUpdates,
    teamNotifications: preferences.teamNotifications,
  });
  
  return preferences;
}

/**
 * Example 2: Updating specific preferences
 * 
 * Updates one or more preference settings.
 * Cache is automatically invalidated.
 */
async function exampleUpdatePreferences(userId: string) {
  const result = await NotificationPreferencesService.updatePreferences(userId, {
    emailNotifications: false, // Disable all emails
    projectUpdates: true,      // Keep project updates enabled
  });
  
  if (result.success) {
    console.log('Preferences updated successfully');
    console.log('New preferences:', result.preferences);
  } else {
    console.error('Failed to update preferences:', result.error);
  }
  
  return result;
}

/**
 * Example 3: Resetting to defaults
 * 
 * Resets all preferences to their default values (all enabled).
 */
async function exampleResetPreferences(userId: string) {
  const result = await NotificationPreferencesService.resetToDefaults(userId);
  
  if (result.success) {
    console.log('Preferences reset to defaults');
  } else {
    console.error('Failed to reset preferences:', result.error);
  }
  
  return result;
}

/**
 * Example 4: Checking if a specific preference is enabled
 * 
 * Useful before sending notifications to check user preferences.
 */
async function exampleCheckPreference(userId: string) {
  const emailEnabled = await NotificationPreferencesService.isEmailEnabled(userId);
  const projectUpdatesEnabled = await NotificationPreferencesService.isPreferenceEnabled(
    userId,
    'projectUpdates'
  );
  
  console.log('Email notifications:', emailEnabled ? 'enabled' : 'disabled');
  console.log('Project updates:', projectUpdatesEnabled ? 'enabled' : 'disabled');
  
  return { emailEnabled, projectUpdatesEnabled };
}

/**
 * Example 5: Creating default preferences for new user
 * 
 * This is typically handled by the database trigger,
 * but can be called manually if needed.
 */
async function exampleCreateDefaults(userId: string) {
  const preferences = await NotificationPreferencesService.createDefaultPreferences(userId);
  
  console.log('Default preferences created for user:', userId);
  console.log('All notifications enabled:', preferences.emailNotifications);
  
  return preferences;
}

/**
 * Example 6: Integration with notification sending
 * 
 * Shows how to check preferences before sending notifications.
 */
async function exampleIntegrationWithNotifications(userId: string) {
  // Check if user wants to receive proposal updates
  const wantsProposalUpdates = await NotificationPreferencesService.isPreferenceEnabled(
    userId,
    'proposalUpdates'
  );
  
  if (!wantsProposalUpdates) {
    console.log('User has disabled proposal updates, skipping notification');
    return;
  }
  
  // Check if user wants emails
  const wantsEmails = await NotificationPreferencesService.isEmailEnabled(userId);
  
  console.log('Sending notification...');
  console.log('Include email:', wantsEmails);
  
  // Proceed with notification creation
  // NotificationService.createNotification({ ... })
}

/**
 * Example 7: Building a preferences UI
 * 
 * Shows how to fetch and display preferences in a settings page.
 */
async function examplePreferencesUI(userId: string) {
  const preferences = await NotificationPreferencesService.getPreferences(userId);
  
  // Structure for UI rendering
  const preferencesForUI = [
    {
      category: 'Email',
      items: [
        {
          key: 'emailNotifications',
          label: 'Enable email notifications',
          description: 'Receive notifications via email',
          enabled: preferences.emailNotifications,
        },
      ],
    },
    {
      category: 'Projects',
      items: [
        {
          key: 'projectUpdates',
          label: 'Project updates',
          description: 'Notifications about project status changes',
          enabled: preferences.projectUpdates,
        },
        {
          key: 'deadlineReminders',
          label: 'Deadline reminders',
          description: 'Reminders about approaching deadlines',
          enabled: preferences.deadlineReminders,
        },
      ],
    },
    {
      category: 'Proposals',
      items: [
        {
          key: 'proposalUpdates',
          label: 'Proposal updates',
          description: 'Notifications about proposal submissions and status',
          enabled: preferences.proposalUpdates,
        },
        {
          key: 'scoringNotifications',
          label: 'Scoring notifications',
          description: 'Notifications about proposal scoring',
          enabled: preferences.scoringNotifications,
        },
      ],
    },
    {
      category: 'Team',
      items: [
        {
          key: 'teamNotifications',
          label: 'Team notifications',
          description: 'Notifications about team member changes',
          enabled: preferences.teamNotifications,
        },
      ],
    },
    {
      category: 'Communication',
      items: [
        {
          key: 'newMessages',
          label: 'New messages',
          description: 'Notifications about new messages',
          enabled: preferences.newMessages,
        },
        {
          key: 'qaNotifications',
          label: 'Q&A notifications',
          description: 'Notifications about questions and answers',
          enabled: preferences.qaNotifications,
        },
      ],
    },
    {
      category: 'Completion',
      items: [
        {
          key: 'completionNotifications',
          label: 'Completion notifications',
          description: 'Notifications about project completion and deliverables',
          enabled: preferences.completionNotifications,
        },
      ],
    },
  ];
  
  return preferencesForUI;
}

/**
 * Example 8: Handling preference updates from UI
 * 
 * Shows how to handle toggle changes from a settings page.
 */
async function exampleHandleToggle(
  userId: string,
  preferenceKey: string,
  newValue: boolean
) {
  const result = await NotificationPreferencesService.updatePreferences(userId, {
    [preferenceKey]: newValue,
  } as any);
  
  if (result.success) {
    console.log(`${preferenceKey} updated to ${newValue}`);
    return { success: true };
  } else {
    console.error('Failed to update preference:', result.error);
    return { success: false, error: result.error };
  }
}

// Export examples for documentation
export {
  exampleGetPreferences,
  exampleUpdatePreferences,
  exampleResetPreferences,
  exampleCheckPreference,
  exampleCreateDefaults,
  exampleIntegrationWithNotifications,
  examplePreferencesUI,
  exampleHandleToggle,
};
