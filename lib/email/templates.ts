/**
 * Email Templates for BidSync Admin Notifications
 * 
 * These templates follow the BidSync design system with yellow-black-white color scheme
 */

interface AdminInvitationEmailParams {
  inviteeEmail: string;
  inviterName: string;
  invitationToken: string;
  expiresAt: string;
}

interface VerificationApprovalEmailParams {
  clientName: string;
  clientEmail: string;
}

interface VerificationRejectionEmailParams {
  clientName: string;
  clientEmail: string;
  reason: string;
}

interface AccountSuspensionEmailParams {
  userName: string;
  userEmail: string;
  reason: string;
  suspendedAt: string;
}

interface ProposalSubmissionClientEmailParams {
  clientName: string;
  projectTitle: string;
  proposalTitle: string;
  teamName: string;
  submittedAt: string;
  proposalUrl: string;
}

interface ProposalSubmissionLeadEmailParams {
  leadName: string;
  projectTitle: string;
  proposalTitle: string;
  submittedAt: string;
  proposalUrl: string;
  executiveSummary?: string;
  budgetEstimate?: number;
  timelineEstimate?: string;
}

interface ProposalSubmissionAdminEmailParams {
  projectTitle: string;
  clientName: string;
  teamName: string;
  proposalTitle: string;
  submittedAt: string;
  projectUrl: string;
  proposalUrl: string;
}

interface DocumentInvitationEmailParams {
  inviterName: string;
  documentTitle: string;
  role: string;
  invitationUrl: string;
  expiresAt: string;
}

interface RollbackNotificationEmailParams {
  userName: string;
  userEmail: string;
  documentTitle: string;
  versionNumber: number;
  rolledBackBy: string;
  documentUrl: string;
}

interface RoleChangeNotificationEmailParams {
  userName: string;
  userEmail: string;
  documentTitle: string;
  newRole: string;
  documentUrl: string;
}

interface AccessRevocationEmailParams {
  userName: string;
  userEmail: string;
  documentTitle: string;
}

interface ProposalScoredEmailParams {
  leadName: string;
  proposalTitle: string;
  projectTitle: string;
  totalScore: number;
  rank: number;
  proposalUrl: string;
}

interface ScoreUpdatedEmailParams {
  leadName: string;
  proposalTitle: string;
  projectTitle: string;
  previousScore: number;
  newScore: number;
  previousRank: number;
  newRank: number;
  proposalUrl: string;
}

interface AllProposalsScoredEmailParams {
  clientName: string;
  projectTitle: string;
  proposalCount: number;
  topProposalTitle: string;
  topProposalScore: number;
  projectUrl: string;
}

/**
 * Base email template with BidSync branding
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

/**
 * Admin Invitation Email Template
 * Sent when an existing admin invites a new admin to the platform
 */
export function getAdminInvitationEmail(params: AdminInvitationEmailParams): { subject: string; html: string; text: string } {
  const { inviteeEmail, inviterName, invitationToken, expiresAt } = params;
  const invitationUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/admin/accept-invitation?token=${invitationToken}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const html = getEmailBase(`
    <div class="content">
      <h1>You've Been Invited to Join BidSync as an Administrator</h1>
      <p>Hello,</p>
      <p>
        <strong>${inviterName}</strong> has invited you to become an administrator on BidSync. 
        As an admin, you'll have access to manage users, verify client registrations, and oversee platform operations.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Invitation Details:</strong></p>
        <p style="margin: 8px 0 0 0;">Email: ${inviteeEmail}</p>
        <p style="margin: 4px 0 0 0;">Expires: ${expiryDate}</p>
      </div>
      <p>Click the button below to accept your invitation and set up your admin account:</p>
      <div style="text-align: center;">
        <a href="${invitationUrl}" class="button">Accept Invitation</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${invitationUrl}" style="color: #FBBF24; word-break: break-all;">${invitationUrl}</a>
      </p>
      <p style="font-size: 14px; color: #6B7280;">
        This invitation will expire on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `);

  const text = `
You've Been Invited to Join BidSync as an Administrator

Hello,

${inviterName} has invited you to become an administrator on BidSync. As an admin, you'll have access to manage users, verify client registrations, and oversee platform operations.

Invitation Details:
- Email: ${inviteeEmail}
- Expires: ${expiryDate}

Accept your invitation by visiting this link:
${invitationUrl}

This invitation will expire on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: 'You\'ve Been Invited to Join BidSync as an Administrator',
    html,
    text,
  };
}

/**
 * Verification Approval Email Template
 * Sent when an admin approves a client's verification request
 */
export function getVerificationApprovalEmail(params: VerificationApprovalEmailParams): { subject: string; html: string; text: string } {
  const { clientName, clientEmail } = params;
  const dashboardUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/projects`;

  const html = getEmailBase(`
    <div class="content">
      <h1>🎉 Your Account Has Been Verified!</h1>
      <p>Hello ${clientName},</p>
      <p>
        Great news! Your BidSync account has been successfully verified by our team. 
        You can now create and post projects to connect with qualified bidding teams.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>What's Next?</strong></p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>Create your first project</li>
          <li>Review proposals from bidding teams</li>
          <li>Communicate with teams through our chat system</li>
          <li>Award projects to the best proposals</li>
        </ul>
      </div>
      <p>Ready to get started? Head to your dashboard to create your first project:</p>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
      </div>
      <p>
        If you have any questions about using BidSync, our support team is here to help.
      </p>
    </div>
  `);

  const text = `
Your Account Has Been Verified!

Hello ${clientName},

Great news! Your BidSync account has been successfully verified by our team. You can now create and post projects to connect with qualified bidding teams.

What's Next?
- Create your first project
- Review proposals from bidding teams
- Communicate with teams through our chat system
- Award projects to the best proposals

Ready to get started? Visit your dashboard:
${dashboardUrl}

If you have any questions about using BidSync, our support team is here to help.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: 'Your BidSync Account Has Been Verified',
    html,
    text,
  };
}

/**
 * Verification Rejection Email Template
 * Sent when an admin rejects a client's verification request
 */
export function getVerificationRejectionEmail(params: VerificationRejectionEmailParams): { subject: string; html: string; text: string } {
  const { clientName, clientEmail, reason } = params;
  const supportUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/support`;

  const html = getEmailBase(`
    <div class="content">
      <h1>Update on Your Account Verification</h1>
      <p>Hello ${clientName},</p>
      <p>
        Thank you for your interest in BidSync. After reviewing your account verification request, 
        we're unable to approve your account at this time.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Reason:</strong></p>
        <p style="margin: 8px 0 0 0;">${reason}</p>
      </div>
      <p>
        If you believe this decision was made in error or if you'd like to provide additional information, 
        please don't hesitate to contact our support team. We're here to help and will be happy to review your case.
      </p>
      <div style="text-align: center;">
        <a href="${supportUrl}" class="button">Contact Support</a>
      </div>
      <p>
        We appreciate your understanding and look forward to potentially working with you in the future.
      </p>
    </div>
  `);

  const text = `
Update on Your Account Verification

Hello ${clientName},

Thank you for your interest in BidSync. After reviewing your account verification request, we're unable to approve your account at this time.

Reason:
${reason}

If you believe this decision was made in error or if you'd like to provide additional information, please don't hesitate to contact our support team. We're here to help and will be happy to review your case.

Contact Support:
${supportUrl}

We appreciate your understanding and look forward to potentially working with you in the future.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: 'Update on Your BidSync Account Verification',
    html,
    text,
  };
}

/**
 * Account Suspension Email Template
 * Sent when an admin suspends a user account
 */
export function getAccountSuspensionEmail(params: AccountSuspensionEmailParams): { subject: string; html: string; text: string } {
  const { userName, userEmail, reason, suspendedAt } = params;
  const supportUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com'}/support`;
  const suspensionDate = new Date(suspendedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = getEmailBase(`
    <div class="content">
      <h1>Your BidSync Account Has Been Suspended</h1>
      <p>Hello ${userName},</p>
      <p>
        We're writing to inform you that your BidSync account (${userEmail}) has been suspended 
        as of ${suspensionDate}.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Reason for Suspension:</strong></p>
        <p style="margin: 8px 0 0 0;">${reason}</p>
      </div>
      <p>
        During this suspension period, you will not be able to access your account or use BidSync services.
      </p>
      <p>
        If you believe this suspension was made in error or if you'd like to discuss this decision, 
        please contact our support team. We're committed to maintaining a fair and safe platform for all users.
      </p>
      <div style="text-align: center;">
        <a href="${supportUrl}" class="button">Contact Support</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        Please note that repeated violations of our terms of service may result in permanent account termination.
      </p>
    </div>
  `);

  const text = `
Your BidSync Account Has Been Suspended

Hello ${userName},

We're writing to inform you that your BidSync account (${userEmail}) has been suspended as of ${suspensionDate}.

Reason for Suspension:
${reason}

During this suspension period, you will not be able to access your account or use BidSync services.

If you believe this suspension was made in error or if you'd like to discuss this decision, please contact our support team. We're committed to maintaining a fair and safe platform for all users.

Contact Support:
${supportUrl}

Please note that repeated violations of our terms of service may result in permanent account termination.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: 'Your BidSync Account Has Been Suspended',
    html,
    text,
  };
}

/**
 * Proposal Submission Client Notification Email Template
 * Sent to the client when a proposal is submitted for their project
 */
export function getProposalSubmissionClientEmail(params: ProposalSubmissionClientEmailParams): { subject: string; html: string; text: string } {
  const { clientName, projectTitle, proposalTitle, teamName, submittedAt, proposalUrl } = params;
  const submissionDate = new Date(submittedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = getEmailBase(`
    <div class="content">
      <h1>New Proposal Submitted for Your Project</h1>
      <p>Hello ${clientName},</p>
      <p>
        Great news! A new proposal has been submitted for your project. 
        A bidding team is interested in working with you.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Proposal Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposal:</strong> ${proposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Team:</strong> ${teamName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Submitted:</strong> ${submissionDate}</p>
      </div>
      <p>
        Review the proposal details, budget, timeline, and team qualifications to determine 
        if this team is the right fit for your project.
      </p>
      <div style="text-align: center;">
        <a href="${proposalUrl}" class="button">View Proposal</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        You can compare multiple proposals, communicate with teams through our chat system, 
        and make your decision when you're ready.
      </p>
    </div>
  `);

  const text = `
New Proposal Submitted for Your Project

Hello ${clientName},

Great news! A new proposal has been submitted for your project. A bidding team is interested in working with you.

Proposal Details:
- Project: ${projectTitle}
- Proposal: ${proposalTitle}
- Team: ${teamName}
- Submitted: ${submissionDate}

Review the proposal details, budget, timeline, and team qualifications to determine if this team is the right fit for your project.

View Proposal:
${proposalUrl}

You can compare multiple proposals, communicate with teams through our chat system, and make your decision when you're ready.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `New Proposal Submitted: ${proposalTitle}`,
    html,
    text,
  };
}

/**
 * Proposal Submission Lead Confirmation Email Template
 * Sent to the project lead when their proposal is successfully submitted
 */
export function getProposalSubmissionLeadEmail(params: ProposalSubmissionLeadEmailParams): { subject: string; html: string; text: string } {
  const { leadName, projectTitle, proposalTitle, submittedAt, proposalUrl, executiveSummary, budgetEstimate, timelineEstimate } = params;
  const submissionDate = new Date(submittedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const summarySection = executiveSummary || budgetEstimate || timelineEstimate ? `
      <div class="info-box">
        <p style="margin: 0;"><strong>Submission Summary:</strong></p>
        ${budgetEstimate ? `<p style="margin: 8px 0 0 0;"><strong>Budget:</strong> $${budgetEstimate.toLocaleString()}</p>` : ''}
        ${timelineEstimate ? `<p style="margin: 4px 0 0 0;"><strong>Timeline:</strong> ${timelineEstimate}</p>` : ''}
        ${executiveSummary ? `<p style="margin: 8px 0 0 0;"><strong>Executive Summary:</strong></p><p style="margin: 4px 0 0 0; color: #374151;">${executiveSummary.substring(0, 200)}${executiveSummary.length > 200 ? '...' : ''}</p>` : ''}
      </div>
  ` : '';

  const html = getEmailBase(`
    <div class="content">
      <h1>✅ Proposal Successfully Submitted</h1>
      <p>Hello ${leadName},</p>
      <p>
        Your proposal has been successfully submitted! The client will be notified and can now 
        review your proposal along with any others they receive.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Submission Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposal:</strong> ${proposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Submitted:</strong> ${submissionDate}</p>
      </div>
      ${summarySection}
      <p>
        You can view your submitted proposal and track its status at any time. 
        The client may reach out through our chat system if they have questions.
      </p>
      <div style="text-align: center;">
        <a href="${proposalUrl}" class="button">View Your Proposal</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        <strong>What's Next?</strong><br>
        • The client will review your proposal<br>
        • You may receive questions through chat<br>
        • You'll be notified if your proposal is accepted
      </p>
    </div>
  `);

  const summaryText = executiveSummary || budgetEstimate || timelineEstimate ? `
Submission Summary:
${budgetEstimate ? `- Budget: $${budgetEstimate.toLocaleString()}` : ''}
${timelineEstimate ? `- Timeline: ${timelineEstimate}` : ''}
${executiveSummary ? `- Executive Summary: ${executiveSummary.substring(0, 200)}${executiveSummary.length > 200 ? '...' : ''}` : ''}
` : '';

  const text = `
Proposal Successfully Submitted

Hello ${leadName},

Your proposal has been successfully submitted! The client will be notified and can now review your proposal along with any others they receive.

Submission Details:
- Project: ${projectTitle}
- Proposal: ${proposalTitle}
- Submitted: ${submissionDate}
${summaryText}
You can view your submitted proposal and track its status at any time. The client may reach out through our chat system if they have questions.

View Your Proposal:
${proposalUrl}

What's Next?
• The client will review your proposal
• You may receive questions through chat
• You'll be notified if your proposal is accepted

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Proposal Submitted: ${proposalTitle}`,
    html,
    text,
  };
}

/**
 * Proposal Submission Admin Notification Email Template
 * Sent to all admins when a proposal is submitted
 */
export function getProposalSubmissionAdminEmail(params: ProposalSubmissionAdminEmailParams): { subject: string; html: string; text: string } {
  const { projectTitle, clientName, teamName, proposalTitle, submittedAt, projectUrl, proposalUrl } = params;
  const submissionDate = new Date(submittedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = getEmailBase(`
    <div class="content">
      <h1>New Proposal Submitted on Platform</h1>
      <p>Hello Admin,</p>
      <p>
        A new proposal has been submitted on BidSync. This notification is for monitoring 
        and oversight purposes.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Activity Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposal:</strong> ${proposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Team:</strong> ${teamName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Submitted:</strong> ${submissionDate}</p>
      </div>
      <p>
        You can review both the project and the submitted proposal using the links below:
      </p>
      <div style="text-align: center;">
        <a href="${projectUrl}" class="button" style="margin-right: 8px;">View Project</a>
        <a href="${proposalUrl}" class="button">View Proposal</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        This is an automated notification for platform monitoring. No action is required unless 
        you identify any issues that need attention.
      </p>
    </div>
  `);

  const text = `
New Proposal Submitted on Platform

Hello Admin,

A new proposal has been submitted on BidSync. This notification is for monitoring and oversight purposes.

Activity Details:
- Project: ${projectTitle}
- Client: ${clientName}
- Proposal: ${proposalTitle}
- Team: ${teamName}
- Submitted: ${submissionDate}

You can review both the project and the submitted proposal using the links below:

View Project:
${projectUrl}

View Proposal:
${proposalUrl}

This is an automated notification for platform monitoring. No action is required unless you identify any issues that need attention.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `[BidSync] New Proposal Submitted: ${proposalTitle}`,
    html,
    text,
  };
}

/**
 * Document Invitation Email Template
 * Sent when a user is invited to collaborate on a document
 */
export function getDocumentInvitationEmail(params: DocumentInvitationEmailParams): { subject: string; html: string; text: string } {
  const { inviterName, documentTitle, role, invitationUrl, expiresAt } = params;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = getEmailBase(`
    <div class="content">
      <h1>You've Been Invited to Collaborate</h1>
      <p>Hello,</p>
      <p>
        <strong>${inviterName}</strong> has invited you to collaborate on a document.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Invitation Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Document:</strong> ${documentTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Your Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Expires:</strong> ${expiryDate}</p>
      </div>
      <p>
        ${role === 'editor' ? 'As an editor, you\'ll be able to make changes to the document and collaborate in real-time with other team members.' : ''}
        ${role === 'commenter' ? 'As a commenter, you\'ll be able to add comments and suggestions to the document.' : ''}
        ${role === 'viewer' ? 'As a viewer, you\'ll be able to read the document but won\'t be able to make changes.' : ''}
      </p>
      <p>Click the button below to accept the invitation and start collaborating:</p>
      <div style="text-align: center;">
        <a href="${invitationUrl}" class="button">Accept Invitation</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${invitationUrl}" style="color: #FBBF24; word-break: break-all;">${invitationUrl}</a>
      </p>
      <p style="font-size: 14px; color: #6B7280;">
        This invitation will expire on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `);

  const text = `
You've Been Invited to Collaborate

Hello,

${inviterName} has invited you to collaborate on a document.

Invitation Details:
- Document: ${documentTitle}
- Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
- Expires: ${expiryDate}

${role === 'editor' ? 'As an editor, you\'ll be able to make changes to the document and collaborate in real-time with other team members.' : ''}
${role === 'commenter' ? 'As a commenter, you\'ll be able to add comments and suggestions to the document.' : ''}
${role === 'viewer' ? 'As a viewer, you\'ll be able to read the document but won\'t be able to make changes.' : ''}

Accept your invitation by visiting this link:
${invitationUrl}

This invitation will expire on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `You've Been Invited to Collaborate on "${documentTitle}"`,
    html,
    text,
  };
}

/**
 * Rollback Notification Email Template
 * Sent to all active collaborators when a document is rolled back to a previous version
 */
export function getRollbackNotificationEmail(params: RollbackNotificationEmailParams): { subject: string; html: string; text: string } {
  const { userName, documentTitle, versionNumber, rolledBackBy, documentUrl } = params;

  const html = getEmailBase(`
    <div class="content">
      <h1>Document Rolled Back to Previous Version</h1>
      <p>Hello ${userName},</p>
      <p>
        A document you're collaborating on has been rolled back to a previous version.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Rollback Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Document:</strong> ${documentTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Restored Version:</strong> Version ${versionNumber}</p>
        <p style="margin: 4px 0 0 0;"><strong>Rolled Back By:</strong> ${rolledBackBy}</p>
      </div>
      <p>
        The document has been restored to an earlier state. Any changes made after version ${versionNumber} 
        are no longer visible in the current document, but they remain preserved in the version history.
      </p>
      <p>
        If you were actively editing the document, please refresh your browser to see the restored version.
      </p>
      <div style="text-align: center;">
        <a href="${documentUrl}" class="button">View Document</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        You can view the complete version history and compare different versions at any time.
      </p>
    </div>
  `);

  const text = `
Document Rolled Back to Previous Version

Hello ${userName},

A document you're collaborating on has been rolled back to a previous version.

Rollback Details:
- Document: ${documentTitle}
- Restored Version: Version ${versionNumber}
- Rolled Back By: ${rolledBackBy}

The document has been restored to an earlier state. Any changes made after version ${versionNumber} are no longer visible in the current document, but they remain preserved in the version history.

If you were actively editing the document, please refresh your browser to see the restored version.

View Document:
${documentUrl}

You can view the complete version history and compare different versions at any time.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Document Rolled Back: ${documentTitle}`,
    html,
    text,
  };
}

/**
 * Role Change Notification Email Template
 * Sent when a collaborator's role is changed on a document
 */
export function getRoleChangeNotificationEmail(params: RoleChangeNotificationEmailParams): { subject: string; html: string; text: string } {
  const { userName, documentTitle, newRole, documentUrl } = params;

  const roleDescriptions: Record<string, string> = {
    owner: 'You now have full control over the document, including the ability to manage team members and delete the document.',
    editor: 'You can now make changes to the document and collaborate in real-time with other team members.',
    commenter: 'You can now add comments and suggestions to the document, but cannot edit the content directly.',
    viewer: 'You can now view the document but cannot make changes or add comments.',
  };

  const html = getEmailBase(`
    <div class="content">
      <h1>Your Role Has Been Updated</h1>
      <p>Hello ${userName},</p>
      <p>
        Your role on a document has been updated.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Update Details:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Document:</strong> ${documentTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>New Role:</strong> ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}</p>
      </div>
      <p>
        ${roleDescriptions[newRole] || 'Your permissions have been updated.'}
      </p>
      <p>
        The changes are effective immediately. If you have the document open, you may need to refresh 
        your browser to see the updated permissions.
      </p>
      <div style="text-align: center;">
        <a href="${documentUrl}" class="button">View Document</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        If you have questions about your new role or permissions, please contact the document owner.
      </p>
    </div>
  `);

  const text = `
Your Role Has Been Updated

Hello ${userName},

Your role on a document has been updated.

Update Details:
- Document: ${documentTitle}
- New Role: ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}

${roleDescriptions[newRole] || 'Your permissions have been updated.'}

The changes are effective immediately. If you have the document open, you may need to refresh your browser to see the updated permissions.

View Document:
${documentUrl}

If you have questions about your new role or permissions, please contact the document owner.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Your Role Has Been Updated on "${documentTitle}"`,
    html,
    text,
  };
}

/**
 * Access Revocation Email Template
 * Sent when a collaborator's access to a document is revoked
 */
export function getAccessRevocationEmail(params: AccessRevocationEmailParams): { subject: string; html: string; text: string } {
  const { userName, documentTitle } = params;

  const html = getEmailBase(`
    <div class="content">
      <h1>Your Access Has Been Revoked</h1>
      <p>Hello ${userName},</p>
      <p>
        Your access to a document has been revoked by the document owner.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Document:</strong> ${documentTitle}</p>
      </div>
      <p>
        You will no longer be able to view or edit this document. If you believe this was done in error, 
        please contact the document owner directly.
      </p>
      <p style="font-size: 14px; color: #6B7280;">
        Any work you contributed to the document remains preserved in the version history.
      </p>
    </div>
  `);

  const text = `
Your Access Has Been Revoked

Hello ${userName},

Your access to a document has been revoked by the document owner.

Document: ${documentTitle}

You will no longer be able to view or edit this document. If you believe this was done in error, please contact the document owner directly.

Any work you contributed to the document remains preserved in the version history.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Your Access to "${documentTitle}" Has Been Revoked`,
    html,
    text,
  };
}

/**
 * Proposal Scored Email Template
 * Sent to the lead when their proposal is scored by the client
 */
export function getProposalScoredEmail(params: ProposalScoredEmailParams): { subject: string; html: string; text: string } {
  const { leadName, proposalTitle, projectTitle, totalScore, rank, proposalUrl } = params;

  const html = getEmailBase(`
    <div class="content">
      <h1>Your Proposal Has Been Scored</h1>
      <p>Hello ${leadName},</p>
      <p>
        Great news! The client has evaluated your proposal and assigned scores across multiple criteria.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Scoring Results:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposal:</strong> ${proposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Total Score:</strong> ${totalScore.toFixed(2)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Current Rank:</strong> #${rank}</p>
      </div>
      <p>
        You can view your detailed scores, including individual criterion evaluations, by visiting your proposal page.
      </p>
      <div style="text-align: center;">
        <a href="${proposalUrl}" class="button">View Your Scores</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        <strong>What's Next?</strong><br>
        • Review your scores to understand how you performed<br>
        • The client may reach out with questions or next steps<br>
        • Continue monitoring your proposal status
      </p>
    </div>
  `);

  const text = `
Your Proposal Has Been Scored

Hello ${leadName},

Great news! The client has evaluated your proposal and assigned scores across multiple criteria.

Scoring Results:
- Project: ${projectTitle}
- Proposal: ${proposalTitle}
- Total Score: ${totalScore.toFixed(2)}
- Current Rank: #${rank}

You can view your detailed scores, including individual criterion evaluations, by visiting your proposal page.

View Your Scores:
${proposalUrl}

What's Next?
• Review your scores to understand how you performed
• The client may reach out with questions or next steps
• Continue monitoring your proposal status

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Your Proposal Has Been Scored: ${proposalTitle}`,
    html,
    text,
  };
}

/**
 * Score Updated Email Template
 * Sent to the lead when their proposal scores are revised by the client
 */
export function getScoreUpdatedEmail(params: ScoreUpdatedEmailParams): { subject: string; html: string; text: string } {
  const { leadName, proposalTitle, projectTitle, previousScore, newScore, previousRank, newRank, proposalUrl } = params;
  
  const scoreChange = newScore - previousScore;
  const rankChange = previousRank - newRank; // Positive means improved rank
  const scoreIncreased = scoreChange > 0;
  const rankImproved = rankChange > 0;

  const html = getEmailBase(`
    <div class="content">
      <h1>Your Proposal Scores Have Been Updated</h1>
      <p>Hello ${leadName},</p>
      <p>
        The client has revised the scores for your proposal. Here's what changed:
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Score Update:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposal:</strong> ${proposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Previous Score:</strong> ${previousScore.toFixed(2)}</p>
        <p style="margin: 4px 0 0 0;"><strong>New Score:</strong> ${newScore.toFixed(2)} ${scoreIncreased ? '📈' : '📉'} (${scoreChange > 0 ? '+' : ''}${scoreChange.toFixed(2)})</p>
        <p style="margin: 4px 0 0 0;"><strong>Previous Rank:</strong> #${previousRank}</p>
        <p style="margin: 4px 0 0 0;"><strong>New Rank:</strong> #${newRank} ${rankImproved ? '⬆️' : rankChange < 0 ? '⬇️' : '➡️'}</p>
      </div>
      <p>
        ${scoreIncreased ? 'Your score has improved!' : 'Your score has been adjusted.'} 
        You can view the updated detailed scores on your proposal page.
      </p>
      <div style="text-align: center;">
        <a href="${proposalUrl}" class="button">View Updated Scores</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        Score revisions may occur as the client refines their evaluation. Continue to monitor your proposal status for any updates.
      </p>
    </div>
  `);

  const text = `
Your Proposal Scores Have Been Updated

Hello ${leadName},

The client has revised the scores for your proposal. Here's what changed:

Score Update:
- Project: ${projectTitle}
- Proposal: ${proposalTitle}
- Previous Score: ${previousScore.toFixed(2)}
- New Score: ${newScore.toFixed(2)} (${scoreChange > 0 ? '+' : ''}${scoreChange.toFixed(2)})
- Previous Rank: #${previousRank}
- New Rank: #${newRank}

${scoreIncreased ? 'Your score has improved!' : 'Your score has been adjusted.'} You can view the updated detailed scores on your proposal page.

View Updated Scores:
${proposalUrl}

Score revisions may occur as the client refines their evaluation. Continue to monitor your proposal status for any updates.

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `Scores Updated for Your Proposal: ${proposalTitle}`,
    html,
    text,
  };
}

/**
 * All Proposals Scored Email Template
 * Sent to the client when all proposals for their project have been scored
 */
export function getAllProposalsScoredEmail(params: AllProposalsScoredEmailParams): { subject: string; html: string; text: string } {
  const { clientName, projectTitle, proposalCount, topProposalTitle, topProposalScore, projectUrl } = params;

  const html = getEmailBase(`
    <div class="content">
      <h1>🎉 All Proposals Have Been Scored</h1>
      <p>Hello ${clientName},</p>
      <p>
        Congratulations! You've completed scoring all ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} 
        for your project. You can now review the complete rankings and make your final decision.
      </p>
      <div class="info-box">
        <p style="margin: 0;"><strong>Scoring Complete:</strong></p>
        <p style="margin: 8px 0 0 0;"><strong>Project:</strong> ${projectTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Proposals Scored:</strong> ${proposalCount}</p>
        <p style="margin: 4px 0 0 0;"><strong>Top Ranked Proposal:</strong> ${topProposalTitle}</p>
        <p style="margin: 4px 0 0 0;"><strong>Top Score:</strong> ${topProposalScore.toFixed(2)}</p>
      </div>
      <p>
        All proposals have been evaluated and ranked based on your scoring criteria. 
        You can now compare proposals side-by-side, review detailed scores, and export your evaluation results.
      </p>
      <div style="text-align: center;">
        <a href="${projectUrl}" class="button">View Rankings & Make Decision</a>
      </div>
      <p style="font-size: 14px; color: #6B7280;">
        <strong>Next Steps:</strong><br>
        • Review the complete proposal rankings<br>
        • Compare top proposals side-by-side<br>
        • Export scoring results for your records<br>
        • Accept the proposal that best fits your needs
      </p>
    </div>
  `);

  const text = `
All Proposals Have Been Scored

Hello ${clientName},

Congratulations! You've completed scoring all ${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} for your project. You can now review the complete rankings and make your final decision.

Scoring Complete:
- Project: ${projectTitle}
- Proposals Scored: ${proposalCount}
- Top Ranked Proposal: ${topProposalTitle}
- Top Score: ${topProposalScore.toFixed(2)}

All proposals have been evaluated and ranked based on your scoring criteria. You can now compare proposals side-by-side, review detailed scores, and export your evaluation results.

View Rankings & Make Decision:
${projectUrl}

Next Steps:
• Review the complete proposal rankings
• Compare top proposals side-by-side
• Export scoring results for your records
• Accept the proposal that best fits your needs

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
  `.trim();

  return {
    subject: `All Proposals Scored for ${projectTitle}`,
    html,
    text,
  };
}
