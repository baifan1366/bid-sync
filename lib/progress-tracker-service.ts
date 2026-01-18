/**
 * Progress Tracker Service
 * 
 * Manages section status tracking, progress calculation, and deadline monitoring
 * for collaborative documents. Provides real-time updates via Supabase Realtime.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { NotificationService } from './notification-service';

// ============================================================
// TYPES
// ============================================================

/**
 * Section status types
 * Requirements: 7.1
 */
export type SectionStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';

/**
 * Section progress information
 * Requirements: 7.3, 7.4
 */
export interface SectionProgress {
  sectionId: string;
  title: string;
  status: SectionStatus;
  assignedTo?: string;
  deadline?: Date;
  lastUpdated: Date;
}

/**
 * Overall document progress
 * Requirements: 7.3
 */
export interface DocumentProgress {
  totalSections: number;
  notStarted: number;
  inProgress: number;
  inReview: number;
  completed: number;
  completionPercentage: number;
}

/**
 * Deadline information with warning/overdue indicators
 * Requirements: 8.3, 8.4, 8.6
 */
export interface Deadline {
  sectionId: string;
  title: string;
  deadline: Date;
  assignedTo?: string;
  status: SectionStatus;
  isOverdue: boolean;
  hoursRemaining: number;
}

/**
 * Progress change event
 * Requirements: 7.5
 */
export interface ProgressChangeEvent {
  type: 'status_changed' | 'deadline_set' | 'assignment_changed';
  sectionId: string;
  documentId: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
}

export type ProgressChangeCallback = (event: ProgressChangeEvent) => void;

// ============================================================
// PROGRESS TRACKER CLASS
// ============================================================

export class ProgressTrackerService {
  private supabase = createClient();
  private progressChangeCallbacks: Set<ProgressChangeCallback> = new Set();
  private realtimeChannel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private notificationCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the progress tracker with user context
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    
    // Set up realtime subscription for progress changes
    this.setupRealtimeSubscription();
    
    // Start deadline notification checker (runs every 5 minutes)
    this.startDeadlineNotificationChecker();
  }

  /**
   * Update section status
   * Requirements: 7.1, 7.2
   */
  async updateSectionStatus(sectionId: string, status: SectionStatus): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_sections')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);

      if (error) {
        console.error('Error updating section status:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception updating section status:', error);
      throw error;
    }
  }

  /**
   * Get progress for all sections in a document
   * Requirements: 7.3, 7.4
   */
  async getSectionProgress(documentId: string): Promise<SectionProgress[]> {
    try {
      const { data, error } = await this.supabase
        .from('document_sections')
        .select('id, title, status, assigned_to, deadline, updated_at')
        .eq('document_id', documentId)
        .order('order', { ascending: true });

      if (error) {
        console.error('Error getting section progress:', error);
        throw error;
      }

      return (data || []).map(section => ({
        sectionId: section.id,
        title: section.title,
        status: section.status as SectionStatus,
        assignedTo: section.assigned_to,
        deadline: section.deadline ? new Date(section.deadline) : undefined,
        lastUpdated: new Date(section.updated_at)
      }));
    } catch (error) {
      console.error('Exception getting section progress:', error);
      throw error;
    }
  }

  /**
   * Calculate overall document progress
   * Requirements: 7.3
   */
  async getOverallProgress(documentId: string): Promise<DocumentProgress> {
    try {
      const { data, error } = await this.supabase.rpc('calculate_document_progress', {
        p_document_id: documentId
      });

      if (error) {
        console.error('Error calculating document progress:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalSections: 0,
          notStarted: 0,
          inProgress: 0,
          inReview: 0,
          completed: 0,
          completionPercentage: 0
        };
      }

      const progress = data[0];
      return {
        totalSections: progress.total_sections,
        notStarted: progress.not_started,
        inProgress: progress.in_progress,
        inReview: progress.in_review,
        completed: progress.completed,
        completionPercentage: parseFloat(progress.completion_percentage)
      };
    } catch (error) {
      console.error('Exception calculating document progress:', error);
      throw error;
    }
  }

  /**
   * Set deadline for a section
   * Requirements: 8.1
   */
  async setDeadline(sectionId: string, deadline: Date): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_sections')
        .update({ 
          deadline: deadline.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);

      if (error) {
        console.error('Error setting deadline:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception setting deadline:', error);
      throw error;
    }
  }

  /**
   * Set deadline for entire document (sets deadline for all sections)
   * Requirements: 8.2
   */
  async setDocumentDeadline(documentId: string, deadline: Date): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_sections')
        .update({ 
          deadline: deadline.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId);

      if (error) {
        console.error('Error setting document deadline:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception setting document deadline:', error);
      throw error;
    }
  }

  /**
   * Get upcoming deadlines for a document
   * Requirements: 8.3, 8.4, 8.6
   */
  async getUpcomingDeadlines(documentId: string, hoursAhead: number = 24): Promise<Deadline[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_upcoming_deadlines', {
        p_document_id: documentId,
        p_hours_ahead: hoursAhead
      });

      if (error) {
        console.error('Error getting upcoming deadlines:', error);
        throw error;
      }

      return (data || []).map((deadline: any) => ({
        sectionId: deadline.section_id,
        title: deadline.title,
        deadline: new Date(deadline.deadline),
        assignedTo: deadline.assigned_to,
        status: deadline.status as SectionStatus,
        isOverdue: deadline.is_overdue,
        hoursRemaining: parseFloat(deadline.hours_remaining)
      }));
    } catch (error) {
      console.error('Exception getting upcoming deadlines:', error);
      throw error;
    }
  }

  /**
   * Get all deadlines for a document (for timeline view)
   * Requirements: 8.6
   */
  async getAllDeadlines(documentId: string): Promise<Deadline[]> {
    try {
      const { data, error } = await this.supabase
        .from('document_sections')
        .select('id, title, deadline, assigned_to, status')
        .eq('document_id', documentId)
        .not('deadline', 'is', null)
        .order('deadline', { ascending: true });

      if (error) {
        console.error('Error getting all deadlines:', error);
        throw error;
      }

      const now = new Date();
      return (data || []).map((section: any) => {
        const deadline = new Date(section.deadline);
        const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        return {
          sectionId: section.id,
          title: section.title,
          deadline,
          assignedTo: section.assigned_to,
          status: section.status as SectionStatus,
          isOverdue: deadline < now,
          hoursRemaining: parseFloat(hoursRemaining.toFixed(2))
        };
      });
    } catch (error) {
      console.error('Exception getting all deadlines:', error);
      throw error;
    }
  }

  /**
   * Assign a section to a user
   * Requirements: 6.1, 6.4
   */
  async assignSection(sectionId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_sections')
        .update({ 
          assigned_to: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);

      if (error) {
        console.error('Error assigning section:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception assigning section:', error);
      throw error;
    }
  }

  /**
   * Unassign a section
   * Requirements: 6.4, 6.5
   */
  async unassignSection(sectionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_sections')
        .update({ 
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);

      if (error) {
        console.error('Error unassigning section:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception unassigning section:', error);
      throw error;
    }
  }

  /**
   * Register a callback for progress change events
   * Requirements: 7.5
   */
  onProgressChange(callback: ProgressChangeCallback): () => void {
    this.progressChangeCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.progressChangeCallbacks.delete(callback);
    };
  }

  /**
   * Check for upcoming deadlines and send notifications
   * Requirements: 8.5
   */
  async checkAndNotifyDeadlines(documentId: string): Promise<void> {
    try {
      // Get deadlines within 24 hours
      const upcomingDeadlines = await this.getUpcomingDeadlines(documentId, 24);
      
      // Filter for deadlines that need notification (within 24 hours but not overdue)
      const deadlinesNeedingNotification = upcomingDeadlines.filter(
        d => !d.isOverdue && d.hoursRemaining <= 24 && d.hoursRemaining > 0
      );

      // Send notifications for upcoming deadlines
      if (deadlinesNeedingNotification.length > 0) {
        for (const deadline of deadlinesNeedingNotification) {
          if (deadline.assignedTo) {
            NotificationService.createNotification({
              userId: deadline.assignedTo,
              type: 'section_deadline_approaching',
              title: 'Section Deadline Approaching',
              body: `Your section "${deadline.title}" is due in ${Math.ceil(deadline.hoursRemaining)} hours.`,
              data: {
                documentId,
                sectionId: deadline.sectionId,
                sectionTitle: deadline.title,
                deadline: deadline.deadline?.toISOString(),
                hoursRemaining: deadline.hoursRemaining,
              },
              sendEmail: true,
            }).catch(err => console.error('Failed to send deadline notification:', err));
          }
        }
      }
    } catch (error) {
      console.error('Exception checking deadlines:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
      this.notificationCheckInterval = null;
    }
    
    this.progressChangeCallbacks.clear();
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Set up Supabase Realtime subscription for progress changes
   * Requirements: 7.5
   */
  private setupRealtimeSubscription(): void {
    this.realtimeChannel = this.supabase
      .channel('document-sections-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_sections'
        },
        (payload) => {
          this.handleRealtimeProgressChange(payload);
        }
      )
      .subscribe();
  }

  /**
   * Handle realtime progress change events from Supabase
   */
  private handleRealtimeProgressChange(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'UPDATE') {
      // Determine what changed
      if (oldRecord.status !== newRecord.status) {
        this.broadcastProgressChange({
          type: 'status_changed',
          sectionId: newRecord.id,
          documentId: newRecord.document_id,
          oldValue: oldRecord.status,
          newValue: newRecord.status,
          timestamp: new Date()
        });
      }
      
      if (oldRecord.deadline !== newRecord.deadline) {
        this.broadcastProgressChange({
          type: 'deadline_set',
          sectionId: newRecord.id,
          documentId: newRecord.document_id,
          oldValue: oldRecord.deadline,
          newValue: newRecord.deadline,
          timestamp: new Date()
        });
      }
      
      if (oldRecord.assigned_to !== newRecord.assigned_to) {
        this.broadcastProgressChange({
          type: 'assignment_changed',
          sectionId: newRecord.id,
          documentId: newRecord.document_id,
          oldValue: oldRecord.assigned_to,
          newValue: newRecord.assigned_to,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Broadcast progress change event to all registered callbacks
   */
  private broadcastProgressChange(event: ProgressChangeEvent): void {
    for (const callback of this.progressChangeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in progress change callback:', error);
      }
    }
  }

  /**
   * Start periodic deadline notification checker
   * Requirements: 8.5
   */
  private startDeadlineNotificationChecker(): void {
    // Check every 5 minutes
    this.notificationCheckInterval = setInterval(async () => {
      // This would need to check all documents the user has access to
      // For now, this is a placeholder that would be called by the UI
      // when a document is active
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let progressTrackerInstance: ProgressTrackerService | null = null;

/**
 * Get the singleton instance of the progress tracker
 */
export function getProgressTracker(): ProgressTrackerService {
  if (!progressTrackerInstance) {
    progressTrackerInstance = new ProgressTrackerService();
  }
  return progressTrackerInstance;
}

/**
 * Create a new progress tracker instance (for testing or multiple contexts)
 */
export function createProgressTracker(): ProgressTrackerService {
  return new ProgressTrackerService();
}
