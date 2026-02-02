/**
 * Notification Types
 * 
 * Shared types for the notification system.
 * Safe to import in both client and server components.
 */

// Comprehensive notification types from notification-system spec
export type NotificationType =
  // Project related
  | 'project_created'
  | 'project_approved'
  | 'project_rejected'
  | 'project_status_changed'
  | 'project_deadline_approaching'
  | 'project_awarded'
  | 'project_completed'
  // Proposal related
  | 'proposal_submitted'
  | 'proposal_pending_approval'
  | 'proposal_status_changed'
  | 'proposal_scored'
  | 'proposal_score_updated'
  | 'all_proposals_scored'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'proposal_archived'
  // Team related
  | 'team_member_joined'
  | 'team_member_removed'
  | 'team_invitation_created'
  | 'team_invitation_accepted'
  // Delivery related
  | 'deliverable_uploaded'
  | 'ready_for_delivery'
  | 'completion_accepted'
  | 'revision_requested'
  | 'revision_completed'
  // Document collaboration
  | 'document_shared'
  | 'document_comment_added'
  | 'document_version_created'
  | 'document_rollback'
  | 'section_assigned'
  | 'section_reassigned'
  | 'section_completed'
  | 'section_deadline_approaching'
  // Messages and Q&A
  | 'message_received'
  | 'qa_question_posted'
  | 'qa_answer_posted'
  // Admin
  | 'admin_invitation'
  | 'verification_approved'
  | 'verification_rejected'
  | 'account_suspended';

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data: Record<string, any>;
  read: boolean;
  readAt?: Date;
  sentViaEmail: boolean;
  legalHold: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
  priority?: NotificationPriority;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}
