/**
 * Email Templates for BidSync Notification System
 * 
 * Comprehensive email templates following BidSync design system (yellow-black-white)
 * 
 * Requirements:
 * - 2.2: Email templates following BidSync design system
 * - 18.1: Yellow (#FBBF24) as primary accent color
 * - 18.2: Black text on white background
 * - 18.3: Yellow background with black text for buttons
 * - 18.4: Include BidSync logo
 * - 18.5: Mobile-responsive design
 */

import { NotificationType } from '@/lib/notification-types';

interface NotificationEmailParams {
  userName: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Base email template with BidSync branding
 * 
 * Requirements:
 * - 18.1-18.5: BidSync design system compliance
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
    .info-box p {
      margin: 4px 0;
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
    @media only screen and (max-width: 600px) {
      .container {
        padding: 20px 10px;
      }
      .content {
        padding: 20px;
      }
      .content h1 {
        font-size: 20px;
      }
      .button {
        display: block;
        text-align: center;
      }
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

/**
 * Generate email content for a notification
 * 
 * @param type - Notification type
 * @param params - Email parameters
 * @returns Email subject, HTML, and text content
 */
export function getNotificationEmail(
  type: NotificationType,
  params: NotificationEmailParams
): { subject: string; html: string; text: string } {
  const { userName, title, body, data, actionUrl, actionText } = params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bidsync.com';

  // Generate type-specific content
  const typeContent = getTypeSpecificContent(type, data);
  
  const html = getEmailBase(`
    <div class="content">
      <h1>${title}</h1>
      <p>Hello ${userName},</p>
      ${body ? `<p>${body}</p>` : ''}
      ${typeContent.html}
      ${actionUrl ? `
        <div style="text-align: center;">
          <a href="${actionUrl}" class="button">${actionText || 'View Details'}</a>
        </div>
      ` : `
        <div style="text-align: center;">
          <a href="${baseUrl}" class="button">View Dashboard</a>
        </div>
      `}
    </div>
  `);

  const text = `
${title}

Hello ${userName},

${body || ''}

${typeContent.text}

${actionUrl ? `${actionText || 'View Details'}: ${actionUrl}` : `View Dashboard: ${baseUrl}`}

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: title,
    html,
    text,
  };
}

/**
 * Generate type-specific content for notifications
 */
function getTypeSpecificContent(
  type: NotificationType,
  data?: Record<string, any>
): { html: string; text: string } {
  if (!data) {
    return { html: '', text: '' };
  }

  switch (type) {
    case 'proposal_submitted':
      return {
        html: `
          <div class="info-box">
            <p><strong>Proposal Details:</strong></p>
            ${data.projectTitle ? `<p><strong>Project:</strong> ${data.projectTitle}</p>` : ''}
            ${data.proposalTitle ? `<p><strong>Proposal:</strong> ${data.proposalTitle}</p>` : ''}
            ${data.teamName ? `<p><strong>Team:</strong> ${data.teamName}</p>` : ''}
          </div>
        `,
        text: `
Proposal Details:
${data.projectTitle ? `- Project: ${data.projectTitle}` : ''}
${data.proposalTitle ? `- Proposal: ${data.proposalTitle}` : ''}
${data.teamName ? `- Team: ${data.teamName}` : ''}
        `.trim(),
      };

    case 'proposal_scored':
    case 'proposal_score_updated':
      return {
        html: `
          <div class="info-box">
            <p><strong>Scoring Results:</strong></p>
            ${data.projectTitle ? `<p><strong>Project:</strong> ${data.projectTitle}</p>` : ''}
            ${data.proposalTitle ? `<p><strong>Proposal:</strong> ${data.proposalTitle}</p>` : ''}
            ${data.totalScore !== undefined ? `<p><strong>Total Score:</strong> ${data.totalScore.toFixed(2)}</p>` : ''}
            ${data.rank !== undefined ? `<p><strong>Rank:</strong> #${data.rank}</p>` : ''}
          </div>
        `,
        text: `
Scoring Results:
${data.projectTitle ? `- Project: ${data.projectTitle}` : ''}
${data.proposalTitle ? `- Proposal: ${data.proposalTitle}` : ''}
${data.totalScore !== undefined ? `- Total Score: ${data.totalScore.toFixed(2)}` : ''}
${data.rank !== undefined ? `- Rank: #${data.rank}` : ''}
        `.trim(),
      };

    case 'team_member_joined':
    case 'team_member_removed':
      return {
        html: `
          <div class="info-box">
            <p><strong>Team Update:</strong></p>
            ${data.projectTitle ? `<p><strong>Project:</strong> ${data.projectTitle}</p>` : ''}
            ${data.memberName ? `<p><strong>Member:</strong> ${data.memberName}</p>` : ''}
            ${data.role ? `<p><strong>Role:</strong> ${data.role}</p>` : ''}
          </div>
        `,
        text: `
Team Update:
${data.projectTitle ? `- Project: ${data.projectTitle}` : ''}
${data.memberName ? `- Member: ${data.memberName}` : ''}
${data.role ? `- Role: ${data.role}` : ''}
        `.trim(),
      };

    case 'ready_for_delivery':
      return {
        html: `
          <div class="info-box">
            <p><strong>Delivery Details:</strong></p>
            ${data.projectTitle ? `<p><strong>Project:</strong> ${data.projectTitle}</p>` : ''}
            ${data.teamName ? `<p><strong>Team:</strong> ${data.teamName}</p>` : ''}
            ${data.deliverableCount !== undefined ? `<p><strong>Deliverables:</strong> ${data.deliverableCount}</p>` : ''}
          </div>
        `,
        text: `
Delivery Details:
${data.projectTitle ? `- Project: ${data.projectTitle}` : ''}
${data.teamName ? `- Team: ${data.teamName}` : ''}
${data.deliverableCount !== undefined ? `- Deliverables: ${data.deliverableCount}` : ''}
        `.trim(),
      };

    case 'project_deadline_approaching':
    case 'section_deadline_approaching':
      return {
        html: `
          <div class="info-box">
            <p><strong>Deadline Alert:</strong></p>
            ${data.projectTitle ? `<p><strong>Project:</strong> ${data.projectTitle}</p>` : ''}
            ${data.sectionTitle ? `<p><strong>Section:</strong> ${data.sectionTitle}</p>` : ''}
            ${data.daysRemaining !== undefined ? `<p><strong>Days Remaining:</strong> ${data.daysRemaining}</p>` : ''}
            ${data.deadline ? `<p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>` : ''}
          </div>
        `,
        text: `
Deadline Alert:
${data.projectTitle ? `- Project: ${data.projectTitle}` : ''}
${data.sectionTitle ? `- Section: ${data.sectionTitle}` : ''}
${data.daysRemaining !== undefined ? `- Days Remaining: ${data.daysRemaining}` : ''}
${data.deadline ? `- Deadline: ${new Date(data.deadline).toLocaleDateString()}` : ''}
        `.trim(),
      };

    case 'section_assigned':
    case 'section_reassigned':
      return {
        html: `
          <div class="info-box">
            <p><strong>Section Assignment:</strong></p>
            ${data.documentTitle ? `<p><strong>Document:</strong> ${data.documentTitle}</p>` : ''}
            ${data.sectionTitle ? `<p><strong>Section:</strong> ${data.sectionTitle}</p>` : ''}
            ${data.deadline ? `<p><strong>Deadline:</strong> ${new Date(data.deadline).toLocaleDateString()}</p>` : ''}
          </div>
        `,
        text: `
Section Assignment:
${data.documentTitle ? `- Document: ${data.documentTitle}` : ''}
${data.sectionTitle ? `- Section: ${data.sectionTitle}` : ''}
${data.deadline ? `- Deadline: ${new Date(data.deadline).toLocaleDateString()}` : ''}
        `.trim(),
      };

    case 'verification_approved':
    case 'verification_rejected':
      return {
        html: `
          <div class="info-box">
            <p><strong>Account Status Update</strong></p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
          </div>
        `,
        text: `
Account Status Update
${data.reason ? `- Reason: ${data.reason}` : ''}
        `.trim(),
      };

    case 'account_suspended':
      return {
        html: `
          <div class="info-box">
            <p><strong>Suspension Details:</strong></p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
            ${data.suspendedAt ? `<p><strong>Date:</strong> ${new Date(data.suspendedAt).toLocaleDateString()}</p>` : ''}
          </div>
        `,
        text: `
Suspension Details:
${data.reason ? `- Reason: ${data.reason}` : ''}
${data.suspendedAt ? `- Date: ${new Date(data.suspendedAt).toLocaleDateString()}` : ''}
        `.trim(),
      };

    default:
      return { html: '', text: '' };
  }
}

/**
 * Generate email for project-related notifications
 */
export function getProjectNotificationEmail(params: {
  userName: string;
  projectTitle: string;
  projectId: string;
  type: 'created' | 'approved' | 'rejected' | 'awarded' | 'completed';
  additionalInfo?: string;
}): { subject: string; html: string; text: string } {
  const { userName, projectTitle, projectId, type, additionalInfo } = params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bidsync.com';
  const projectUrl = `${baseUrl}/projects/${projectId}`;

  const titles: Record<typeof type, string> = {
    created: 'New Project Created',
    approved: 'Project Approved',
    rejected: 'Project Update',
    awarded: 'Project Awarded',
    completed: 'Project Completed',
  };

  const title = titles[type];

  const html = getEmailBase(`
    <div class="content">
      <h1>${title}</h1>
      <p>Hello ${userName},</p>
      <div class="info-box">
        <p><strong>Project:</strong> ${projectTitle}</p>
        ${additionalInfo ? `<p>${additionalInfo}</p>` : ''}
      </div>
      <div style="text-align: center;">
        <a href="${projectUrl}" class="button">View Project</a>
      </div>
    </div>
  `);

  const text = `
${title}

Hello ${userName},

Project: ${projectTitle}
${additionalInfo || ''}

View Project: ${projectUrl}

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `${title}: ${projectTitle}`,
    html,
    text,
  };
}

/**
 * Generate email for deadline reminders
 */
export function getDeadlineReminderEmail(params: {
  userName: string;
  itemTitle: string;
  itemType: 'project' | 'section';
  daysRemaining: number;
  deadline: string;
  itemUrl: string;
}): { subject: string; html: string; text: string } {
  const { userName, itemTitle, itemType, daysRemaining, deadline, itemUrl } = params;
  const deadlineDate = new Date(deadline).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const urgencyEmoji = daysRemaining <= 1 ? '🚨' : daysRemaining <= 3 ? '⚠️' : '📅';

  const html = getEmailBase(`
    <div class="content">
      <h1>${urgencyEmoji} Deadline Reminder</h1>
      <p>Hello ${userName},</p>
      <p>This is a reminder that your ${itemType} deadline is approaching.</p>
      <div class="info-box">
        <p><strong>${itemType === 'project' ? 'Project' : 'Section'}:</strong> ${itemTitle}</p>
        <p><strong>Deadline:</strong> ${deadlineDate}</p>
        <p><strong>Days Remaining:</strong> ${daysRemaining}</p>
      </div>
      <p>Please ensure you complete your work before the deadline.</p>
      <div style="text-align: center;">
        <a href="${itemUrl}" class="button">View ${itemType === 'project' ? 'Project' : 'Section'}</a>
      </div>
    </div>
  `);

  const text = `
${urgencyEmoji} Deadline Reminder

Hello ${userName},

This is a reminder that your ${itemType} deadline is approaching.

${itemType === 'project' ? 'Project' : 'Section'}: ${itemTitle}
Deadline: ${deadlineDate}
Days Remaining: ${daysRemaining}

Please ensure you complete your work before the deadline.

View ${itemType === 'project' ? 'Project' : 'Section'}: ${itemUrl}

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Deadline Reminder: ${itemTitle} (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`,
    html,
    text,
  };
}
