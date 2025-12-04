/**
 * Email Module for BidSync
 * 
 * Provides convenient functions for sending admin notification emails
 */

import { sendEmail } from './service';
import {
  getAdminInvitationEmail,
  getVerificationApprovalEmail,
  getVerificationRejectionEmail,
  getAccountSuspensionEmail,
  getProposalSubmissionClientEmail,
  getProposalSubmissionLeadEmail,
  getProposalSubmissionAdminEmail,
  getDocumentInvitationEmail,
  getRollbackNotificationEmail,
  getRoleChangeNotificationEmail,
  getAccessRevocationEmail,
} from './templates';

/**
 * Send admin invitation email
 */
export async function sendAdminInvitationEmail(params: {
  inviteeEmail: string;
  inviterName: string;
  invitationToken: string;
  expiresAt: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getAdminInvitationEmail(params);
  
  return sendEmail({
    to: params.inviteeEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send verification approval email
 */
export async function sendVerificationApprovedEmail(params: {
  clientName: string;
  clientEmail: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getVerificationApprovalEmail(params);
  
  return sendEmail({
    to: params.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send verification rejection email
 */
export async function sendVerificationRejectedEmail(params: {
  clientName: string;
  clientEmail: string;
  reason: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getVerificationRejectionEmail(params);
  
  return sendEmail({
    to: params.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send account suspension email
 */
export async function sendAccountSuspensionEmail(params: {
  userName: string;
  userEmail: string;
  reason: string;
  suspendedAt: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getAccountSuspensionEmail(params);
  
  return sendEmail({
    to: params.userEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send proposal submission notification to client
 */
export async function sendProposalSubmissionClientEmail(params: {
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  proposalTitle: string;
  teamName: string;
  submittedAt: string;
  proposalUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getProposalSubmissionClientEmail(params);
  
  return sendEmail({
    to: params.clientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send proposal submission confirmation to lead
 */
export async function sendProposalSubmissionLeadEmail(params: {
  leadName: string;
  leadEmail: string;
  projectTitle: string;
  proposalTitle: string;
  submittedAt: string;
  proposalUrl: string;
  executiveSummary?: string;
  budgetEstimate?: number;
  timelineEstimate?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getProposalSubmissionLeadEmail(params);
  
  return sendEmail({
    to: params.leadEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send proposal submission notification to admin
 */
export async function sendProposalSubmissionAdminEmail(params: {
  adminEmail: string;
  projectTitle: string;
  clientName: string;
  teamName: string;
  proposalTitle: string;
  submittedAt: string;
  projectUrl: string;
  proposalUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getProposalSubmissionAdminEmail(params);
  
  return sendEmail({
    to: params.adminEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send document invitation email
 */
export async function sendDocumentInvitationEmail(params: {
  inviteeEmail: string;
  inviterName: string;
  documentTitle: string;
  role: string;
  invitationUrl: string;
  expiresAt: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getDocumentInvitationEmail(params);
  
  return sendEmail({
    to: params.inviteeEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send rollback notification email
 */
export async function sendRollbackNotificationEmail(params: {
  userName: string;
  userEmail: string;
  documentTitle: string;
  versionNumber: number;
  rolledBackBy: string;
  documentUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getRollbackNotificationEmail(params);
  
  return sendEmail({
    to: params.userEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send role change notification email
 */
export async function sendRoleChangeNotificationEmail(params: {
  userName: string;
  userEmail: string;
  documentTitle: string;
  newRole: string;
  documentUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getRoleChangeNotificationEmail(params);
  
  return sendEmail({
    to: params.userEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send access revocation email
 */
export async function sendAccessRevocationEmail(params: {
  userName: string;
  userEmail: string;
  documentTitle: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { subject, html, text } = getAccessRevocationEmail(params);
  
  return sendEmail({
    to: params.userEmail,
    subject,
    html,
    text,
  });
}

// Re-export service functions for advanced usage
export { 
  sendEmail, 
  sendBulkEmails,
  processQueue,
  retryFailedEmails,
  getEmailQueueStatus, 
  clearEmailQueue 
} from './service';
export type { EmailOptions, EmailResult, QueueStatus } from './service';

// Re-export template functions for custom usage
export {
  getAdminInvitationEmail,
  getVerificationApprovalEmail,
  getVerificationRejectionEmail,
  getAccountSuspensionEmail,
  getProposalSubmissionClientEmail,
  getProposalSubmissionLeadEmail,
  getProposalSubmissionAdminEmail,
  getDocumentInvitationEmail,
  getRollbackNotificationEmail,
  getRoleChangeNotificationEmail,
  getAccessRevocationEmail,
} from './templates';

// Re-export proposal notification functions
export {
  sendClientNotification,
  sendLeadConfirmation,
  sendAdminNotifications,
} from './proposal-notifications';
export type {
  ClientNotificationParams,
  LeadConfirmationParams,
  AdminNotificationsParams,
} from './proposal-notifications';

// Re-export scoring notification functions
export {
  sendLeadScoredNotification,
  sendLeadScoreUpdatedNotification,
  sendClientAllScoredNotification,
  areAllProposalsScored,
} from './scoring-notifications';
export type {
  LeadScoredNotificationParams,
  LeadScoreUpdatedNotificationParams,
  ClientAllScoredNotificationParams,
} from './scoring-notifications';

// Re-export completion notification functions
export {
  sendClientReadyForDeliveryNotification,
  sendTeamCompletionNotifications,
  sendLeadRevisionRequestNotification,
} from './completion-notifications';
export type {
  ClientReadyForDeliveryParams,
  TeamCompletionParams,
  LeadRevisionRequestParams,
} from './completion-notifications';

// Re-export notification template functions
export {
  getNotificationEmail,
  getProjectNotificationEmail,
  getDeadlineReminderEmail,
} from './notification-templates';
