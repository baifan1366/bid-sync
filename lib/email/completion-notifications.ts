/**
 * Completion Notification Service
 * 
 * Handles email notifications for project delivery and completion events.
 * 
 * Implements requirements 2.2, 4.3, 5.3 from the project-delivery-archival spec.
 */

import { sendEmail } from './service';
import { createClient } from '@/lib/supabase/server';

/**
 * Parameters for client notification on ready for delivery
 */
export interface ClientReadyForDeliveryParams {
  clientId: string;
  projectId: string;
  projectTitle: string;
  teamName: string;
  deliverableCount: number;
}

/**
 * Parameters for team notification on completion
 */
export interface TeamCompletionParams {
  projectId: string;
  proposalId: string;
  projectTitle: string;
  clientName: string;
}

/**
 * Parameters for lead notification on revision request
 */
export interface LeadRevisionRequestParams {
  leadId: string;
  projectId: string;
  projectTitle: string;
  clientName: string;
  revisionNotes: string;
}

/**
 * Send notification to client when project is marked ready for delivery
 * 
 * Requirement 2.2: Notify client when project status changes to "pending_completion"
 * 
 * @param params - Client notification parameters
 * @returns Promise with success status
 */
export async function sendClientReadyForDeliveryNotification(
  params: ClientReadyForDeliveryParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', params.clientId)
      .single();

    if (clientError || !client || !client.email) {
      console.error('Error fetching client details:', clientError);
      return {
        success: false,
        error: 'Client not found or email not available',
      };
    }

    const clientName = client.full_name || 'Valued Client';
    const projectUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/client-projects/${params.projectId}`;

    const subject = `Project Ready for Review: ${params.projectTitle}`;

    const html = getEmailBase(`
      <div class="content">
        <h1>🎉 Project Ready for Your Review</h1>
        <p>Hello ${clientName},</p>
        <p>
          Great news! The bidding team has completed work on your project and submitted 
          ${params.deliverableCount} deliverable${params.deliverableCount !== 1 ? 's' : ''} for your review.
        </p>
        <div class="info-box">
          <p style="margin: 0;"><strong>Project Details:</strong></p>
          <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${params.projectTitle}</p>
          <p style="margin: 4px 0 0 0;"><strong>Team:</strong> ${params.teamName}</p>
          <p style="margin: 4px 0 0 0;"><strong>Deliverables:</strong> ${params.deliverableCount} file${params.deliverableCount !== 1 ? 's' : ''}</p>
        </div>
        <p>
          Please review the submitted deliverables to ensure they meet your project requirements. 
          You can download each file, review the work, and then choose to either accept the completion 
          or request revisions.
        </p>
        <div style="text-align: center;">
          <a href="${projectUrl}" class="button">Review Deliverables</a>
        </div>
        <p style="font-size: 14px; color: #6B7280;">
          <strong>What's Next?</strong><br>
          • Download and review all deliverables<br>
          • Accept completion if everything meets your requirements<br>
          • Request revisions if changes are needed
        </p>
      </div>
    `);

    const text = `
Project Ready for Your Review

Hello ${clientName},

Great news! The bidding team has completed work on your project and submitted ${params.deliverableCount} deliverable${params.deliverableCount !== 1 ? 's' : ''} for your review.

Project Details:
- Project: ${params.projectTitle}
- Team: ${params.teamName}
- Deliverables: ${params.deliverableCount} file${params.deliverableCount !== 1 ? 's' : ''}

Please review the submitted deliverables to ensure they meet your project requirements. You can download each file, review the work, and then choose to either accept the completion or request revisions.

Review Deliverables:
${projectUrl}

What's Next?
• Download and review all deliverables
• Accept completion if everything meets your requirements
• Request revisions if changes are needed

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
    `.trim();

    return await sendEmail({
      to: client.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('Error sending client ready for delivery notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send notifications to all team members when project is completed
 * 
 * Requirement 4.3: Notify all bidding team members when project is marked completed
 * 
 * @param params - Team completion parameters
 * @returns Promise with success status
 */
export async function sendTeamCompletionNotifications(
  params: TeamCompletionParams
): Promise<{ success: boolean; error?: string; notificationsSent: number }> {
  try {
    const supabase = await createClient();

    // Get all team members for this project
    const { data: teamMembers, error: teamError } = await supabase
      .from('bid_team_members')
      .select('user_id, users!inner(email, full_name)')
      .eq('project_id', params.projectId);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return {
        success: false,
        error: 'Failed to fetch team members',
        notificationsSent: 0,
      };
    }

    if (!teamMembers || teamMembers.length === 0) {
      return {
        success: true,
        notificationsSent: 0,
      };
    }

    const projectUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/lead-projects/${params.projectId}`;

    // Send notification to each team member
    const notificationPromises = teamMembers.map(async (member) => {
      const user = (member.users as any);
      if (!user || !user.email) {
        return { success: false };
      }

      const memberName = user.full_name || 'Team Member';
      const subject = `Project Completed: ${params.projectTitle}`;

      const html = getEmailBase(`
        <div class="content">
          <h1>✅ Project Successfully Completed!</h1>
          <p>Hello ${memberName},</p>
          <p>
            Congratulations! The client has accepted the project completion. 
            Your hard work has paid off!
          </p>
          <div class="info-box">
            <p style="margin: 0;"><strong>Project Details:</strong></p>
            <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${params.projectTitle}</p>
            <p style="margin: 4px 0 0 0;"><strong>Client:</strong> ${params.clientName}</p>
            <p style="margin: 4px 0 0 0;"><strong>Status:</strong> Completed</p>
          </div>
          <p>
            The project has been officially marked as completed and will be archived for future reference. 
            Thank you for your excellent work on this project!
          </p>
          <div style="text-align: center;">
            <a href="${projectUrl}" class="button">View Project</a>
          </div>
          <p style="font-size: 14px; color: #6B7280;">
            The project data will be archived and remain accessible for your records.
          </p>
        </div>
      `);

      const text = `
Project Successfully Completed!

Hello ${memberName},

Congratulations! The client has accepted the project completion. Your hard work has paid off!

Project Details:
- Project: ${params.projectTitle}
- Client: ${params.clientName}
- Status: Completed

The project has been officially marked as completed and will be archived for future reference. Thank you for your excellent work on this project!

View Project:
${projectUrl}

The project data will be archived and remain accessible for your records.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
      `.trim();

      return await sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });
    });

    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    return {
      success: true,
      notificationsSent: successCount,
    };
  } catch (error) {
    console.error('Error sending team completion notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationsSent: 0,
    };
  }
}

/**
 * Send notification to bidding lead when client requests revisions
 * 
 * Requirement 5.3: Notify bidding lead with revision notes when revisions are requested
 * 
 * @param params - Lead revision request parameters
 * @returns Promise with success status
 */
export async function sendLeadRevisionRequestNotification(
  params: LeadRevisionRequestParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', params.leadId)
      .single();

    if (leadError || !lead || !lead.email) {
      console.error('Error fetching lead details:', leadError);
      return {
        success: false,
        error: 'Lead not found or email not available',
      };
    }

    const leadName = lead.full_name || 'Team Lead';
    const projectUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/lead-projects/${params.projectId}`;

    const subject = `Revisions Requested: ${params.projectTitle}`;

    const html = getEmailBase(`
      <div class="content">
        <h1>📝 Revisions Requested</h1>
        <p>Hello ${leadName},</p>
        <p>
          The client has reviewed the deliverables and is requesting revisions 
          before accepting the project completion.
        </p>
        <div class="info-box">
          <p style="margin: 0;"><strong>Project Details:</strong></p>
          <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${params.projectTitle}</p>
          <p style="margin: 4px 0 0 0;"><strong>Client:</strong> ${params.clientName}</p>
        </div>
        <div class="info-box" style="background-color: rgba(251, 191, 36, 0.15);">
          <p style="margin: 0;"><strong>Revision Notes from Client:</strong></p>
          <p style="margin: 8px 0 0 0; color: #000000; white-space: pre-wrap;">${params.revisionNotes}</p>
        </div>
        <p>
          The project status has been changed back to "awarded" so you can upload additional 
          deliverables or make the requested changes. Once you've addressed the feedback, 
          you can mark the project ready for delivery again.
        </p>
        <div style="text-align: center;">
          <a href="${projectUrl}" class="button">View Project & Upload Revisions</a>
        </div>
        <p style="font-size: 14px; color: #6B7280;">
          <strong>Next Steps:</strong><br>
          • Review the client's feedback carefully<br>
          • Make the requested changes<br>
          • Upload updated deliverables<br>
          • Mark the project ready for delivery again
        </p>
      </div>
    `);

    const text = `
Revisions Requested

Hello ${leadName},

The client has reviewed the deliverables and is requesting revisions before accepting the project completion.

Project Details:
- Project: ${params.projectTitle}
- Client: ${params.clientName}

Revision Notes from Client:
${params.revisionNotes}

The project status has been changed back to "awarded" so you can upload additional deliverables or make the requested changes. Once you've addressed the feedback, you can mark the project ready for delivery again.

View Project & Upload Revisions:
${projectUrl}

Next Steps:
• Review the client's feedback carefully
• Make the requested changes
• Upload updated deliverables
• Mark the project ready for delivery again

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
    `.trim();

    return await sendEmail({
      to: lead.email,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('Error sending lead revision request notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Base email template with BidSync branding
 * Matches the design system from templates.ts
 */
function getEmailBase(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BidSync Notification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #ffffff;
      color: #000000;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      display: inline-block;
      background-color: #FBBF24;
      color: #000000;
      padding: 12px 24px;
      font-size: 24px;
      font-weight: bold;
      border-radius: 8px;
      text-decoration: none;
    }
    .content {
      background-color: #ffffff;
      border: 2px solid rgba(251, 191, 36, 0.2);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .content h1 {
      color: #000000;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      color: #374151;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .button {
      display: inline-block;
      background-color: #FBBF24;
      color: #000000;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #F59E0B;
    }
    .info-box {
      background-color: rgba(251, 191, 36, 0.1);
      border-left: 4px solid #FBBF24;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      color: #6B7280;
      font-size: 14px;
      margin-top: 32px;
    }
    .footer a {
      color: #FBBF24;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo">BidSync</span>
    </div>
    ${content}
    <div class="footer">
      <p>
        This is an automated message from BidSync.<br>
        If you have any questions, please contact our support team.
      </p>
      <p>
        &copy; ${new Date().getFullYear()} BidSync. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
