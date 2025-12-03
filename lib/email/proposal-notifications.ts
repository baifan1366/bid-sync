/**
 * Proposal Submission Email Notifications
 * 
 * Handles sending email notifications for proposal submissions to:
 * - Clients (project owners)
 * - Project Leads (proposal submitters)
 * - Admins (platform administrators)
 * 
 * All email failures are handled gracefully - they are logged but don't
 * block the submission process.
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from './service';
import {
  getProposalSubmissionClientEmail,
  getProposalSubmissionLeadEmail,
  getProposalSubmissionAdminEmail,
} from './templates';

/**
 * Parameters for client notification
 */
export interface ClientNotificationParams {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  submittedAt: string;
}

/**
 * Parameters for lead confirmation
 */
export interface LeadConfirmationParams {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  submittedAt: string;
  executiveSummary?: string;
  budgetEstimate?: number;
  timelineEstimate?: string;
}

/**
 * Parameters for admin notifications
 */
export interface AdminNotificationsParams {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  submittedAt: string;
}

/**
 * Send notification to client when a proposal is submitted for their project
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * @param params Client notification parameters
 * @returns Promise that resolves when email is sent (or fails gracefully)
 */
export async function sendClientNotification(
  params: ClientNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get project and client details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title, client_id')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project for client notification: ${projectError?.message || 'Project not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get client user details
    const { data: clientData, error: clientError } = await supabase.auth.admin.getUserById(
      project.client_id
    );

    if (clientError || !clientData.user) {
      const errorMsg = `Failed to fetch client user: ${clientError?.message || 'User not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const clientName = clientData.user.user_metadata?.full_name || 
                      clientData.user.user_metadata?.name || 
                      'Client';
    const clientEmail = clientData.user.email;

    if (!clientEmail) {
      const errorMsg = 'Client email not found';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get proposal lead details for team name
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('lead_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      const errorMsg = `Failed to fetch proposal: ${proposalError?.message || 'Proposal not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { data: leadData, error: leadError } = await supabase.auth.admin.getUserById(
      proposal.lead_id
    );

    if (leadError || !leadData.user) {
      const errorMsg = `Failed to fetch lead user: ${leadError?.message || 'User not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const teamName = leadData.user.user_metadata?.full_name || 
                    leadData.user.user_metadata?.name || 
                    'Bidding Team';

    // Generate proposal URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    const proposalUrl = `${baseUrl}/proposals/${params.proposalId}`;

    // Generate and send email
    const emailContent = getProposalSubmissionClientEmail({
      clientName,
      projectTitle: project.title,
      proposalTitle: params.proposalTitle,
      teamName,
      submittedAt: params.submittedAt,
      proposalUrl,
    });

    const result = await sendEmail({
      to: clientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      console.error('Failed to send client notification email:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`Client notification sent successfully to ${clientEmail}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending client notification:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send confirmation to project lead when their proposal is submitted
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * 
 * @param params Lead confirmation parameters
 * @returns Promise that resolves when email is sent (or fails gracefully)
 */
export async function sendLeadConfirmation(
  params: LeadConfirmationParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project for lead confirmation: ${projectError?.message || 'Project not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get proposal lead details
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('lead_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      const errorMsg = `Failed to fetch proposal: ${proposalError?.message || 'Proposal not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { data: leadData, error: leadError } = await supabase.auth.admin.getUserById(
      proposal.lead_id
    );

    if (leadError || !leadData.user) {
      const errorMsg = `Failed to fetch lead user: ${leadError?.message || 'User not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const leadName = leadData.user.user_metadata?.full_name || 
                    leadData.user.user_metadata?.name || 
                    'Project Lead';
    const leadEmail = leadData.user.email;

    if (!leadEmail) {
      const errorMsg = 'Lead email not found';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Generate proposal URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    const proposalUrl = `${baseUrl}/proposals/${params.proposalId}`;

    // Generate and send email
    const emailContent = getProposalSubmissionLeadEmail({
      leadName,
      projectTitle: project.title,
      proposalTitle: params.proposalTitle,
      submittedAt: params.submittedAt,
      proposalUrl,
      executiveSummary: params.executiveSummary,
      budgetEstimate: params.budgetEstimate,
      timelineEstimate: params.timelineEstimate,
    });

    const result = await sendEmail({
      to: leadEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      console.error('Failed to send lead confirmation email:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`Lead confirmation sent successfully to ${leadEmail}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending lead confirmation:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send notifications to all admins when a proposal is submitted
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.5
 * 
 * @param params Admin notifications parameters
 * @returns Promise that resolves when all emails are sent (or fail gracefully)
 */
export async function sendAdminNotifications(
  params: AdminNotificationsParams
): Promise<{ success: boolean; sentCount: number; failedCount: number; errors: string[] }> {
  const supabase = await createClient();
  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  try {
    // Get project and client details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title, client_id')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project for admin notifications: ${projectError?.message || 'Project not found'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, sentCount, failedCount, errors };
    }

    // Get client details
    const { data: clientData, error: clientError } = await supabase.auth.admin.getUserById(
      project.client_id
    );

    if (clientError || !clientData.user) {
      const errorMsg = `Failed to fetch client user: ${clientError?.message || 'User not found'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, sentCount, failedCount, errors };
    }

    const clientName = clientData.user.user_metadata?.full_name || 
                      clientData.user.user_metadata?.name || 
                      'Client';

    // Get proposal lead details for team name
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('lead_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      const errorMsg = `Failed to fetch proposal: ${proposalError?.message || 'Proposal not found'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, sentCount, failedCount, errors };
    }

    const { data: leadData, error: leadError } = await supabase.auth.admin.getUserById(
      proposal.lead_id
    );

    if (leadError || !leadData.user) {
      const errorMsg = `Failed to fetch lead user: ${leadError?.message || 'User not found'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, sentCount, failedCount, errors };
    }

    const teamName = leadData.user.user_metadata?.full_name || 
                    leadData.user.user_metadata?.name || 
                    'Bidding Team';

    // Generate URLs
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    const proposalUrl = `${baseUrl}/proposals/${params.proposalId}`;
    const projectUrl = `${baseUrl}/client-projects/${params.projectId}`;

    // Get all admin users
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !allUsers) {
      const errorMsg = `Failed to fetch users: ${usersError?.message || 'Users not found'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, sentCount, failedCount, errors };
    }

    // Filter for admin users
    const admins = allUsers.users.filter(
      (user: any) => user.user_metadata?.role === 'admin'
    );

    if (admins.length === 0) {
      console.log('No admin users found to notify');
      return { success: true, sentCount: 0, failedCount: 0, errors: [] };
    }

    // Send individual email to each admin
    for (const admin of admins) {
      try {
        if (!admin.email) {
          const errorMsg = `Admin user ${admin.id} has no email address`;
          console.error(errorMsg);
          errors.push(errorMsg);
          failedCount++;
          continue;
        }

        const emailContent = getProposalSubmissionAdminEmail({
          projectTitle: project.title,
          clientName,
          teamName,
          proposalTitle: params.proposalTitle,
          submittedAt: params.submittedAt,
          projectUrl,
          proposalUrl,
        });

        const result = await sendEmail({
          to: admin.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        if (result.success) {
          sentCount++;
          console.log(`Admin notification sent successfully to ${admin.email}`);
        } else {
          failedCount++;
          const errorMsg = `Failed to send to ${admin.email}: ${result.error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      } catch (adminError) {
        failedCount++;
        const errorMsg = adminError instanceof Error ? adminError.message : 'Unknown error';
        console.error(`Error sending admin notification to ${admin.email}:`, errorMsg);
        errors.push(`${admin.email}: ${errorMsg}`);
      }
    }

    const success = sentCount > 0;
    console.log(`Admin notifications: ${sentCount} sent, ${failedCount} failed`);
    
    return { success, sentCount, failedCount, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending admin notifications:', errorMsg);
    errors.push(errorMsg);
    return { success: false, sentCount, failedCount, errors };
  }
}
