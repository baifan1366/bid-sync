/**
 * Proposal Team Helpers
 * 
 * Helper functions for working with proposal team members
 * Replaces the old bid_team_members architecture
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Check if a user is a member of a proposal team
 */
export async function checkProposalTeamMembership(
  proposalId: string,
  userId: string
): Promise<{ isMember: boolean; role?: 'lead' | 'member'; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: member, error } = await supabase
      .from('proposal_team_members')
      .select('role')
      .eq('proposal_id', proposalId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking proposal team membership:', error)
      return { isMember: false, error: error.message }
    }

    return {
      isMember: !!member,
      role: member?.role as 'lead' | 'member' | undefined,
    }
  } catch (error) {
    console.error('Error in checkProposalTeamMembership:', error)
    return {
      isMember: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if a user is a member of any proposal team for a project
 */
export async function checkProjectTeamMembership(
  projectId: string,
  userId: string
): Promise<{ isMember: boolean; proposalId?: string; role?: 'lead' | 'member'; error?: string }> {
  try {
    // Use admin client to bypass RLS when checking team membership
    const { createAdminClient } = await import('@/lib/supabase/server');
    const adminClient = createAdminClient();

    console.log('[checkProjectTeamMembership] Checking for projectId:', projectId, 'userId:', userId);

    // Get all proposals for this project
    const { data: proposals, error: proposalsError } = await adminClient
      .from('proposals')
      .select('id')
      .eq('project_id', projectId)

    console.log('[checkProjectTeamMembership] Proposals found:', proposals?.length, 'error:', proposalsError);

    if (proposalsError) {
      return { isMember: false, error: proposalsError.message }
    }

    if (!proposals || proposals.length === 0) {
      return { isMember: false }
    }

    const proposalIds = proposals.map(p => p.id)

    // Check if user is a member of any of these proposals
    const { data: members, error } = await adminClient
      .from('proposal_team_members')
      .select('proposal_id, role')
      .in('proposal_id', proposalIds)
      .eq('user_id', userId)

    console.log('[checkProjectTeamMembership] Members found:', members?.length, 'error:', error);

    if (error) {
      console.error('Error checking project team membership:', error)
      return { isMember: false, error: error.message }
    }

    // Return the first membership found
    const member = members && members.length > 0 ? members[0] : null;

    return {
      isMember: !!member,
      proposalId: member?.proposal_id,
      role: member?.role as 'lead' | 'member' | undefined,
    }
  } catch (error) {
    console.error('Error in checkProjectTeamMembership:', error)
    return {
      isMember: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get proposal ID from project ID for a specific user
 * Returns the user's proposal if they are a lead, or any proposal they are a member of
 */
export async function getProposalIdFromProject(
  projectId: string,
  userId: string
): Promise<{ proposalId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // First, check if user is a lead for any proposal in this project
    const { data: leadProposal, error: leadError } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', projectId)
      .eq('lead_id', userId)
      .maybeSingle()

    if (leadProposal) {
      return { proposalId: leadProposal.id }
    }

    // If not a lead, check if they are a member of any proposal
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', projectId)

    if (proposalsError || !proposals || proposals.length === 0) {
      return { error: 'No proposals found for this project' }
    }

    const proposalIds = proposals.map(p => p.id)

    const { data: membership, error: memberError } = await supabase
      .from('proposal_team_members')
      .select('proposal_id')
      .in('proposal_id', proposalIds)
      .eq('user_id', userId)
      .maybeSingle()

    if (membership) {
      return { proposalId: membership.proposal_id }
    }

    return { error: 'User is not a member of any proposal for this project' }
  } catch (error) {
    console.error('Error in getProposalIdFromProject:', error)
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all team members for a proposal
 */
export async function getProposalTeamMembers(proposalId: string) {
  try {
    const supabase = await createClient()

    const { data: members, error } = await supabase
      .from('proposal_team_members')
      .select('user_id, role, joined_at')
      .eq('proposal_id', proposalId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Error getting proposal team members:', error)
      return { members: [], error: error.message }
    }

    return { members: members || [], error: null }
  } catch (error) {
    console.error('Error in getProposalTeamMembers:', error)
    return {
      members: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
