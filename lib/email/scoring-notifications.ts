/**
 * Scoring System Email Notifications
 * 
 * Handles sending email notifications for scoring events:
 * - Lead notification when their proposal is scored
 * - Lead notification when scores are updated
 * - Client notification when all proposals are scored
 * 
 * Requirements: 9.5
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from './service';
import {
  getProposalScoredEmail,
  getScoreUpdatedEmail,
  getAllProposalsScoredEmail,
} from './templates';

/**
 * Parameters for lead scored notification
 */
export interface LeadScoredNotificationParams {
  proposalId: string;
  projectId: string;
}

/**
 * Parameters for lead score updated notification
 */
export interface LeadScoreUpdatedNotificationParams {
  proposalId: string;
  projectId: string;
  previousScore: number;
  newScore: number;
  previousRank: number;
  newRank: number;
}

/**
 * Parameters for client all scored notification
 */
export interface ClientAllScoredNotificationParams {
  projectId: string;
}

/**
 * Send notification to lead when their proposal is scored
 * 
 * Requirements: 9.5
 * 
 * @param params Lead scored notification parameters
 * @returns Promise that resolves when email is sent (or fails gracefully)
 */
export async function sendLeadScoredNotification(
  params: LeadScoredNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get proposal details
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('title, lead_id, project_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      const errorMsg = `Failed to fetch proposal: ${proposalError?.message || 'Proposal not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project: ${projectError?.message || 'Project not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get lead user details
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

    // Get ranking information
    const { data: ranking, error: rankingError } = await supabase
      .from('proposal_rankings')
      .select('total_score, rank')
      .eq('proposal_id', params.proposalId)
      .single();

    if (rankingError || !ranking) {
      const errorMsg = `Failed to fetch ranking: ${rankingError?.message || 'Ranking not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Generate proposal URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    const proposalUrl = `${baseUrl}/proposals/${params.proposalId}`;

    // Generate and send email
    const emailContent = getProposalScoredEmail({
      leadName,
      proposalTitle: proposal.title,
      projectTitle: project.title,
      totalScore: ranking.total_score,
      rank: ranking.rank,
      proposalUrl,
    });

    const result = await sendEmail({
      to: leadEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      console.error('Failed to send lead scored notification email:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`Lead scored notification sent successfully to ${leadEmail}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending lead scored notification:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send notification to lead when their proposal scores are updated
 * 
 * Requirements: 9.5
 * 
 * @param params Lead score updated notification parameters
 * @returns Promise that resolves when email is sent (or fails gracefully)
 */
export async function sendLeadScoreUpdatedNotification(
  params: LeadScoreUpdatedNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get proposal details
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('title, lead_id, project_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      const errorMsg = `Failed to fetch proposal: ${proposalError?.message || 'Proposal not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project: ${projectError?.message || 'Project not found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get lead user details
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
    const emailContent = getScoreUpdatedEmail({
      leadName,
      proposalTitle: proposal.title,
      projectTitle: project.title,
      previousScore: params.previousScore,
      newScore: params.newScore,
      previousRank: params.previousRank,
      newRank: params.newRank,
      proposalUrl,
    });

    const result = await sendEmail({
      to: leadEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      console.error('Failed to send lead score updated notification email:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`Lead score updated notification sent successfully to ${leadEmail}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending lead score updated notification:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send notification to client when all proposals are scored
 * 
 * Requirements: 9.5
 * 
 * @param params Client all scored notification parameters
 * @returns Promise that resolves when email is sent (or fails gracefully)
 */
export async function sendClientAllScoredNotification(
  params: ClientAllScoredNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('title, client_id')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      const errorMsg = `Failed to fetch project: ${projectError?.message || 'Project not found'}`;
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

    // Get all rankings for the project
    const { data: rankings, error: rankingsError } = await supabase
      .from('proposal_rankings')
      .select('proposal_id, total_score, rank, proposals!inner(title)')
      .eq('project_id', params.projectId)
      .order('rank', { ascending: true });

    if (rankingsError || !rankings || rankings.length === 0) {
      const errorMsg = `Failed to fetch rankings: ${rankingsError?.message || 'No rankings found'}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const topProposal = rankings[0];
    const proposalCount = rankings.length;

    // Generate project URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    const projectUrl = `${baseUrl}/projects/${params.projectId}`;

    // Generate and send email
    const emailContent = getAllProposalsScoredEmail({
      clientName,
      projectTitle: project.title,
      proposalCount,
      topProposalTitle: (topProposal.proposals as any).title,
      topProposalScore: topProposal.total_score,
      projectUrl,
    });

    const result = await sendEmail({
      to: clientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success) {
      console.error('Failed to send client all scored notification email:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`Client all scored notification sent successfully to ${clientEmail}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending client all scored notification:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if all proposals for a project are fully scored
 * 
 * @param projectId The project ID to check
 * @returns Promise that resolves to true if all proposals are fully scored
 */
export async function areAllProposalsScored(projectId: string): Promise<boolean> {
  const supabase = await createClient();

  try {
    // Get all proposals for the project
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', projectId);

    if (proposalsError || !proposals || proposals.length === 0) {
      return false;
    }

    // Get all rankings for the project
    const { data: rankings, error: rankingsError } = await supabase
      .from('proposal_rankings')
      .select('proposal_id, is_fully_scored')
      .eq('project_id', projectId);

    if (rankingsError || !rankings) {
      return false;
    }

    // Check if all proposals have rankings and are fully scored
    const rankedProposalIds = new Set(rankings.map(r => r.proposal_id));
    const allProposalsRanked = proposals.every(p => rankedProposalIds.has(p.id));
    const allFullyScored = rankings.every(r => r.is_fully_scored);

    return allProposalsRanked && allFullyScored;
  } catch (error) {
    console.error('Error checking if all proposals are scored:', error);
    return false;
  }
}
