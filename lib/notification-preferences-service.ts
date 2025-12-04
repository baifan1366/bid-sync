/**
 * Notification Preferences Service
 * 
 * Manages user notification preferences for the BidSync platform.
 * Provides caching, preference updates, and default preference management.
 * 
 * Implements requirements from notification-system spec:
 * - 4.1: Display all available notification categories
 * - 4.2: Save preference toggles to database
 * - 4.3: Check user preferences before sending notifications
 * - 4.4: Global email notification toggle
 */

import { createClient } from '@/lib/supabase/server';

/**
 * User notification preferences interface
 * Maps to user_notification_preferences table
 */
export interface UserNotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  projectUpdates: boolean;
  newMessages: boolean;
  proposalUpdates: boolean;
  qaNotifications: boolean;
  deadlineReminders: boolean;
  teamNotifications: boolean;
  completionNotifications: boolean;
  scoringNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial preferences for updates
 */
export type UpdatePreferencesInput = Partial<Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

/**
 * Result type for preference operations
 */
export interface PreferencesResult {
  success: boolean;
  preferences?: UserNotificationPreferences;
  error?: string;
}

/**
 * Default notification preferences
 * All notifications enabled by default
 */
const DEFAULT_PREFERENCES: Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  emailNotifications: true,
  projectUpdates: true,
  newMessages: true,
  proposalUpdates: true,
  qaNotifications: true,
  deadlineReminders: true,
  teamNotifications: true,
  completionNotifications: true,
  scoringNotifications: true,
};

/**
 * Simple in-memory cache for preferences
 * Cache expires after 5 minutes
 */
class PreferencesCache {
  private cache: Map<string, { preferences: UserNotificationPreferences; timestamp: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(userId: string): UserNotificationPreferences | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.TTL) {
      this.cache.delete(userId);
      return null;
    }

    return cached.preferences;
  }

  set(userId: string, preferences: UserNotificationPreferences): void {
    this.cache.set(userId, {
      preferences,
      timestamp: Date.now(),
    });
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const preferencesCache = new PreferencesCache();

/**
 * NotificationPreferencesService class for managing user notification preferences
 * 
 * Implements requirements:
 * - 4.1: Display all available notification categories
 * - 4.2: Save preference toggles to database
 * - 4.3: Check user preferences before sending notifications
 * - 4.4: Global email notification toggle
 */
export class NotificationPreferencesService {
  /**
   * Gets user notification preferences with caching
   * 
   * Requirements:
   * - 4.1: Display all available notification categories
   * - Caching: Reduces database queries for frequently accessed preferences
   * 
   * @param userId - The user ID
   * @returns User preferences or default preferences if not found
   */
  static async getPreferences(userId: string): Promise<UserNotificationPreferences> {
    try {
      // Check cache first
      const cached = preferencesCache.get(userId);
      if (cached) {
        return cached;
      }

      const supabase = await createClient();

      // Fetch from database
      const { data: preferences, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !preferences) {
        // If preferences don't exist, create them with defaults
        const defaultPrefs = await this.createDefaultPreferences(userId);
        return defaultPrefs;
      }

      // Map database fields to interface
      const mappedPreferences = this.mapPreferences(preferences);

      // Cache the result
      preferencesCache.set(userId, mappedPreferences);

      return mappedPreferences;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      
      // Return default preferences on error
      return {
        id: '',
        userId,
        ...DEFAULT_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Updates user notification preferences
   * 
   * Requirements:
   * - 4.2: Save preference toggles to database
   * - Invalidates cache after update
   * 
   * @param userId - The user ID
   * @param updates - Partial preferences to update
   * @returns Success result with updated preferences
   */
  static async updatePreferences(
    userId: string,
    updates: UpdatePreferencesInput
  ): Promise<PreferencesResult> {
    try {
      const supabase = await createClient();

      // Ensure preferences exist first
      const existing = await this.getPreferences(userId);
      if (!existing.id) {
        // Create if doesn't exist
        await this.createDefaultPreferences(userId);
      }

      // Map interface fields to database fields
      const dbUpdates: any = {};
      if (updates.emailNotifications !== undefined) dbUpdates.email_notifications = updates.emailNotifications;
      if (updates.projectUpdates !== undefined) dbUpdates.project_updates = updates.projectUpdates;
      if (updates.newMessages !== undefined) dbUpdates.new_messages = updates.newMessages;
      if (updates.proposalUpdates !== undefined) dbUpdates.proposal_updates = updates.proposalUpdates;
      if (updates.qaNotifications !== undefined) dbUpdates.qa_notifications = updates.qaNotifications;
      if (updates.deadlineReminders !== undefined) dbUpdates.deadline_reminders = updates.deadlineReminders;
      if (updates.teamNotifications !== undefined) dbUpdates.team_notifications = updates.teamNotifications;
      if (updates.completionNotifications !== undefined) dbUpdates.completion_notifications = updates.completionNotifications;
      if (updates.scoringNotifications !== undefined) dbUpdates.scoring_notifications = updates.scoringNotifications;

      // Requirement 4.2: Update preferences in database
      const { data: updated, error } = await supabase
        .from('user_notification_preferences')
        .update(dbUpdates)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error || !updated) {
        console.error('Error updating notification preferences:', error);
        return {
          success: false,
          error: 'Failed to update preferences',
        };
      }

      // Invalidate cache
      preferencesCache.invalidate(userId);

      // Map and return updated preferences
      const mappedPreferences = this.mapPreferences(updated);

      return {
        success: true,
        preferences: mappedPreferences,
      };
    } catch (error) {
      console.error('Unexpected error updating preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Resets user preferences to defaults
   * 
   * Requirements:
   * - 4.2: Save preference toggles to database
   * - Provides easy way to restore default settings
   * 
   * @param userId - The user ID
   * @returns Success result with reset preferences
   */
  static async resetToDefaults(userId: string): Promise<PreferencesResult> {
    try {
      const supabase = await createClient();

      // Map default preferences to database fields
      const dbDefaults = {
        email_notifications: DEFAULT_PREFERENCES.emailNotifications,
        project_updates: DEFAULT_PREFERENCES.projectUpdates,
        new_messages: DEFAULT_PREFERENCES.newMessages,
        proposal_updates: DEFAULT_PREFERENCES.proposalUpdates,
        qa_notifications: DEFAULT_PREFERENCES.qaNotifications,
        deadline_reminders: DEFAULT_PREFERENCES.deadlineReminders,
        team_notifications: DEFAULT_PREFERENCES.teamNotifications,
        completion_notifications: DEFAULT_PREFERENCES.completionNotifications,
        scoring_notifications: DEFAULT_PREFERENCES.scoringNotifications,
      };

      // Update to defaults
      const { data: reset, error } = await supabase
        .from('user_notification_preferences')
        .update(dbDefaults)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error || !reset) {
        console.error('Error resetting notification preferences:', error);
        return {
          success: false,
          error: 'Failed to reset preferences',
        };
      }

      // Invalidate cache
      preferencesCache.invalidate(userId);

      // Map and return reset preferences
      const mappedPreferences = this.mapPreferences(reset);

      return {
        success: true,
        preferences: mappedPreferences,
      };
    } catch (error) {
      console.error('Unexpected error resetting preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Creates default notification preferences for a new user
   * 
   * Requirements:
   * - Create default preferences on user registration
   * - Note: This is also handled by database trigger, but provided as fallback
   * 
   * @param userId - The user ID
   * @returns Default preferences
   */
  static async createDefaultPreferences(userId: string): Promise<UserNotificationPreferences> {
    try {
      const supabase = await createClient();

      // Map default preferences to database fields
      const dbDefaults = {
        user_id: userId,
        email_notifications: DEFAULT_PREFERENCES.emailNotifications,
        project_updates: DEFAULT_PREFERENCES.projectUpdates,
        new_messages: DEFAULT_PREFERENCES.newMessages,
        proposal_updates: DEFAULT_PREFERENCES.proposalUpdates,
        qa_notifications: DEFAULT_PREFERENCES.qaNotifications,
        deadline_reminders: DEFAULT_PREFERENCES.deadlineReminders,
        team_notifications: DEFAULT_PREFERENCES.teamNotifications,
        completion_notifications: DEFAULT_PREFERENCES.completionNotifications,
        scoring_notifications: DEFAULT_PREFERENCES.scoringNotifications,
      };

      // Insert default preferences
      const { data: created, error } = await supabase
        .from('user_notification_preferences')
        .insert(dbDefaults)
        .select('*')
        .single();

      if (error) {
        // If error is due to duplicate (user already has preferences), fetch them
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('user_notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (existing) {
            return this.mapPreferences(existing);
          }
        }

        console.error('Error creating default preferences:', error);
        
        // Return in-memory defaults if database operation fails
        return {
          id: '',
          userId,
          ...DEFAULT_PREFERENCES,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Map and cache the created preferences
      const mappedPreferences = this.mapPreferences(created);
      preferencesCache.set(userId, mappedPreferences);

      return mappedPreferences;
    } catch (error) {
      console.error('Unexpected error creating default preferences:', error);
      
      // Return in-memory defaults on error
      return {
        id: '',
        userId,
        ...DEFAULT_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Checks if a specific preference is enabled for a user
   * 
   * Requirements:
   * - 4.3: Check user preferences before sending notifications
   * - 4.4: Global email notification toggle
   * 
   * @param userId - The user ID
   * @param preferenceKey - The preference key to check
   * @returns Whether the preference is enabled
   */
  static async isPreferenceEnabled(
    userId: string,
    preferenceKey: keyof Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);
      return preferences[preferenceKey] !== false;
    } catch (error) {
      console.error('Error checking preference:', error);
      // Default to enabled on error
      return true;
    }
  }

  /**
   * Checks if email notifications are globally enabled for a user
   * 
   * Requirements:
   * - 4.4: Global email notification toggle
   * 
   * @param userId - The user ID
   * @returns Whether email notifications are enabled
   */
  static async isEmailEnabled(userId: string): Promise<boolean> {
    return this.isPreferenceEnabled(userId, 'emailNotifications');
  }

  /**
   * Maps database preferences to interface
   * 
   * @private
   */
  private static mapPreferences(dbPreferences: any): UserNotificationPreferences {
    return {
      id: dbPreferences.id,
      userId: dbPreferences.user_id,
      emailNotifications: dbPreferences.email_notifications ?? true,
      projectUpdates: dbPreferences.project_updates ?? true,
      newMessages: dbPreferences.new_messages ?? true,
      proposalUpdates: dbPreferences.proposal_updates ?? true,
      qaNotifications: dbPreferences.qa_notifications ?? true,
      deadlineReminders: dbPreferences.deadline_reminders ?? true,
      teamNotifications: dbPreferences.team_notifications ?? true,
      completionNotifications: dbPreferences.completion_notifications ?? true,
      scoringNotifications: dbPreferences.scoring_notifications ?? true,
      createdAt: new Date(dbPreferences.created_at),
      updatedAt: new Date(dbPreferences.updated_at),
    };
  }

  /**
   * Clears the preferences cache
   * Useful for testing or when cache needs to be invalidated globally
   * 
   * @internal
   */
  static clearCache(): void {
    preferencesCache.clear();
  }
}
