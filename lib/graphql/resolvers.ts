import { createClient, createAdminClient } from '@/lib/supabase/server';
import { GraphQLError } from 'graphql';
import { logActivity, logAdminAction } from '@/lib/activity-logger';
import {
  sendAdminInvitationEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendAccountSuspensionEmail,
} from '@/lib/email';
import { ProposalSubmissionService } from '@/lib/proposal-submission-service';
import { DocumentService } from '@/lib/document-service';
import { VersionControlService } from '@/lib/version-control-service';
import { TeamManagementService } from '@/lib/team-management-service';
import { CollaborationService } from '@/lib/collaboration-service';
import { SectionLockManager } from '@/lib/section-lock-service';
import { ProgressTrackerService } from '@/lib/progress-tracker-service';
import { SectionManagementService } from '@/lib/section-management-service';
import { ProposalService } from '@/lib/proposal-service';
import { RetentionService } from '@/lib/retention-service';
import { sanitizeSearchInput } from '@/lib/validation-utils';

// ============================================================
// ERROR HANDLING UTILITIES
// ============================================================

interface ErrorDetails {
  code: string;
  message: string;
  operation?: string;
  table?: string;
  field?: string;
  hint?: string;
  originalError?: any;
  timestamp?: string;
  userId?: string;
  resourceId?: string;
}

/**
 * Creates a detailed GraphQL error with enhanced debugging information
 */
const createDetailedError = (
  message: string,
  code: string,
  details?: Partial<ErrorDetails>
): GraphQLError => {
  const errorInfo: ErrorDetails = {
    code,
    message,
    timestamp: new Date().toISOString(),
    ...details,
  };

  // Log error for server-side debugging
  console.error(`[GraphQL Error] ${code}:`, {
    message,
    ...details,
    stack: details?.originalError?.stack,
  });

  return new GraphQLError(message, {
    extensions: {
      code,
      details: {
        operation: errorInfo.operation,
        table: errorInfo.table,
        field: errorInfo.field,
        hint: errorInfo.hint,
        timestamp: errorInfo.timestamp,
        // Only include safe error details in response
        dbError: details?.originalError?.code || null,
        dbMessage: details?.originalError?.message || null,
        dbHint: details?.originalError?.hint || null,
        dbDetails: details?.originalError?.details || null,
      },
    },
  });
};

/**
 * Handles Supabase database errors with detailed information
 */
const handleSupabaseError = (
  error: any,
  operation: string,
  context?: { table?: string; userId?: string; resourceId?: string }
): GraphQLError => {
  const errorCode = error?.code || 'UNKNOWN';
  const errorMessage = error?.message || 'An unknown database error occurred';
  
  // Map common Supabase/PostgreSQL error codes to user-friendly messages
  const errorMap: Record<string, { code: string; message: string; hint?: string }> = {
    '23505': { 
      code: 'DUPLICATE_ENTRY', 
      message: 'A record with this value already exists',
      hint: 'Check for duplicate entries in unique fields'
    },
    '23503': { 
      code: 'FOREIGN_KEY_VIOLATION', 
      message: 'Referenced record does not exist',
      hint: 'Ensure the related record exists before creating this entry'
    },
    '23502': { 
      code: 'NOT_NULL_VIOLATION', 
      message: 'Required field is missing',
      hint: 'Provide all required fields'
    },
    '42P01': { 
      code: 'TABLE_NOT_FOUND', 
      message: 'Database table not found',
      hint: 'Run database migrations to create required tables'
    },
    '42703': { 
      code: 'COLUMN_NOT_FOUND', 
      message: 'Database column not found',
      hint: 'Check if the column exists or run migrations'
    },
    'PGRST116': { 
      code: 'NOT_FOUND', 
      message: 'Record not found',
      hint: 'The requested resource does not exist'
    },
    '42501': { 
      code: 'PERMISSION_DENIED', 
      message: 'Permission denied for this operation',
      hint: 'Check RLS policies and user permissions'
    },
    '22P02': { 
      code: 'INVALID_INPUT', 
      message: 'Invalid input syntax',
      hint: 'Check the format of your input data'
    },
    '22003': { 
      code: 'NUMERIC_VALUE_OUT_OF_RANGE', 
      message: 'Numeric value out of range',
      hint: 'Ensure numeric values are within acceptable limits'
    },
  };

  const mappedError = errorMap[errorCode] || {
    code: 'INTERNAL_SERVER_ERROR',
    message: `Database operation failed: ${errorMessage}`,
    hint: 'Please try again or contact support if the issue persists'
  };

  return createDetailedError(mappedError.message, mappedError.code, {
    operation,
    table: context?.table,
    hint: mappedError.hint,
    originalError: error,
    userId: context?.userId,
    resourceId: context?.resourceId,
  });
};

/**
 * Wraps an async resolver function with error handling
 */
const withErrorHandling = <T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      // If it's already a GraphQL error, re-throw it
      if (error instanceof GraphQLError) {
        throw error;
      }
      
      // Handle Supabase errors
      if (error?.code || error?.message?.includes('supabase')) {
        throw handleSupabaseError(error, operation);
      }
      
      // Handle generic errors
      throw createDetailedError(
        error?.message || 'An unexpected error occurred',
        'INTERNAL_SERVER_ERROR',
        { operation, originalError: error }
      );
    }
  };
};

/**
 * Checks if a user is suspended and throws an error if they are
 */
const checkUserSuspension = (user: any, operation: string): void => {
  if (user?.user_metadata?.is_suspended) {
    const reason = user.user_metadata?.suspended_reason || 'Your account has been suspended.';
    throw createDetailedError(
      'Account suspended. You cannot perform this action.',
      'FORBIDDEN',
      {
        operation,
        userId: user.id,
        hint: `Suspension reason: ${reason}. Please contact support if you believe this is a mistake.`,
      }
    );
  }
};

// Helper function to map database project to GraphQL schema
const mapProject = (project: any) => ({
  id: project.id,
  clientId: project.client_id,
  title: project.title,
  description: project.description,
  status: project.status?.toUpperCase() || 'PENDING_REVIEW',
  budget: project.budget,
  budgetMin: project.budget_min,
  budgetMax: project.budget_max,
  deadline: project.deadline,
  additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
    id: req.id,
    fieldName: req.fieldName,
    fieldType: req.fieldType?.toUpperCase() || 'TEXT',
    required: req.required ?? false,
    helpText: req.helpText || null,
    options: req.options || [],
    order: req.order ?? 0,
  })),
  createdAt: project.created_at,
  updatedAt: project.updated_at,
});

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role || 'bidding_member';
      const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
      
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.user_metadata?.email_verified || false,
        role: role.toUpperCase(),
        verificationStatus: (user.user_metadata?.verification_status || defaultStatus).toUpperCase(),
        verificationReason: user.user_metadata?.verification_reason,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    },

    projects: async (_: any, { clientId }: { clientId?: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user (optional for public marketplace)
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      // If user is not authenticated, only show open projects (public marketplace)
      if (!user) {
        query = query.eq('status', 'open');
      } else {
        // If clientId is provided, filter by it
        // Otherwise, if user is a client, only show their projects
        if (clientId) {
          query = query.eq('client_id', clientId);
        } else if (user.user_metadata?.role === 'client') {
          query = query.eq('client_id', user.id);
        }
      }

      const { data: projects, error } = await query;

      if (error) {
        throw handleSupabaseError(error, 'projects.fetch', {
          table: 'projects',
          userId: user?.id,
          resourceId: clientId,
        });
      }

      return (projects || []).map(mapProject);
    },

    openProjects: async () => {
      const supabase = await createClient();
      
      // No authentication required - this is for public marketplace
      // Fetch all open projects
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) {
        throw handleSupabaseError(error, 'openProjects.fetch', {
          table: 'projects',
        });
      }

      return (projects || []).map(mapProject);
    },

    project: async (_: any, { id }: { id: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'project.fetch',
          hint: 'Please log in to access this resource',
          originalError: authError,
        });
      }

      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw handleSupabaseError(error, 'project.fetch', {
          table: 'projects',
          userId: user.id,
          resourceId: id,
        });
      }

      if (!project) {
        throw createDetailedError('Project not found', 'NOT_FOUND', {
          operation: 'project.fetch',
          table: 'projects',
          resourceId: id,
          hint: 'The project may have been deleted or you may not have access',
        });
      }

      // Authorization check - only client can view their project
      if (user.user_metadata?.role === 'client' && project.client_id !== user.id) {
        throw createDetailedError('Forbidden: You do not have access to this project', 'FORBIDDEN', {
          operation: 'project.fetch',
          userId: user.id,
          resourceId: id,
          hint: 'You can only view projects that you own',
        });
      }

      return mapProject(project);
    },

    projectWithProposals: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'projectWithProposals.fetch',
          hint: 'Please log in to access this resource',
          originalError: authError,
        });
      }

      // Fetch project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw handleSupabaseError(projectError, 'projectWithProposals.fetchProject', {
          table: 'projects',
          userId: user.id,
          resourceId: projectId,
        });
      }

      if (!project) {
        throw createDetailedError('Project not found', 'NOT_FOUND', {
          operation: 'projectWithProposals.fetchProject',
          table: 'projects',
          resourceId: projectId,
          hint: 'The project may have been deleted',
        });
      }

      // Authorization check - only client can view their project
      if (project.client_id !== user.id) {
        throw new GraphQLError('Forbidden: You do not have access to this project', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch all proposals for this project
      const { data: proposals, error: proposalsError } = await supabase
        .from('proposals')
        .select('*')
        .eq('project_id', projectId);

      if (proposalsError) {
        throw new GraphQLError('Failed to fetch proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Calculate proposal counts
      const totalProposals = proposals?.length || 0;
      const submittedProposals = proposals?.filter((p: any) => p.status === 'submitted').length || 0;
      const underReviewProposals = proposals?.filter((p: any) => p.status === 'reviewing').length || 0;
      const acceptedProposals = proposals?.filter((p: any) => p.status === 'approved').length || 0;
      const rejectedProposals = proposals?.filter((p: any) => p.status === 'rejected').length || 0;

      // Build proposal summaries
      const adminClient = createAdminClient();
      const proposalSummaries = await Promise.all((proposals || []).map(async (proposal: any) => {
        // Get team members for this proposal from proposal_team_members
        const { data: proposalTeamMembers } = await supabase
          .from('proposal_team_members')
          .select('user_id, role')
          .eq('proposal_id', proposal.id);
        
        const teamMembers = proposalTeamMembers || [];
        
        // Get lead info - first check proposal's lead_id, then look in team members
        const leadMember = teamMembers?.find((m: any) => m.role === 'lead');
        const leadUserId = proposal.lead_id || leadMember?.user_id;
        const { data: leadUser } = await adminClient.auth.admin.getUserById(leadUserId);
        
        // Get team size
        const teamSize = teamMembers?.length || 1; // At least 1 for the lead

        // Get unread message count
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('proposal_id', proposal.id)
          .eq('read', false)
          .neq('sender_id', user.id);

        // Get compliance score
        const { data: checklistItems } = await supabase
          .from('checklist_items')
          .select('passed')
          .eq('proposal_id', proposal.id);
        
        const totalItems = checklistItems?.length || 0;
        const passedItems = checklistItems?.filter(item => item.passed).length || 0;
        const complianceScore = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

        return {
          id: proposal.id,
          title: proposal.title || `Proposal for ${project.title}`,
          biddingTeamName: leadUser?.user?.user_metadata?.full_name || 'Team',
          biddingLead: {
            id: leadUser?.user?.id || '',
            name: leadUser?.user?.user_metadata?.full_name || leadUser?.user?.user_metadata?.name || 'Unknown',
            email: leadUser?.user?.email || '',
            avatarUrl: leadUser?.user?.user_metadata?.avatar_url || null,
            role: 'lead',
            assignedSections: [],
          },
          teamSize,
          budgetEstimate: proposal.budget_estimate || null,
          timelineEstimate: proposal.timeline_estimate || null,
          executiveSummary: proposal.executive_summary || null,
          submissionDate: proposal.submitted_at || proposal.created_at,
          status: proposal.status.toUpperCase(),
          complianceScore,
          unreadMessages: unreadCount || 0,
          additionalInfo: [], // Required field - empty array as default
        };
      }));

      return {
        project: {
          id: project.id,
          client_id: project.client_id,
          clientId: project.client_id,
          title: project.title,
          description: project.description,
          status: project.status.toUpperCase(),
          budget: project.budget,
          budget_min: project.budget_min,
          budget_max: project.budget_max,
          deadline: project.deadline,
          additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
            id: req.id,
            fieldName: req.fieldName,
            fieldType: req.fieldType ? req.fieldType.toUpperCase() : 'TEXT',
            required: req.required ?? false,
            helpText: req.helpText || null,
            options: req.options || [],
            order: req.order ?? 0,
          })),
          created_at: project.created_at,
          createdAt: project.created_at,
          updated_at: project.updated_at,
          updatedAt: project.updated_at,
        },
        proposals: proposalSummaries,
        totalProposals,
        submittedProposals,
        underReviewProposals,
        acceptedProposals,
        rejectedProposals,
      };
    },

    proposalDetail: async (_: any, { proposalId }: { proposalId: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'proposalDetail.fetch',
          hint: 'Please log in to view proposal details',
          originalError: authError,
        });
      }

      // Fetch proposal with related data
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          projects!inner(client_id, title)
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError) {
        throw handleSupabaseError(proposalError, 'proposalDetail.fetchProposal', {
          table: 'proposals',
          userId: user.id,
          resourceId: proposalId,
        });
      }

      if (!proposal) {
        throw createDetailedError('Proposal not found', 'NOT_FOUND', {
          operation: 'proposalDetail.fetchProposal',
          table: 'proposals',
          resourceId: proposalId,
          hint: 'The proposal may have been deleted or does not exist',
        });
      }

      // Authorization check - only client or team members can view
      const isClient = proposal.projects.client_id === user.id;
      const isLead = proposal.lead_id === user.id;
      
      // Check proposal_team_members first (new architecture)
      const { data: proposalTeamMember } = await supabase
        .from('proposal_team_members')
        .select('*')
        .eq('proposal_id', proposalId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isClient && !isLead && !proposalTeamMember) {
        throw createDetailedError('Forbidden: You do not have access to this proposal', 'FORBIDDEN', {
          operation: 'proposalDetail.authorization',
          userId: user.id,
          resourceId: proposalId,
          hint: 'You must be the client, lead, or a team member to view this proposal',
        });
      }

      // Fetch team members from proposal_team_members
      const { data: proposalTeamMembers } = await supabase
        .from('proposal_team_members')
        .select('*')
        .eq('proposal_id', proposalId);

      const teamMembersData = proposalTeamMembers || [];

      const adminClient = createAdminClient();
      
      // Get lead info from proposal.lead_id first
      let lead: any = null;
      if (proposal.lead_id) {
        const { data: leadUserData } = await adminClient.auth.admin.getUserById(proposal.lead_id);
        if (leadUserData?.user) {
          lead = {
            id: proposal.lead_id,
            name: leadUserData.user.user_metadata?.full_name || leadUserData.user.user_metadata?.name || leadUserData.user.email?.split('@')[0] || 'Unknown',
            email: leadUserData.user.email || '',
            avatarUrl: leadUserData.user.user_metadata?.avatar_url || null,
            role: 'lead',
            assignedSections: [],
          };
        }
      }

      // Get team members details
      const teamMembersWithDetails = await Promise.all((teamMembersData || []).map(async (member: any) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(member.user_id);
        return {
          id: member.user_id,
          name: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || userData?.user?.email?.split('@')[0] || 'Unknown',
          email: userData?.user?.email || '',
          avatarUrl: userData?.user?.user_metadata?.avatar_url || null,
          role: member.role,
          assignedSections: [],
        };
      }));

      // If no lead from proposal.lead_id, try to find from team members
      if (!lead) {
        lead = teamMembersWithDetails.find(m => m.role === 'lead') || teamMembersWithDetails[0];
      }
      
      // Filter out the lead from members list
      const members = teamMembersWithDetails.filter(m => m.id !== lead?.id && m.role !== 'lead');

      // Fetch proposal versions
      const { data: versions } = await supabase
        .from('proposal_versions')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('version_number', { ascending: false });

      const currentVersion = versions?.[0]?.version_number || 1;

      // Fetch workspace and document sections for this proposal's project
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)
        .maybeSingle();

      let sections: any[] = [];
      let documents: any[] = [];

      if (workspace) {
        // Fetch workspace documents
        const { data: workspaceDocs } = await supabase
          .from('workspace_documents')
          .select('id, title, content, created_at')
          .eq('workspace_id', workspace.id);

        // Fetch document sections
        const { data: docSections } = await supabase
          .from('document_sections')
          .select('id, document_id, title, content, "order", status')
          .in('document_id', (workspaceDocs || []).map(d => d.id))
          .order('"order"', { ascending: true });

        sections = (docSections || []).map((section: any) => ({
          id: section.id,
          title: section.title || 'Untitled Section',
          content: section.content || '',
          order: section.order,
        }));

        // If no sections from document_sections, try to get from workspace_documents content
        if (sections.length === 0 && workspaceDocs && workspaceDocs.length > 0) {
          sections = workspaceDocs.map((doc: any, index: number) => ({
            id: doc.id,
            title: doc.title || `Document ${index + 1}`,
            content: doc.content || '',
            order: index,
          }));
        }
      }

      // Fallback: try to get sections from proposal_versions content
      if (sections.length === 0 && versions?.[0]?.content?.sections) {
        sections = versions[0].content.sections.map((section: any, index: number) => ({
          id: `section-${index}`,
          title: section.title || `Section ${index + 1}`,
          content: section.content || '',
          order: index,
        }));
      }

      // Fetch documents from documents table
      const { data: proposalDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('proposal_id', proposalId);

      documents = (proposalDocs || []).map((doc: any) => ({
        id: doc.id,
        name: doc.url?.split('/').pop() || doc.name || 'document',
        fileType: doc.doc_type || 'unknown',
        fileSize: doc.file_size || 0,
        category: doc.category || 'OTHER',
        url: doc.url,
        uploadedAt: doc.created_at,
        uploadedBy: doc.created_by,
      }));

      // Fetch checklist items
      const { data: checklistItems } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('proposal_id', proposalId);

      return {
        id: proposal.id,
        title: proposal.title || `Proposal for ${proposal.projects.title}`,
        status: proposal.status.toUpperCase(),
        submissionDate: proposal.submitted_at || proposal.created_at,
        biddingTeam: {
          lead: lead || { id: '', name: 'Unknown', email: '', avatarUrl: null, role: 'lead', assignedSections: [] },
          members: members || [],
        },
        sections,
        documents,
        complianceChecklist: (checklistItems || []).map((item: any) => ({
          id: item.id,
          category: 'TECHNICAL',
          item: item.label,
          completed: item.passed,
          completedBy: item.reviewer_id,
          completedAt: item.checked_at,
        })),
        versions: (versions || []).map((v: any) => ({
          id: v.id,
          versionNumber: v.version_number,
          content: JSON.stringify(v.content),
          createdBy: v.created_by,
          createdAt: v.created_at,
        })),
        currentVersion,
      };
    },

    chatMessages: async (
      _: any,
      { projectId, proposalId, limit = 50, offset = 0 }: { projectId: string; proposalId?: string; limit?: number; offset?: number }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'chatMessages.fetch',
          hint: 'Please log in to view messages',
          originalError: authError,
        });
      }

      // Build query
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (proposalId) {
        query = query.eq('proposal_id', proposalId);
      }

      const { data: messages, error: messagesError } = await query;

      if (messagesError) {
        throw handleSupabaseError(messagesError, 'chatMessages.fetch', {
          table: 'chat_messages',
          userId: user.id,
          resourceId: projectId,
        });
      }

      // Fetch sender details for each message
      const adminClient = createAdminClient();
      const messagesWithDetails = await Promise.all((messages || []).map(async (message: any) => {
        const { data: senderData } = await adminClient.auth.admin.getUserById(message.sender_id);
        const senderRole = senderData?.user?.user_metadata?.role || 'bidding_member';
        
        return {
          id: message.id,
          projectId: message.project_id,
          proposalId: message.proposal_id,
          senderId: message.sender_id,
          senderName: senderData?.user?.user_metadata?.full_name || senderData?.user?.user_metadata?.name || 'Unknown',
          senderAvatar: senderData?.user?.user_metadata?.avatar_url || null,
          senderRole,
          content: message.content,
          createdAt: message.created_at,
          read: message.read,
        };
      }));

      return messagesWithDetails;
    },

    unreadMessageCount: async (
      _: any,
      { projectId, proposalId }: { projectId: string; proposalId?: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'unreadMessageCount.fetch',
          hint: 'Please log in to check unread messages',
          originalError: authError,
        });
      }

      // Build query
      let query = supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('read', false)
        .neq('sender_id', user.id);

      if (proposalId) {
        query = query.eq('proposal_id', proposalId);
      }

      const { count, error: countError } = await query;

      if (countError) {
        throw new GraphQLError('Failed to count unread messages', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return count || 0;
    },

    pendingClientVerifications: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all users with pending verification
      const adminClient = createAdminClient();
      const { data: users, error } = await adminClient.auth.admin.listUsers();
      
      if (error) {
        throw new GraphQLError('Failed to fetch users', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Filter for clients with pending verification
      const pendingClients = users.users.filter(
        (u: any) => 
          u.user_metadata?.role === 'client' && 
          (!u.user_metadata?.verification_status || u.user_metadata?.verification_status === 'pending_verification')
      );

      return pendingClients.map((u: any) => ({
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: 'CLIENT',
        verificationStatus: 'PENDING_VERIFICATION',
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));
    },

    user: async (_: any, { id }: { id: string }) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const adminClient = createAdminClient();
      const { data: targetUser, error } = await adminClient.auth.admin.getUserById(id);
      
      if (error || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const u = targetUser.user;
      const role = u.user_metadata?.role || 'bidding_member';
      const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
      
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: role.toUpperCase(),
        verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    userProfile: async (_: any, { userId }: { userId: string }) => {
      const supabase = await createClient();
      
      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'UNAUTHORIZED' },
        });
      }

      // Get target user info using admin client
      const adminClient = createAdminClient();
      const { data: targetUser, error } = await adminClient.auth.admin.getUserById(userId);
      
      if (error || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const u = targetUser.user;
      const role = u.user_metadata?.role || 'bidding_member';
      const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
      
      // Return public profile information only
      return {
        id: u.id,
        email: u.email,
        role: role.toUpperCase(),
        fullName: u.user_metadata?.full_name || u.user_metadata?.name || 'Anonymous User',
        createdAt: u.created_at,
        verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
      };
    },

    allAdmins: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all users with admin role using service role client
      const adminClient = createAdminClient();
      const { data: users, error } = await adminClient.auth.admin.listUsers();
      
      if (error) {
        throw new GraphQLError('Failed to fetch admins', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Filter for admins and get invitation info
      const admins = users.users.filter((u: any) => u.user_metadata?.role === 'admin');
      
      const adminsWithInvitationInfo = await Promise.all(admins.map(async (admin: any) => {
        // Get invitation info if exists
        const { data: invitation } = await supabase
          .from('admin_invitations')
          .select('invited_by')
          .eq('email', admin.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: admin.id,
          email: admin.email,
          fullName: admin.user_metadata?.full_name || admin.user_metadata?.name || null,
          createdAt: admin.created_at,
          lastLoginAt: admin.last_sign_in_at || null,
          invitedBy: invitation?.invited_by || null,
        };
      }));

      return adminsWithInvitationInfo;
    },

    adminInvitations: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all admin invitations
      const { data: invitations, error } = await supabase
        .from('admin_invitations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new GraphQLError('Failed to fetch admin invitations', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return (invitations || []).map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        invitedBy: inv.invited_by,
        token: inv.token,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at,
      }));
    },

    allUsers: async (
      _: any,
      { page = 1, pageSize = 50, role, verificationStatus, searchQuery, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' }: {
        page?: number;
        pageSize?: number;
        role?: string;
        verificationStatus?: string;
        searchQuery?: string;
        dateFrom?: string;
        dateTo?: string;
        sortBy?: string;
        sortOrder?: string;
      }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all users
      const adminClient = createAdminClient();
      const { data: allUsersData, error } = await adminClient.auth.admin.listUsers();
      
      if (error) {
        throw new GraphQLError('Failed to fetch users', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      let filteredUsers = allUsersData.users;

      // Apply role filter
      if (role) {
        const roleFilter = role.toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => u.user_metadata?.role === roleFilter);
      }

      // Apply verification status filter
      if (verificationStatus) {
        const statusFilter = verificationStatus.toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => 
          (u.user_metadata?.verification_status || 'pending_verification') === statusFilter
        );
      }

      // Apply search query
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          const email = u.email?.toLowerCase() || '';
          const fullName = (u.user_metadata?.full_name || u.user_metadata?.name || '').toLowerCase();
          const company = (u.user_metadata?.company_name || '').toLowerCase();
          return email.includes(query) || fullName.includes(query) || company.includes(query);
        });
      }

      // Apply date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filteredUsers = filteredUsers.filter((u: any) => new Date(u.created_at) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        filteredUsers = filteredUsers.filter((u: any) => new Date(u.created_at) <= toDate);
      }

      // Apply sorting
      filteredUsers.sort((a: any, b: any) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'email':
            aValue = a.email || '';
            bValue = b.email || '';
            break;
          case 'role':
            aValue = a.user_metadata?.role || '';
            bValue = b.user_metadata?.role || '';
            break;
          case 'verificationStatus':
            aValue = a.user_metadata?.verification_status || 'pending_verification';
            bValue = b.user_metadata?.verification_status || 'pending_verification';
            break;
          case 'fullName':
            aValue = a.user_metadata?.full_name || a.user_metadata?.name || '';
            bValue = b.user_metadata?.full_name || b.user_metadata?.name || '';
            break;
          case 'lastActivityAt':
            aValue = a.user_metadata?.last_activity_at || a.last_sign_in_at || '';
            bValue = b.user_metadata?.last_activity_at || b.last_sign_in_at || '';
            break;
          case 'createdAt':
          default:
            aValue = a.created_at;
            bValue = b.created_at;
            break;
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      const totalCount = filteredUsers.length;

      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      const users = paginatedUsers.map((u: any) => {
        const role = u.user_metadata?.role || 'bidding_member';
        // Only clients need verification status, others are automatically verified
        const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
        
        return {
          id: u.id,
          email: u.email,
          emailVerified: u.user_metadata?.email_verified || false,
          role: role.toUpperCase(),
          verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
          verificationReason: u.user_metadata?.verification_reason || null,
          fullName: u.user_metadata?.full_name || u.user_metadata?.name || null,
          isSuspended: u.user_metadata?.is_suspended || false,
          suspendedReason: u.user_metadata?.suspended_reason || null,
          suspendedAt: u.user_metadata?.suspended_at || null,
          lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        };
      });

      return {
        users,
        totalCount,
        page,
        pageSize,
      };
    },

    userStatistics: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all users
      const adminClient = createAdminClient();
      const { data: allUsersData, error } = await adminClient.auth.admin.listUsers();
      
      if (error) {
        console.error('User statistics error:', error);
        throw new GraphQLError(`Failed to fetch user statistics: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const allUsers = allUsersData.users;

      // Calculate statistics
      const totalUsers = allUsers.length;
      const totalClients = allUsers.filter((u: any) => u.user_metadata?.role === 'client').length;
      const totalLeads = allUsers.filter((u: any) => u.user_metadata?.role === 'bidding_lead').length;
      const totalMembers = allUsers.filter((u: any) => u.user_metadata?.role === 'bidding_member').length;
      const totalAdmins = allUsers.filter((u: any) => u.user_metadata?.role === 'admin').length;
      const pendingVerifications = allUsers.filter((u: any) => 
        u.user_metadata?.role === 'client' && 
        (!u.user_metadata?.verification_status || u.user_metadata?.verification_status === 'pending_verification')
      ).length;
      // Count verified users: those with explicit 'verified' status
      // For non-clients without explicit status, treat them as verified
      const verifiedUsers = allUsers.filter((u: any) => {
        const role = u.user_metadata?.role || 'bidding_member';
        const status = u.user_metadata?.verification_status;
        
        // If has explicit 'verified' status, count it
        if (status === 'verified') {
          return true;
        }
        
        // For non-clients without explicit status, they are auto-verified
        if (role !== 'client' && !status) {
          return true;
        }
        
        return false;
      }).length;
      const suspendedUsers = allUsers.filter((u: any) => 
        u.user_metadata?.is_suspended === true
      ).length;

      return {
        totalUsers,
        totalClients,
        totalLeads,
        totalMembers,
        totalAdmins,
        pendingVerifications,
        verifiedUsers,
        suspendedUsers,
      };
    },

    userActivityLogs: async (
      _: any,
      { userId, limit = 100, offset = 0, dateFrom, dateTo }: { 
        userId: string; 
        limit?: number; 
        offset?: number;
        dateFrom?: string;
        dateTo?: string;
      }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId);

      // Apply date range filtering
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data: logs, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Activity logs error:', error);
        // If table doesn't exist, return empty array instead of throwing
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('user_activity_logs table does not exist, returning empty array');
          return [];
        }
        throw new GraphQLError(`Failed to fetch activity logs: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return (logs || []).map((log: any) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        metadata: log.metadata,
        createdAt: log.created_at,
      }));
    },

    adminActions: async (
      _: any,
      { limit = 100, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const { data: actions, error } = await supabase
        .from('admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Admin actions error:', error);
        // If table doesn't exist, return empty array instead of throwing
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('admin_actions table does not exist, returning empty array');
          return [];
        }
        throw new GraphQLError(`Failed to fetch admin actions: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return (actions || []).map((action: any) => ({
        id: action.id,
        adminId: action.admin_id,
        actionType: action.action_type,
        targetUserId: action.target_user_id,
        previousValue: action.previous_value,
        newValue: action.new_value,
        reason: action.reason,
        createdAt: action.created_at,
      }));
    },

    exportUserActivityLogs: async (
      _: any,
      { userId, dateFrom, dateTo }: { userId: string; dateFrom?: string; dateTo?: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', userId);

      // Apply date range filtering
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data: logs, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Export activity logs error:', error);
        // If table doesn't exist, return empty CSV
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('user_activity_logs table does not exist, returning empty CSV');
          const headers = ['ID', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent', 'Metadata', 'Created At'];
          return headers.join(',');
        }
        throw new GraphQLError(`Failed to fetch activity logs: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Generate CSV format
      const headers = ['ID', 'User ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent', 'Metadata', 'Created At'];
      const csvRows = [headers.join(',')];

      (logs || []).forEach((log: any) => {
        const row = [
          log.id,
          log.user_id,
          log.action,
          log.resource_type || '',
          log.resource_id || '',
          log.ip_address || '',
          `"${(log.user_agent || '').replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
          log.created_at,
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    },

    getProjectRequirements: async (
      _: any,
      { projectId }: { projectId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Fetch project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('additional_info_requirements, client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Authorization check - user must be project client or a team member with a proposal
      const isClient = project.client_id === user.id;
      
      // Check if user is a team member with a proposal for this project
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(projectId, user.id);

      if (!isClient && !isMember) {
        throw new GraphQLError('Forbidden: You do not have access to this project', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Return additional info requirements
      const requirements = project.additional_info_requirements || [];
      
      return requirements.map((req: any) => ({
        id: req.id,
        fieldName: req.fieldName,
        fieldType: req.fieldType.toUpperCase(),
        required: req.required,
        helpText: req.helpText || null,
        options: req.options || [],
        order: req.order,
      }));
    },

    leadProposals: async (
      _: any,
      { leadId }: { leadId: string }
    ) => {
      // Validate leadId format early - must be a valid UUID
      if (!leadId || leadId === 'placeholder' || leadId === 'no-user' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
        throw new GraphQLError('Invalid leadId provided', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization check - user must be requesting their own proposals
      if (user.id !== leadId) {
        throw new GraphQLError('Forbidden: You can only view your own proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch proposals for the lead with project information
      // Note: Using !inner to ensure we only get proposals with valid projects
      const { data: proposals, error: proposalsError } = await supabase
        .from('proposals')
        .select(`
          id,
          title,
          content,
          status,
          budget_estimate,
          timeline_estimate,
          additional_info,
          submitted_at,
          created_at,
          project_id,
          projects!inner (
            id,
            client_id,
            title,
            description,
            budget,
            deadline,
            status,
            additional_info_requirements,
            created_at,
            updated_at
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (proposalsError) {
        console.error('[leadProposals] Supabase error:', proposalsError);
        throw handleSupabaseError(proposalsError, 'leadProposals.fetch', {
          table: 'proposals',
          userId: user.id,
          resourceId: leadId,
        });
      }

      // Transform the data to match the GraphQL schema
      return (proposals || []).map((proposal: any) => {
        // Check if project data is available
        if (!proposal.projects) {
          console.error('[leadProposals] Missing project data for proposal:', proposal.id);
          throw new GraphQLError(`Project data not found for proposal ${proposal.id}`, {
            extensions: { 
              code: 'DATA_INTEGRITY_ERROR',
              proposalId: proposal.id,
              hint: 'The project may have been deleted or you may not have access to it'
            },
          });
        }

        return {
          id: proposal.id,
          title: proposal.title,
          content: proposal.content,
          status: proposal.status?.toUpperCase() || 'DRAFT',
          budgetEstimate: proposal.budget_estimate,
          timelineEstimate: proposal.timeline_estimate,
          additionalInfo: proposal.additional_info,
          submissionDate: proposal.submitted_at || proposal.created_at,
          project: {
            id: proposal.projects.id,
            clientId: proposal.projects.client_id,
            title: proposal.projects.title,
            description: proposal.projects.description,
            budget: proposal.projects.budget,
            budgetMin: null, // Column doesn't exist in database
            budgetMax: null, // Column doesn't exist in database
            deadline: proposal.projects.deadline,
            status: proposal.projects.status?.toUpperCase() || 'PENDING_REVIEW',
            additionalInfoRequirements: (proposal.projects.additional_info_requirements || []).map((req: any) => ({
              id: req.id,
              fieldName: req.fieldName,
              fieldType: req.fieldType?.toUpperCase() || 'TEXT',
              required: req.required ?? false,
              helpText: req.helpText || null,
              options: req.options || [],
              order: req.order ?? 0,
            })),
            createdAt: proposal.projects.created_at,
            updatedAt: proposal.projects.updated_at,
          },
        };
      });
    },

    // Collaborative Editor Queries - Document Operations
    workspace: async (_: any, { id }: { id: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { data: workspace, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !workspace) {
        throw new GraphQLError('Workspace not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Fetch workspace documents (collaborative editor content)
      const { data: documents } = await supabase
        .from('workspace_documents')
        .select('*')
        .eq('workspace_id', id)
        .order('updated_at', { ascending: false });

      return {
        id: workspace.id,
        projectId: workspace.project_id,
        leadId: workspace.lead_id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
        // Include documents for the Workspace type
        documents: (documents || []).map((doc: any) => ({
          id: doc.id,
          workspaceId: doc.workspace_id,
          title: doc.title,
          description: doc.description,
          content: doc.content,
          createdBy: doc.created_by,
          lastEditedBy: doc.last_edited_by,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      };
    },

    workspaceByProject: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // First try to find workspace for this user (lead)
      let { data: workspace, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('project_id', projectId)
        .eq('lead_id', user.id)
        .single();

      // If not found as lead, check if user is a team member on any proposal for this project
      if (error || !workspace) {
        // Check proposal_team_members first (new architecture)
        const { data: proposalTeamMember } = await supabase
          .from('proposal_team_members')
          .select('proposal_id, proposals!inner(project_id)')
          .eq('user_id', user.id)
          .eq('proposals.project_id', projectId)
          .limit(1)
          .maybeSingle();

        if (proposalTeamMember) {
          // Find workspace for this project (any workspace the user has access to)
          const result = await supabase
            .from('workspaces')
            .select('*')
            .eq('project_id', projectId)
            .limit(1)
            .single();
          
          workspace = result.data;
          error = result.error;
        } else {
          // Check if user is a team member via proposal_team_members
          const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
          const { isMember, proposalId } = await checkProjectTeamMembership(projectId, user.id);

          if (isMember && proposalId) {
            const result = await supabase
              .from('workspaces')
              .select('*')
              .eq('project_id', projectId)
              .limit(1)
              .single();
            
            workspace = result.data;
            error = result.error;
          }
        }
      }

      if (error || !workspace) {
        throw new GraphQLError('Workspace not found for this project', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Fetch workspace documents
      const { data: documents } = await supabase
        .from('workspace_documents')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('updated_at', { ascending: false });

      return {
        id: workspace.id,
        projectId: workspace.project_id,
        leadId: workspace.lead_id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
        documents: (documents || []).map((doc: any) => ({
          id: doc.id,
          workspaceId: doc.workspace_id,
          title: doc.title,
          description: doc.description,
          content: doc.content,
          createdBy: doc.created_by,
          lastEditedBy: doc.last_edited_by,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      };
    },

    document: async (_: any, { id }: { id: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();
      const result = await documentService.getDocument(id, user.id);

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to fetch document', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return {
        id: result.data.id,
        workspaceId: result.data.workspaceId,
        title: result.data.title,
        description: result.data.description,
        content: result.data.content,
        createdBy: result.data.createdBy,
        lastEditedBy: result.data.lastEditedBy,
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      };
    },

    listDocuments: async (_: any, { workspaceId }: { workspaceId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();
      const result = await documentService.listDocuments(workspaceId, user.id);

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to list documents', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return result.data.map(doc => ({
        id: doc.id,
        workspaceId: doc.workspaceId,
        title: doc.title,
        description: doc.description,
        content: doc.content,
        createdBy: doc.createdBy,
        lastEditedBy: doc.lastEditedBy,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    },

    searchDocuments: async (_: any, { workspaceId, query }: { workspaceId: string; query: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();
      const result = await documentService.searchDocuments({
        query,
        workspaceId,
        userId: user.id,
      });

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to search documents', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return result.data.map(doc => ({
        id: doc.id,
        workspaceId: doc.workspaceId,
        title: doc.title,
        description: doc.description,
        content: doc.content,
        createdBy: doc.createdBy,
        lastEditedBy: doc.lastEditedBy,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    },

    // Version Control Queries
    documentVersionHistory: async (_: any, { documentId }: { documentId: string }) => {
      console.log('[documentVersionHistory] Starting query for documentId:', documentId);
      
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('[documentVersionHistory] Auth error:', authError);
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      console.log('[documentVersionHistory] User authenticated:', user.id);

      const versionService = new VersionControlService();
      const result = await versionService.getVersionHistory(documentId, user.id);
      
      console.log('[documentVersionHistory] Service result:', {
        success: result.success,
        error: result.error,
        dataLength: result.data?.length || 0
      });

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to fetch version history', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get user names for each version
      const adminClient = createAdminClient();
      const versionsWithNames = await Promise.all(
        result.data.map(async (version) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(version.createdBy);
          const createdByName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

          return {
            id: version.id,
            documentId: version.documentId,
            versionNumber: version.versionNumber,
            content: version.content,
            createdBy: version.createdBy,
            createdByName,
            changesSummary: version.changesSummary,
            isRollback: version.isRollback,
            rolledBackFrom: version.rolledBackFrom,
            createdAt: version.createdAt,
          };
        })
      );
      
      console.log('[documentVersionHistory] Returning versions:', versionsWithNames.length);

      return versionsWithNames;
    },

    documentVersion: async (_: any, { versionId }: { versionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const versionService = new VersionControlService();
      const result = await versionService.getVersion(versionId, user.id);

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to fetch version', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get user name
      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(result.data.createdBy);
      const createdByName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

      return {
        id: result.data.id,
        documentId: result.data.documentId,
        versionNumber: result.data.versionNumber,
        content: result.data.content,
        createdBy: result.data.createdBy,
        createdByName,
        changesSummary: result.data.changesSummary,
        isRollback: result.data.isRollback,
        rolledBackFrom: result.data.rolledBackFrom,
        createdAt: result.data.createdAt,
      };
    },

    // Team Management Queries
    documentCollaborators: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const teamService = new TeamManagementService();
      const result = await teamService.getCollaborators(documentId, user.id);

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to fetch collaborators', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get added by names
      const adminClient = createAdminClient();
      const collaboratorsWithNames = await Promise.all(
        result.data.map(async (collab) => {
          const { data: addedByData } = await adminClient.auth.admin.getUserById(collab.addedBy);
          const addedByName = addedByData?.user?.user_metadata?.full_name || addedByData?.user?.email || 'Unknown';

          return {
            id: collab.id,
            documentId: collab.documentId,
            userId: collab.userId,
            userName: collab.userName,
            email: collab.email,
            role: collab.role.toUpperCase(),
            addedBy: collab.addedBy,
            addedByName,
            addedAt: collab.addedAt,
          };
        })
      );

      return collaboratorsWithNames;
    },

    // Collaboration Queries
    activeSessions: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const collaborationService = new CollaborationService();
      const result = await collaborationService.getActiveSessions(documentId, user.id);

      if (!result.success || !result.data) {
        throw new GraphQLError(result.error || 'Failed to fetch active sessions', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return result.data.map(session => ({
        userId: session.userId,
        userName: session.userName,
        userColor: session.userColor,
        cursorPosition: session.cursorPosition,
        lastActivity: session.lastActive,
      }));
    },

    documentInvitations: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user has owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: documentId,
          p_user_id: user.id,
          p_required_role: 'owner'
        });

      if (!hasPermission) {
        throw new GraphQLError('Only document owners can view invitations', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const { data: invitations, error } = await supabase
        .from('document_invitations')
        .select('*, documents(title)')
        .eq('document_id', documentId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new GraphQLError('Failed to fetch invitations', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get inviter names
      const adminClient = createAdminClient();
      const invitationsWithNames = await Promise.all(
        (invitations || []).map(async (inv: any) => {
          const { data: inviterData } = await adminClient.auth.admin.getUserById(inv.invited_by);
          const invitedByName = inviterData?.user?.user_metadata?.full_name || inviterData?.user?.email || 'Unknown';

          return {
            id: inv.id,
            documentId: inv.document_id,
            documentTitle: inv.documents?.title || 'Untitled',
            email: inv.email,
            role: inv.role.toUpperCase(),
            token: inv.token,
            invitedBy: inv.invited_by,
            invitedByName,
            expiresAt: inv.expires_at,
            acceptedAt: inv.accepted_at,
            acceptedBy: inv.accepted_by,
            createdAt: inv.created_at,
          };
        })
      );

      return invitationsWithNames;
    },

    pendingInvitations: async (_: any, { email }: { email: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify email matches authenticated user
      if (user.email !== email) {
        throw new GraphQLError('Can only view your own invitations', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const { data: invitations, error } = await supabase
        .from('document_invitations')
        .select('*, documents(title)')
        .eq('email', email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new GraphQLError('Failed to fetch invitations', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get inviter names
      const adminClient = createAdminClient();
      const invitationsWithNames = await Promise.all(
        (invitations || []).map(async (inv: any) => {
          const { data: inviterData } = await adminClient.auth.admin.getUserById(inv.invited_by);
          const invitedByName = inviterData?.user?.user_metadata?.full_name || inviterData?.user?.email || 'Unknown';

          return {
            id: inv.id,
            documentId: inv.document_id,
            documentTitle: inv.documents?.title || 'Untitled',
            email: inv.email,
            role: inv.role.toUpperCase(),
            token: inv.token,
            invitedBy: inv.invited_by,
            invitedByName,
            expiresAt: inv.expires_at,
            acceptedAt: inv.accepted_at,
            acceptedBy: inv.accepted_by,
            createdAt: inv.created_at,
          };
        })
      );

      return invitationsWithNames;
    },

    // Section Locking Queries
    getLockStatus: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const lockManager = new SectionLockManager();
      await lockManager.initialize(user.id);

      try {
        const status = await lockManager.getLockStatus(sectionId);
        
        // Get locked by user info if locked
        let lockedByUser = null;
        if (status.lockedBy) {
          const adminClient = createAdminClient();
          const { data: userData } = await adminClient.auth.admin.getUserById(status.lockedBy);
          if (userData?.user) {
            lockedByUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          isLocked: status.isLocked,
          lockedBy: status.lockedBy,
          lockedByUser,
          lockedAt: status.lockedAt?.toISOString(),
          expiresAt: status.expiresAt?.toISOString(),
        };
      } finally {
        await lockManager.cleanup();
      }
    },

    getActiveLocks: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get all active locks for the document
      const { data: locks, error } = await supabase
        .from('section_locks')
        .select('*, document_sections!inner(document_id)')
        .eq('document_sections.document_id', documentId)
        .gt('expires_at', new Date().toISOString());

      if (error) {
        throw new GraphQLError('Failed to fetch active locks', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get user names for each lock
      const adminClient = createAdminClient();
      const locksWithNames = await Promise.all(
        (locks || []).map(async (lock: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(lock.user_id);
          const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

          return {
            id: lock.id,
            sectionId: lock.section_id,
            documentId: lock.document_id,
            userId: lock.user_id,
            userName,
            acquiredAt: lock.acquired_at,
            expiresAt: lock.expires_at,
            lastHeartbeat: lock.last_heartbeat,
          };
        })
      );

      return locksWithNames;
    },

    // Progress Tracking Queries
    getSectionProgress: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        const progress = await progressTracker.getSectionProgress(documentId);
        
        // Get assigned user info for each section
        const adminClient = createAdminClient();
        const progressWithUsers = await Promise.all(
          progress.map(async (section) => {
            let assignedToUser = null;
            if (section.assignedTo) {
              const { data: userData } = await adminClient.auth.admin.getUserById(section.assignedTo);
              if (userData?.user) {
                assignedToUser = {
                  id: userData.user.id,
                  email: userData.user.email,
                  fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
                };
              }
            }

            // Calculate if overdue and hours remaining
            const now = new Date();
            const deadline = section.deadline;
            const isOverdue = deadline ? deadline < now : false;
            const hoursRemaining = deadline 
              ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
              : null;

            return {
              sectionId: section.sectionId,
              title: section.title,
              status: section.status.toUpperCase(),
              assignedTo: section.assignedTo,
              assignedToUser,
              deadline: section.deadline?.toISOString(),
              lastUpdated: section.lastUpdated.toISOString(),
              isOverdue,
              hoursRemaining,
            };
          })
        );

        return progressWithUsers;
      } finally {
        await progressTracker.cleanup();
      }
    },

    getOverallProgress: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        const progress = await progressTracker.getOverallProgress(documentId);
        const upcomingDeadlines = await progressTracker.getUpcomingDeadlines(documentId, 24);

        // Get assigned user info for deadlines
        const adminClient = createAdminClient();
        const deadlinesWithUsers = await Promise.all(
          upcomingDeadlines.map(async (deadline) => {
            let assignedToUser = null;
            if (deadline.assignedTo) {
              const { data: userData } = await adminClient.auth.admin.getUserById(deadline.assignedTo);
              if (userData?.user) {
                assignedToUser = {
                  id: userData.user.id,
                  email: userData.user.email,
                  fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
                };
              }
            }

            return {
              sectionId: deadline.sectionId,
              title: deadline.title,
              deadline: deadline.deadline.toISOString(),
              assignedTo: deadline.assignedTo,
              assignedToUser,
              isOverdue: deadline.isOverdue,
              hoursRemaining: deadline.hoursRemaining,
              status: deadline.status.toUpperCase(),
            };
          })
        );

        return {
          documentId,
          totalSections: progress.totalSections,
          notStarted: progress.notStarted,
          inProgress: progress.inProgress,
          inReview: progress.inReview,
          completed: progress.completed,
          completionPercentage: progress.completionPercentage,
          upcomingDeadlines: deadlinesWithUsers,
        };
      } finally {
        await progressTracker.cleanup();
      }
    },

    getUpcomingDeadlines: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        const deadlines = await progressTracker.getUpcomingDeadlines(documentId, 24);

        // Get assigned user info for each deadline
        const adminClient = createAdminClient();
        const deadlinesWithUsers = await Promise.all(
          deadlines.map(async (deadline) => {
            let assignedToUser = null;
            if (deadline.assignedTo) {
              const { data: userData } = await adminClient.auth.admin.getUserById(deadline.assignedTo);
              if (userData?.user) {
                assignedToUser = {
                  id: userData.user.id,
                  email: userData.user.email,
                  fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
                };
              }
            }

            return {
              sectionId: deadline.sectionId,
              title: deadline.title,
              deadline: deadline.deadline.toISOString(),
              assignedTo: deadline.assignedTo,
              assignedToUser,
              isOverdue: deadline.isOverdue,
              hoursRemaining: deadline.hoursRemaining,
              status: deadline.status.toUpperCase(),
            };
          })
        );

        return deadlinesWithUsers;
      } finally {
        await progressTracker.cleanup();
      }
    },

    getDocumentSections: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get all sections for the document
      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', documentId)
        .order('order', { ascending: true });

      if (error) {
        throw new GraphQLError('Failed to fetch document sections', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get user info for assigned and locked by users
      const adminClient = createAdminClient();
      const sectionsWithUsers = await Promise.all(
        (sections || []).map(async (section: any) => {
          let assignedToUser = null;
          if (section.assigned_to) {
            const { data: userData } = await adminClient.auth.admin.getUserById(section.assigned_to);
            if (userData?.user) {
              assignedToUser = {
                id: userData.user.id,
                email: userData.user.email,
                fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
              };
            }
          }

          let lockedByUser = null;
          if (section.locked_by) {
            const { data: userData } = await adminClient.auth.admin.getUserById(section.locked_by);
            if (userData?.user) {
              lockedByUser = {
                id: userData.user.id,
                email: userData.user.email,
                fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
              };
            }
          }

          return {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assigned_to,
            assignedToUser,
            deadline: section.deadline,
            content: section.content,
            lockedBy: section.locked_by,
            lockedByUser,
            lockedAt: section.locked_at,
            lockExpiresAt: section.lock_expires_at,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
          };
        })
      );

      return sectionsWithUsers;
    },

    // ============================================================================
    // PROJECT APPROVAL QUERIES
    // ============================================================================

    pendingProjects: async () => {
      const supabase = await createClient();
      
      // Verify admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS and access admin API
      const adminClient = createAdminClient();

      // Get pending projects
      const { data: projects, error } = await adminClient
        .from('projects')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });

      if (error) {
        throw new GraphQLError('Failed to fetch pending projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch client data separately using admin API
      const clientIds = [...new Set(projects?.map((p: any) => p.client_id) || [])];
      const clientsMap = new Map();

      for (const clientId of clientIds) {
        const { data: { user: clientUser }, error: clientError } = await adminClient.auth.admin.getUserById(clientId);
        if (!clientError && clientUser) {
          clientsMap.set(clientId, {
            id: clientUser.id,
            email: clientUser.email,
            fullName: clientUser.user_metadata?.full_name || clientUser.user_metadata?.name,
            role: (clientUser.user_metadata?.role || 'client').toUpperCase(),
          });
        }
      }

      return (projects || []).map((project: any) => ({
        id: project.id,
        clientId: project.client_id,
        client: clientsMap.get(project.client_id) || null,
        title: project.title,
        description: project.description,
        budget: project.budget,
        budgetMin: project.budget_min,
        budgetMax: project.budget_max,
        deadline: project.deadline,
        status: project.status?.toUpperCase() || 'PENDING_REVIEW',
        additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
          id: req.id,
          fieldName: req.fieldName,
          fieldType: req.fieldType?.toUpperCase() || 'TEXT',
          required: req.required ?? false,
          helpText: req.helpText || null,
          options: req.options || [],
          order: req.order ?? 0,
        })),
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      }));
    },

    // ============================================================================
    // Q&A QUERIES
    // ============================================================================

    projectQuestions: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();

      const { data: questions, error } = await supabase
        .from('project_questions')
        .select(`
          *,
          askedBy:asked_by (
            id,
            email,
            raw_user_meta_data
          ),
          answers:question_answers (
            id,
            answer,
            created_at,
            answeredBy:answered_by (
              id,
              email,
              raw_user_meta_data
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new GraphQLError('Failed to fetch questions', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return questions.map((q: any) => ({
        id: q.id,
        projectId: q.project_id,
        question: q.question,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
        askedBy: {
          id: q.askedBy.id,
          email: q.askedBy.email,
          fullName: q.askedBy.raw_user_meta_data?.full_name,
          role: (q.askedBy.raw_user_meta_data?.role || 'bidding_lead').toUpperCase(),
        },
        answers: q.answers.map((a: any) => ({
          id: a.id,
          questionId: q.id,
          answer: a.answer,
          createdAt: a.created_at,
          answeredBy: {
            id: a.answeredBy.id,
            email: a.answeredBy.email,
            fullName: a.answeredBy.raw_user_meta_data?.full_name,
            role: (a.answeredBy.raw_user_meta_data?.role || 'client').toUpperCase(),
          },
        })),
      }));
    },

    // ============================================================================
    // ANALYTICS QUERIES
    // ============================================================================

    platformAnalytics: async (
      _: any,
      { dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }
    ) => {
      console.log('[platformAnalytics] Starting query...');
      const supabase = await createClient();
      
      // Verify admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('[platformAnalytics] Auth error:', authError);
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      console.log('[platformAnalytics] User role:', role);
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS for analytics
      const adminClient = createAdminClient();

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();
      console.log('[platformAnalytics] Date range:', { from, to });

      // Try direct queries instead of RPC function
      try {
        // Get user growth
        console.log('[platformAnalytics] Fetching user growth...');
        const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
        
        if (usersError) {
          console.error('[platformAnalytics] Users error:', usersError);
        }
        
        const users = usersData?.users || [];
        const filteredUsers = users.filter((u: any) => {
          const createdAt = new Date(u.created_at);
          return createdAt >= new Date(from) && createdAt <= new Date(to);
        });
        
        // Group by date
        const userGrowthMap = new Map<string, number>();
        filteredUsers.forEach((u: any) => {
          const date = new Date(u.created_at).toISOString().split('T')[0];
          userGrowthMap.set(date, (userGrowthMap.get(date) || 0) + 1);
        });
        
        const userGrowth = Array.from(userGrowthMap.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        console.log('[platformAnalytics] User growth:', userGrowth.length, 'entries');

        // Get project stats
        console.log('[platformAnalytics] Fetching project stats...');
        const { data: projects, error: projectsError } = await adminClient
          .from('projects')
          .select('status, created_at')
          .gte('created_at', from)
          .lte('created_at', to);

        if (projectsError) {
          console.error('[platformAnalytics] Projects error:', projectsError);
        }

        const projectStats = {
          total: projects?.length || 0,
          pending: projects?.filter((p: any) => p.status === 'pending_review').length || 0,
          open: projects?.filter((p: any) => p.status === 'open').length || 0,
          closed: projects?.filter((p: any) => p.status === 'closed').length || 0,
          awarded: projects?.filter((p: any) => p.status === 'awarded').length || 0,
        };
        console.log('[platformAnalytics] Project stats:', projectStats);

        // Get proposal stats
        console.log('[platformAnalytics] Fetching proposal stats...');
        const { data: proposals, error: proposalsError } = await adminClient
          .from('proposals')
          .select('status, created_at')
          .gte('created_at', from)
          .lte('created_at', to);

        if (proposalsError) {
          console.error('[platformAnalytics] Proposals error:', proposalsError);
        }

        const proposalStats = {
          total: proposals?.length || 0,
          draft: proposals?.filter((p: any) => p.status === 'draft').length || 0,
          submitted: proposals?.filter((p: any) => p.status === 'submitted').length || 0,
          accepted: proposals?.filter((p: any) => p.status === 'approved').length || 0,
          rejected: proposals?.filter((p: any) => p.status === 'rejected').length || 0,
        };
        console.log('[platformAnalytics] Proposal stats:', proposalStats);

        // Calculate conversion rates
        const totalProjects = projects?.length || 0;
        const approvedProjects = projects?.filter((p: any) => p.status !== 'pending_review').length || 0;
        const projectApprovalRate = totalProjects > 0 ? (approvedProjects / totalProjects) * 100 : 0;

        const totalProposals = proposals?.length || 0;
        const acceptedProposals = proposals?.filter((p: any) => p.status === 'approved').length || 0;
        const proposalAcceptanceRate = totalProposals > 0 ? (acceptedProposals / totalProposals) * 100 : 0;

        console.log('[platformAnalytics] Query completed successfully');

        return {
          userGrowth,
          projectStats,
          proposalStats,
          revenueData: [],
          conversionRates: {
            projectApprovalRate: Math.round(projectApprovalRate * 100) / 100,
            proposalAcceptanceRate: Math.round(proposalAcceptanceRate * 100) / 100,
            clientRetentionRate: 0,
          },
        };
      } catch (err) {
        console.error('[platformAnalytics] Unexpected error:', err);
        throw new GraphQLError('Failed to calculate analytics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: String(err) },
        });
      }
    },

    scoringAnalytics: async (
      _: any,
      { dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }
    ) => {
      const supabase = await createClient();
      
      // Verify admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS for analytics
      const adminClient = createAdminClient();

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();

      // Calculate scoring usage percentage
      const { data: projectsData, error: projectsError } = await adminClient
        .from('projects')
        .select('id')
        .gte('created_at', from)
        .lte('created_at', to);

      if (projectsError) {
        throw new GraphQLError('Failed to fetch projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const totalProjects = projectsData?.length || 0;

      const { data: templatesData, error: templatesError } = await adminClient
        .from('scoring_templates')
        .select('project_id')
        .gte('created_at', from)
        .lte('created_at', to);

      if (templatesError) {
        throw new GraphQLError('Failed to fetch scoring templates', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const projectsWithScoring = new Set(templatesData?.map(t => t.project_id) || []).size;
      const scoringUsagePercentage = totalProjects > 0 ? (projectsWithScoring / totalProjects) * 100 : 0;

      // Calculate average proposals scored per project
      const { data: scoresData, error: scoresError } = await adminClient
        .from('proposal_scores')
        .select('proposal_id')
        .eq('is_final', true)
        .gte('scored_at', from)
        .lte('scored_at', to);

      if (scoresError) {
        throw new GraphQLError('Failed to fetch proposal scores', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const uniqueScoredProposals = new Set(scoresData?.map(s => s.proposal_id) || []).size;
      const averageProposalsScored = projectsWithScoring > 0 ? uniqueScoredProposals / projectsWithScoring : 0;

      // Identify most common criteria
      const { data: criteriaData, error: criteriaError } = await adminClient
        .from('scoring_criteria')
        .select('name, template_id')
        .gte('created_at', from)
        .lte('created_at', to);

      if (criteriaError) {
        throw new GraphQLError('Failed to fetch scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const criteriaCount: Record<string, number> = {};
      criteriaData?.forEach((criterion: any) => {
        criteriaCount[criterion.name] = (criteriaCount[criterion.name] || 0) + 1;
      });

      const totalCriteria = criteriaData?.length || 0;
      const mostCommonCriteria = Object.entries(criteriaCount)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalCriteria > 0 ? (count / totalCriteria) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate average scoring duration (from first score to finalization)
      const { data: scoringDurations, error: durationError } = await adminClient.rpc(
        'calculate_average_scoring_duration',
        {
          p_date_from: from,
          p_date_to: to,
        }
      );

      if (durationError) {
        console.error('Failed to calculate scoring duration:', durationError);
      }

      const averageScoringDuration = scoringDurations || 0;

      return {
        scoringUsagePercentage,
        averageProposalsScored,
        mostCommonCriteria,
        averageScoringDuration,
      };
    },

    // ============================================================================
    // MEMBER DASHBOARD QUERIES
    // ============================================================================

    myAssignedSections: async () => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { data: sections, error } = await supabase
        .from('document_sections')
        .select(`
          *,
          document:documents (
            id,
            title,
            workspace:workspaces (
              id,
              project_id,
              name
            )
          )
        `)
        .eq('assigned_to', user.id)
        .order('deadline', { ascending: true, nullsFirst: false });

      if (error) {
        throw new GraphQLError('Failed to fetch assigned sections', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return sections.map((section: any) => ({
        id: section.id,
        title: section.title,
        status: section.status?.toUpperCase() || 'NOT_STARTED',
        deadline: section.deadline,
        document: {
          id: section.document.id,
          title: section.document.title,
          workspace: {
            id: section.document.workspace.id,
            projectId: section.document.workspace.project_id,
            name: section.document.workspace.name,
          },
        },
      }));
    },

    // ============================================================================
    // ADMIN PROPOSAL OVERSIGHT QUERIES
    // ============================================================================

    adminAllProposals: async (_: any, { status, search }: { status?: string; search?: string }) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS - admin needs to see ALL proposals
      const adminClient = createAdminClient();

      // Build query using admin client to bypass RLS
      let query = adminClient
        .from('proposals')
        .select(`
          id,
          title,
          status,
          budget_estimate,
          timeline_estimate,
          submitted_at,
          lead_id,
          project_id
        `)
        .order('submitted_at', { ascending: false, nullsFirst: false });

      // Apply status filter
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Apply search filter
      if (search && search.trim()) {
        const sanitizedSearch = sanitizeSearchInput(search);
        if (sanitizedSearch) {
          query = query.or(`title.ilike.%${sanitizedSearch}%`);
        }
      }

      const { data: proposals, error } = await query;

      if (error) {
        console.error('Error fetching proposals:', error);
        throw new GraphQLError('Failed to fetch proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error },
        });
      }

      // Get related data (projects, users) - use adminClient to bypass RLS
      const proposalsWithDetails = await Promise.all(
        (proposals || []).map(async (proposal: any) => {
          // Get project using admin client
          const { data: project } = await adminClient
            .from('projects')
            .select('id, title')
            .eq('id', proposal.project_id)
            .single();

          // Get bidding lead user info
          const { data: { user: leadUser } } = await adminClient.auth.admin.getUserById(proposal.lead_id);

          // Get bidding team info from proposal_team_members
          let biddingTeam = null;
          const { data: teamMember } = await adminClient
            .from('proposal_team_members')
            .select('user_id')
            .eq('proposal_id', proposal.id)
            .eq('user_id', proposal.lead_id)
            .eq('role', 'lead')
            .maybeSingle();
          
          // Note: bidding_teams table relationship removed as it's not in the new architecture
          // If you need team names, they should be stored in proposals or user metadata

          return {
            id: proposal.id,
            title: proposal.title || 'Untitled Proposal',
            status: proposal.status.toUpperCase(),
            budgetEstimate: proposal.budget_estimate,
            timelineEstimate: proposal.timeline_estimate,
            submissionDate: proposal.submitted_at,
            project: project ? {
              id: project.id,
              title: project.title,
            } : null,
            biddingLead: leadUser ? {
              id: leadUser.id,
              email: leadUser.email,
              fullName: leadUser.user_metadata?.full_name || 
                        leadUser.user_metadata?.name || 
                        null,
            } : null,
            biddingTeam,
          };
        })
      );

      return proposalsWithDetails.filter(p => p.project && p.biddingLead);
    },

    adminPendingProposals: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS
      const adminClient = createAdminClient();

      // Get only pending_approval proposals
      const { data: proposals, error } = await adminClient
        .from('proposals')
        .select(`
          id,
          title,
          status,
          budget_estimate,
          timeline_estimate,
          submitted_at,
          lead_id,
          project_id
        `)
        .eq('status', 'pending_approval')
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending proposals:', error);
        throw new GraphQLError('Failed to fetch pending proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error },
        });
      }

      // Get related data
      const proposalsWithDetails = await Promise.all(
        (proposals || []).map(async (proposal: any) => {
          // Get project
          const { data: project } = await adminClient
            .from('projects')
            .select('id, title')
            .eq('id', proposal.project_id)
            .single();

          // Get bidding lead user info
          const { data: { user: leadUser } } = await adminClient.auth.admin.getUserById(proposal.lead_id);

          return {
            id: proposal.id,
            title: proposal.title || 'Untitled Proposal',
            status: proposal.status.toUpperCase(),
            budgetEstimate: proposal.budget_estimate,
            timelineEstimate: proposal.timeline_estimate,
            submissionDate: proposal.submitted_at,
            project: project ? {
              id: project.id,
              title: project.title,
            } : null,
            biddingLead: leadUser ? {
              id: leadUser.id,
              email: leadUser.email,
              fullName: leadUser.user_metadata?.full_name || 
                        leadUser.user_metadata?.name || 
                        null,
            } : null,
            biddingTeam: null,
          };
        })
      );

      return proposalsWithDetails.filter(p => p.project && p.biddingLead);
    },

    // ============================================================================
    // ADMIN TEMPLATE MANAGEMENT QUERIES
    // ============================================================================

    adminAllTemplates: async () => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use admin client to bypass RLS
      const adminClient = createAdminClient();

      // Query contract_templates table (the actual table name)
      const { data: templates, error } = await adminClient
        .from('contract_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching templates:', error);
        throw new GraphQLError('Failed to fetch templates', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error },
        });
      }

      return (templates || []).map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        type: (template.type || 'CONTRACT').toUpperCase(),
        content: JSON.stringify(template.content),
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      }));
    },

    // ============================================================================
    // SCORING TEMPLATE QUERIES
    // ============================================================================

    scoringTemplate: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if user is client or has a proposal for this project
      const isClient = project.client_id === user.id;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(projectId, user.id);

      if (!isClient && !isMember) {
        throw new GraphQLError('You do not have access to this project', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get template for project
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_default', false)
        .single();

      if (templateError || !template) {
        return null;
      }

      // Get criteria
      const { data: criteria, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .select('*')
        .eq('template_id', template.id)
        .order('order_index');

      if (criteriaError) {
        throw new GraphQLError('Failed to fetch scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return {
        id: template.id,
        projectId: template.project_id,
        name: template.name,
        description: template.description,
        isDefault: template.is_default,
        criteria: (criteria || []).map(c => ({
          id: c.id,
          templateId: c.template_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          orderIndex: c.order_index,
          createdAt: c.created_at,
        })),
        createdBy: template.created_by,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      };
    },

    defaultScoringTemplates: async () => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get default templates
      const { data: templates, error: templateError } = await supabase
        .from('scoring_templates')
        .select('*')
        .eq('is_default', true)
        .order('name');

      if (templateError) {
        throw new GraphQLError('Failed to fetch default templates', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get criteria for each template
      const templatesWithCriteria = await Promise.all(
        (templates || []).map(async (template: any) => {
          const { data: criteria } = await supabase
            .from('scoring_criteria')
            .select('*')
            .eq('template_id', template.id)
            .order('order_index');

          return {
            id: template.id,
            projectId: template.project_id,
            name: template.name,
            description: template.description,
            isDefault: template.is_default,
            criteria: (criteria || []).map(c => ({
              id: c.id,
              templateId: c.template_id,
              name: c.name,
              description: c.description,
              weight: c.weight,
              orderIndex: c.order_index,
              createdAt: c.created_at,
            })),
            createdBy: template.created_by,
            createdAt: template.created_at,
            updatedAt: template.updated_at,
          };
        })
      );

      return templatesWithCriteria;
    },

    proposalScores: async (_: any, { proposalId }: { proposalId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*, projects!inner(client_id)')
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if user is client or lead
      const isClient = proposal.projects.client_id === user.id;
      const isLead = proposal.lead_id === user.id;

      if (!isClient && !isLead) {
        throw new GraphQLError('You do not have access to this proposal', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get scores - use admin client to bypass RLS for scoring_criteria join
      // This is needed because leads need to see criteria but don't have direct RLS access
      const adminClient = createAdminClient();
      const { data: scores, error: scoresError } = await adminClient
        .from('proposal_scores')
        .select('*, scoring_criteria(*)')
        .eq('proposal_id', proposalId)
        .eq('is_final', true);

      if (scoresError) {
        console.error('Error fetching proposal scores:', scoresError);
        throw new GraphQLError('Failed to fetch proposal scores', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Return empty array if no scores yet (newly submitted proposals won't have scores)
      if (!scores || scores.length === 0) {
        return [];
      }

      // Get user details for each score
      const scoresWithDetails = await Promise.all(
        scores.map(async (score: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(score.scored_by);
          const userRole = userData?.user?.user_metadata?.role || 'bidding_member';
          const defaultStatus = userRole === 'client' ? 'pending_verification' : 'verified';

          // Handle case where scoring_criteria might be null
          const criteria = score.scoring_criteria || {};

          return {
            id: score.id,
            proposalId: score.proposal_id,
            criterion: {
              id: criteria.id || '',
              templateId: criteria.template_id || '',
              name: criteria.name || 'Unknown Criterion',
              description: criteria.description || '',
              weight: criteria.weight || 0,
              orderIndex: criteria.order_index || 0,
              createdAt: criteria.created_at || '',
            },
            rawScore: score.raw_score,
            weightedScore: score.weighted_score,
            notes: isLead ? null : score.notes, // Hide notes from leads
            scoredBy: {
              id: userData?.user?.id || '',
              email: userData?.user?.email || '',
              emailVerified: userData?.user?.user_metadata?.email_verified || false,
              role: userRole.toUpperCase(),
              verificationStatus: (userData?.user?.user_metadata?.verification_status || defaultStatus).toUpperCase(),
              verificationReason: userData?.user?.user_metadata?.verification_reason || null,
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
              isSuspended: userData?.user?.user_metadata?.is_suspended || false,
              suspendedReason: userData?.user?.user_metadata?.suspended_reason || null,
              suspendedAt: userData?.user?.user_metadata?.suspended_at || null,
              lastActivityAt: userData?.user?.user_metadata?.last_activity_at || userData?.user?.last_sign_in_at || null,
              createdAt: userData?.user?.created_at || '',
              updatedAt: userData?.user?.updated_at || '',
            },
            scoredAt: score.scored_at,
            isFinal: score.is_final,
          };
        })
      );

      return scoresWithDetails;
    },

    proposalScoreHistory: async (_: any, { proposalId }: { proposalId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get proposal and verify access (only client can view history)
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*, projects!inner(client_id)')
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const isClient = proposal.projects.client_id === user.id;

      if (!isClient) {
        throw new GraphQLError('Only the project client can view score history', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get score history
      const { data: history, error: historyError } = await supabase
        .from('proposal_score_history')
        .select('*, scoring_criteria(*)')
        .eq('proposal_id', proposalId)
        .order('changed_at', { ascending: false });

      if (historyError) {
        throw new GraphQLError('Failed to fetch score history', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get user details for each history entry
      const adminClient = createAdminClient();
      const historyWithDetails = await Promise.all(
        (history || []).map(async (entry: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(entry.changed_by);
          const userRole = userData?.user?.user_metadata?.role || 'bidding_member';
          const defaultStatus = userRole === 'client' ? 'pending_verification' : 'verified';

          return {
            id: entry.id,
            proposalId: entry.proposal_id,
            criterion: {
              id: entry.scoring_criteria.id,
              templateId: entry.scoring_criteria.template_id,
              name: entry.scoring_criteria.name,
              description: entry.scoring_criteria.description,
              weight: entry.scoring_criteria.weight,
              orderIndex: entry.scoring_criteria.order_index,
              createdAt: entry.scoring_criteria.created_at,
            },
            previousRawScore: entry.previous_raw_score,
            newRawScore: entry.new_raw_score,
            previousNotes: entry.previous_notes,
            newNotes: entry.new_notes,
            changedBy: {
              id: userData?.user?.id || '',
              email: userData?.user?.email || '',
              emailVerified: userData?.user?.user_metadata?.email_verified || false,
              role: userRole.toUpperCase(),
              verificationStatus: (userData?.user?.user_metadata?.verification_status || defaultStatus).toUpperCase(),
              verificationReason: userData?.user?.user_metadata?.verification_reason || null,
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
              isSuspended: userData?.user?.user_metadata?.is_suspended || false,
              suspendedReason: userData?.user?.user_metadata?.suspended_reason || null,
              suspendedAt: userData?.user?.user_metadata?.suspended_at || null,
              lastActivityAt: userData?.user?.user_metadata?.last_activity_at || userData?.user?.last_sign_in_at || null,
              createdAt: userData?.user?.created_at || '',
              updatedAt: userData?.user?.updated_at || '',
            },
            changedAt: entry.changed_at,
            reason: entry.reason,
          };
        })
      );

      return historyWithDetails;
    },

    proposalRankings: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if user is client or has a proposal for this project
      const isClient = project.client_id === user.id;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(projectId, user.id);

      if (!isClient && !isMember) {
        throw new GraphQLError('You do not have access to this project', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get rankings
      const { data: rankings, error: rankingsError } = await supabase
        .from('proposal_rankings')
        .select('*, proposals!inner(*)')
        .eq('project_id', projectId)
        .order('rank', { ascending: true });

      if (rankingsError) {
        throw new GraphQLError('Failed to fetch proposal rankings', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Build ranking summaries with proposal details
      const adminClient = createAdminClient();
      const rankingsWithDetails = await Promise.all(
        (rankings || []).map(async (ranking: any) => {
          const proposal = ranking.proposals;

          // Get lead info
          const { data: leadUser } = await adminClient.auth.admin.getUserById(proposal.lead_id);
          
          // Get team size from proposal_team_members
          const { count: teamSize } = await supabase
            .from('proposal_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id);

          // Get unread message count (only for client)
          let unreadCount = 0;
          if (isClient) {
            const { count } = await supabase
              .from('chat_messages')
              .select('*', { count: 'exact', head: true })
              .eq('proposal_id', proposal.id)
              .eq('read', false)
              .neq('sender_id', user.id);
            unreadCount = count || 0;
          }

          // Get compliance score
          const { data: checklistItems } = await supabase
            .from('checklist_items')
            .select('passed')
            .eq('proposal_id', proposal.id);
          
          const totalItems = checklistItems?.length || 0;
          const passedItems = checklistItems?.filter(item => item.passed).length || 0;
          const complianceScore = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

          // Get additional info
          const { data: additionalInfo } = await supabase
            .from('proposal_additional_info')
            .select('*')
            .eq('proposal_id', proposal.id);

          return {
            id: ranking.id,
            projectId: ranking.project_id,
            proposal: {
              id: proposal.id,
              title: `Proposal for Project`,
              biddingTeamName: leadUser?.user?.user_metadata?.full_name || 'Team',
              biddingLead: {
                id: leadUser?.user?.id || '',
                name: leadUser?.user?.user_metadata?.full_name || leadUser?.user?.user_metadata?.name || 'Unknown',
                email: leadUser?.user?.email || '',
                avatarUrl: leadUser?.user?.user_metadata?.avatar_url || null,
                role: 'lead',
                assignedSections: [],
              },
              teamSize: teamSize || 1,
              budgetEstimate: null,
              timelineEstimate: null,
              executiveSummary: null,
              submissionDate: proposal.submitted_at || proposal.created_at,
              status: proposal.status.toUpperCase(),
              complianceScore,
              unreadMessages: unreadCount,
              additionalInfo: (additionalInfo || []).map((info: any) => ({
                id: info.id,
                fieldId: info.field_id,
                fieldName: info.field_name,
                fieldValue: info.field_value,
              })),
            },
            totalScore: ranking.total_score,
            rank: ranking.rank,
            isFullyScored: ranking.is_fully_scored,
            calculatedAt: ranking.calculated_at,
          };
        })
      );

      return rankingsWithDetails;
    },

    scoringComparison: async (
      _: any,
      { projectId, proposalIds }: { projectId: string; proposalIds: string[] }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only client can compare proposals
      if (project.client_id !== user.id) {
        throw new GraphQLError('Only the project client can compare proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate proposal count (2-4)
      if (proposalIds.length < 2 || proposalIds.length > 4) {
        throw new GraphQLError('You must select between 2 and 4 proposals to compare', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get scoring template for project
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_default', false)
        .single();

      if (templateError || !template) {
        throw new GraphQLError('No scoring template found for this project', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get criteria
      const { data: criteria, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .select('*')
        .eq('template_id', template.id)
        .order('order_index');

      if (criteriaError) {
        throw new GraphQLError('Failed to fetch scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get proposals with scores and rankings
      const adminClient = createAdminClient();
      const proposalsWithScores = await Promise.all(
        proposalIds.map(async (proposalId: string) => {
          // Get proposal
          const { data: proposal, error: proposalError } = await supabase
            .from('proposals')
            .select('*')
            .eq('id', proposalId)
            .eq('project_id', projectId)
            .single();

          if (proposalError || !proposal) {
            throw new GraphQLError(`Proposal ${proposalId} not found`, {
              extensions: { code: 'NOT_FOUND' },
            });
          }

          // Get scores
          const { data: scores, error: scoresError } = await supabase
            .from('proposal_scores')
            .select('*, scoring_criteria(*)')
            .eq('proposal_id', proposalId)
            .eq('is_final', true);

          if (scoresError) {
            throw new GraphQLError('Failed to fetch proposal scores', {
              extensions: { code: 'INTERNAL_SERVER_ERROR' },
            });
          }

          // Get ranking
          const { data: ranking } = await supabase
            .from('proposal_rankings')
            .select('*')
            .eq('proposal_id', proposalId)
            .eq('project_id', projectId)
            .single();

          // Get lead info
          const { data: leadUser } = await adminClient.auth.admin.getUserById(proposal.lead_id);
          
          // Get team size from proposal_team_members
          const { count: teamSize } = await supabase
            .from('proposal_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id);

          // Get unread message count
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id)
            .eq('read', false)
            .neq('sender_id', user.id);

          // Get compliance score
          const { data: checklistItems } = await supabase
            .from('checklist_items')
            .select('passed')
            .eq('proposal_id', proposal.id);
          
          const totalItems = checklistItems?.length || 0;
          const passedItems = checklistItems?.filter(item => item.passed).length || 0;
          const complianceScore = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

          // Get additional info
          const { data: additionalInfo } = await supabase
            .from('proposal_additional_info')
            .select('*')
            .eq('proposal_id', proposal.id);

          // Format scores with user details
          const scoresWithDetails = await Promise.all(
            (scores || []).map(async (score: any) => {
              const { data: userData } = await adminClient.auth.admin.getUserById(score.scored_by);
              const userRole = userData?.user?.user_metadata?.role || 'bidding_member';
              const defaultStatus = userRole === 'client' ? 'pending_verification' : 'verified';

              return {
                id: score.id,
                proposalId: score.proposal_id,
                criterion: {
                  id: score.scoring_criteria.id,
                  templateId: score.scoring_criteria.template_id,
                  name: score.scoring_criteria.name,
                  description: score.scoring_criteria.description,
                  weight: score.scoring_criteria.weight,
                  orderIndex: score.scoring_criteria.order_index,
                  createdAt: score.scoring_criteria.created_at,
                },
                rawScore: score.raw_score,
                weightedScore: score.weighted_score,
                notes: score.notes,
                scoredBy: {
                  id: userData?.user?.id || '',
                  email: userData?.user?.email || '',
                  emailVerified: userData?.user?.user_metadata?.email_verified || false,
                  role: userRole.toUpperCase(),
                  verificationStatus: (userData?.user?.user_metadata?.verification_status || defaultStatus).toUpperCase(),
                  verificationReason: userData?.user?.user_metadata?.verification_reason || null,
                  fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
                  isSuspended: userData?.user?.user_metadata?.is_suspended || false,
                  suspendedReason: userData?.user?.user_metadata?.suspended_reason || null,
                  suspendedAt: userData?.user?.user_metadata?.suspended_at || null,
                  lastActivityAt: userData?.user?.user_metadata?.last_activity_at || userData?.user?.last_sign_in_at || null,
                  createdAt: userData?.user?.created_at || '',
                  updatedAt: userData?.user?.updated_at || '',
                },
                scoredAt: score.scored_at,
                isFinal: score.is_final,
              };
            })
          );

          return {
            proposal: {
              id: proposal.id,
              title: `Proposal for Project`,
              biddingTeamName: leadUser?.user?.user_metadata?.full_name || 'Team',
              biddingLead: {
                id: leadUser?.user?.id || '',
                name: leadUser?.user?.user_metadata?.full_name || leadUser?.user?.user_metadata?.name || 'Unknown',
                email: leadUser?.user?.email || '',
                avatarUrl: leadUser?.user?.user_metadata?.avatar_url || null,
                role: 'lead',
                assignedSections: [],
              },
              teamSize: teamSize || 1,
              budgetEstimate: null,
              timelineEstimate: null,
              executiveSummary: null,
              submissionDate: proposal.submitted_at || proposal.created_at,
              status: proposal.status.toUpperCase(),
              complianceScore,
              unreadMessages: unreadCount || 0,
              additionalInfo: (additionalInfo || []).map((info: any) => ({
                id: info.id,
                fieldId: info.field_id,
                fieldName: info.field_name,
                fieldValue: info.field_value,
              })),
            },
            scores: scoresWithDetails,
            totalScore: ranking?.total_score || 0,
            rank: ranking?.rank || 0,
            isFullyScored: ranking?.is_fully_scored || false,
          };
        })
      );

      // Calculate best and worst scores for each criterion
      const bestScores: Array<{ criterionId: string; proposalId: string; score: number }> = [];
      const worstScores: Array<{ criterionId: string; proposalId: string; score: number }> = [];

      (criteria || []).forEach((criterion: any) => {
        let bestScore = -Infinity;
        let worstScore = Infinity;
        let bestProposalId = '';
        let worstProposalId = '';

        proposalsWithScores.forEach((proposalData) => {
          const score = proposalData.scores.find((s) => s.criterion.id === criterion.id);
          if (score) {
            if (score.rawScore > bestScore) {
              bestScore = score.rawScore;
              bestProposalId = proposalData.proposal.id;
            }
            if (score.rawScore < worstScore) {
              worstScore = score.rawScore;
              worstProposalId = proposalData.proposal.id;
            }
          }
        });

        if (bestProposalId) {
          bestScores.push({
            criterionId: criterion.id,
            proposalId: bestProposalId,
            score: bestScore,
          });
        }

        if (worstProposalId) {
          worstScores.push({
            criterionId: criterion.id,
            proposalId: worstProposalId,
            score: worstScore,
          });
        }
      });

      return {
        proposals: proposalsWithScores,
        criteria: (criteria || []).map((c: any) => ({
          id: c.id,
          templateId: c.template_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          orderIndex: c.order_index,
          createdAt: c.created_at,
        })),
        bestScores,
        worstScores,
      };
    },

    // ============================================================================
    // Proposal Archival Queries
    // ============================================================================

    getProposals: async (
      _: any,
      { includeArchived, archivedOnly, projectId, status }: {
        includeArchived?: boolean;
        archivedOnly?: boolean;
        projectId?: string;
        status?: string;
      }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.getProposals({
          userId: user.id,
          includeArchived: includeArchived || false,
          archivedOnly: archivedOnly || false,
          projectId,
          status: status?.toLowerCase() as any,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to get proposals:', error);
        throw new GraphQLError(error.message || 'Failed to get proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    isProposalArchived: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.isProposalArchived({
          proposalId,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to check archived status:', error);
        throw new GraphQLError(error.message || 'Failed to check archived status', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getArchivedCount: async () => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.getArchivedCount(user.id);
        
        return result;
      } catch (error: any) {
        console.error('Failed to get archived count:', error);
        throw new GraphQLError(error.message || 'Failed to get archived count', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // Multi-Proposal Management Queries
    // ============================================================================

    getProposalDashboard: async (
      _: any,
      { filterStatus, filterDeadlineBefore, filterDeadlineAfter, filterProjectId, sortBy, sortOrder }: {
        filterStatus?: string;
        filterDeadlineBefore?: string;
        filterDeadlineAfter?: string;
        filterProjectId?: string;
        sortBy?: string;
        sortOrder?: string;
      }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { MultiProposalService } = await import('@/lib/multi-proposal-service');
        const result = await MultiProposalService.getProposalDashboard({
          userId: user.id,
          filterStatus: filterStatus?.toLowerCase() as any,
          filterDeadlineBefore,
          filterDeadlineAfter,
          filterProjectId,
          sortBy: sortBy as any,
          sortOrder: sortOrder as any,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to get proposal dashboard:', error);
        throw new GraphQLError(error.message || 'Failed to get proposal dashboard', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getWorkspaceState: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { MultiProposalService } = await import('@/lib/multi-proposal-service');
        const result = await MultiProposalService.getWorkspaceState({
          proposalId,
          userId: user.id,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to get workspace state:', error);
        throw new GraphQLError(error.message || 'Failed to get workspace state', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getAggregateStatistics: async () => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { MultiProposalService } = await import('@/lib/multi-proposal-service');
        const result = await MultiProposalService.getAggregateStatistics({
          userId: user.id,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to get aggregate statistics:', error);
        throw new GraphQLError(error.message || 'Failed to get aggregate statistics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // BIDDING LEADER MANAGEMENT QUERIES
    // ============================================================================

    getOpenProjects: async (
      _: any,
      { filter }: { filter?: any }
    ) => {
      try {
        const { ProjectDiscoveryServiceServer } = await import('@/lib/project-discovery-service.server');
        
        const projectFilter = filter ? {
          budgetMin: filter.budgetMin,
          budgetMax: filter.budgetMax,
          deadlineBefore: filter.deadlineBefore ? new Date(filter.deadlineBefore) : undefined,
          deadlineAfter: filter.deadlineAfter ? new Date(filter.deadlineAfter) : undefined,
          category: filter.category,
          searchTerm: filter.searchTerm,
          status: filter.status,
        } : undefined;

        const projects = await ProjectDiscoveryServiceServer.getOpenProjects(projectFilter);
        
        return projects.map((project: any) => ({
          id: project.id,
          clientId: project.clientId,
          title: project.title,
          description: project.description,
          status: project.status?.toUpperCase() || 'OPEN',
          budget: project.budget,
          budgetMin: project.budgetMin,
          budgetMax: project.budgetMax,
          deadline: project.deadline,
          additionalInfoRequirements: project.additionalInfoRequirements || [],
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }));
      } catch (error: any) {
        console.error('Failed to get open projects:', error);
        throw new GraphQLError(error.message || 'Failed to get open projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    searchProjects: async (
      _: any,
      { query, filter }: { query: string; filter?: any }
    ) => {
      try {
        const { ProjectDiscoveryServiceServer } = await import('@/lib/project-discovery-service.server');
        
        const projectFilter = filter ? {
          budgetMin: filter.budgetMin,
          budgetMax: filter.budgetMax,
          deadlineBefore: filter.deadlineBefore ? new Date(filter.deadlineBefore) : undefined,
          deadlineAfter: filter.deadlineAfter ? new Date(filter.deadlineAfter) : undefined,
          category: filter.category,
          status: filter.status,
        } : undefined;

        const projects = await ProjectDiscoveryServiceServer.searchProjects(query, projectFilter);
        
        return projects.map((project: any) => ({
          id: project.id,
          clientId: project.clientId,
          title: project.title,
          description: project.description,
          status: project.status?.toUpperCase() || 'OPEN',
          budget: project.budget,
          budgetMin: project.budgetMin,
          budgetMax: project.budgetMax,
          deadline: project.deadline,
          additionalInfoRequirements: project.additionalInfoRequirements || [],
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        }));
      } catch (error: any) {
        console.error('Failed to search projects:', error);
        throw new GraphQLError(error.message || 'Failed to search projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getProjectDetail: async (
      _: any,
      { projectId }: { projectId: string }
    ) => {
      try {
        const { ProjectDiscoveryServiceServer } = await import('@/lib/project-discovery-service.server');
        
        const project = await ProjectDiscoveryServiceServer.getProjectDetail(projectId);
        
        return {
          id: project.id,
          clientId: project.clientId,
          client: project.client ? {
            id: project.client.id,
            email: project.client.email,
            fullName: project.client.name,
          } : null,
          title: project.title,
          description: project.description,
          status: project.status?.toUpperCase() || 'OPEN',
          budget: project.budget,
          deadline: project.deadline,
          additionalInfoRequirements: project.additionalInfoRequirements || [],
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      } catch (error: any) {
        console.error('Failed to get project detail:', error);
        throw new GraphQLError(error.message || 'Failed to get project detail', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getBidPerformance: async (
      _: any,
      { leadId }: { leadId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: user can only view their own performance
      if (user.id !== leadId) {
        throw new GraphQLError('Forbidden: You can only view your own performance', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        const { AnalyticsService } = await import('@/lib/analytics-service');
        
        const performance = await AnalyticsService.getBidPerformance(leadId);
        
        return performance;
      } catch (error: any) {
        console.error('Failed to get bid performance:', error);
        throw new GraphQLError(error.message || 'Failed to get bid performance', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getTeamMetrics: async (
      _: any,
      { projectId }: { projectId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { AnalyticsService } = await import('@/lib/analytics-service');
        
        const metrics = await AnalyticsService.getTeamMetrics(projectId);
        
        return metrics;
      } catch (error: any) {
        console.error('Failed to get team metrics:', error);
        throw new GraphQLError(error.message || 'Failed to get team metrics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // Get all proposal team members for the current user
    getAllProposalTeamMembers: async (_: any, __: any) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // First, get all proposals where user is the lead
        const { data: leadProposals, error: leadError } = await supabase
          .from('proposals')
          .select(`
            id,
            project_id,
            lead_id,
            status,
            projects!inner(id, title, client_id)
          `)
          .eq('lead_id', user.id)
          .order('created_at', { ascending: false });

        if (leadError) {
          console.error('Failed to fetch lead proposals:', leadError);
          throw new GraphQLError('Failed to fetch proposals', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        // Then, get projects where user is a team member via proposal_team_members
        const { data: memberProposals } = await supabase
          .from('proposal_team_members')
          .select('proposal_id, proposals!inner(id, project_id, lead_id, status, projects!inner(id, title, client_id))')
          .eq('user_id', user.id);

        const memberProposalsData = memberProposals?.map((m: any) => ({
          id: m.proposals.id,
          project_id: m.proposals.project_id,
          lead_id: m.proposals.lead_id,
          status: m.proposals.status,
          projects: m.proposals.projects,
        })) || [];

        // Combine and deduplicate proposals
        const proposalMap = new Map();
        [...(leadProposals || []), ...memberProposalsData].forEach(p => {
          proposalMap.set(p.id, p);
        });
        const proposals = Array.from(proposalMap.values());

        // For each proposal, get team members
        const adminClient = createAdminClient();
        const proposalsWithTeams = await Promise.all((proposals || []).map(async (proposal: any) => {
          // Get team members from proposal_team_members (correct table)
          const { data: teamMembers } = await supabase
            .from('proposal_team_members')
            .select('user_id, role, joined_at')
            .eq('proposal_id', proposal.id);

          // Get user details for each member
          const membersWithDetails = await Promise.all((teamMembers || []).map(async (member: any) => {
            const { data: userData } = await adminClient.auth.admin.getUserById(member.user_id);
            
            return {
              userId: member.user_id,
              user: userData?.user ? {
                id: userData.user.id,
                email: userData.user.email,
                fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
                avatarUrl: userData.user.user_metadata?.avatar_url || null,
              } : null,
              role: member.role.toUpperCase(),
              joinedAt: member.joined_at,
            };
          }));

          return {
            proposalId: proposal.id,
            projectId: proposal.project_id,
            projectTitle: proposal.projects.title,
            proposalStatus: proposal.status.toUpperCase(),
            teamMembers: membersWithDetails,
          };
        }));

        return proposalsWithTeams;
      } catch (error: any) {
        console.error('Failed to get all proposal team members:', error);
        throw new GraphQLError(error.message || 'Failed to get all proposal team members', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getTeamMembers: async (
      _: any,
      { projectId }: { projectId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Make projectId optional - if not provided, return all teams for user's proposals
      if (!projectId) {
        // Redirect to getAllProposalTeamMembers
        return resolvers.Query.getAllProposalTeamMembers(_, {});
      }

      try {
        // First, get the proposal for this project
        const supabase = await createClient();
        const { data: proposal, error: proposalError } = await supabase
          .from('proposals')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (proposalError || !proposal) {
          throw new GraphQLError('No proposal found for this project', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        const { TeamManagementService } = await import('@/lib/team-management-service');
        const service = new TeamManagementService();
        
        const result = await service.getTeamMembers({ proposalId: proposal.id });

        if (!result.success || !result.data) {
          throw new GraphQLError(result.error || 'Failed to get team members', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        // Get user details for each member
        const adminClient = createAdminClient();
        const membersWithDetails = await Promise.all(
          result.data.map(async (member: any) => {
            const { data: userData } = await adminClient.auth.admin.getUserById(member.userId);
            
            return {
              id: member.id,
              projectId: member.projectId,
              userId: member.userId,
              user: userData?.user ? {
                id: userData.user.id,
                email: userData.user.email,
                fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
              } : null,
              role: member.role.toUpperCase(),
              joinedAt: member.joinedAt,
              assignedSections: member.assignedSections || [],
              contributionStats: member.contributionStats,
            };
          })
        );

        return membersWithDetails;
      } catch (error: any) {
        console.error('Failed to get team members:', error);
        throw new GraphQLError(error.message || 'Failed to get team members', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getActiveInvitations: async (
      _: any,
      { projectId }: { projectId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate projectId before proceeding
      if (!projectId || typeof projectId !== 'string') {
        throw new GraphQLError('Invalid project ID', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        const { TeamInvitationService } = await import('@/lib/team-invitation-service');
        const service = new TeamInvitationService();
        
        const result = await service.getActiveInvitations(projectId, user.id);

        if (!result.success) {
          // Return empty array instead of throwing for better UX
          if (result.error?.includes('Invalid project ID') || result.error?.includes('Only bidding leads')) {
            return [];
          }
          throw new GraphQLError(result.error || 'Failed to get active invitations', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return result.data || [];
      } catch (error: any) {
        console.error('Failed to get active invitations:', error);
        // Return empty array instead of throwing for better UX
        return [];
      }
    },

    validateInvitation: async (
      _: any,
      { codeOrToken }: { codeOrToken: string }
    ) => {
      // No authentication required for validation
      try {
        const { TeamInvitationService } = await import('@/lib/team-invitation-service');
        const service = new TeamInvitationService();
        
        const result = await service.validateInvitation({ codeOrToken });

        if (!result.success || !result.data) {
          // Return error in the ValidationResult format instead of throwing
          return {
            valid: false,
            invitation: null,
            error: result.error || 'Failed to validate invitation',
          };
        }

        return result.data;
      } catch (error: any) {
        console.error('Failed to validate invitation:', error);
        return {
          valid: false,
          invitation: null,
          error: error.message || 'Failed to validate invitation',
        };
      }
    },

    // Project Delivery and Archival Queries
    deliverables: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { DeliverableService } = await import('@/lib/deliverable-service');
      const result = await DeliverableService.getDeliverables(projectId);

      if (!result.success || !result.deliverables) {
        throw new GraphQLError(result.error || 'Failed to fetch deliverables', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get user details and download URLs for each deliverable
      const adminClient = createAdminClient();
      const deliverablesWithDetails = await Promise.all(
        result.deliverables.map(async (deliverable) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(deliverable.uploadedBy);
          const downloadUrlResult = await DeliverableService.generateDownloadUrl(deliverable.id);

          return {
            id: deliverable.id,
            projectId: deliverable.projectId,
            proposalId: deliverable.proposalId,
            uploadedBy: {
              id: deliverable.uploadedBy,
              email: userData?.user?.email || '',
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
            },
            fileName: deliverable.fileName,
            filePath: deliverable.filePath,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
            description: deliverable.description,
            version: deliverable.version,
            isFinal: deliverable.isFinal,
            uploadedAt: deliverable.uploadedAt.toISOString(),
            downloadUrl: downloadUrlResult.url || '',
          };
        })
      );

      return deliverablesWithDetails;
    },

    projectCompletion: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { CompletionService } = await import('@/lib/completion-service');
      const completion = await CompletionService.getCompletion(projectId);

      if (!completion) {
        return null;
      }

      // Get deliverables
      const { DeliverableService } = await import('@/lib/deliverable-service');
      const deliverablesResult = await DeliverableService.getDeliverables(projectId);
      const deliverables = deliverablesResult.deliverables || [];

      // Get revisions
      const revisions = await CompletionService.getRevisions(completion.id);

      // Get user details
      const adminClient = createAdminClient();
      const { data: submittedByData } = await adminClient.auth.admin.getUserById(completion.submittedBy);
      const reviewedByResponse = completion.reviewedBy 
        ? await adminClient.auth.admin.getUserById(completion.reviewedBy)
        : null;
      const reviewedByData = reviewedByResponse?.data;

      // Get deliverables with details
      const deliverablesWithDetails = await Promise.all(
        deliverables.map(async (deliverable) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(deliverable.uploadedBy);
          const downloadUrlResult = await DeliverableService.generateDownloadUrl(deliverable.id);

          return {
            id: deliverable.id,
            projectId: deliverable.projectId,
            proposalId: deliverable.proposalId,
            uploadedBy: {
              id: deliverable.uploadedBy,
              email: userData?.user?.email || '',
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
            },
            fileName: deliverable.fileName,
            filePath: deliverable.filePath,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
            description: deliverable.description,
            version: deliverable.version,
            isFinal: deliverable.isFinal,
            uploadedAt: deliverable.uploadedAt.toISOString(),
            downloadUrl: downloadUrlResult.url || '',
          };
        })
      );

      // Get revisions with details
      const revisionsWithDetails = await Promise.all(
        revisions.map(async (revision) => {
          const { data: requestedByData } = await adminClient.auth.admin.getUserById(revision.requestedBy);
          const resolvedByResponse = revision.resolvedBy 
            ? await adminClient.auth.admin.getUserById(revision.resolvedBy)
            : null;
          const resolvedByData = resolvedByResponse?.data;

          return {
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            requestedBy: {
              id: revision.requestedBy,
              email: requestedByData?.user?.email || '',
              fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
            },
            requestedAt: revision.requestedAt.toISOString(),
            revisionNotes: revision.revisionNotes,
            resolvedBy: revision.resolvedBy ? {
              id: revision.resolvedBy,
              email: resolvedByData?.user?.email || '',
              fullName: resolvedByData?.user?.user_metadata?.full_name || resolvedByData?.user?.user_metadata?.name || 'Unknown',
            } : null,
            resolvedAt: revision.resolvedAt?.toISOString(),
          };
        })
      );

      return {
        id: completion.id,
        projectId: completion.projectId,
        proposalId: completion.proposalId,
        submittedBy: {
          id: completion.submittedBy,
          email: submittedByData?.user?.email || '',
          fullName: submittedByData?.user?.user_metadata?.full_name || submittedByData?.user?.user_metadata?.name || 'Unknown',
        },
        submittedAt: completion.submittedAt.toISOString(),
        reviewedBy: completion.reviewedBy ? {
          id: completion.reviewedBy,
          email: reviewedByData?.user?.email || '',
          fullName: reviewedByData?.user?.user_metadata?.full_name || reviewedByData?.user?.user_metadata?.name || 'Unknown',
        } : null,
        reviewedAt: completion.reviewedAt?.toISOString(),
        reviewStatus: completion.reviewStatus.toUpperCase(),
        reviewComments: completion.reviewComments,
        revisionCount: completion.revisionCount,
        completedAt: completion.completedAt?.toISOString(),
        deliverables: deliverablesWithDetails,
        revisions: revisionsWithDetails,
      };
    },

    projectArchive: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ArchiveService } = await import('@/lib/archive-service');
      const result = await ArchiveService.getArchive(projectId, user.id);

      if (!result.success || !result.archive) {
        if (result.errorCode === 'NOT_FOUND') {
          return null;
        }
        throw new GraphQLError(result.error || 'Failed to fetch archive', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const archive = result.archive;
      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(archive.archivedBy);

      return {
        id: archive.id,
        projectId: archive.projectId,
        archiveIdentifier: archive.archiveIdentifier,
        compressedSize: archive.compressedSize,
        originalSize: archive.originalSize,
        compressionRatio: archive.compressionRatio,
        archivedBy: {
          id: archive.archivedBy,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: archive.archivedAt.toISOString(),
        retentionUntil: archive.retentionUntil?.toISOString(),
        legalHold: archive.legalHold,
        legalHoldReason: archive.legalHoldReason,
        accessCount: archive.accessCount,
        lastAccessedAt: archive.lastAccessedAt?.toISOString(),
        project: {
          id: archive.archiveData.project.id,
          title: archive.archiveData.project.title,
          description: archive.archiveData.project.description,
          budget: archive.archiveData.project.budget,
          deadline: archive.archiveData.project.deadline?.toISOString(),
          clientId: archive.archiveData.project.clientId,
          status: archive.archiveData.project.status,
          proposals: archive.archiveData.proposals.map((p) => ({
            id: p.id,
            leadId: p.leadId,
            status: p.status,
            submittedAt: p.submittedAt?.toISOString(),
            versions: p.versions.map((v) => ({
              versionNumber: v.versionNumber,
              content: JSON.stringify(v.content),
              createdBy: v.createdBy,
              createdAt: v.createdAt.toISOString(),
            })),
          })),
          deliverables: archive.archiveData.deliverables.map((d) => ({
            id: d.id,
            projectId: archive.projectId,
            proposalId: archive.archiveData.proposals[0]?.id || '',
            uploadedBy: {
              id: d.uploadedBy,
              email: '',
              fullName: 'Archived User',
            },
            fileName: d.fileName,
            filePath: d.filePath,
            fileType: d.fileType,
            fileSize: d.fileSize,
            description: d.description,
            version: 1,
            isFinal: true,
            uploadedAt: d.uploadedAt.toISOString(),
            downloadUrl: '',
          })),
          documents: archive.archiveData.workspaces.flatMap((w) =>
            w.documents.map((doc) => ({
              id: doc.id,
              title: doc.title,
              content: JSON.stringify(doc.content),
              createdBy: doc.createdBy,
              createdAt: doc.createdAt.toISOString(),
            }))
          ),
          comments: archive.archiveData.comments.map((c) => ({
            id: c.id,
            authorId: c.authorId,
            message: c.message,
            visibility: c.visibility,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      };
    },

    projectArchiveByIdentifier: async (_: any, { archiveIdentifier }: { archiveIdentifier: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ArchiveService } = await import('@/lib/archive-service');
      const result = await ArchiveService.getArchiveByIdentifier(archiveIdentifier, user.id);

      if (!result.success || !result.archive) {
        if (result.errorCode === 'NOT_FOUND') {
          return null;
        }
        throw new GraphQLError(result.error || 'Failed to fetch archive', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const archive = result.archive;
      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(archive.archivedBy);

      return {
        id: archive.id,
        projectId: archive.projectId,
        archiveIdentifier: archive.archiveIdentifier,
        compressedSize: archive.compressedSize,
        originalSize: archive.originalSize,
        compressionRatio: archive.compressionRatio,
        archivedBy: {
          id: archive.archivedBy,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: archive.archivedAt.toISOString(),
        retentionUntil: archive.retentionUntil?.toISOString(),
        legalHold: archive.legalHold,
        legalHoldReason: archive.legalHoldReason,
        accessCount: archive.accessCount,
        lastAccessedAt: archive.lastAccessedAt?.toISOString(),
        project: {
          id: archive.archiveData.project.id,
          title: archive.archiveData.project.title,
          description: archive.archiveData.project.description,
          budget: archive.archiveData.project.budget,
          deadline: archive.archiveData.project.deadline?.toISOString(),
          clientId: archive.archiveData.project.clientId,
          status: archive.archiveData.project.status,
          proposals: archive.archiveData.proposals.map((p) => ({
            id: p.id,
            leadId: p.leadId,
            status: p.status,
            submittedAt: p.submittedAt?.toISOString(),
            versions: p.versions.map((v) => ({
              versionNumber: v.versionNumber,
              content: JSON.stringify(v.content),
              createdBy: v.createdBy,
              createdAt: v.createdAt.toISOString(),
            })),
          })),
          deliverables: archive.archiveData.deliverables.map((d) => ({
            id: d.id,
            projectId: archive.projectId,
            proposalId: archive.archiveData.proposals[0]?.id || '',
            uploadedBy: {
              id: d.uploadedBy,
              email: '',
              fullName: 'Archived User',
            },
            fileName: d.fileName,
            filePath: d.filePath,
            fileType: d.fileType,
            fileSize: d.fileSize,
            description: d.description,
            version: 1,
            isFinal: true,
            uploadedAt: d.uploadedAt.toISOString(),
            downloadUrl: '',
          })),
          documents: archive.archiveData.workspaces.flatMap((w) =>
            w.documents.map((doc) => ({
              id: doc.id,
              title: doc.title,
              content: JSON.stringify(doc.content),
              createdBy: doc.createdBy,
              createdAt: doc.createdAt.toISOString(),
            }))
          ),
          comments: archive.archiveData.comments.map((c) => ({
            id: c.id,
            authorId: c.authorId,
            message: c.message,
            visibility: c.visibility,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      };
    },

    searchArchives: async (
      _: any,
      { query, limit = 50, offset = 0 }: { query: string; limit?: number; offset?: number }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ArchiveService } = await import('@/lib/archive-service');
      const result = await ArchiveService.searchArchives(query, user.id, limit, offset);

      if (!result.success || !result.archives) {
        throw new GraphQLError(result.error || 'Failed to search archives', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const archivesWithDetails = await Promise.all(
        result.archives.map(async (archive) => {
          const { data: archivedByData } = await adminClient.auth.admin.getUserById(archive.archivedBy);

          return {
            id: archive.id,
            projectId: archive.projectId,
            archiveIdentifier: archive.archiveIdentifier,
            compressedSize: archive.compressedSize,
            originalSize: archive.originalSize,
            compressionRatio: archive.compressionRatio,
            archivedBy: {
              id: archive.archivedBy,
              email: archivedByData?.user?.email || '',
              fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
            },
            archivedAt: archive.archivedAt.toISOString(),
            retentionUntil: archive.retentionUntil?.toISOString(),
            legalHold: archive.legalHold,
            legalHoldReason: archive.legalHoldReason,
            accessCount: archive.accessCount,
            lastAccessedAt: archive.lastAccessedAt?.toISOString(),
            project: {
              id: archive.archiveData.project.id,
              title: archive.archiveData.project.title,
              description: archive.archiveData.project.description,
              budget: archive.archiveData.project.budget,
              deadline: archive.archiveData.project.deadline?.toISOString(),
              clientId: archive.archiveData.project.clientId,
              status: archive.archiveData.project.status,
              proposals: archive.archiveData.proposals.map((p) => ({
                id: p.id,
                leadId: p.leadId,
                status: p.status,
                submittedAt: p.submittedAt?.toISOString(),
                versions: p.versions.map((v) => ({
                  versionNumber: v.versionNumber,
                  content: JSON.stringify(v.content),
                  createdBy: v.createdBy,
                  createdAt: v.createdAt.toISOString(),
                })),
              })),
              deliverables: archive.archiveData.deliverables.map((d) => ({
                id: d.id,
                projectId: archive.projectId,
                proposalId: archive.archiveData.proposals[0]?.id || '',
                uploadedBy: {
                  id: d.uploadedBy,
                  email: '',
                  fullName: 'Archived User',
                },
                fileName: d.fileName,
                filePath: d.filePath,
                fileType: d.fileType,
                fileSize: d.fileSize,
                description: d.description,
                version: 1,
                isFinal: true,
                uploadedAt: d.uploadedAt.toISOString(),
                downloadUrl: '',
              })),
              documents: archive.archiveData.workspaces.flatMap((w) =>
                w.documents.map((doc) => ({
                  id: doc.id,
                  title: doc.title,
                  content: JSON.stringify(doc.content),
                  createdBy: doc.createdBy,
                  createdAt: doc.createdAt.toISOString(),
                }))
              ),
              comments: archive.archiveData.comments.map((c) => ({
                id: c.id,
                authorId: c.authorId,
                message: c.message,
                visibility: c.visibility,
                createdAt: c.createdAt.toISOString(),
              })),
            },
          };
        })
      );

      return archivesWithDetails;
    },

    projectExport: async (_: any, { exportId }: { exportId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ExportService } = await import('@/lib/export-service');
      const result = await ExportService.getExport(exportId, user.id);

      if (!result.success || !result.export) {
        return null;
      }

      const exportRecord = result.export;

      // Verify user is the requester
      if (exportRecord.requestedBy !== user.id) {
        throw new GraphQLError('Forbidden: You can only view your own exports', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const adminClient = createAdminClient();
      const { data: requestedByData } = await adminClient.auth.admin.getUserById(exportRecord.requestedBy);

      // Generate download URL if export is completed
      let downloadUrl = null;
      if (exportRecord.status === 'completed' && exportRecord.exportPath) {
        const urlResult = await ExportService.generateDownloadUrl(exportId, user.id);
        downloadUrl = urlResult.url || null;
      }

      return {
        id: exportRecord.id,
        projectId: exportRecord.projectId,
        requestedBy: {
          id: exportRecord.requestedBy,
          email: requestedByData?.user?.email || '',
          fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
        },
        requestedAt: exportRecord.requestedAt.toISOString(),
        status: exportRecord.status.toUpperCase(),
        exportPath: exportRecord.exportPath,
        exportSize: exportRecord.exportSize,
        expiresAt: exportRecord.expiresAt?.toISOString(),
        downloadUrl,
        errorMessage: exportRecord.errorMessage,
      };
    },

    projectExports: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ExportService } = await import('@/lib/export-service');
      const result = await ExportService.getExportsByProject(projectId, user.id);

      if (!result.success || !result.exports) {
        return [];
      }

      // Filter to only show user's own exports
      const userExports = result.exports.filter((exp) => exp.requestedBy === user.id);

      const adminClient = createAdminClient();
      const exportsWithDetails = await Promise.all(
        userExports.map(async (exportRecord) => {
          const { data: requestedByData } = await adminClient.auth.admin.getUserById(exportRecord.requestedBy);

          // Generate download URL if export is completed
          let downloadUrl = null;
          if (exportRecord.status === 'completed' && exportRecord.exportPath) {
            const urlResult = await ExportService.generateDownloadUrl(exportRecord.id, user.id);
            downloadUrl = urlResult.url || null;
          }

          return {
            id: exportRecord.id,
            projectId: exportRecord.projectId,
            requestedBy: {
              id: exportRecord.requestedBy,
              email: requestedByData?.user?.email || '',
              fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
            },
            requestedAt: exportRecord.requestedAt.toISOString(),
            status: exportRecord.status.toUpperCase(),
            exportPath: exportRecord.exportPath,
            exportSize: exportRecord.exportSize,
            expiresAt: exportRecord.expiresAt?.toISOString(),
            downloadUrl,
            errorMessage: exportRecord.errorMessage,
          };
        })
      );

      return exportsWithDetails;
    },

    completionStatistics: async (
      _: any,
      { dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { StatisticsService } = await import('@/lib/statistics-service');
      const fromDate = dateFrom ? new Date(dateFrom) : undefined;
      const toDate = dateTo ? new Date(dateTo) : undefined;

      const result = await StatisticsService.getCompletionStatistics(fromDate, toDate);

      if (!result.success || !result.statistics) {
        throw new GraphQLError(result.error || 'Failed to fetch statistics', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const statistics = result.statistics;

      return {
        totalCompleted: statistics.totalCompleted,
        averageTimeToCompletion: statistics.averageTimeToCompletion,
        projectsRequiringRevisions: statistics.projectsRequiringRevisions,
        totalDeliverablesReceived: statistics.totalDeliverablesReceived,
        completionsByMonth: statistics.completionsByMonth.map((m) => ({
          month: m.month,
          count: m.count,
        })),
      };
    },

    // Notification queries
    notifications: async (_: any, { limit = 50, unreadOnly = false }: { limit?: number; unreadOnly?: boolean }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Unauthorized');
      }

      let query = supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      const { data: notifications, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      const { count: unreadCount } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      // Map database fields to GraphQL schema fields
      const mappedNotifications = (notifications || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        readAt: n.read_at,
        sentViaEmail: n.sent_via_email || false,
        legalHold: n.legal_hold || false,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      }));

      return {
        notifications: mappedNotifications,
        unreadCount: unreadCount || 0,
      };
    },

    unreadNotificationCount: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Unauthorized');
      }

      const { count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      return count || 0;
    },

    // ============================================================================
    // LEAD DASHBOARD QUERIES
    // ============================================================================

    leadDashboardStats: async (
      _: any,
      { leadId }: { leadId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: user can only view their own dashboard
      if (user.id !== leadId) {
        throw new GraphQLError('Forbidden: You can only view your own dashboard', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        // Get all proposals for this lead
        const { data: proposals, error: proposalsError } = await supabase
          .from('proposals')
          .select(`
            id,
            status,
            submitted_at,
            created_at,
            budget_estimate,
            timeline_estimate
          `)
          .eq('lead_id', leadId);

        if (proposalsError) {
          console.error('Error fetching proposals:', proposalsError);
          throw proposalsError;
        }

        const allProposals = proposals || [];
        
        // Calculate statistics
        const totalProposals = allProposals.length;
        const activeProposals = allProposals.filter(
          (p: any) => p.status === 'draft' || p.status === 'submitted' || p.status === 'reviewing'
        ).length;
        const submittedProposals = allProposals.filter(
          (p: any) => p.status === 'submitted' || p.status === 'reviewing' || p.status === 'approved' || p.status === 'rejected'
        ).length;
        const acceptedProposals = allProposals.filter(
          (p: any) => p.status === 'approved'
        ).length;
        const rejectedProposals = allProposals.filter(
          (p: any) => p.status === 'rejected'
        ).length;

        // Calculate win rate
        const decidedProposals = acceptedProposals + rejectedProposals;
        const winRate = decidedProposals > 0 
          ? Math.round((acceptedProposals / decidedProposals) * 100) 
          : 0;

        // Calculate total bid value (sum of all budget estimates)
        let totalBidValue = 0;
        allProposals.forEach((p: any) => {
          if (p.budget_estimate) {
            totalBidValue += p.budget_estimate;
          }
        });

        // Calculate average response time (hours from creation to submission)
        const submittedWithDates = allProposals.filter(
          (p: any) => p.submitted_at && p.created_at
        );
        let averageResponseTime = 0;
        if (submittedWithDates.length > 0) {
          const totalHours = submittedWithDates.reduce((sum: number, p: any) => {
            const created = new Date(p.created_at).getTime();
            const submitted = new Date(p.submitted_at).getTime();
            const hours = (submitted - created) / (1000 * 60 * 60);
            return sum + hours;
          }, 0);
          averageResponseTime = Math.round(totalHours / submittedWithDates.length);
        }

        return {
          totalProposals,
          activeProposals,
          submittedProposals,
          acceptedProposals,
          rejectedProposals,
          winRate,
          totalBidValue,
          averageResponseTime,
        };
      } catch (error: any) {
        console.error('Failed to get lead dashboard stats:', error);
        throw new GraphQLError(error.message || 'Failed to get dashboard statistics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    leadRecentProposals: async (
      _: any,
      { leadId, limit = 5 }: { leadId: string; limit?: number }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: user can only view their own proposals
      if (user.id !== leadId) {
        throw new GraphQLError('Forbidden: You can only view your own proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        // Get recent proposals with project information
        const { data: proposals, error: proposalsError } = await supabase
          .from('proposals')
          .select(`
            id,
            status,
            submitted_at,
            created_at,
            budget_estimate,
            projects!inner(
              id,
              title
            )
          `)
          .eq('lead_id', leadId)
          .order('submitted_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (proposalsError) {
          console.error('Error fetching recent proposals:', proposalsError);
          throw proposalsError;
        }

        const recentProposals = (proposals || []).map((p: any) => {
          return {
            id: p.id,
            projectTitle: p.projects?.title || 'Untitled Project',
            status: p.status,
            submittedAt: p.submitted_at || p.created_at,
            budgetEstimate: p.budget_estimate || 0,
          };
        });

        return recentProposals;
      } catch (error: any) {
        console.error('Failed to get recent proposals:', error);
        throw new GraphQLError(error.message || 'Failed to get recent proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    submissionDraft: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { data: draft, error: draftError } = await supabase
          .from('submission_drafts')
          .select('*')
          .eq('proposal_id', proposalId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (draftError) {
          console.error('Error fetching draft:', draftError);
          throw new GraphQLError('Failed to fetch draft', {
            extensions: { code: 'DATABASE_ERROR', details: draftError },
          });
        }

        if (!draft) {
          return null;
        }

        return {
          id: draft.id,
          proposalId: draft.proposal_id,
          userId: draft.user_id,
          currentStep: draft.current_step,
          draftData: draft.draft_data,
          createdAt: draft.created_at,
          updatedAt: draft.updated_at,
        };
      } catch (error: any) {
        console.error('Failed to get submission draft:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError(error.message || 'Failed to get draft', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // Section Comment Queries
    // ============================================================================

    getSectionComments: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Get all comments for the section
        const { data: comments, error } = await supabase
          .from('section_comments')
          .select(`
            *,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .eq('section_id', sectionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching comments:', error);
          throw new GraphQLError('Failed to fetch comments', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        // Organize comments into threads
        const commentMap = new Map<string, any>();
        const rootComments: any[] = [];

        comments?.forEach((comment) => {
          const mappedComment = mapSectionComment(comment);
          commentMap.set(mappedComment.id, mappedComment);

          if (!mappedComment.parentId) {
            rootComments.push(mappedComment);
          }
        });

        // Build reply trees
        comments?.forEach((comment) => {
          if (comment.parent_id) {
            const parent = commentMap.get(comment.parent_id);
            if (parent) {
              if (!parent.replies) parent.replies = [];
              const child = commentMap.get(comment.id);
              if (child) parent.replies.push(child);
            }
          }
        });

        return rootComments;
      } catch (error: any) {
        console.error('Error in getSectionComments:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to fetch comments', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    getUnresolvedCommentsCount: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { count, error } = await supabase
          .from('section_comments')
          .select('*', { count: 'exact', head: true })
          .eq('section_id', sectionId)
          .eq('is_resolved', false);

        if (error) {
          console.error('Error getting unresolved count:', error);
          return 0;
        }

        return count || 0;
      } catch (error: any) {
        console.error('Error in getUnresolvedCommentsCount:', error);
        return 0;
      }
    },
  },

  // Field resolver for Workspace type
  Workspace: {
    documents: async (parent: { id: string }) => {
      // Use admin client to bypass RLS for fetching workspace documents
      const adminClient = createAdminClient();
      
      const { data: documents, error } = await adminClient
        .from('workspace_documents')
        .select('*')
        .eq('workspace_id', parent.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching workspace documents:', error);
        return [];
      }

      return (documents || []).map((doc: any) => ({
        id: doc.id,
        workspaceId: doc.workspace_id,
        title: doc.title,
        description: doc.description,
        content: doc.content || {},
        createdBy: doc.created_by,
        lastEditedBy: doc.last_edited_by,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));
    },
  },

  // Field resolver for Document type
  Document: {
    collaborators: async (parent: { id: string }) => {
      const adminClient = createAdminClient();
      
      const { data: collaborators, error } = await adminClient
        .from('document_collaborators')
        .select('*')
        .eq('document_id', parent.id);

      if (error) {
        console.error('Error fetching document collaborators:', error);
        return [];
      }

      // Get user details for each collaborator
      const collaboratorsWithDetails = await Promise.all(
        (collaborators || []).map(async (collab: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(collab.user_id);
          const { data: addedByData } = await adminClient.auth.admin.getUserById(collab.added_by);
          
          return {
            id: collab.id,
            documentId: collab.document_id,
            userId: collab.user_id,
            userName: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown',
            email: userData?.user?.email || '',
            role: collab.role.toUpperCase(),
            addedBy: collab.added_by,
            addedByName: addedByData?.user?.user_metadata?.full_name || addedByData?.user?.email || 'Unknown',
            addedAt: collab.added_at,
          };
        })
      );

      return collaboratorsWithDetails;
    },

    versions: async (parent: { id: string }) => {
      const adminClient = createAdminClient();
      
      const { data: versions, error } = await adminClient
        .from('document_versions')
        .select('*')
        .eq('document_id', parent.id)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('Error fetching document versions:', error);
        return [];
      }

      return (versions || []).map((v: any) => ({
        id: v.id,
        documentId: v.document_id,
        versionNumber: v.version_number,
        content: v.content,
        createdBy: v.created_by,
        changesSummary: v.changes_summary,
        isRollback: v.is_rollback,
        rolledBackFrom: v.rolled_back_from,
        createdAt: v.created_at,
      }));
    },

    activeSessions: async (parent: { id: string }) => {
      const adminClient = createAdminClient();
      
      // Get sessions active in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: sessions, error } = await adminClient
        .from('collaboration_sessions')
        .select('*')
        .eq('document_id', parent.id)
        .gte('last_activity', fiveMinutesAgo);

      if (error) {
        console.error('Error fetching active sessions:', error);
        return [];
      }

      // Get user details for each session
      const sessionsWithDetails = await Promise.all(
        (sessions || []).map(async (session: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(session.user_id);
          
          return {
            userId: session.user_id,
            userName: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown',
            userColor: session.user_color,
            cursorPosition: session.cursor_position,
            lastActivity: session.last_activity,
          };
        })
      );

      return sessionsWithDetails;
    },

    sections: async (parent: { id: string }) => {
      const adminClient = createAdminClient();
      
      const { data: sections, error } = await adminClient
        .from('document_sections')
        .select('*')
        .eq('document_id', parent.id)
        .order('order', { ascending: true });

      if (error) {
        console.error('Error fetching document sections:', error);
        return [];
      }

      // Get user details for assigned users
      const sectionsWithDetails = await Promise.all(
        (sections || []).map(async (section: any) => {
          let assignedToUser = null;
          if (section.assigned_to) {
            const { data: userData } = await adminClient.auth.admin.getUserById(section.assigned_to);
            if (userData?.user) {
              assignedToUser = {
                id: userData.user.id,
                email: userData.user.email,
                fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
              };
            }
          }

          return {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assigned_to,
            assignedToUser,
            deadline: section.deadline,
            content: section.content || {},
            lockedBy: section.locked_by,
            lockedAt: section.locked_at,
            lockExpiresAt: section.lock_expires_at,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
          };
        })
      );

      return sectionsWithDetails;
    },
  },

  Mutation: {
    sendMessage: async (
      _: any,
      { input }: { input: { projectId: string; proposalId?: string; content: string } }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'sendMessage',
          hint: 'Please log in to send messages',
          originalError: authError,
        });
      }

      // Check if user is suspended
      checkUserSuspension(user, 'sendMessage');

      // Validate content is not empty
      if (!input.content.trim()) {
        throw createDetailedError('Message content cannot be empty', 'BAD_USER_INPUT', {
          operation: 'sendMessage',
          field: 'content',
          hint: 'Please provide a message to send',
        });
      }

      // Insert message
      const { data: message, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          project_id: input.projectId,
          proposal_id: input.proposalId || null,
          sender_id: user.id,
          content: input.content,
          read: false,
        })
        .select()
        .single();

      if (insertError) {
        throw handleSupabaseError(insertError, 'sendMessage.insert', {
          table: 'chat_messages',
          userId: user.id,
          resourceId: input.projectId,
        });
      }

      // Send notification to message recipient(s)
      try {
        const { NotificationService } = await import('../notification-service');
        
        // Get project details
        const { data: project } = await supabase
          .from('projects')
          .select('client_id, title')
          .eq('id', input.projectId)
          .single();

        if (project) {
          const senderName = user.user_metadata?.full_name || user.user_metadata?.name || 'Someone';
          const senderRole = user.user_metadata?.role;
          
          if (senderRole === 'client') {
            // Client sent message - notify the lead(s)
            if (input.proposalId) {
              // Notify specific proposal lead
              const { data: proposal } = await supabase
                .from('proposals')
                .select('lead_id')
                .eq('id', input.proposalId)
                .single();
              
              if (proposal && proposal.lead_id !== user.id) {
                await NotificationService.createNotification({
                  userId: proposal.lead_id,
                  type: 'message_received',
                  title: 'New Message from Client',
                  body: `${senderName} sent you a message about "${project.title}": "${input.content.substring(0, 80)}${input.content.length > 80 ? '...' : ''}"`,
                  data: {
                    projectId: input.projectId,
                    proposalId: input.proposalId,
                    messageId: message.id,
                    senderId: user.id,
                  },
                  sendEmail: true,
                  priority: NotificationService.NotificationPriority.HIGH,
                }).catch(error => {
                  console.error('Failed to send message notification:', error);
                });
              }
            }
          } else {
            // Lead/member sent message - notify the client
            if (project.client_id !== user.id) {
              await NotificationService.createNotification({
                userId: project.client_id,
                type: 'message_received',
                title: 'New Message on Your Project',
                body: `${senderName} sent you a message about "${project.title}": "${input.content.substring(0, 80)}${input.content.length > 80 ? '...' : ''}"`,
                data: {
                  projectId: input.projectId,
                  proposalId: input.proposalId,
                  messageId: message.id,
                  senderId: user.id,
                },
                sendEmail: true,
                priority: NotificationService.NotificationPriority.HIGH,
              }).catch(error => {
                console.error('Failed to send message notification:', error);
              });
            }
          }
        }
      } catch (error) {
        console.error('Error sending message notification:', error);
      }

      return {
        id: message.id,
        projectId: message.project_id,
        proposalId: message.proposal_id,
        senderId: message.sender_id,
        senderName: user.user_metadata?.full_name || user.user_metadata?.name || 'Unknown',
        senderAvatar: user.user_metadata?.avatar_url || null,
        senderRole: user.user_metadata?.role || 'bidding_member',
        content: message.content,
        createdAt: message.created_at,
        read: message.read,
      };
    },

    markMessagesAsRead: async (
      _: any,
      { projectId, proposalId }: { projectId: string; proposalId?: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Build update query
      let query = supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('project_id', projectId)
        .neq('sender_id', user.id);

      if (proposalId) {
        query = query.eq('proposal_id', proposalId);
      }

      const { error: updateError } = await query;

      if (updateError) {
        throw new GraphQLError('Failed to mark messages as read', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    acceptProposal: async (
      _: any,
      { proposalId, projectId }: { proposalId: string; projectId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'acceptProposal',
          hint: 'Please log in to accept proposals',
          originalError: authError,
        });
      }

      // Verify user is the project client and get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id, title')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw handleSupabaseError(projectError, 'acceptProposal.fetchProject', {
          table: 'projects',
          userId: user.id,
          resourceId: projectId,
        });
      }

      if (!project) {
        throw createDetailedError('Project not found', 'NOT_FOUND', {
          operation: 'acceptProposal.fetchProject',
          resourceId: projectId,
          hint: 'The project may have been deleted',
        });
      }

      if (project.client_id !== user.id) {
        throw createDetailedError('Forbidden: Only the project client can accept proposals', 'FORBIDDEN', {
          operation: 'acceptProposal',
          userId: user.id,
          resourceId: projectId,
          hint: 'You must be the project owner to accept proposals',
        });
      }

      // Get proposal details for notifications
      const { data: proposal, error: proposalFetchError } = await supabase
        .from('proposals')
        .select('lead_id, status')
        .eq('id', proposalId)
        .single();

      if (proposalFetchError) {
        throw handleSupabaseError(proposalFetchError, 'acceptProposal.fetchProposal', {
          table: 'proposals',
          userId: user.id,
          resourceId: proposalId,
        });
      }

      if (!proposal) {
        throw createDetailedError('Proposal not found', 'NOT_FOUND', {
          operation: 'acceptProposal.fetchProposal',
          resourceId: proposalId,
          hint: 'The proposal may have been deleted or does not exist',
        });
      }

      // Update the accepted proposal status
      const { error: acceptError } = await supabase
        .from('proposals')
        .update({ status: 'approved' })
        .eq('id', proposalId);

      if (acceptError) {
        throw handleSupabaseError(acceptError, 'acceptProposal.updateStatus', {
          table: 'proposals',
          userId: user.id,
          resourceId: proposalId,
        });
      }

      // Reject all other proposals for this project
      const { error: rejectError } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('project_id', projectId)
        .neq('id', proposalId);

      if (rejectError) {
        throw handleSupabaseError(rejectError, 'acceptProposal.rejectOthers', {
          table: 'proposals',
          userId: user.id,
          resourceId: projectId,
        });
      }

      // Update project status to awarded
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({ status: 'awarded' })
        .eq('id', projectId);

      if (projectUpdateError) {
        throw handleSupabaseError(projectUpdateError, 'acceptProposal.updateProjectStatus', {
          table: 'projects',
          userId: user.id,
          resourceId: projectId,
        });
      }

      // Create decision record
      const { data: decision, error: decisionError } = await supabase
        .from('proposal_decisions')
        .insert({
          proposal_id: proposalId,
          project_id: projectId,
          decision_type: 'accepted',
          decided_by: user.id,
        })
        .select()
        .single();

      if (decisionError) {
        throw handleSupabaseError(decisionError, 'acceptProposal.createDecision', {
          table: 'proposal_decisions',
          userId: user.id,
          resourceId: proposalId,
        });
      }

      // Send notifications (non-blocking)
      // Requirement 6.2: Notify bidding leader and all team members
      const { NotificationService } = await import('@/lib/notification-service');
      
      // Notify the bidding leader
      NotificationService.createNotification({
        userId: proposal.lead_id,
        type: 'proposal_accepted',
        title: `Proposal Accepted: ${project.title}`,
        body: `Congratulations! Your proposal for "${project.title}" has been accepted by the client.`,
        data: {
          proposalId,
          projectId,
          projectTitle: project.title,
        },
        sendEmail: true,
        priority: NotificationService.NotificationPriority.HIGH,
      }).catch(error => {
        console.error('Failed to send notification to lead:', error);
      });

      // Notify all team members
      // Send notifications to team members (fire and forget)
      (async () => {
        try {
          // Get all proposals for this project
          const { data: proposals } = await supabase
            .from('proposals')
            .select('id')
            .eq('project_id', projectId);

          const proposalIds = proposals?.map(p => p.id) || [];

          // Get team members from proposal_team_members
          const { data: teamMembers } = await supabase
            .from('proposal_team_members')
            .select('user_id')
            .in('proposal_id', proposalIds)
            .neq('user_id', proposal.lead_id);

          if (teamMembers && teamMembers.length > 0) {
            teamMembers.forEach(member => {
              NotificationService.createNotification({
                userId: member.user_id,
                type: 'proposal_accepted',
                title: `Proposal Accepted: ${project.title}`,
                body: `Great news! Your team's proposal for "${project.title}" has been accepted by the client.`,
                data: {
                  proposalId,
                  projectId,
                  projectTitle: project.title,
                  leadId: proposal.lead_id,
                },
                sendEmail: true,
                priority: NotificationService.NotificationPriority.HIGH,
              }).catch((error: any) => {
                console.error(`Failed to send notification to team member ${member.user_id}:`, error);
              });
            });
          }
        } catch (error) {
          console.error('Failed to fetch team members for notifications:', error);
        }
      })();

      return {
        id: decision.id,
        proposalId: decision.proposal_id,
        projectId: decision.project_id,
        decisionType: decision.decision_type,
        decidedBy: decision.decided_by,
        decidedAt: decision.decided_at,
        feedback: decision.feedback,
      };
    },

    rejectProposal: async (
      _: any,
      { input }: { input: { proposalId: string; projectId: string; feedback: string } }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'rejectProposal',
          hint: 'Please log in to reject proposals',
          originalError: authError,
        });
      }

      // Validate feedback is not empty
      if (!input.feedback.trim()) {
        throw createDetailedError('Rejection feedback is required', 'BAD_USER_INPUT', {
          operation: 'rejectProposal',
          field: 'feedback',
          hint: 'Please provide feedback explaining why the proposal was rejected',
        });
      }

      // Verify user is the project client and get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id, title')
        .eq('id', input.projectId)
        .single();

      if (projectError) {
        throw handleSupabaseError(projectError, 'rejectProposal.fetchProject', {
          table: 'projects',
          userId: user.id,
          resourceId: input.projectId,
        });
      }

      if (!project) {
        throw createDetailedError('Project not found', 'NOT_FOUND', {
          operation: 'rejectProposal.fetchProject',
          resourceId: input.projectId,
          hint: 'The project may have been deleted',
        });
      }

      if (project.client_id !== user.id) {
        throw createDetailedError('Forbidden: Only the project client can reject proposals', 'FORBIDDEN', {
          operation: 'rejectProposal',
          userId: user.id,
          resourceId: input.projectId,
          hint: 'You must be the project owner to reject proposals',
        });
      }

      // Get proposal details for notifications
      const { data: proposal, error: proposalFetchError } = await supabase
        .from('proposals')
        .select('lead_id, status')
        .eq('id', input.proposalId)
        .single();

      if (proposalFetchError) {
        throw handleSupabaseError(proposalFetchError, 'rejectProposal.fetchProposal', {
          table: 'proposals',
          userId: user.id,
          resourceId: input.proposalId,
        });
      }

      if (!proposal) {
        throw createDetailedError('Proposal not found', 'NOT_FOUND', {
          operation: 'rejectProposal.fetchProposal',
          resourceId: input.proposalId,
          hint: 'The proposal may have been deleted or does not exist',
        });
      }

      // Update proposal status
      const { error: rejectError } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', input.proposalId);

      if (rejectError) {
        throw handleSupabaseError(rejectError, 'rejectProposal.updateStatus', {
          table: 'proposals',
          userId: user.id,
          resourceId: input.proposalId,
        });
      }

      // Create decision record with feedback
      const { data: decision, error: decisionError } = await supabase
        .from('proposal_decisions')
        .insert({
          proposal_id: input.proposalId,
          project_id: input.projectId,
          decision_type: 'rejected',
          decided_by: user.id,
          feedback: input.feedback,
        })
        .select()
        .single();

      if (decisionError) {
        throw handleSupabaseError(decisionError, 'rejectProposal.createDecision', {
          table: 'proposal_decisions',
          userId: user.id,
          resourceId: input.proposalId,
        });
      }

      // Send notification to bidding leader (non-blocking)
      // Requirement 6.4: Notify bidding leader when proposal is rejected
      const { NotificationService } = await import('@/lib/notification-service');
      
      NotificationService.createNotification({
        userId: proposal.lead_id,
        type: 'proposal_rejected',
        title: `Proposal Not Selected: ${project.title}`,
        body: `Your proposal for "${project.title}" was not selected. The client has provided feedback for your review.`,
        data: {
          proposalId: input.proposalId,
          projectId: input.projectId,
          projectTitle: project.title,
          feedback: input.feedback,
        },
        sendEmail: true,
        priority: NotificationService.NotificationPriority.MEDIUM,
      }).catch(error => {
        console.error('Failed to send rejection notification to lead:', error);
      });

      return {
        id: decision.id,
        proposalId: decision.proposal_id,
        projectId: decision.project_id,
        decisionType: decision.decision_type,
        decidedBy: decision.decided_by,
        decidedAt: decision.decided_at,
        feedback: decision.feedback,
      };
    },

    updateProjectStatus: async (
      _: any,
      { projectId, status, notes }: { projectId: string; status: string; notes?: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const userRole = user.user_metadata?.role;

      // First, get the current project to log the previous status
      const { data: existingProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (fetchError || !existingProject) {
        console.error('Database error fetching project:', fetchError);
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const previousStatus = existingProject.status;

      // Authorization check
      if (userRole === 'client') {
        // Clients can only update their own projects
        if (existingProject.client_id !== user.id) {
          throw new GraphQLError('Forbidden: You can only update your own projects', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
        // Clients can only close or reopen projects
        const allowedStatuses = ['open', 'closed'];
        if (!allowedStatuses.includes(status.toLowerCase())) {
          throw new GraphQLError('Clients can only open or close projects', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      } else if (userRole !== 'admin') {
        throw new GraphQLError('Only admins and project owners can update project status', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update project status - use admin client for admins, regular client for clients
      const clientToUse = userRole === 'admin' ? createAdminClient() : supabase;
      const { data: updatedProjects, error: updateError } = await clientToUse
        .from('projects')
        .update({
          status: status.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select('*');

      if (updateError || !updatedProjects || updatedProjects.length === 0) {
        console.error('Database error updating project:', updateError);
        console.error('Project ID:', projectId);
        console.error('New status:', status.toLowerCase());
        throw new GraphQLError(`Failed to update project: ${updateError?.message || 'No rows updated'}`, {
          extensions: { 
            code: 'INTERNAL_SERVER_ERROR',
            details: updateError 
          },
        });
      }

      const project = updatedProjects[0];

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'project_status_updated',
        targetUserId: project.client_id,
        previousValue: { status: previousStatus },
        newValue: { status: status.toLowerCase() },
        reason: notes || undefined,
      });

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        status: project.status.toUpperCase(),
        budget: project.budget,
        deadline: project.deadline,
        additionalInfoRequirements: project.additional_info_requirements || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      };
    },

    createProject: async (
      _: any,
      { input }: { 
        input: { 
          title: string; 
          description: string; 
          budget?: number; 
          deadline?: string;
          additionalInfoRequirements?: Array<{
            id: string;
            fieldName: string;
            fieldType: string;
            required: boolean;
            helpText?: string;
            options?: string[];
            order: number;
          }>;
        } 
      }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'createProject',
          hint: 'Please log in to create a project',
          originalError: authError,
        });
      }

      // Check if user is suspended
      checkUserSuspension(user, 'createProject');

      // Check if user is a client
      const userRole = user.user_metadata?.role;
      if (userRole !== 'client') {
        throw createDetailedError('Only clients can create projects', 'FORBIDDEN', {
          operation: 'createProject',
          userId: user.id,
          hint: `Your current role is "${userRole}". Only users with "client" role can create projects.`,
        });
      }

      // Check verification status
      const verificationStatus = user.user_metadata?.verification_status;
      if (verificationStatus !== 'verified') {
        throw createDetailedError(
          'Account verification required. Your account must be verified by a Content Coordinator before you can create projects.',
          'FORBIDDEN',
          {
            operation: 'createProject',
            userId: user.id,
            hint: `Your verification status is "${verificationStatus || 'pending_verification'}". Please wait for admin approval.`,
          }
        );
      }

      // Validate required fields
      if (!input.title?.trim()) {
        throw createDetailedError('Project title is required', 'BAD_USER_INPUT', {
          operation: 'createProject',
          field: 'title',
          hint: 'Please provide a title for your project',
        });
      }

      if (!input.description?.trim()) {
        throw createDetailedError('Project description is required', 'BAD_USER_INPUT', {
          operation: 'createProject',
          field: 'description',
          hint: 'Please provide a description for your project',
        });
      }

      // Create project with additional info requirements
      const { data: project, error: createError } = await supabase
        .from('projects')
        .insert({
          client_id: user.id,
          title: input.title,
          description: input.description,
          budget: input.budget || null,
          deadline: input.deadline || null,
          status: 'pending_review',
          additional_info_requirements: input.additionalInfoRequirements || [],
        })
        .select('*')
        .single();

      if (createError) {
        throw handleSupabaseError(createError, 'createProject.insert', {
          table: 'projects',
          userId: user.id,
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'project_created',
        resourceType: 'project',
        resourceId: project.id,
        metadata: {
          title: project.title,
          hasAdditionalRequirements: (input.additionalInfoRequirements?.length || 0) > 0,
          requirementsCount: input.additionalInfoRequirements?.length || 0,
        },
      });

      // Requirement 10.1: Notify all administrators when a project is created
      try {
        const { NotificationService } = await import('../notification-service');
        
        // Get all admin users
        const adminClient = createAdminClient();
        const { data: allUsers } = await adminClient.auth.admin.listUsers();
        const admins = allUsers?.users.filter((u: any) => u.user_metadata?.role === 'admin') || [];
        
        // Send notification to each admin (in-app only per requirement 10.4)
        for (const admin of admins) {
          await NotificationService.createNotification({
            userId: admin.id,
            type: 'project_created',
            title: `New Project Created: ${project.title}`,
            body: `A new project "${project.title}" has been created by ${user.user_metadata?.full_name || user.email} and requires review.`,
            data: {
              projectId: project.id,
              clientId: user.id,
              title: project.title,
              budget: project.budget,
              deadline: project.deadline,
            },
            sendEmail: false, // Requirement 10.4: In-app only for admin project notifications
          }).catch(error => {
            console.error('Failed to send admin notification:', error);
          });
        }
      } catch (error) {
        // Non-blocking: log error but don't fail project creation
        console.error('Error sending admin notifications for project creation:', error);
      }

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        status: project.status.toUpperCase(),
        budget: project.budget,
        deadline: project.deadline,
        additionalInfoRequirements: project.additional_info_requirements || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      };
    },

    updateProject: async (
      _: any,
      { id, input }: { id: string; input: any }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user is suspended
      checkUserSuspension(user, 'updateProject');

      // Get the existing project
      const { data: existingProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingProject) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Authorization check - only the project owner can update
      if (existingProject.client_id !== user.id) {
        throw new GraphQLError('Forbidden: You can only update your own projects', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Only allow editing if project is in pending_review status
      if (existingProject.status !== 'pending_review') {
        throw new GraphQLError('Projects can only be edited while in pending review status', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.budget !== undefined) updateData.budget = input.budget;
      if (input.deadline !== undefined) updateData.deadline = input.deadline;
      if (input.additionalInfoRequirements !== undefined) {
        updateData.additional_info_requirements = input.additionalInfoRequirements;
      }

      // Update project
      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Database error updating project:', updateError);
        throw new GraphQLError(`Failed to update project: ${updateError.message}`, {
          extensions: { 
            code: 'INTERNAL_SERVER_ERROR',
            details: updateError 
          },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'project_updated',
        resourceType: 'project',
        resourceId: id,
        metadata: {
          updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at'),
        },
      });

      return {
        id: updatedProject.id,
        clientId: updatedProject.client_id,
        title: updatedProject.title,
        description: updatedProject.description,
        status: updatedProject.status.toUpperCase(),
        budget: updatedProject.budget,
        deadline: updatedProject.deadline,
        additionalInfoRequirements: updatedProject.additional_info_requirements || [],
        createdAt: updatedProject.created_at,
        updatedAt: updatedProject.updated_at,
      };
    },

    verifyClient: async (
      _: any,
      { userId, approved, reason }: { userId: string; approved: boolean; reason?: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get the target user
      const adminClient = createAdminClient();
      const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify the user is a client
      if (targetUser.user.user_metadata?.role !== 'client') {
        throw new GraphQLError('User is not a client', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const previousStatus = targetUser.user.user_metadata?.verification_status || 'pending_verification';

      // Update user metadata with verification status
      const newStatus = approved ? 'verified' : 'rejected';
      const updatedMetadata = {
        ...targetUser.user.user_metadata,
        verification_status: newStatus,
        verification_reason: reason || null,
        verified_at: approved ? new Date().toISOString() : null,
        verified_by: user.id,
      };

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to update user verification status', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action with decision details
      await logAdminAction({
        adminId: user.id,
        actionType: 'verify_client',
        targetUserId: userId,
        previousValue: { verification_status: previousStatus },
        newValue: { 
          verification_status: newStatus,
          approved,
          reason: reason || null,
        },
        reason: reason || (approved ? 'Client verification approved' : 'Client verification rejected'),
      });

      // Send notification email to user
      const clientName = updatedUser.user.user_metadata?.full_name || updatedUser.user.user_metadata?.name || 'User';
      const clientEmail = updatedUser.user.email!;

      if (approved) {
        await sendVerificationApprovedEmail({
          clientName,
          clientEmail,
        });
      } else {
        await sendVerificationRejectedEmail({
          clientName,
          clientEmail,
          reason: reason || 'Your verification request did not meet our requirements.',
        });
      }

      // Requirements 11.1, 11.2, 11.4, 11.5: Send in-app and email notifications for verification status
      try {
        const { NotificationService } = await import('../notification-service');
        
        if (approved) {
          // Requirement 11.1: Notify user of verification approval
          await NotificationService.createNotification({
            userId: userId,
            type: 'verification_approved',
            title: 'Account Verified',
            body: 'Your account has been verified! You can now create projects and access all platform features.',
            data: {
              verifiedAt: updatedUser.user.user_metadata?.verified_at,
              verifiedBy: user.id,
            },
            sendEmail: true, // Requirement 11.4: Send both in-app and email
            priority: 'critical' as any, // Requirement 11.5: Critical notifications bypass preferences
          }).catch(error => {
            console.error('Failed to send verification approval notification:', error);
          });
        } else {
          // Requirement 11.2: Notify user of verification rejection with reason
          await NotificationService.createNotification({
            userId: userId,
            type: 'verification_rejected',
            title: 'Account Verification Rejected',
            body: `Your account verification request has been rejected. Reason: ${reason || 'Your verification request did not meet our requirements.'}`,
            data: {
              reason: reason || 'Your verification request did not meet our requirements.',
              rejectedBy: user.id,
            },
            sendEmail: true, // Requirement 11.4: Send both in-app and email
            priority: 'critical' as any, // Requirement 11.5: Critical notifications bypass preferences
          }).catch(error => {
            console.error('Failed to send verification rejection notification:', error);
          });
        }
      } catch (error) {
        // Non-blocking: log error but don't fail verification process
        console.error('Error sending verification notifications:', error);
      }

      const u = updatedUser.user;
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: 'CLIENT',
        verificationStatus: newStatus.toUpperCase(),
        verificationReason: reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: u.user_metadata?.is_suspended || false,
        suspendedReason: u.user_metadata?.suspended_reason || null,
        suspendedAt: u.user_metadata?.suspended_at || null,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    inviteAdmin: async (
      _: any,
      { email }: { email: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check if email already has admin role
      const adminClient = createAdminClient();
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingAdmin = existingUsers?.users.find(
        (u: any) => u.email === email && u.user_metadata?.role === 'admin'
      );

      if (existingAdmin) {
        throw new GraphQLError('User with this email is already an admin', {
          extensions: { code: 'CONFLICT' },
        });
      }

      // Generate unique token and set expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('admin_invitations')
        .insert({
          email,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (inviteError) {
        throw new GraphQLError('Failed to create admin invitation', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'invite_admin',
        previousValue: undefined,
        newValue: { email, token: invitation.token },
        reason: 'Admin invitation sent',
      });

      // Send invitation email
      const inviterName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'BidSync Admin';
      await sendAdminInvitationEmail({
        inviteeEmail: email,
        inviterName,
        invitationToken: invitation.token,
        expiresAt: invitation.expires_at,
      });

      return {
        id: invitation.id,
        email: invitation.email,
        invitedBy: invitation.invited_by,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      };
    },

    removeAdminPrivileges: async (
      _: any,
      { userId }: { userId: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if user is trying to remove their own privileges
      if (userId === user.id) {
        throw new GraphQLError('Cannot remove your own admin privileges', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check if this is the last admin
      const adminClient = createAdminClient();
      const { data: allUsers } = await adminClient.auth.admin.listUsers();
      const adminCount = allUsers?.users.filter((u: any) => u.user_metadata?.role === 'admin').length || 0;

      if (adminCount <= 1) {
        throw new GraphQLError('Cannot remove the last admin. At least one admin must remain.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get target user
      const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify target user is an admin
      if (targetUser.user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('User is not an admin', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Update user role to bidding_member (standard user)
      const previousMetadata = { ...targetUser.user.user_metadata };
      const updatedMetadata = {
        ...targetUser.user.user_metadata,
        role: 'bidding_member',
      };

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to remove admin privileges', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'remove_admin_privileges',
        targetUserId: userId,
        previousValue: { role: 'admin' },
        newValue: { role: 'bidding_member' },
        reason: 'Admin privileges removed',
      });

      const u = updatedUser.user;
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: 'BIDDING_MEMBER',
        verificationStatus: (u.user_metadata?.verification_status || 'verified').toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: u.user_metadata?.is_suspended || false,
        suspendedReason: u.user_metadata?.suspended_reason || null,
        suspendedAt: u.user_metadata?.suspended_at || null,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    acceptAdminInvitation: async (
      _: any,
      { token }: { token: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Find invitation by token
      const { data: invitation, error: inviteError } = await supabase
        .from('admin_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invitation) {
        throw new GraphQLError('Invalid invitation token', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if invitation has already been used
      if (invitation.used_by) {
        throw new GraphQLError('Invitation has already been used', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check if invitation has expired
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      if (now > expiresAt) {
        throw new GraphQLError('Invitation has expired', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Verify user email matches invitation email
      if (user.email !== invitation.email) {
        throw new GraphQLError('Invitation email does not match your account', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update user role to admin
      const updatedMetadata = {
        ...user.user_metadata,
        role: 'admin',
      };

      const adminClient = createAdminClient();
      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to grant admin privileges', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Mark invitation as used
      await supabase
        .from('admin_invitations')
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      const u = updatedUser.user;
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: 'ADMIN',
        verificationStatus: (u.user_metadata?.verification_status || 'verified').toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: u.user_metadata?.is_suspended || false,
        suspendedReason: u.user_metadata?.suspended_reason || null,
        suspendedAt: u.user_metadata?.suspended_at || null,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    changeUserRole: async (
      _: any,
      { userId, newRole }: { userId: string; newRole: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate new role
      const validRoles = ['CLIENT', 'BIDDING_LEAD', 'BIDDING_MEMBER', 'CONTENT_COORDINATOR', 'ADMIN'];
      if (!validRoles.includes(newRole)) {
        throw new GraphQLError('Invalid role value', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get target user
      const adminClient = createAdminClient();
      const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const previousRole = targetUser.user.user_metadata?.role || 'bidding_member';
      const newRoleLower = newRole.toLowerCase();

      // Update user role
      const updatedMetadata = {
        ...targetUser.user.user_metadata,
        role: newRoleLower,
      };

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to change user role', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'change_user_role',
        targetUserId: userId,
        previousValue: { role: previousRole },
        newValue: { role: newRoleLower },
        reason: 'User role changed',
      });

      const u = updatedUser.user;
      const defaultStatus = newRoleLower === 'client' ? 'pending_verification' : 'verified';
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: newRole,
        verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: u.user_metadata?.is_suspended || false,
        suspendedReason: u.user_metadata?.suspended_reason || null,
        suspendedAt: u.user_metadata?.suspended_at || null,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    suspendUser: async (
      _: any,
      { userId, reason }: { userId: string; reason: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get target user
      const adminClient = createAdminClient();
      const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Update user metadata to mark as suspended
      const updatedMetadata = {
        ...targetUser.user.user_metadata,
        is_suspended: true,
        suspended_reason: reason,
        suspended_at: new Date().toISOString(),
        suspended_by: user.id,
      };

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to suspend user', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'suspend_user',
        targetUserId: userId,
        previousValue: { is_suspended: false },
        newValue: { is_suspended: true, reason },
        reason,
      });

      // Send suspension notification email
      const userName = updatedUser.user.user_metadata?.full_name || updatedUser.user.user_metadata?.name || 'User';
      const userEmail = updatedUser.user.email!;
      await sendAccountSuspensionEmail({
        userName,
        userEmail,
        reason,
        suspendedAt: updatedUser.user.user_metadata?.suspended_at,
      });

      // Requirement 11.3, 11.5: Send critical notification for account suspension
      try {
        const { NotificationService } = await import('../notification-service');
        
        await NotificationService.createNotification({
          userId: userId,
          type: 'account_suspended',
          title: 'Account Suspended',
          body: `Your account has been suspended. Reason: ${reason}`,
          data: {
            reason: reason,
            suspendedAt: updatedUser.user.user_metadata?.suspended_at,
            suspendedBy: user.id,
          },
          sendEmail: true,
          priority: 'critical' as any, // Requirement 11.5: Critical notifications bypass preferences
        }).catch(error => {
          console.error('Failed to send account suspension notification:', error);
        });
      } catch (error) {
        // Non-blocking: log error but don't fail suspension process
        console.error('Error sending suspension notifications:', error);
      }

      const u = updatedUser.user;
      const role = u.user_metadata?.role || 'bidding_member';
      const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: role.toUpperCase(),
        verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: true,
        suspendedReason: reason,
        suspendedAt: u.user_metadata?.suspended_at,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    reactivateUser: async (
      _: any,
      { userId }: { userId: string }
    ) => {
      const supabase = await createClient();
      
      // Check if user is admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Forbidden: Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get target user
      const adminClient = createAdminClient();
      const { data: targetUser, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !targetUser.user) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Update user metadata to remove suspension
      const updatedMetadata = {
        ...targetUser.user.user_metadata,
        is_suspended: false,
        suspended_reason: null,
        suspended_at: null,
        suspended_by: null,
      };

      const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: updatedMetadata }
      );

      if (updateError || !updatedUser.user) {
        throw new GraphQLError('Failed to reactivate user', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log admin action
      await logAdminAction({
        adminId: user.id,
        actionType: 'reactivate_user',
        targetUserId: userId,
        previousValue: { is_suspended: true },
        newValue: { is_suspended: false },
        reason: 'User account reactivated',
      });

      // Send notification to reactivated user
      try {
        const { NotificationService } = await import('../notification-service');
        
        await NotificationService.createNotification({
          userId: userId,
          type: 'verification_approved', // Reusing this type for account reactivation
          title: '✅ Account Reactivated',
          body: 'Your account has been reactivated. You can now access all platform features again.',
          data: {
            reactivatedAt: new Date().toISOString(),
            reactivatedBy: user.id,
          },
          sendEmail: true,
          priority: NotificationService.NotificationPriority.HIGH,
        }).catch(error => {
          console.error('Failed to send account reactivation notification:', error);
        });
      } catch (error) {
        console.error('Error sending account reactivation notification:', error);
      }

      const u = updatedUser.user;
      const role = u.user_metadata?.role || 'bidding_member';
      const defaultStatus = role === 'client' ? 'pending_verification' : 'verified';
      return {
        id: u.id,
        email: u.email,
        emailVerified: u.user_metadata?.email_verified || false,
        role: role.toUpperCase(),
        verificationStatus: (u.user_metadata?.verification_status || defaultStatus).toUpperCase(),
        verificationReason: u.user_metadata?.verification_reason,
        fullName: u.user_metadata?.full_name || u.user_metadata?.name,
        isSuspended: false,
        suspendedReason: null,
        suspendedAt: null,
        lastActivityAt: u.user_metadata?.last_activity_at || u.last_sign_in_at || null,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      };
    },

    logUserActivity: async (
      _: any,
      { userId, action, resourceType, resourceId, metadata }: {
        userId: string;
        action: string;
        resourceType?: string;
        resourceId?: string;
        metadata?: any;
      }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Create activity log
      const { data: log, error: logError } = await supabase
        .from('user_activity_logs')
        .insert({
          user_id: userId,
          action,
          resource_type: resourceType || null,
          resource_id: resourceId || null,
          metadata: metadata || null,
        })
        .select()
        .single();

      if (logError) {
        throw new GraphQLError('Failed to log user activity', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return {
        id: log.id,
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        metadata: log.metadata,
        createdAt: log.created_at,
      };
    },

    createProposal: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw createDetailedError('Not authenticated', 'UNAUTHENTICATED', {
          operation: 'createProposal',
          hint: 'Please log in to create a proposal',
          originalError: authError,
        });
      }

      // Check if user is suspended
      checkUserSuspension(user, 'createProposal');

      // Verify user is a bidding lead
      const userRole = user.user_metadata?.role;
      if (userRole !== 'bidding_lead') {
        throw createDetailedError('Forbidden: Only bidding leads can create proposals', 'FORBIDDEN', {
          operation: 'createProposal',
          userId: user.id,
          hint: `Your current role is "${userRole}". Only users with "bidding_lead" role can create proposals.`,
        });
      }

      // Use ProposalService to create proposal with workspace and sections
      const result = await ProposalService.createProposal(projectId, user.id);

      if (!result.success) {
        // Map error codes to detailed errors
        const errorHints: Record<string, string> = {
          'DUPLICATE_PROPOSAL': 'You have already created a proposal for this project',
          'PROJECT_NOT_FOUND': 'The project you are trying to bid on does not exist or has been deleted',
          'PROJECT_NOT_OPEN': 'This project is not currently accepting proposals. It may be pending review, closed, or already awarded.',
          'UNAUTHORIZED': 'You do not have permission to create a proposal for this project',
          'WORKSPACE_CREATION_FAILED': 'Failed to create the proposal workspace. Please try again.',
          'UNKNOWN': 'An unexpected error occurred. Please try again or contact support.',
        };

        const errorCodeMap: Record<string, string> = {
          'DUPLICATE_PROPOSAL': 'BAD_USER_INPUT',
          'PROJECT_NOT_FOUND': 'NOT_FOUND',
          'PROJECT_NOT_OPEN': 'BAD_USER_INPUT',
          'UNAUTHORIZED': 'FORBIDDEN',
          'WORKSPACE_CREATION_FAILED': 'INTERNAL_SERVER_ERROR',
          'UNKNOWN': 'INTERNAL_SERVER_ERROR',
        };

        throw createDetailedError(
          result.error || 'Failed to create proposal',
          errorCodeMap[result.errorCode || 'UNKNOWN'] || 'INTERNAL_SERVER_ERROR',
          {
            operation: 'createProposal',
            userId: user.id,
            resourceId: projectId,
            hint: errorHints[result.errorCode || 'UNKNOWN'],
          }
        );
      }

      // Get project details for response
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw handleSupabaseError(projectError, 'createProposal.fetchProject', {
          table: 'projects',
          userId: user.id,
          resourceId: projectId,
        });
      }

      if (!project) {
        throw createDetailedError('Project not found', 'NOT_FOUND', {
          operation: 'createProposal.fetchProject',
          resourceId: projectId,
          hint: 'The project may have been deleted after proposal creation',
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'proposal_created',
        resourceType: 'proposal',
        resourceId: result.proposal!.id,
        metadata: {
          projectId,
          projectTitle: project.title,
          workspaceId: result.workspace!.id,
        },
      });

      return {
        id: result.proposal!.id,
        projectId: result.proposal!.projectId,
        leadId: result.proposal!.leadId,
        title: null,
        status: result.proposal!.status.toUpperCase(),
        budgetEstimate: null,
        timelineEstimate: null,
        executiveSummary: null,
        submissionDate: null,
        createdAt: result.proposal!.createdAt,
        updatedAt: result.proposal!.createdAt,
        documentId: result.document?.id || null,
        workspaceId: result.workspace?.id || null,
        project: {
          id: project.id,
          clientId: project.client_id,
          title: project.title,
          description: project.description,
          status: project.status.toUpperCase(),
          budget: project.budget,
          deadline: project.deadline,
          additionalInfoRequirements: project.additional_info_requirements || [],
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
      };
    },

    updateProposal: async (
      _: any,
      {
        proposalId,
        title,
        content,
        budgetEstimate,
        timelineEstimate,
        additionalInfo,
      }: {
        proposalId: string;
        title?: string;
        content?: string;
        budgetEstimate?: number;
        timelineEstimate?: string;
        additionalInfo?: Record<string, any>;
      }
    ) => {
      const supabase = await createClient();

      // Get authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify proposal exists and user owns it
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (proposal.lead_id !== user.id) {
        throw new GraphQLError('Forbidden: You can only update your own proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Only allow updates to draft proposals
      if (proposal.status !== 'draft') {
        throw new GraphQLError('Cannot update submitted proposals', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Update proposal
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (budgetEstimate !== undefined) updateData.budget_estimate = budgetEstimate;
      if (timelineEstimate !== undefined) updateData.timeline_estimate = timelineEstimate;
      if (additionalInfo !== undefined) updateData.additional_info = additionalInfo;

      // Use admin client to bypass RLS for proposal updates
      const adminClient = createAdminClient();
      const { data: updatedProposal, error: updateError } = await adminClient
        .from('proposals')
        .update(updateData)
        .eq('id', proposalId)
        .select()
        .single();

      if (updateError || !updatedProposal) {
        console.error('Failed to update proposal:', updateError);
        throw new GraphQLError(`Failed to update proposal: ${updateError?.message || 'Unknown error'}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch workspace and document IDs for this proposal
      let workspaceId = null;
      let documentId = null;
      
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)
        .eq('lead_id', user.id)
        .single();

      if (workspace) {
        workspaceId = workspace.id;
        
        // Get the first document in this workspace
        const { data: document } = await supabase
          .from('workspace_documents')
          .select('id')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (document) {
          documentId = document.id;
        }
      }

      // Sync content to workspace_documents if content was updated
      // This ensures collaborative editor shows the latest content from workspace page
      if (content !== undefined && workspaceId && documentId) {
        try {
          // Parse content if it's a JSON string, otherwise wrap it in TipTap format
          let documentContent: any;
          try {
            documentContent = typeof content === 'string' ? JSON.parse(content) : content;
          } catch {
            // If content is plain text, wrap it in TipTap document format
            documentContent = {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: content ? [{ type: 'text', text: content }] : []
                }
              ]
            };
          }

          const { error: docUpdateError } = await adminClient
            .from('workspace_documents')
            .update({
              content: documentContent,
              last_edited_by: user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId);

          if (docUpdateError) {
            console.error('[updateProposal] Failed to sync content to workspace document:', docUpdateError);
          } else {
            console.log('[updateProposal] Successfully synced content to workspace document:', documentId);
          }
        } catch (syncError) {
          console.error('[updateProposal] Error syncing content to workspace document:', syncError);
          // Don't fail the proposal update, just log the error
        }
      }

      // Get project for response
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', updatedProposal.project_id)
        .single();

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'proposal_updated',
        resourceType: 'proposal',
        resourceId: proposalId,
        metadata: {
          fields: Object.keys(updateData),
        },
      });

      return {
        id: updatedProposal.id,
        projectId: updatedProposal.project_id,
        leadId: updatedProposal.lead_id,
        title: updatedProposal.title,
        content: updatedProposal.content,
        status: updatedProposal.status?.toUpperCase() || 'DRAFT',
        budgetEstimate: updatedProposal.budget_estimate,
        timelineEstimate: updatedProposal.timeline_estimate,
        executiveSummary: updatedProposal.executive_summary,
        additionalInfo: updatedProposal.additional_info,
        submissionDate: updatedProposal.submitted_at,
        documentId: documentId,
        workspaceId: workspaceId,
        createdAt: updatedProposal.created_at,
        updatedAt: updatedProposal.updated_at,
        project: project ? {
          id: project.id,
          clientId: project.client_id,
          title: project.title,
          description: project.description,
          status: project.status?.toUpperCase() || 'PENDING_REVIEW',
          budget: project.budget,
          budgetMin: project.budget_min,
          budgetMax: project.budget_max,
          deadline: project.deadline,
          additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
            id: req.id,
            fieldName: req.fieldName,
            fieldType: req.fieldType?.toUpperCase() || 'TEXT',
            required: req.required ?? false,
            helpText: req.helpText || null,
            options: req.options || [],
            order: req.order ?? 0,
          })),
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        } : null,
      };
    },

    submitProposal: async (
      _: any,
      { input }: {
        input: {
          proposalId: string;
          projectId: string;
          title: string;
          budgetEstimate: number;
          timelineEstimate: string;
          executiveSummary: string;
          additionalInfo: Array<{
            fieldId: string;
            fieldName: string;
            fieldValue: any;
          }>;
        };
      }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is the proposal lead
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('lead_id')
        .eq('id', input.proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (proposal.lead_id !== user.id) {
        throw new GraphQLError('Forbidden: Only the proposal lead can submit the proposal', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Process submission using the service
      const submissionService = new ProposalSubmissionService();
      const result = await submissionService.processSubmission({
        proposalId: input.proposalId,
        projectId: input.projectId,
        userId: user.id,
        title: input.title,
        budgetEstimate: input.budgetEstimate,
        timelineEstimate: input.timelineEstimate,
        executiveSummary: input.executiveSummary,
        additionalInfo: input.additionalInfo,
      });

      return {
        success: result.success,
        proposalId: result.proposalId,
        submittedAt: result.submittedAt,
        errors: result.errors || [],
      };
    },

    // Collaborative Editor Mutations - Document Operations
    createWorkspace: async (
      _: any,
      { input }: { input: { projectId: string; name: string; description?: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is a project lead
      const userRole = user.user_metadata?.role;
      if (userRole !== 'bidding_lead') {
        throw new GraphQLError('Only bidding leads can create workspaces', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Create workspace
      const { data: workspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          project_id: input.projectId,
          lead_id: user.id,
          name: input.name,
          description: input.description,
        })
        .select()
        .single();

      if (createError || !workspace) {
        throw new GraphQLError(`Failed to create workspace: ${createError?.message || 'Unknown error'}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return {
        id: workspace.id,
        projectId: workspace.project_id,
        leadId: workspace.lead_id,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
      };
    },

    createDocument: async (
      _: any,
      { input }: { input: { workspaceId: string; title: string; description?: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();
      const result = await documentService.createDocument({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        createdBy: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          document: null,
          error: result.error || 'Failed to create document',
        };
      }

      return {
        success: true,
        document: {
          id: result.data.id,
          workspaceId: result.data.workspaceId,
          title: result.data.title,
          description: result.data.description,
          content: result.data.content,
          createdBy: result.data.createdBy,
          lastEditedBy: result.data.lastEditedBy,
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
        },
        error: null,
      };
    },

    updateDocument: async (
      _: any,
      { documentId, input }: { documentId: string; input: { title?: string; description?: string; content?: any } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();

      // Update metadata if provided
      if (input.title !== undefined || input.description !== undefined) {
        const metadataResult = await documentService.updateDocumentMetadata({
          documentId,
          title: input.title,
          description: input.description,
          userId: user.id,
        });

        if (!metadataResult.success) {
          return {
            success: false,
            document: null,
            error: metadataResult.error || 'Failed to update document metadata',
          };
        }
      }

      // Update content if provided
      if (input.content !== undefined) {
        const contentResult = await documentService.updateDocument({
          documentId,
          content: input.content,
          userId: user.id,
        });

        if (!contentResult.success || !contentResult.data) {
          return {
            success: false,
            document: null,
            error: contentResult.error || 'Failed to update document content',
          };
        }

        // Sync document content to the corresponding proposal
        // This ensures workspace page shows the latest content from collaborative editor
        try {
          // Get workspace info from the document
          const { data: docWithWorkspace } = await supabase
            .from('workspace_documents')
            .select('workspace_id, workspaces!inner(project_id, lead_id)')
            .eq('id', documentId)
            .single();

          if (docWithWorkspace) {
            const workspace = docWithWorkspace.workspaces as any;
            const projectId = workspace.project_id;
            const leadId = workspace.lead_id;

            // Update the proposal content for this project and lead
            const contentString = typeof input.content === 'string' 
              ? input.content 
              : JSON.stringify(input.content);

            const { error: proposalUpdateError } = await supabase
              .from('proposals')
              .update({ 
                content: contentString,
                updated_at: new Date().toISOString()
              })
              .eq('project_id', projectId)
              .eq('lead_id', leadId);

            if (proposalUpdateError) {
              console.error('[updateDocument] Failed to sync content to proposal:', proposalUpdateError);
              // Don't fail the document update, just log the error
            } else {
              console.log('[updateDocument] Successfully synced content to proposal for project:', projectId);
            }
          }
        } catch (syncError) {
          console.error('[updateDocument] Error syncing content to proposal:', syncError);
          // Don't fail the document update, just log the error
        }

        return {
          success: true,
          document: {
            id: contentResult.data.id,
            workspaceId: contentResult.data.workspaceId,
            title: contentResult.data.title,
            description: contentResult.data.description,
            content: contentResult.data.content,
            createdBy: contentResult.data.createdBy,
            lastEditedBy: contentResult.data.lastEditedBy,
            createdAt: contentResult.data.createdAt,
            updatedAt: contentResult.data.updatedAt,
          },
          error: null,
        };
      }

      // If only metadata was updated, fetch the updated document
      const docResult = await documentService.getDocument(documentId, user.id);
      if (!docResult.success || !docResult.data) {
        return {
          success: false,
          document: null,
          error: docResult.error || 'Failed to fetch updated document',
        };
      }

      return {
        success: true,
        document: {
          id: docResult.data.id,
          workspaceId: docResult.data.workspaceId,
          title: docResult.data.title,
          description: docResult.data.description,
          content: docResult.data.content,
          createdBy: docResult.data.createdBy,
          lastEditedBy: docResult.data.lastEditedBy,
          createdAt: docResult.data.createdAt,
          updatedAt: docResult.data.updatedAt,
        },
        error: null,
      };
    },

    deleteDocument: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const documentService = new DocumentService();
      const result = await documentService.deleteDocument(documentId, user.id);

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to delete document', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    // Version Control Mutations
    createVersion: async (
      _: any,
      { documentId, changesSummary }: { documentId: string; changesSummary?: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get current document content
      const documentService = new DocumentService();
      const docResult = await documentService.getDocument(documentId, user.id);

      if (!docResult.success || !docResult.data) {
        return {
          success: false,
          version: null,
          error: docResult.error || 'Failed to fetch document',
        };
      }

      const versionService = new VersionControlService();
      const result = await versionService.createVersion({
        documentId,
        content: docResult.data.content,
        userId: user.id,
        changesSummary,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          version: null,
          error: result.error || 'Failed to create version',
        };
      }

      // Get user name
      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(result.data.createdBy);
      const createdByName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

      return {
        success: true,
        version: {
          id: result.data.id,
          documentId: result.data.documentId,
          versionNumber: result.data.versionNumber,
          content: result.data.content,
          createdBy: result.data.createdBy,
          createdByName,
          changesSummary: result.data.changesSummary,
          isRollback: result.data.isRollback,
          rolledBackFrom: result.data.rolledBackFrom,
          createdAt: result.data.createdAt,
        },
        error: null,
      };
    },

    rollbackToVersion: async (
      _: any,
      { documentId, versionId }: { documentId: string; versionId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const versionService = new VersionControlService();
      const result = await versionService.rollbackToVersion({
        documentId,
        versionId,
        userId: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          document: null,
          error: result.error || 'Failed to rollback document',
        };
      }

      return {
        success: true,
        document: {
          id: result.data.id,
          workspaceId: result.data.workspaceId,
          title: result.data.title,
          description: result.data.description,
          content: result.data.content,
          createdBy: result.data.createdBy,
          lastEditedBy: result.data.lastEditedBy,
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
        },
        error: null,
      };
    },

    // Team Management Mutations
    inviteMember: async (
      _: any,
      { input }: { input: { documentId: string; email: string; role: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const teamService = new TeamManagementService();
      const result = await teamService.inviteMember({
        documentId: input.documentId,
        email: input.email,
        role: input.role.toLowerCase() as 'editor' | 'commenter' | 'viewer',
        invitedBy: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          invitation: null,
          error: result.error || 'Failed to invite member',
        };
      }

      // Get document title and inviter name
      const { data: document } = await supabase
        .from('workspace_documents')
        .select('title')
        .eq('id', input.documentId)
        .single();

      const adminClient = createAdminClient();
      const { data: inviterData } = await adminClient.auth.admin.getUserById(user.id);
      const invitedByName = inviterData?.user?.user_metadata?.full_name || inviterData?.user?.email || 'Unknown';

      return {
        success: true,
        invitation: {
          id: result.data.id,
          documentId: result.data.documentId,
          documentTitle: document?.title || 'Untitled',
          email: result.data.email,
          role: result.data.role.toUpperCase(),
          token: result.data.token,
          invitedBy: result.data.invitedBy,
          invitedByName,
          expiresAt: result.data.expiresAt,
          acceptedAt: result.data.acceptedAt,
          acceptedBy: result.data.acceptedBy,
          createdAt: result.data.createdAt,
        },
        error: null,
      };
    },

    acceptInvitation: async (_: any, { token }: { token: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const teamService = new TeamManagementService();
      const result = await teamService.acceptInvitation({
        invitationToken: token,
        userId: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          collaborator: null,
          error: result.error || 'Failed to accept invitation',
        };
      }

      // Get added by name
      const adminClient = createAdminClient();
      const { data: addedByData } = await adminClient.auth.admin.getUserById(result.data.addedBy);
      const addedByName = addedByData?.user?.user_metadata?.full_name || addedByData?.user?.email || 'Unknown';

      return {
        success: true,
        collaborator: {
          id: result.data.id,
          documentId: result.data.documentId,
          userId: result.data.userId,
          userName: result.data.userName,
          email: result.data.email,
          role: result.data.role.toUpperCase(),
          addedBy: result.data.addedBy,
          addedByName,
          addedAt: result.data.addedAt,
        },
        error: null,
      };
    },

    updateMemberRole: async (
      _: any,
      { input }: { input: { documentId: string; userId: string; role: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const teamService = new TeamManagementService();
      const result = await teamService.updateMemberRole({
        documentId: input.documentId,
        userId: input.userId,
        role: input.role.toLowerCase() as any,
        updatedBy: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          collaborator: null,
          error: result.error || 'Failed to update member role',
        };
      }

      // Get added by name
      const adminClient = createAdminClient();
      const { data: addedByData } = await adminClient.auth.admin.getUserById(result.data.addedBy);
      const addedByName = addedByData?.user?.user_metadata?.full_name || addedByData?.user?.email || 'Unknown';

      return {
        success: true,
        collaborator: {
          id: result.data.id,
          documentId: result.data.documentId,
          userId: result.data.userId,
          userName: result.data.userName,
          email: result.data.email,
          role: result.data.role.toUpperCase(),
          addedBy: result.data.addedBy,
          addedByName,
          addedAt: result.data.addedAt,
        },
        error: null,
      };
    },

    removeMember: async (
      _: any,
      { documentId, userId }: { documentId: string; userId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const teamService = new TeamManagementService();
      const result = await teamService.removeMember({
        documentId,
        userId,
        removedBy: user.id,
      });

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to remove member', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    // Collaboration Session Mutations
    joinSession: async (
      _: any,
      { input }: { input: { documentId: string; userColor: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const collaborationService = new CollaborationService();
      const result = await collaborationService.joinSession({
        documentId: input.documentId,
        userId: user.id,
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          session: null,
          error: result.error || 'Failed to join session',
        };
      }

      return {
        success: true,
        session: {
          id: result.data.id,
          documentId: result.data.documentId,
          userId: result.data.userId,
          userName: result.data.userName,
          userColor: result.data.userColor,
          cursorPosition: result.data.cursorPosition,
          presenceStatus: result.data.presenceStatus.toUpperCase(),
          lastActivity: result.data.lastActivity,
          joinedAt: result.data.joinedAt,
        },
        error: null,
      };
    },

    leaveSession: async (_: any, { sessionId }: { sessionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const collaborationService = new CollaborationService();
      const result = await collaborationService.leaveSession({
        sessionId,
        userId: user.id,
      });

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to leave session', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    updateCursorPosition: async (
      _: any,
      { input }: { input: { sessionId: string; from: number; to: number } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const collaborationService = new CollaborationService();
      const result = await collaborationService.broadcastCursorPosition({
        sessionId: input.sessionId,
        userId: user.id,
        position: { from: input.from, to: input.to },
      });

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to update cursor position', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    updatePresence: async (
      _: any,
      { input }: { input: { sessionId: string; status: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const collaborationService = new CollaborationService();
      const result = await collaborationService.broadcastPresence({
        sessionId: input.sessionId,
        userId: user.id,
        presence: {
          status: input.status.toLowerCase() as 'active' | 'idle' | 'away',
          lastActivity: new Date().toISOString(),
        },
      });

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to update presence', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    updateCurrentSection: async (
      _: any,
      { input }: { input: { sessionId: string; sectionId?: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Update the session's current section
      const { error } = await supabase
        .from('collaboration_sessions')
        .update({ 
          current_section: input.sectionId || null,
          last_activity: new Date().toISOString()
        })
        .eq('id', input.sessionId)
        .eq('user_id', user.id);

      if (error) {
        throw new GraphQLError('Failed to update current section', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    // Section Locking Mutations
    acquireLock: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the document ID for this section
      const { data: section, error: sectionError } = await supabase
        .from('document_sections')
        .select('document_id')
        .eq('id', sectionId)
        .single();

      if (sectionError || !section) {
        return {
          success: false,
          lock: null,
          error: 'Section not found',
          lockedBy: null,
        };
      }

      const lockManager = new SectionLockManager();
      await lockManager.initialize(user.id);

      try {
        const result = await lockManager.acquireLock(sectionId, section.document_id);

        if (!result.success) {
          // Get info about who has the lock
          const status = await lockManager.getLockStatus(sectionId);
          let lockedByName = null;
          if (status.lockedBy) {
            const adminClient = createAdminClient();
            const { data: userData } = await adminClient.auth.admin.getUserById(status.lockedBy);
            lockedByName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';
          }

          return {
            success: false,
            lock: null,
            error: 'Section is already locked',
            lockedBy: lockedByName,
          };
        }

        // Get user name
        const adminClient = createAdminClient();
        const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
        const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown';

        return {
          success: true,
          lock: {
            id: result.lockId!,
            sectionId,
            documentId: section.document_id,
            userId: user.id,
            userName,
            acquiredAt: new Date().toISOString(),
            expiresAt: result.expiresAt!.toISOString(),
            lastHeartbeat: new Date().toISOString(),
          },
          error: null,
          lockedBy: null,
        };
      } finally {
        // Don't cleanup here as we want to keep the lock active
        // Cleanup will happen when releaseLock is called or on disconnect
      }
    },

    releaseLock: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const lockManager = new SectionLockManager();
      await lockManager.initialize(user.id);

      try {
        await lockManager.releaseLock(sectionId);
        return true;
      } catch (error) {
        console.error('Error releasing lock:', error);
        return false;
      } finally {
        await lockManager.cleanup();
      }
    },

    heartbeatLock: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the lock ID for this section and user
      const { data: lock, error: lockError } = await supabase
        .from('section_locks')
        .select('id')
        .eq('section_id', sectionId)
        .eq('user_id', user.id)
        .single();

      if (lockError || !lock) {
        return false;
      }

      const lockManager = new SectionLockManager();
      await lockManager.initialize(user.id);

      try {
        const success = await lockManager.heartbeat(lock.id);
        return success;
      } finally {
        await lockManager.cleanup();
      }
    },

    // Progress Tracking Mutations
    updateSectionStatus: async (
      _: any,
      { sectionId, status }: { sectionId: string; status: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Use SectionManagementService which includes notification integration
        // Requirements: 12.3, 12.4, 12.5
        const result = await SectionManagementService.updateSection(
          sectionId,
          { status: status.toLowerCase() as any }
        );

        if (!result.success || !result.section) {
          return {
            success: false,
            section: null,
            error: result.error || 'Failed to update section status',
          };
        }

        const section = result.section;

        // Get user info for assigned and locked by users
        const adminClient = createAdminClient();
        let assignedToUser = null;
        if (section.assignedTo) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.assignedTo);
          if (userData?.user) {
            assignedToUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          success: true,
          section: {
            id: section.id,
            documentId: section.documentId,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assignedTo,
            assignedToUser,
            deadline: section.deadline,
            content: section.content,
            lockedBy: null,
            lockedByUser: null,
            lockedAt: null,
            lockExpiresAt: null,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          section: null,
          error: error.message || 'Failed to update section status',
        };
      }
    },

    assignSection: async (
      _: any,
      { input }: { input: { sectionId: string; userId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Use SectionManagementService which includes notification integration
        // Requirements: 12.1, 12.2, 12.4, 12.5
        const result = await SectionManagementService.assignSection(
          input.sectionId,
          input.userId
        );

        if (!result.success || !result.section) {
          return {
            success: false,
            section: null,
            error: result.error || 'Failed to assign section',
          };
        }

        const section = result.section;

        // Get user info for assigned and locked by users
        const adminClient = createAdminClient();
        let assignedToUser = null;
        if (section.assignedTo) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.assignedTo);
          if (userData?.user) {
            assignedToUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          success: true,
          section: {
            id: section.id,
            documentId: section.documentId,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assignedTo,
            assignedToUser,
            deadline: section.deadline,
            content: section.content,
            lockedBy: null,
            lockedByUser: null,
            lockedAt: null,
            lockExpiresAt: null,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          section: null,
          error: error.message || 'Failed to assign section',
        };
      }
    },

    unassignSection: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        await progressTracker.unassignSection(sectionId);

        // Fetch the updated section
        const { data: section, error: sectionError } = await supabase
          .from('document_sections')
          .select('*')
          .eq('id', sectionId)
          .single();

        if (sectionError || !section) {
          return {
            success: false,
            section: null,
            error: 'Failed to fetch updated section',
          };
        }

        // Get user info for locked by user
        const adminClient = createAdminClient();
        let lockedByUser = null;
        if (section.locked_by) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.locked_by);
          if (userData?.user) {
            lockedByUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          success: true,
          section: {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assigned_to,
            assignedToUser: null,
            deadline: section.deadline,
            content: section.content,
            lockedBy: section.locked_by,
            lockedByUser,
            lockedAt: section.locked_at,
            lockExpiresAt: section.lock_expires_at,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          section: null,
          error: error.message || 'Failed to unassign section',
        };
      } finally {
        await progressTracker.cleanup();
      }
    },

    // Deadline Management Mutations
    setSectionDeadline: async (
      _: any,
      { sectionId, input }: { sectionId: string; input: { deadline: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        const deadline = new Date(input.deadline);
        await progressTracker.setDeadline(sectionId, deadline);

        // Fetch the updated section
        const { data: section, error: sectionError } = await supabase
          .from('document_sections')
          .select('*')
          .eq('id', sectionId)
          .single();

        if (sectionError || !section) {
          return {
            success: false,
            section: null,
            error: 'Failed to fetch updated section',
          };
        }

        // Get user info for assigned and locked by users
        const adminClient = createAdminClient();
        let assignedToUser = null;
        if (section.assigned_to) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.assigned_to);
          if (userData?.user) {
            assignedToUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        let lockedByUser = null;
        if (section.locked_by) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.locked_by);
          if (userData?.user) {
            lockedByUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          success: true,
          section: {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assigned_to,
            assignedToUser,
            deadline: section.deadline,
            content: section.content,
            lockedBy: section.locked_by,
            lockedByUser,
            lockedAt: section.locked_at,
            lockExpiresAt: section.lock_expires_at,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          section: null,
          error: error.message || 'Failed to set section deadline',
        };
      } finally {
        await progressTracker.cleanup();
      }
    },

    setDocumentDeadline: async (
      _: any,
      { documentId, input }: { documentId: string; input: { deadline: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        const deadline = new Date(input.deadline);
        await progressTracker.setDocumentDeadline(documentId, deadline);

        // Fetch the updated document
        const documentService = new DocumentService();
        const result = await documentService.getDocument(documentId, user.id);

        if (!result.success || !result.data) {
          return {
            success: false,
            document: null,
            error: result.error || 'Failed to fetch updated document',
          };
        }

        return {
          success: true,
          document: {
            id: result.data.id,
            workspaceId: result.data.workspaceId,
            title: result.data.title,
            description: result.data.description,
            content: result.data.content,
            createdBy: result.data.createdBy,
            lastEditedBy: result.data.lastEditedBy,
            createdAt: result.data.createdAt,
            updatedAt: result.data.updatedAt,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          document: null,
          error: error.message || 'Failed to set document deadline',
        };
      } finally {
        await progressTracker.cleanup();
      }
    },

    removeSectionDeadline: async (_: any, { sectionId }: { sectionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { error } = await supabase
          .from('document_sections')
          .update({ 
            deadline: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', sectionId);

        if (error) {
          return {
            success: false,
            section: null,
            error: 'Failed to remove section deadline',
          };
        }

        // Fetch the updated section
        const { data: section, error: sectionError } = await supabase
          .from('document_sections')
          .select('*')
          .eq('id', sectionId)
          .single();

        if (sectionError || !section) {
          return {
            success: false,
            section: null,
            error: 'Failed to fetch updated section',
          };
        }

        // Get user info for assigned and locked by users
        const adminClient = createAdminClient();
        let assignedToUser = null;
        if (section.assigned_to) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.assigned_to);
          if (userData?.user) {
            assignedToUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        let lockedByUser = null;
        if (section.locked_by) {
          const { data: userData } = await adminClient.auth.admin.getUserById(section.locked_by);
          if (userData?.user) {
            lockedByUser = {
              id: userData.user.id,
              email: userData.user.email,
              fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || null,
            };
          }
        }

        return {
          success: true,
          section: {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status.toUpperCase(),
            assignedTo: section.assigned_to,
            assignedToUser,
            deadline: section.deadline,
            content: section.content,
            lockedBy: section.locked_by,
            lockedByUser,
            lockedAt: section.locked_at,
            lockExpiresAt: section.lock_expires_at,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          section: null,
          error: error.message || 'Failed to remove section deadline',
        };
      }
    },

    removeDocumentDeadline: async (_: any, { documentId }: { documentId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { error } = await supabase
          .from('document_sections')
          .update({ 
            deadline: null,
            updated_at: new Date().toISOString()
          })
          .eq('document_id', documentId);

        if (error) {
          return {
            success: false,
            document: null,
            error: 'Failed to remove document deadline',
          };
        }

        // Fetch the updated document
        const documentService = new DocumentService();
        const result = await documentService.getDocument(documentId, user.id);

        if (!result.success || !result.data) {
          return {
            success: false,
            document: null,
            error: result.error || 'Failed to fetch updated document',
          };
        }

        return {
          success: true,
          document: {
            id: result.data.id,
            workspaceId: result.data.workspaceId,
            title: result.data.title,
            description: result.data.description,
            content: result.data.content,
            createdBy: result.data.createdBy,
            lastEditedBy: result.data.lastEditedBy,
            createdAt: result.data.createdAt,
            updatedAt: result.data.updatedAt,
          },
          error: null,
        };
      } catch (error: any) {
        return {
          success: false,
          document: null,
          error: error.message || 'Failed to remove document deadline',
        };
      }
    },

    // ============================================================================
    // PROJECT APPROVAL MUTATIONS
    // ============================================================================

    approveProject: async (
      _: any,
      { projectId, notes }: { projectId: string; notes?: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Call the approve_project function
      const { error } = await supabase.rpc('approve_project', {
        p_project_id: projectId,
        p_admin_id: user.id,
        p_notes: notes || null,
      });

      if (error) {
        throw new GraphQLError('Failed to approve project', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch the updated project
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (fetchError || !project) {
        throw new GraphQLError('Failed to fetch updated project', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'APPROVE_PROJECT',
        resourceType: 'project',
        resourceId: projectId,
        metadata: { notes },
      });

      // Send notification to project client
      try {
        const { NotificationService } = await import('../notification-service');
        
        await NotificationService.createNotification({
          userId: project.client_id,
          type: 'project_approved',
          title: '🎉 Project Approved',
          body: `Your project "${project.title}" has been approved and is now open for proposals.`,
          data: {
            projectId: project.id,
            projectTitle: project.title,
            approvedBy: user.id,
            notes: notes || null,
          },
          sendEmail: true,
          priority: NotificationService.NotificationPriority.HIGH,
        }).catch(error => {
          console.error('Failed to send project approval notification:', error);
        });
      } catch (error) {
        console.error('Error sending project approval notification:', error);
      }

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        budgetMin: project.budget_min,
        budgetMax: project.budget_max,
        deadline: project.deadline,
        status: project.status?.toUpperCase() || 'OPEN',
        additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
          id: req.id,
          fieldName: req.fieldName,
          fieldType: req.fieldType?.toUpperCase() || 'TEXT',
          required: req.required ?? false,
          helpText: req.helpText || null,
          options: req.options || [],
          order: req.order ?? 0,
        })),
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      };
    },

    rejectProject: async (
      _: any,
      { projectId, reason }: { projectId: string; reason: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!reason.trim()) {
        throw new GraphQLError('Rejection reason is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Call the reject_project function
      const { error } = await supabase.rpc('reject_project', {
        p_project_id: projectId,
        p_admin_id: user.id,
        p_reason: reason,
      });

      if (error) {
        throw new GraphQLError('Failed to reject project', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch the updated project
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (fetchError || !project) {
        throw new GraphQLError('Failed to fetch updated project', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'REJECT_PROJECT',
        resourceType: 'project',
        resourceId: projectId,
        metadata: { reason },
      });

      // Send notification to project client
      try {
        const { NotificationService } = await import('../notification-service');
        
        await NotificationService.createNotification({
          userId: project.client_id,
          type: 'project_rejected',
          title: 'Project Not Approved',
          body: `Your project "${project.title}" was not approved. Reason: ${reason}`,
          data: {
            projectId: project.id,
            projectTitle: project.title,
            rejectedBy: user.id,
            reason,
          },
          sendEmail: true,
          priority: NotificationService.NotificationPriority.HIGH,
        }).catch(error => {
          console.error('Failed to send project rejection notification:', error);
        });
      } catch (error) {
        console.error('Error sending project rejection notification:', error);
      }

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        budgetMin: project.budget_min,
        budgetMax: project.budget_max,
        deadline: project.deadline,
        status: project.status?.toUpperCase() || 'CLOSED',
        additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
          id: req.id,
          fieldName: req.fieldName,
          fieldType: req.fieldType?.toUpperCase() || 'TEXT',
          required: req.required ?? false,
          helpText: req.helpText || null,
          options: req.options || [],
          order: req.order ?? 0,
        })),
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      };
    },

    // ============================================================================
    // ADMIN PROPOSAL APPROVAL MUTATIONS
    // ============================================================================

    adminApproveProposal: async (
      _: any,
      { proposalId, notes }: { proposalId: string; notes?: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Call the admin_approve_proposal function
      const { error } = await supabase.rpc('admin_approve_proposal', {
        p_proposal_id: proposalId,
        p_admin_id: user.id,
        p_notes: notes || null,
      });

      if (error) {
        console.error('Failed to approve proposal:', error);
        throw new GraphQLError('Failed to approve proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
        });
      }

      // Fetch the updated proposal
      const { data: proposal, error: fetchError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (fetchError || !proposal) {
        throw new GraphQLError('Failed to fetch updated proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'APPROVE_PROPOSAL',
        resourceType: 'proposal',
        resourceId: proposalId,
        metadata: { notes },
      });

      return {
        id: proposal.id,
        projectId: proposal.project_id,
        leadId: proposal.lead_id,
        status: proposal.status?.toUpperCase() || 'APPROVED',
        content: proposal.content,
        submittedAt: proposal.submitted_at,
        createdAt: proposal.created_at,
        updatedAt: proposal.updated_at,
      };
    },

    adminRejectProposal: async (
      _: any,
      { proposalId, reason }: { proposalId: string; reason: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!reason.trim()) {
        throw new GraphQLError('Rejection reason is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Call the admin_reject_proposal function
      const { error } = await supabase.rpc('admin_reject_proposal', {
        p_proposal_id: proposalId,
        p_admin_id: user.id,
        p_reason: reason,
      });

      if (error) {
        console.error('Failed to reject proposal:', error);
        throw new GraphQLError('Failed to reject proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
        });
      }

      // Fetch the updated proposal
      const { data: proposal, error: fetchError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (fetchError || !proposal) {
        throw new GraphQLError('Failed to fetch updated proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'REJECT_PROPOSAL',
        resourceType: 'proposal',
        resourceId: proposalId,
        metadata: { reason },
      });

      return {
        id: proposal.id,
        projectId: proposal.project_id,
        leadId: proposal.lead_id,
        status: proposal.status?.toUpperCase() || 'REJECTED',
        content: proposal.content,
        submittedAt: proposal.submitted_at,
        createdAt: proposal.created_at,
        updatedAt: proposal.updated_at,
      };
    },

    requestProjectChanges: async (
      _: any,
      { projectId, changes }: { projectId: string; changes: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update project with requested changes
      const { data: project, error } = await supabase
        .from('projects')
        .update({
          approval_notes: changes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select()
        .single();

      if (error || !project) {
        throw new GraphQLError('Failed to request changes', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'REQUEST_PROJECT_CHANGES',
        resourceType: 'project',
        resourceId: projectId,
        metadata: { changes },
      });

      // Send notification to project client
      try {
        const { NotificationService } = await import('../notification-service');
        
        await NotificationService.createNotification({
          userId: project.client_id,
          type: 'project_status_changed',
          title: 'Changes Requested for Your Project',
          body: `An administrator has requested changes to your project "${project.title}".`,
          data: {
            projectId: project.id,
            projectTitle: project.title,
            requestedBy: user.id,
            changes,
          },
          sendEmail: true,
          priority: NotificationService.NotificationPriority.MEDIUM,
        }).catch(error => {
          console.error('Failed to send project changes request notification:', error);
        });
      } catch (error) {
        console.error('Error sending project changes request notification:', error);
      }

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        budgetMin: project.budget_min,
        budgetMax: project.budget_max,
        deadline: project.deadline,
        status: project.status?.toUpperCase() || 'PENDING_REVIEW',
        additionalInfoRequirements: (project.additional_info_requirements || []).map((req: any) => ({
          id: req.id,
          fieldName: req.fieldName,
          fieldType: req.fieldType?.toUpperCase() || 'TEXT',
          required: req.required ?? false,
          helpText: req.helpText || null,
          options: req.options || [],
          order: req.order ?? 0,
        })),
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      };
    },

    // ============================================================================
    // Q&A MUTATIONS
    // ============================================================================

    askQuestion: async (
      _: any,
      { projectId, question }: { projectId: string; question: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!question.trim()) {
        throw new GraphQLError('Question cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const { data: newQuestion, error } = await supabase
        .from('project_questions')
        .insert({
          project_id: projectId,
          asked_by: user.id,
          question: question.trim(),
        })
        .select(`
          *,
          askedBy:asked_by (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !newQuestion) {
        throw new GraphQLError('Failed to post question', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'ASK_QUESTION',
        resourceType: 'project',
        resourceId: projectId,
        metadata: { questionId: newQuestion.id },
      });

      // Send notification to project client about new question
      try {
        const { NotificationService } = await import('../notification-service');
        
        // Get project details to find client
        const { data: project } = await supabase
          .from('projects')
          .select('client_id, title')
          .eq('id', projectId)
          .single();

        if (project && project.client_id !== user.id) {
          const askerName = newQuestion.askedBy.raw_user_meta_data?.full_name || newQuestion.askedBy.email || 'A bidding team';
          
          await NotificationService.createNotification({
            userId: project.client_id,
            type: 'qa_question_posted',
            title: 'New Question on Your Project',
            body: `${askerName} asked a question about "${project.title}": "${question.substring(0, 100)}${question.length > 100 ? '...' : ''}"`,
            data: {
              projectId,
              projectTitle: project.title,
              questionId: newQuestion.id,
              askedBy: user.id,
            },
            sendEmail: true,
            priority: NotificationService.NotificationPriority.MEDIUM,
          }).catch(error => {
            console.error('Failed to send question notification:', error);
          });
        }
      } catch (error) {
        console.error('Error sending question notification:', error);
      }

      return {
        id: newQuestion.id,
        projectId: newQuestion.project_id,
        question: newQuestion.question,
        createdAt: newQuestion.created_at,
        updatedAt: newQuestion.updated_at,
        askedBy: {
          id: newQuestion.askedBy.id,
          email: newQuestion.askedBy.email,
          fullName: newQuestion.askedBy.raw_user_meta_data?.full_name,
          role: (newQuestion.askedBy.raw_user_meta_data?.role || 'bidding_lead').toUpperCase(),
        },
        answers: [],
      };
    },

    answerQuestion: async (
      _: any,
      { questionId, answer }: { questionId: string; answer: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!answer.trim()) {
        throw new GraphQLError('Answer cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const { data: newAnswer, error } = await supabase
        .from('question_answers')
        .insert({
          question_id: questionId,
          answered_by: user.id,
          answer: answer.trim(),
        })
        .select(`
          *,
          answeredBy:answered_by (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !newAnswer) {
        throw new GraphQLError('Failed to post answer', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'ANSWER_QUESTION',
        resourceType: 'question',
        resourceId: questionId,
        metadata: { answerId: newAnswer.id },
      });

      // Send notification to question asker and all bidding leads
      try {
        const { NotificationService } = await import('../notification-service');
        
        // Get question details with project info
        const { data: questionData } = await supabase
          .from('project_questions')
          .select('asked_by, question, project_id, projects(title, client_id)')
          .eq('id', questionId)
          .single();

        if (questionData) {
          const answererName = newAnswer.answeredBy.raw_user_meta_data?.full_name || newAnswer.answeredBy.email || 'Someone';
          const projectData = questionData.projects as any;
          
          // Notify the question asker if they're not the answerer
          if (questionData.asked_by !== user.id) {
            await NotificationService.createNotification({
              userId: questionData.asked_by,
              type: 'qa_answer_posted',
              title: 'Your Question Was Answered',
              body: `${answererName} answered your question: "${questionData.question.substring(0, 60)}${questionData.question.length > 60 ? '...' : ''}"`,
              data: {
                questionId,
                projectId: questionData.project_id,
                answerId: newAnswer.id,
                answeredBy: user.id,
              },
              sendEmail: true,
              priority: NotificationService.NotificationPriority.HIGH,
            }).catch(error => {
              console.error('Failed to send answer notification to asker:', error);
            });
          }

          // If client answered, notify all bidding leads with proposals
          if (user.user_metadata?.role === 'client') {
            const { data: proposals } = await supabase
              .from('proposals')
              .select('lead_id')
              .eq('project_id', questionData.project_id);

            if (proposals && proposals.length > 0) {
              for (const proposal of proposals) {
                if (proposal.lead_id !== user.id && proposal.lead_id !== questionData.asked_by) {
                  await NotificationService.createNotification({
                    userId: proposal.lead_id,
                    type: 'qa_answer_posted',
                    title: 'New Q&A Answer Posted',
                    body: `The client answered a question about "${projectData?.title || 'the project'}"`,
                    data: {
                      questionId,
                      projectId: questionData.project_id,
                      answerId: newAnswer.id,
                      answeredBy: user.id,
                    },
                    sendEmail: true,
                    priority: NotificationService.NotificationPriority.MEDIUM,
                  }).catch(error => {
                    console.error('Failed to send answer notification to lead:', error);
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending answer notifications:', error);
      }

      return {
        id: newAnswer.id,
        questionId: newAnswer.question_id,
        answer: newAnswer.answer,
        createdAt: newAnswer.created_at,
        answeredBy: {
          id: newAnswer.answeredBy.id,
          email: newAnswer.answeredBy.email,
          fullName: newAnswer.answeredBy.raw_user_meta_data?.full_name,
          role: (newAnswer.answeredBy.raw_user_meta_data?.role || 'client').toUpperCase(),
        },
      };
    },

    deleteQuestion: async (_: any, { questionId }: { questionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user owns the question
      const { data: question, error: fetchError } = await supabase
        .from('project_questions')
        .select('asked_by')
        .eq('id', questionId)
        .single();

      if (fetchError || !question) {
        throw new GraphQLError('Question not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (question.asked_by !== user.id && user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Not authorized to delete this question', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const { error } = await supabase
        .from('project_questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        throw new GraphQLError('Failed to delete question', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Log activity
      await logActivity({
        userId: user.id,
        action: 'DELETE_QUESTION',
        resourceType: 'question',
        resourceId: questionId,
      });

      return true;
    },

    // ============================================================================
    // SCORING TEMPLATE MUTATIONS
    // ============================================================================

    createScoringTemplate: async (
      _: any,
      { input }: { input: { projectId: string; name: string; description?: string; criteria: Array<{ name: string; description?: string; weight: number; orderIndex: number }> } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is the project client
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (project.client_id !== user.id) {
        throw new GraphQLError('Only the project client can create scoring templates', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate that weights sum to 100
      const totalWeight = input.criteria.reduce((sum, c) => sum + c.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new GraphQLError(`Criterion weights must sum to 100%. Current sum: ${totalWeight}%`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate weight range for each criterion
      for (const criterion of input.criteria) {
        if (criterion.weight < 0 || criterion.weight > 100) {
          throw new GraphQLError(`Criterion weight must be between 0 and 100. Invalid weight: ${criterion.weight}%`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Check if template already exists for this project
      const { data: existingTemplate } = await supabase
        .from('scoring_templates')
        .select('id')
        .eq('project_id', input.projectId)
        .eq('is_default', false)
        .single();

      if (existingTemplate) {
        throw new GraphQLError('A scoring template already exists for this project. Use updateScoringTemplate to modify it.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Create template
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .insert({
          project_id: input.projectId,
          name: input.name,
          description: input.description || null,
          is_default: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (templateError) {
        throw new GraphQLError('Failed to create scoring template', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Create criteria
      const criteriaToInsert = input.criteria.map(c => ({
        template_id: template.id,
        name: c.name,
        description: c.description || null,
        weight: c.weight,
        order_index: c.orderIndex,
      }));

      const { data: criteria, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .insert(criteriaToInsert)
        .select();

      if (criteriaError) {
        // Rollback template creation
        await supabase.from('scoring_templates').delete().eq('id', template.id);
        throw new GraphQLError('Failed to create scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return {
        id: template.id,
        projectId: template.project_id,
        name: template.name,
        description: template.description,
        isDefault: template.is_default,
        criteria: criteria.map(c => ({
          id: c.id,
          templateId: c.template_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          orderIndex: c.order_index,
          createdAt: c.created_at,
        })),
        createdBy: template.created_by,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      };
    },

    updateScoringTemplate: async (
      _: any,
      { templateId, input }: { templateId: string; input: { name?: string; description?: string; criteria?: Array<{ id?: string; name: string; description?: string; weight: number; orderIndex: number }> } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get template and verify ownership
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .select('*, projects!inner(client_id)')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        throw new GraphQLError('Scoring template not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (template.projects.client_id !== user.id) {
        throw new GraphQLError('Only the project client can update scoring templates', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if any proposals have been scored
      // First get all criterion IDs for this template
      const { data: criteriaIds, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .select('id')
        .eq('template_id', templateId);

      if (criteriaError) {
        throw new GraphQLError('Failed to check scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      if (criteriaIds && criteriaIds.length > 0) {
        const ids = criteriaIds.map(c => c.id);
        const { data: scoredProposals, error: scoreCheckError } = await supabase
          .from('proposal_scores')
          .select('id')
          .in('criterion_id', ids)
          .limit(1);

        if (scoreCheckError) {
          throw new GraphQLError('Failed to check scoring status', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        if (scoredProposals && scoredProposals.length > 0) {
          throw new GraphQLError('Cannot update template after proposals have been scored', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Validate weights if criteria are being updated
      if (input.criteria) {
        const totalWeight = input.criteria.reduce((sum, c) => sum + c.weight, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new GraphQLError(`Criterion weights must sum to 100%. Current sum: ${totalWeight}%`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        for (const criterion of input.criteria) {
          if (criterion.weight < 0 || criterion.weight > 100) {
            throw new GraphQLError(`Criterion weight must be between 0 and 100. Invalid weight: ${criterion.weight}%`, {
              extensions: { code: 'BAD_USER_INPUT' },
            });
          }
        }
      }

      // Update template
      const updateData: any = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;

      const { data: updatedTemplate, error: updateError } = await supabase
        .from('scoring_templates')
        .update(updateData)
        .eq('id', templateId)
        .select()
        .single();

      if (updateError) {
        throw new GraphQLError('Failed to update scoring template', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Update criteria if provided
      let criteria;
      if (input.criteria) {
        // Delete existing criteria
        await supabase.from('scoring_criteria').delete().eq('template_id', templateId);

        // Insert new criteria
        const criteriaToInsert = input.criteria.map(c => ({
          template_id: templateId,
          name: c.name,
          description: c.description || null,
          weight: c.weight,
          order_index: c.orderIndex,
        }));

        const { data: newCriteria, error: criteriaError } = await supabase
          .from('scoring_criteria')
          .insert(criteriaToInsert)
          .select();

        if (criteriaError) {
          throw new GraphQLError('Failed to update scoring criteria', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        criteria = newCriteria;
      } else {
        // Fetch existing criteria
        const { data: existingCriteria } = await supabase
          .from('scoring_criteria')
          .select('*')
          .eq('template_id', templateId)
          .order('order_index');

        criteria = existingCriteria || [];
      }

      return {
        id: updatedTemplate.id,
        projectId: updatedTemplate.project_id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        isDefault: updatedTemplate.is_default,
        criteria: criteria.map((c: any) => ({
          id: c.id,
          templateId: c.template_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          orderIndex: c.order_index,
          createdAt: c.created_at,
        })),
        createdBy: updatedTemplate.created_by,
        createdAt: updatedTemplate.created_at,
        updatedAt: updatedTemplate.updated_at,
      };
    },

    deleteScoringTemplate: async (
      _: any,
      { templateId }: { templateId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get template and verify ownership
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .select('*, projects!inner(client_id)')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        throw new GraphQLError('Scoring template not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (template.projects.client_id !== user.id) {
        throw new GraphQLError('Only the project client can delete scoring templates', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if any proposals have been scored
      // First get all criterion IDs for this template
      const { data: criteriaIds, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .select('id')
        .eq('template_id', templateId);

      if (criteriaError) {
        throw new GraphQLError('Failed to check scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      if (criteriaIds && criteriaIds.length > 0) {
        const ids = criteriaIds.map(c => c.id);
        const { data: scoredProposals, error: scoreCheckError } = await supabase
          .from('proposal_scores')
          .select('id')
          .in('criterion_id', ids)
          .limit(1);

        if (scoreCheckError) {
          throw new GraphQLError('Failed to check scoring status', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        if (scoredProposals && scoredProposals.length > 0) {
          throw new GraphQLError('Cannot delete template after proposals have been scored', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Delete template (criteria will be deleted via CASCADE)
      const { error: deleteError } = await supabase
        .from('scoring_templates')
        .delete()
        .eq('id', templateId);

      if (deleteError) {
        throw new GraphQLError('Failed to delete scoring template', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    // ============================================================================
    // PROPOSAL SCORING MUTATIONS
    // ============================================================================

    scoreProposal: async (
      _: any,
      { input }: { input: { proposalId: string; criterionId: string; rawScore: number; notes?: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate raw score range
      if (input.rawScore < 1 || input.rawScore > 10) {
        throw new GraphQLError('Raw score must be between 1 and 10', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*, projects!inner(client_id, title, id)')
        .eq('id', input.proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only client can score proposals
      if (proposal.projects.client_id !== user.id) {
        throw new GraphQLError('Only the project client can score proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if proposal is locked (accepted or rejected)
      if (proposal.status === 'approved' || proposal.status === 'rejected') {
        throw new GraphQLError('Cannot score proposals that have been accepted or rejected', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get criterion and calculate weighted score
      const { data: criterion, error: criterionError } = await supabase
        .from('scoring_criteria')
        .select('*')
        .eq('id', input.criterionId)
        .single();

      if (criterionError || !criterion) {
        throw new GraphQLError('Scoring criterion not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const weightedScore = input.rawScore * (criterion.weight / 100);

      // Check if score already exists (draft or final)
      const { data: existingScore } = await supabase
        .from('proposal_scores')
        .select('*')
        .eq('proposal_id', input.proposalId)
        .eq('criterion_id', input.criterionId)
        .single();

      let score;
      const isUpdate = !!existingScore;
      
      if (existingScore) {
        // Update existing score
        const { data: updatedScore, error: updateError } = await supabase
          .from('proposal_scores')
          .update({
            raw_score: input.rawScore,
            weighted_score: weightedScore,
            notes: input.notes || null,
            scored_at: new Date().toISOString(),
          })
          .eq('id', existingScore.id)
          .select()
          .single();

        if (updateError) {
          throw new GraphQLError('Failed to update score', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        score = updatedScore;
      } else {
        // Create new score
        const { data: newScore, error: insertError } = await supabase
          .from('proposal_scores')
          .insert({
            proposal_id: input.proposalId,
            criterion_id: input.criterionId,
            raw_score: input.rawScore,
            weighted_score: weightedScore,
            notes: input.notes || null,
            scored_by: user.id,
            is_final: false,
          })
          .select()
          .single();

        if (insertError) {
          throw new GraphQLError('Failed to create score', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        score = newScore;
      }

      // Calculate total score and rank for notification
      const { data: allScores } = await supabase
        .from('proposal_scores')
        .select('weighted_score')
        .eq('proposal_id', input.proposalId);

      const totalScore = allScores?.reduce((sum, s) => sum + (s.weighted_score || 0), 0) || 0;

      // Get all proposals for this project to calculate rank
      const { data: allProposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('project_id', proposal.projects.id);

      let rank = 1;
      if (allProposals && allProposals.length > 1) {
        const proposalScores = await Promise.all(
          allProposals.map(async (p) => {
            const { data: scores } = await supabase
              .from('proposal_scores')
              .select('weighted_score')
              .eq('proposal_id', p.id);
            const total = scores?.reduce((sum, s) => sum + (s.weighted_score || 0), 0) || 0;
            return { proposalId: p.id, total };
          })
        );
        proposalScores.sort((a, b) => b.total - a.total);
        rank = proposalScores.findIndex(p => p.proposalId === input.proposalId) + 1;
      }

      // Send notification to bidding leader (non-blocking)
      // Requirement 6.1: Notify bidding leader when proposal is scored
      // Requirement 6.3: Notify bidding leader when score is updated
      const { NotificationService } = await import('@/lib/notification-service');
      const projectData = proposal.projects as any;
      
      NotificationService.createNotification({
        userId: proposal.lead_id,
        type: isUpdate ? 'proposal_score_updated' : 'proposal_scored',
        title: isUpdate 
          ? `Proposal Score Updated: ${projectData.title}`
          : `Proposal Scored: ${projectData.title}`,
        body: isUpdate
          ? `Your proposal for "${projectData.title}" has been re-scored. Current total score: ${totalScore.toFixed(2)}, Rank: #${rank}`
          : `Your proposal for "${projectData.title}" has been scored. Total score: ${totalScore.toFixed(2)}, Rank: #${rank}`,
        data: {
          proposalId: input.proposalId,
          projectId: projectData.id,
          projectTitle: projectData.title,
          totalScore: totalScore.toFixed(2),
          rank,
          criterionName: criterion.name,
          rawScore: input.rawScore,
        },
        sendEmail: true,
        priority: NotificationService.NotificationPriority.MEDIUM,
      }).catch(error => {
        console.error('Failed to send scoring notification to lead:', error);
      });

      // Get user details
      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
      const userRole = userData?.user?.user_metadata?.role || 'bidding_member';
      const defaultStatus = userRole === 'client' ? 'pending_verification' : 'verified';

      return {
        id: score.id,
        proposalId: score.proposal_id,
        criterion: {
          id: criterion.id,
          templateId: criterion.template_id,
          name: criterion.name,
          description: criterion.description,
          weight: criterion.weight,
          orderIndex: criterion.order_index,
          createdAt: criterion.created_at,
        },
        rawScore: score.raw_score,
        weightedScore: score.weighted_score,
        notes: score.notes,
        scoredBy: {
          id: user.id,
          email: user.email || '',
          emailVerified: userData?.user?.user_metadata?.email_verified || false,
          role: userRole.toUpperCase(),
          verificationStatus: (userData?.user?.user_metadata?.verification_status || defaultStatus).toUpperCase(),
          verificationReason: userData?.user?.user_metadata?.verification_reason || null,
          fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
          isSuspended: userData?.user?.user_metadata?.is_suspended || false,
          suspendedReason: userData?.user?.user_metadata?.suspended_reason || null,
          suspendedAt: userData?.user?.user_metadata?.suspended_at || null,
          lastActivityAt: userData?.user?.user_metadata?.last_activity_at || userData?.user?.last_sign_in_at || null,
          createdAt: user.created_at || '',
          updatedAt: user.updated_at || '',
        },
        scoredAt: score.scored_at,
        isFinal: score.is_final,
      };
    },

    finalizeScoring: async (
      _: any,
      { input }: { input: { proposalId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*, projects!inner(client_id)')
        .eq('id', input.proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only client can finalize scoring
      if (proposal.projects.client_id !== user.id) {
        throw new GraphQLError('Only the project client can finalize scoring', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if proposal is locked
      if (proposal.status === 'approved' || proposal.status === 'rejected') {
        throw new GraphQLError('Cannot finalize scoring for proposals that have been accepted or rejected', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get scoring template for the project
      const { data: template, error: templateError } = await supabase
        .from('scoring_templates')
        .select('id')
        .eq('project_id', proposal.project_id)
        .eq('is_default', false)
        .single();

      if (templateError || !template) {
        throw new GraphQLError('No scoring template found for this project', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get all criteria for the template
      const { data: criteria, error: criteriaError } = await supabase
        .from('scoring_criteria')
        .select('id')
        .eq('template_id', template.id);

      if (criteriaError) {
        throw new GraphQLError('Failed to fetch scoring criteria', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Check if all criteria have been scored
      const { data: scores, error: scoresError } = await supabase
        .from('proposal_scores')
        .select('criterion_id')
        .eq('proposal_id', input.proposalId);

      if (scoresError) {
        throw new GraphQLError('Failed to fetch scores', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const scoredCriteriaIds = new Set((scores || []).map(s => s.criterion_id));
      const unscoredCriteria = (criteria || []).filter(c => !scoredCriteriaIds.has(c.id));

      if (unscoredCriteria.length > 0) {
        throw new GraphQLError(`Cannot finalize scoring: ${unscoredCriteria.length} criteria remain unscored`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Mark all scores as final
      const { error: finalizeError } = await supabase
        .from('proposal_scores')
        .update({ is_final: true })
        .eq('proposal_id', input.proposalId);

      if (finalizeError) {
        throw new GraphQLError('Failed to finalize scoring', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Recalculate rankings for the project
      const { error: rankingError } = await supabase.rpc('recalculate_project_rankings', {
        p_project_id: proposal.project_id,
      });

      if (rankingError) {
        console.error('Failed to recalculate rankings:', rankingError);
        // Don't throw error, just log it
      }

      // Send notification to lead that their proposal has been scored
      // Import at top of file: import { sendLeadScoredNotification, sendClientAllScoredNotification, areAllProposalsScored } from '@/lib/email/scoring-notifications';
      try {
        const { sendLeadScoredNotification, sendClientAllScoredNotification, areAllProposalsScored } = await import('@/lib/email/scoring-notifications');
        
        // Notify lead
        await sendLeadScoredNotification({
          proposalId: input.proposalId,
          projectId: proposal.project_id,
        });

        // Check if all proposals are now scored and notify client
        const allScored = await areAllProposalsScored(proposal.project_id);
        if (allScored) {
          await sendClientAllScoredNotification({
            projectId: proposal.project_id,
          });
        }
      } catch (notificationError) {
        // Log but don't fail the operation if notifications fail
        console.error('Failed to send scoring notifications:', notificationError);
      }

      return true;
    },

    reviseScore: async (
      _: any,
      { input }: { input: { proposalId: string; criterionId: string; newRawScore: number; newNotes?: string; reason: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate raw score range
      if (input.newRawScore < 1 || input.newRawScore > 10) {
        throw new GraphQLError('Raw score must be between 1 and 10', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*, projects!inner(client_id)')
        .eq('id', input.proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only client can revise scores
      if (proposal.projects.client_id !== user.id) {
        throw new GraphQLError('Only the project client can revise scores', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if proposal is locked (accepted or rejected)
      if (proposal.status === 'approved' || proposal.status === 'rejected') {
        throw new GraphQLError('Cannot revise scores for proposals that have been accepted or rejected', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Get existing score
      const { data: existingScore, error: scoreError } = await supabase
        .from('proposal_scores')
        .select('*')
        .eq('proposal_id', input.proposalId)
        .eq('criterion_id', input.criterionId)
        .single();

      if (scoreError || !existingScore) {
        throw new GraphQLError('Score not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get criterion for weight calculation
      const { data: criterion, error: criterionError } = await supabase
        .from('scoring_criteria')
        .select('*')
        .eq('id', input.criterionId)
        .single();

      if (criterionError || !criterion) {
        throw new GraphQLError('Scoring criterion not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const newWeightedScore = input.newRawScore * (criterion.weight / 100);

      // Create history entry
      const { error: historyError } = await supabase
        .from('proposal_score_history')
        .insert({
          proposal_id: input.proposalId,
          criterion_id: input.criterionId,
          previous_raw_score: existingScore.raw_score,
          new_raw_score: input.newRawScore,
          previous_notes: existingScore.notes,
          new_notes: input.newNotes || null,
          changed_by: user.id,
          reason: input.reason,
        });

      if (historyError) {
        throw new GraphQLError('Failed to create history entry', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Update score
      const { data: updatedScore, error: updateError } = await supabase
        .from('proposal_scores')
        .update({
          raw_score: input.newRawScore,
          weighted_score: newWeightedScore,
          notes: input.newNotes || null,
          scored_at: new Date().toISOString(),
        })
        .eq('id', existingScore.id)
        .select()
        .single();

      if (updateError) {
        throw new GraphQLError('Failed to update score', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Get previous ranking before recalculation
      const { data: previousRanking } = await supabase
        .from('proposal_rankings')
        .select('total_score, rank')
        .eq('proposal_id', input.proposalId)
        .single();

      const previousScore = previousRanking?.total_score || 0;
      const previousRank = previousRanking?.rank || 0;

      // Recalculate rankings for the project
      const { error: rankingError } = await supabase.rpc('recalculate_project_rankings', {
        p_project_id: proposal.project_id,
      });

      if (rankingError) {
        console.error('Failed to recalculate rankings:', rankingError);
        // Don't throw error, just log it
      }

      // Get new ranking after recalculation
      const { data: newRanking } = await supabase
        .from('proposal_rankings')
        .select('total_score, rank')
        .eq('proposal_id', input.proposalId)
        .single();

      const newScore = newRanking?.total_score || 0;
      const newRank = newRanking?.rank || 0;

      // Send notification to lead that their scores have been updated
      try {
        const { sendLeadScoreUpdatedNotification } = await import('@/lib/email/scoring-notifications');
        
        await sendLeadScoreUpdatedNotification({
          proposalId: input.proposalId,
          projectId: proposal.project_id,
          previousScore,
          newScore,
          previousRank,
          newRank,
        });
      } catch (notificationError) {
        // Log but don't fail the operation if notifications fail
        console.error('Failed to send score updated notification:', notificationError);
      }

      // Get user details
      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
      const userRole = userData?.user?.user_metadata?.role || 'bidding_member';
      const defaultStatus = userRole === 'client' ? 'pending_verification' : 'verified';

      return {
        id: updatedScore.id,
        proposalId: updatedScore.proposal_id,
        criterion: {
          id: criterion.id,
          templateId: criterion.template_id,
          name: criterion.name,
          description: criterion.description,
          weight: criterion.weight,
          orderIndex: criterion.order_index,
          createdAt: criterion.created_at,
        },
        rawScore: updatedScore.raw_score,
        weightedScore: updatedScore.weighted_score,
        notes: updatedScore.notes,
        scoredBy: {
          id: user.id,
          email: user.email || '',
          emailVerified: userData?.user?.user_metadata?.email_verified || false,
          role: userRole.toUpperCase(),
          verificationStatus: (userData?.user?.user_metadata?.verification_status || defaultStatus).toUpperCase(),
          verificationReason: userData?.user?.user_metadata?.verification_reason || null,
          fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || null,
          isSuspended: userData?.user?.user_metadata?.is_suspended || false,
          suspendedReason: userData?.user?.user_metadata?.suspended_reason || null,
          suspendedAt: userData?.user?.user_metadata?.suspended_at || null,
          lastActivityAt: userData?.user?.user_metadata?.last_activity_at || userData?.user?.last_sign_in_at || null,
          createdAt: user.created_at || '',
          updatedAt: user.updated_at || '',
        },
        scoredAt: updatedScore.scored_at,
        isFinal: updatedScore.is_final,
      };
    },

    recalculateRankings: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is the project client
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (project.client_id !== user.id) {
        throw new GraphQLError('Only the project client can recalculate rankings', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Call the database function to recalculate rankings
      const { error: rankingError } = await supabase.rpc('recalculate_project_rankings', {
        p_project_id: projectId,
      });

      if (rankingError) {
        console.error('Failed to recalculate rankings:', rankingError);
        throw new GraphQLError('Failed to recalculate rankings', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch and return the updated rankings
      const { data: rankings, error: fetchError } = await supabase
        .from('proposal_rankings')
        .select('*, proposals!inner(*)')
        .eq('project_id', projectId)
        .order('rank', { ascending: true });

      if (fetchError) {
        throw new GraphQLError('Failed to fetch updated rankings', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Build ranking summaries with proposal details
      const adminClient = createAdminClient();
      const rankingsWithDetails = await Promise.all(
        (rankings || []).map(async (ranking: any) => {
          const proposal = ranking.proposals;

          // Get lead info
          const { data: leadUser } = await adminClient.auth.admin.getUserById(proposal.lead_id);
          
          // Get team size from proposal_team_members
          const { count: teamSize } = await supabase
            .from('proposal_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id);

          // Get unread message count
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id)
            .eq('read', false)
            .neq('sender_id', user.id);

          // Get compliance score
          const { data: checklistItems } = await supabase
            .from('checklist_items')
            .select('passed')
            .eq('proposal_id', proposal.id);
          
          const totalItems = checklistItems?.length || 0;
          const passedItems = checklistItems?.filter(item => item.passed).length || 0;
          const complianceScore = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

          // Get additional info
          const { data: additionalInfo } = await supabase
            .from('proposal_additional_info')
            .select('*')
            .eq('proposal_id', proposal.id);

          return {
            id: ranking.id,
            projectId: ranking.project_id,
            proposal: {
              id: proposal.id,
              title: `Proposal for Project`,
              biddingTeamName: leadUser?.user?.user_metadata?.full_name || 'Team',
              biddingLead: {
                id: leadUser?.user?.id || '',
                name: leadUser?.user?.user_metadata?.full_name || leadUser?.user?.user_metadata?.name || 'Unknown',
                email: leadUser?.user?.email || '',
                avatarUrl: leadUser?.user?.user_metadata?.avatar_url || null,
                role: 'lead',
                assignedSections: [],
              },
              teamSize: teamSize || 1,
              budgetEstimate: null,
              timelineEstimate: null,
              executiveSummary: null,
              submissionDate: proposal.submitted_at || proposal.created_at,
              status: proposal.status.toUpperCase(),
              complianceScore,
              unreadMessages: unreadCount || 0,
              additionalInfo: (additionalInfo || []).map((info: any) => ({
                id: info.id,
                fieldId: info.field_id,
                fieldName: info.field_name,
                fieldValue: info.field_value,
              })),
            },
            totalScore: ranking.total_score,
            rank: ranking.rank,
            isFullyScored: ranking.is_fully_scored,
            calculatedAt: ranking.calculated_at,
          };
        })
      );

      return rankingsWithDetails;
    },

    exportScoring: async (_: any, { projectId }: { projectId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is the project client
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (project.client_id !== user.id) {
        throw new GraphQLError('Only the project client can export scoring data', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Generate the export using the ScoringExportService
      try {
        const { ScoringExportService } = await import('@/lib/scoring-export-service');
        const exportResult = await ScoringExportService.generateExport(projectId, user.id);
        
        return {
          url: exportResult.url,
          expiresAt: exportResult.expiresAt,
        };
      } catch (error: any) {
        console.error('Failed to generate scoring export:', error);
        throw new GraphQLError(error.message || 'Failed to generate scoring export', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // Proposal Archival Mutations
    // ============================================================================

    archiveProposal: async (
      _: any,
      { proposalId, reason }: { proposalId: string; reason?: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.archiveProposal({
          proposalId,
          userId: user.id,
          reason,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to archive proposal:', error);
        throw new GraphQLError(error.message || 'Failed to archive proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    unarchiveProposal: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.unarchiveProposal({
          proposalId,
          userId: user.id,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to unarchive proposal:', error);
        throw new GraphQLError(error.message || 'Failed to unarchive proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    bulkArchiveProposals: async (
      _: any,
      { proposalIds }: { proposalIds: string[] }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { ProposalArchivalService } = await import('@/lib/proposal-archival-service');
        const result = await ProposalArchivalService.bulkArchive(proposalIds, user.id);
        
        return {
          success: result.success,
          error: result.error,
        };
      } catch (error: any) {
        console.error('Failed to bulk archive proposals:', error);
        throw new GraphQLError(error.message || 'Failed to bulk archive proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // Multi-Proposal Management Mutations
    // ============================================================================

    saveWorkspaceState: async (
      _: any,
      { proposalId, state }: { proposalId: string; state: any }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { MultiProposalService } = await import('@/lib/multi-proposal-service');
        const result = await MultiProposalService.saveWorkspaceState({
          proposalId,
          userId: user.id,
          state,
        });
        
        return result;
      } catch (error: any) {
        console.error('Failed to save workspace state:', error);
        throw new GraphQLError(error.message || 'Failed to save workspace state', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    clearWorkspaceState: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { MultiProposalService } = await import('@/lib/multi-proposal-service');
        const result = await MultiProposalService.clearWorkspaceState(proposalId, user.id);
        
        return result;
      } catch (error: any) {
        console.error('Failed to clear workspace state:', error);
        throw new GraphQLError(error.message || 'Failed to clear workspace state', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // ============================================================================
    // SUBMISSION DRAFT MUTATIONS
    // ============================================================================

    saveSubmissionDraft: async (
      _: any,
      { input }: { input: { proposalId: string; currentStep: number; draftData: Record<string, any> } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Verify user has access to this proposal
        const { data: proposal, error: proposalError } = await supabase
          .from('proposals')
          .select('id, lead_id')
          .eq('id', input.proposalId)
          .single();

        if (proposalError || !proposal) {
          throw new GraphQLError('Proposal not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        if (proposal.lead_id !== user.id) {
          throw new GraphQLError('Forbidden: You can only save drafts for your own proposals', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        // Upsert draft (insert or update)
        const { data: draft, error: draftError } = await supabase
          .from('submission_drafts')
          .upsert({
            proposal_id: input.proposalId,
            user_id: user.id,
            current_step: input.currentStep,
            draft_data: input.draftData,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'proposal_id,user_id',
          })
          .select('id')
          .single();

        if (draftError) {
          console.error('Error saving draft:', draftError);
          throw new GraphQLError('Failed to save draft', {
            extensions: { code: 'DATABASE_ERROR', details: draftError },
          });
        }

        return {
          success: true,
          draftId: draft.id,
        };
      } catch (error: any) {
        console.error('Failed to save submission draft:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        return {
          success: false,
          error: error.message || 'Failed to save draft',
        };
      }
    },

    deleteSubmissionDraft: async (
      _: any,
      { proposalId }: { proposalId: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { error: deleteError } = await supabase
          .from('submission_drafts')
          .delete()
          .eq('proposal_id', proposalId)
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting draft:', deleteError);
          throw new GraphQLError('Failed to delete draft', {
            extensions: { code: 'DATABASE_ERROR', details: deleteError },
          });
        }

        return {
          success: true,
        };
      } catch (error: any) {
        console.error('Failed to delete submission draft:', error);
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        return {
          success: false,
          error: error.message || 'Failed to delete draft',
        };
      }
    },

    // ============================================================================
    // BIDDING LEADER MANAGEMENT MUTATIONS
    // ============================================================================

    generateInvitation: async (
      _: any,
      { input }: { input: { projectId: string; proposalId?: string; expirationDays?: number; isMultiUse?: boolean } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { TeamInvitationService } = await import('@/lib/team-invitation-service');
        const service = new TeamInvitationService();
        
        // If proposalId is not provided, try to get it from projectId
        let proposalId = input.proposalId;
        if (!proposalId && input.projectId) {
          // Get the user's proposal for this project
          const { data: proposal } = await supabase
            .from('proposals')
            .select('id')
            .eq('project_id', input.projectId)
            .eq('lead_id', user.id)
            .single();
          
          if (proposal) {
            proposalId = proposal.id;
          }
        }
        
        if (!proposalId) {
          throw new GraphQLError('Proposal ID is required', {
            extensions: { code: 'BAD_REQUEST' },
          });
        }
        
        const result = await service.generateInvitation({
          proposalId,
          projectId: input.projectId,
          createdBy: user.id,
          expirationDays: input.expirationDays,
          isMultiUse: input.isMultiUse,
        });

        if (!result.success || !result.data) {
          throw new GraphQLError(result.error || 'Failed to generate invitation', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return result.data;
      } catch (error: any) {
        console.error('Failed to generate invitation:', error);
        throw new GraphQLError(error.message || 'Failed to generate invitation', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    joinTeam: async (
      _: any,
      { input }: { input: { invitationId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { TeamManagementService } = await import('@/lib/team-management-service');
        const service = new TeamManagementService();
        
        const result = await service.joinTeam({
          invitationId: input.invitationId,
          userId: user.id,
        });

        if (!result.success || !result.data) {
          throw new GraphQLError(result.error || 'Failed to join team', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        // Get user details
        const adminClient = createAdminClient();
        const { data: userData } = await adminClient.auth.admin.getUserById(result.data.userId);

        return {
          id: result.data.id,
          projectId: result.data.projectId,
          userId: result.data.userId,
          user: userData?.user ? {
            id: userData.user.id,
            email: userData.user.email,
            fullName: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
          } : null,
          role: result.data.role.toUpperCase(),
          joinedAt: result.data.joinedAt,
          assignedSections: [],
          contributionStats: null,
        };
      } catch (error: any) {
        console.error('Failed to join team:', error);
        throw new GraphQLError(error.message || 'Failed to join team', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    removeTeamMember: async (
      _: any,
      { input }: { input: { proposalId: string; userId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        const { TeamManagementService } = await import('@/lib/team-management-service');
        const service = new TeamManagementService();
        
        const result = await service.removeTeamMember({
          proposalId: input.proposalId,
          userId: input.userId,
          removedBy: user.id,
        });

        if (!result.success) {
          throw new GraphQLError(result.error || 'Failed to remove team member', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return true;
      } catch (error: any) {
        console.error('Failed to remove team member:', error);
        throw new GraphQLError(error.message || 'Failed to remove team member', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    // Project Delivery and Archival Mutations
    uploadDeliverable: async (
      _: any,
      { input }: { input: {
        projectId: string;
        proposalId: string;
        fileName: string;
        filePath: string;
        fileType: string;
        fileSize: number;
        description?: string;
      } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Note: In a real implementation, the file would be uploaded via a separate endpoint
      // This mutation just creates the database record after the file is uploaded
      const { DeliverableService } = await import('@/lib/deliverable-service');
      
      // For GraphQL, we assume the file is already uploaded to the filePath
      // In practice, you'd use a multipart upload or separate file upload endpoint
      const result = await DeliverableService.uploadDeliverable(
        {
          projectId: input.projectId,
          proposalId: input.proposalId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          description: input.description,
          file: Buffer.from(''), // Placeholder - file already uploaded
        },
        user.id
      );

      if (!result.success || !result.deliverable) {
        throw new GraphQLError(result.error || 'Failed to upload deliverable', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(result.deliverable.uploadedBy);
      const downloadUrlResult = await DeliverableService.generateDownloadUrl(result.deliverable.id);

      return {
        id: result.deliverable.id,
        projectId: result.deliverable.projectId,
        proposalId: result.deliverable.proposalId,
        uploadedBy: {
          id: result.deliverable.uploadedBy,
          email: userData?.user?.email || '',
          fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
        },
        fileName: result.deliverable.fileName,
        filePath: result.deliverable.filePath,
        fileType: result.deliverable.fileType,
        fileSize: result.deliverable.fileSize,
        description: result.deliverable.description,
        version: result.deliverable.version,
        isFinal: result.deliverable.isFinal,
        uploadedAt: result.deliverable.uploadedAt.toISOString(),
        downloadUrl: downloadUrlResult.url || '',
      };
    },

    deleteDeliverable: async (_: any, { deliverableId }: { deliverableId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { DeliverableService } = await import('@/lib/deliverable-service');
      const result = await DeliverableService.deleteDeliverable(deliverableId, user.id);

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to delete deliverable', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    markReadyForDelivery: async (
      _: any,
      { input }: { input: { projectId: string; proposalId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { CompletionService } = await import('@/lib/completion-service');
      const result = await CompletionService.markReadyForDelivery(input, user.id);

      if (!result.success || !result.completion) {
        throw new GraphQLError(result.error || 'Failed to mark ready for delivery', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: submittedByData } = await adminClient.auth.admin.getUserById(result.completion.submittedBy);

      // Get deliverables
      const { DeliverableService } = await import('@/lib/deliverable-service');
      const deliverablesResult = await DeliverableService.getDeliverables(input.projectId);
      const deliverables = deliverablesResult.deliverables || [];

      const deliverablesWithDetails = await Promise.all(
        deliverables.map(async (deliverable) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(deliverable.uploadedBy);
          const downloadUrlResult = await DeliverableService.generateDownloadUrl(deliverable.id);

          return {
            id: deliverable.id,
            projectId: deliverable.projectId,
            proposalId: deliverable.proposalId,
            uploadedBy: {
              id: deliverable.uploadedBy,
              email: userData?.user?.email || '',
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
            },
            fileName: deliverable.fileName,
            filePath: deliverable.filePath,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
            description: deliverable.description,
            version: deliverable.version,
            isFinal: deliverable.isFinal,
            uploadedAt: deliverable.uploadedAt.toISOString(),
            downloadUrl: downloadUrlResult.url || '',
          };
        })
      );

      return {
        id: result.completion.id,
        projectId: result.completion.projectId,
        proposalId: result.completion.proposalId,
        submittedBy: {
          id: result.completion.submittedBy,
          email: submittedByData?.user?.email || '',
          fullName: submittedByData?.user?.user_metadata?.full_name || submittedByData?.user?.user_metadata?.name || 'Unknown',
        },
        submittedAt: result.completion.submittedAt.toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewStatus: result.completion.reviewStatus.toUpperCase(),
        reviewComments: result.completion.reviewComments,
        revisionCount: result.completion.revisionCount,
        completedAt: result.completion.completedAt?.toISOString(),
        deliverables: deliverablesWithDetails,
        revisions: [],
      };
    },

    reviewCompletion: async (
      _: any,
      { input }: { input: {
        completionId: string;
        reviewStatus: string;
        reviewComments?: string;
      } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { CompletionService } = await import('@/lib/completion-service');
      const result = await CompletionService.reviewCompletion(
        {
          completionId: input.completionId,
          reviewStatus: input.reviewStatus.toLowerCase() as any,
          reviewComments: input.reviewComments,
        },
        user.id
      );

      if (!result.success || !result.completion) {
        throw new GraphQLError(result.error || 'Failed to review completion', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: submittedByData } = await adminClient.auth.admin.getUserById(result.completion.submittedBy);
      const reviewedByResponse = result.completion.reviewedBy
        ? await adminClient.auth.admin.getUserById(result.completion.reviewedBy)
        : null;
      const reviewedByData = reviewedByResponse?.data;

      // Get deliverables
      const { DeliverableService } = await import('@/lib/deliverable-service');
      const deliverablesResult = await DeliverableService.getDeliverables(result.completion.projectId);
      const deliverables = deliverablesResult.deliverables || [];

      const deliverablesWithDetails = await Promise.all(
        deliverables.map(async (deliverable) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(deliverable.uploadedBy);
          const downloadUrlResult = await DeliverableService.generateDownloadUrl(deliverable.id);

          return {
            id: deliverable.id,
            projectId: deliverable.projectId,
            proposalId: deliverable.proposalId,
            uploadedBy: {
              id: deliverable.uploadedBy,
              email: userData?.user?.email || '',
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
            },
            fileName: deliverable.fileName,
            filePath: deliverable.filePath,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
            description: deliverable.description,
            version: deliverable.version,
            isFinal: deliverable.isFinal,
            uploadedAt: deliverable.uploadedAt.toISOString(),
            downloadUrl: downloadUrlResult.url || '',
          };
        })
      );

      // Get revisions
      const revisions = await CompletionService.getRevisions(result.completion.id);
      const revisionsWithDetails = await Promise.all(
        revisions.map(async (revision) => {
          const { data: requestedByData } = await adminClient.auth.admin.getUserById(revision.requestedBy);
          const resolvedByData = revision.resolvedBy 
            ? await adminClient.auth.admin.getUserById(revision.resolvedBy)
            : null;

          return {
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            requestedBy: {
              id: revision.requestedBy,
              email: requestedByData?.user?.email || '',
              fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
            },
            requestedAt: revision.requestedAt.toISOString(),
            revisionNotes: revision.revisionNotes,
            resolvedBy: revision.resolvedBy ? {
              id: revision.resolvedBy,
              email: resolvedByData?.data?.user?.email || '',
              fullName: resolvedByData?.data?.user?.user_metadata?.full_name || resolvedByData?.data?.user?.user_metadata?.name || 'Unknown',
            } : null,
            resolvedAt: revision.resolvedAt?.toISOString(),
          };
        })
      );

      return {
        id: result.completion.id,
        projectId: result.completion.projectId,
        proposalId: result.completion.proposalId,
        submittedBy: {
          id: result.completion.submittedBy,
          email: submittedByData?.user?.email || '',
          fullName: submittedByData?.user?.user_metadata?.full_name || submittedByData?.user?.user_metadata?.name || 'Unknown',
        },
        submittedAt: result.completion.submittedAt.toISOString(),
        reviewedBy: result.completion.reviewedBy ? {
          id: result.completion.reviewedBy,
          email: reviewedByData?.user?.email || '',
          fullName: reviewedByData?.user?.user_metadata?.full_name || reviewedByData?.user?.user_metadata?.name || 'Unknown',
        } : null,
        reviewedAt: result.completion.reviewedAt?.toISOString(),
        reviewStatus: result.completion.reviewStatus.toUpperCase(),
        reviewComments: result.completion.reviewComments,
        revisionCount: result.completion.revisionCount,
        completedAt: result.completion.completedAt?.toISOString(),
        deliverables: deliverablesWithDetails,
        revisions: revisionsWithDetails,
      };
    },

    acceptCompletion: async (_: any, { completionId }: { completionId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { CompletionService } = await import('@/lib/completion-service');
      const result = await CompletionService.acceptCompletion(completionId, user.id);

      if (!result.success || !result.completion) {
        throw new GraphQLError(result.error || 'Failed to accept completion', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: submittedByData } = await adminClient.auth.admin.getUserById(result.completion.submittedBy);
      const reviewedByResponse = result.completion.reviewedBy
        ? await adminClient.auth.admin.getUserById(result.completion.reviewedBy)
        : null;
      const reviewedByData = reviewedByResponse?.data;

      // Get deliverables
      const { DeliverableService } = await import('@/lib/deliverable-service');
      const deliverablesResult = await DeliverableService.getDeliverables(result.completion.projectId);
      const deliverables = deliverablesResult.deliverables || [];

      const deliverablesWithDetails = await Promise.all(
        deliverables.map(async (deliverable) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(deliverable.uploadedBy);
          const downloadUrlResult = await DeliverableService.generateDownloadUrl(deliverable.id);

          return {
            id: deliverable.id,
            projectId: deliverable.projectId,
            proposalId: deliverable.proposalId,
            uploadedBy: {
              id: deliverable.uploadedBy,
              email: userData?.user?.email || '',
              fullName: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
            },
            fileName: deliverable.fileName,
            filePath: deliverable.filePath,
            fileType: deliverable.fileType,
            fileSize: deliverable.fileSize,
            description: deliverable.description,
            version: deliverable.version,
            isFinal: deliverable.isFinal,
            uploadedAt: deliverable.uploadedAt.toISOString(),
            downloadUrl: downloadUrlResult.url || '',
          };
        })
      );

      // Get revisions
      const revisions = await CompletionService.getRevisions(result.completion.id);
      const revisionsWithDetails = await Promise.all(
        revisions.map(async (revision) => {
          const { data: requestedByData } = await adminClient.auth.admin.getUserById(revision.requestedBy);
          const resolvedByData = revision.resolvedBy 
            ? await adminClient.auth.admin.getUserById(revision.resolvedBy)
            : null;

          return {
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            requestedBy: {
              id: revision.requestedBy,
              email: requestedByData?.user?.email || '',
              fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
            },
            requestedAt: revision.requestedAt.toISOString(),
            revisionNotes: revision.revisionNotes,
            resolvedBy: revision.resolvedBy ? {
              id: revision.resolvedBy,
              email: resolvedByData?.data?.user?.email || '',
              fullName: resolvedByData?.data?.user?.user_metadata?.full_name || resolvedByData?.data?.user?.user_metadata?.name || 'Unknown',
            } : null,
            resolvedAt: revision.resolvedAt?.toISOString(),
          };
        })
      );

      return {
        id: result.completion.id,
        projectId: result.completion.projectId,
        proposalId: result.completion.proposalId,
        submittedBy: {
          id: result.completion.submittedBy,
          email: submittedByData?.user?.email || '',
          fullName: submittedByData?.user?.user_metadata?.full_name || submittedByData?.user?.user_metadata?.name || 'Unknown',
        },
        submittedAt: result.completion.submittedAt.toISOString(),
        reviewedBy: result.completion.reviewedBy ? {
          id: result.completion.reviewedBy,
          email: reviewedByData?.user?.email || '',
          fullName: reviewedByData?.user?.user_metadata?.full_name || reviewedByData?.user?.user_metadata?.name || 'Unknown',
        } : null,
        reviewedAt: result.completion.reviewedAt?.toISOString(),
        reviewStatus: result.completion.reviewStatus.toUpperCase(),
        reviewComments: result.completion.reviewComments,
        revisionCount: result.completion.revisionCount,
        completedAt: result.completion.completedAt?.toISOString(),
        deliverables: deliverablesWithDetails,
        revisions: revisionsWithDetails,
      };
    },

    requestRevision: async (
      _: any,
      { input }: { input: { completionId: string; revisionNotes: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { CompletionService } = await import('@/lib/completion-service');
      const result = await CompletionService.requestRevision(input, user.id);

      if (!result.success || !result.revision) {
        throw new GraphQLError(result.error || 'Failed to request revision', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: requestedByData } = await adminClient.auth.admin.getUserById(result.revision.requestedBy);
      const resolvedByData = result.revision.resolvedBy 
        ? await adminClient.auth.admin.getUserById(result.revision.resolvedBy)
        : null;

      return {
        id: result.revision.id,
        revisionNumber: result.revision.revisionNumber,
        requestedBy: {
          id: result.revision.requestedBy,
          email: requestedByData?.user?.email || '',
          fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
        },
        requestedAt: result.revision.requestedAt.toISOString(),
        revisionNotes: result.revision.revisionNotes,
        resolvedBy: result.revision.resolvedBy ? {
          id: result.revision.resolvedBy,
          email: resolvedByData?.data?.user?.email || '',
          fullName: resolvedByData?.data?.user?.user_metadata?.full_name || resolvedByData?.data?.user?.user_metadata?.name || 'Unknown',
        } : null,
        resolvedAt: result.revision.resolvedAt?.toISOString(),
      };
    },

    requestExport: async (
      _: any,
      { input }: { input: { projectId: string } }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { ExportService } = await import('@/lib/export-service');
      const result = await ExportService.requestExport({ projectId: input.projectId, userId: user.id });

      if (!result.success || !result.export) {
        throw new GraphQLError(result.error || 'Failed to request export', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: requestedByData } = await adminClient.auth.admin.getUserById(result.export.requestedBy);

      return {
        id: result.export.id,
        projectId: result.export.projectId,
        requestedBy: {
          id: result.export.requestedBy,
          email: requestedByData?.user?.email || '',
          fullName: requestedByData?.user?.user_metadata?.full_name || requestedByData?.user?.user_metadata?.name || 'Unknown',
        },
        requestedAt: result.export.requestedAt.toISOString(),
        status: result.export.status.toUpperCase(),
        exportPath: result.export.exportPath,
        exportSize: result.export.exportSize,
        expiresAt: result.export.expiresAt?.toISOString(),
        downloadUrl: null,
        errorMessage: result.export.errorMessage,
      };
    },

    applyLegalHold: async (
      _: any,
      { archiveId, reason }: { archiveId: string; reason: string }
    ) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only admins can apply legal hold
      if (user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Only administrators can apply legal hold', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const result = await RetentionService.applyLegalHold(archiveId, reason, user.id);

      if (!result.success || !result.archive) {
        throw new GraphQLError(result.error || 'Failed to apply legal hold', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch full archive data
      const { data: fullArchive, error: archiveError } = await supabase
        .from('project_archives')
        .select('*')
        .eq('id', result.archive.id)
        .single();

      if (archiveError || !fullArchive) {
        throw new GraphQLError('Failed to fetch archive details', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(fullArchive.archived_by);

      // Parse archive data
      const archiveData = typeof fullArchive.archive_data === 'string' 
        ? JSON.parse(fullArchive.archive_data) 
        : fullArchive.archive_data;

      return {
        id: fullArchive.id,
        projectId: fullArchive.project_id,
        archiveIdentifier: fullArchive.archive_identifier,
        compressedSize: fullArchive.compressed_size || 0,
        originalSize: fullArchive.original_size || 0,
        compressionRatio: fullArchive.compression_ratio || 0,
        archivedBy: {
          id: fullArchive.archived_by,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: fullArchive.archived_at,
        retentionUntil: fullArchive.retention_until,
        legalHold: fullArchive.legal_hold,
        legalHoldReason: fullArchive.legal_hold_reason,
        accessCount: fullArchive.access_count || 0,
        lastAccessedAt: fullArchive.last_accessed_at,
        project: {
          id: archiveData.project.id,
          title: archiveData.project.title,
          description: archiveData.project.description,
          budget: archiveData.project.budget,
          deadline: archiveData.project.deadline,
          clientId: archiveData.project.clientId,
          status: archiveData.project.status,
          proposals: archiveData.proposals || [],
          deliverables: archiveData.deliverables || [],
          documents: archiveData.documents || [],
          comments: archiveData.comments || [],
        },
      };
    },

    removeLegalHold: async (_: any, { archiveId }: { archiveId: string }) => {
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only admins can remove legal hold
      if (user.user_metadata?.role !== 'admin') {
        throw new GraphQLError('Only administrators can remove legal hold', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const result = await RetentionService.removeLegalHold(archiveId, user.id);

      if (!result.success || !result.archive) {
        throw new GraphQLError(result.error || 'Failed to remove legal hold', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Fetch full archive data
      const { data: fullArchive, error: archiveError } = await supabase
        .from('project_archives')
        .select('*')
        .eq('id', result.archive.id)
        .single();

      if (archiveError || !fullArchive) {
        throw new GraphQLError('Failed to fetch archive details', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(fullArchive.archived_by);

      // Parse archive data
      const archiveData = typeof fullArchive.archive_data === 'string' 
        ? JSON.parse(fullArchive.archive_data) 
        : fullArchive.archive_data;

      return {
        id: fullArchive.id,
        projectId: fullArchive.project_id,
        archiveIdentifier: fullArchive.archive_identifier,
        compressedSize: fullArchive.compressed_size || 0,
        originalSize: fullArchive.original_size || 0,
        compressionRatio: fullArchive.compression_ratio || 0,
        archivedBy: {
          id: fullArchive.archived_by,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: fullArchive.archived_at,
        retentionUntil: fullArchive.retention_until,
        legalHold: fullArchive.legal_hold,
        legalHoldReason: fullArchive.legal_hold_reason,
        accessCount: fullArchive.access_count || 0,
        lastAccessedAt: fullArchive.last_accessed_at,
        project: {
          id: archiveData.project.id,
          title: archiveData.project.title,
          description: archiveData.project.description,
          budget: archiveData.project.budget,
          deadline: archiveData.project.deadline,
          clientId: archiveData.project.clientId,
          status: archiveData.project.status,
          proposals: archiveData.proposals || [],
          deliverables: archiveData.deliverables || [],
          documents: archiveData.documents || [],
          comments: archiveData.comments || [],
        },
      };
    },

    // Notification mutations
    markNotificationAsRead: async (_: any, { notificationId }: { notificationId: string }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          read: true, 
          read_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        throw new GraphQLError(`Failed to mark notification as read: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    markAllNotificationsAsRead: async () => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          read: true, 
          read_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        throw new GraphQLError(`Failed to mark all notifications as read: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    deleteNotification: async (_: any, { notificationId }: { notificationId: string }) => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { error } = await supabase
        .from('notification_queue')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) {
        throw new GraphQLError(`Failed to delete notification: ${error.message}`, {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
    },

    // ============================================================================
    // Section Comment Mutations
    // ============================================================================

    createSectionComment: async (
      _: any,
      { input }: { input: { sectionId: string; documentId: string; content: string; parentId?: string } }
    ) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Verify user has access to the document
        const { data: collaborator } = await supabase
          .from('document_collaborators')
          .select('id')
          .eq('document_id', input.documentId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!collaborator) {
          throw new GraphQLError('You do not have access to this document', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        // Create the comment
        const { data: comment, error: createError } = await supabase
          .from('section_comments')
          .insert({
            section_id: input.sectionId,
            document_id: input.documentId,
            user_id: user.id,
            content: input.content,
            parent_id: input.parentId || null,
          })
          .select(`
            *,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .single();

        if (createError || !comment) {
          console.error('Error creating comment:', createError);
          throw new GraphQLError('Failed to create comment', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        // Send notifications asynchronously
        sendCommentNotifications(comment, user.id, supabase).catch((error) => {
          console.error('Error sending comment notifications:', error);
        });

        return {
          success: true,
          comment: mapSectionComment(comment),
        };
      } catch (error: any) {
        console.error('Error in createSectionComment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to create comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    updateSectionComment: async (
      _: any,
      { commentId, content }: { commentId: string; content: string }
    ) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Verify user owns the comment
        const { data: existingComment } = await supabase
          .from('section_comments')
          .select('user_id')
          .eq('id', commentId)
          .single();

        if (!existingComment || existingComment.user_id !== user.id) {
          throw new GraphQLError('You can only edit your own comments', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        // Update the comment
        const { data: comment, error: updateError } = await supabase
          .from('section_comments')
          .update({ content })
          .eq('id', commentId)
          .select(`
            *,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .single();

        if (updateError || !comment) {
          console.error('Error updating comment:', updateError);
          throw new GraphQLError('Failed to update comment', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return {
          success: true,
          comment: mapSectionComment(comment),
        };
      } catch (error: any) {
        console.error('Error in updateSectionComment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to update comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    deleteSectionComment: async (_: any, { commentId }: { commentId: string }) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Verify user owns the comment or is document owner
        const { data: comment } = await supabase
          .from('section_comments')
          .select('user_id, document_id')
          .eq('id', commentId)
          .single();

        if (!comment) {
          throw new GraphQLError('Comment not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        // Check if user is comment author or document owner
        const isAuthor = comment.user_id === user.id;
        const { data: collaborator } = await supabase
          .from('document_collaborators')
          .select('role')
          .eq('document_id', comment.document_id)
          .eq('user_id', user.id)
          .maybeSingle();

        const isOwner = collaborator?.role === 'owner';

        if (!isAuthor && !isOwner) {
          throw new GraphQLError('You can only delete your own comments or you must be the document owner', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        // Delete the comment
        const { error: deleteError } = await supabase
          .from('section_comments')
          .delete()
          .eq('id', commentId);

        if (deleteError) {
          console.error('Error deleting comment:', deleteError);
          throw new GraphQLError('Failed to delete comment', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return true;
      } catch (error: any) {
        console.error('Error in deleteSectionComment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to delete comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    resolveSectionComment: async (_: any, { commentId }: { commentId: string }) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Update the comment
        const { data: comment, error: updateError } = await supabase
          .from('section_comments')
          .update({
            is_resolved: true,
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', commentId)
          .select(`
            *,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .single();

        if (updateError || !comment) {
          console.error('Error resolving comment:', updateError);
          throw new GraphQLError('Failed to resolve comment', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return {
          success: true,
          comment: mapSectionComment(comment),
        };
      } catch (error: any) {
        console.error('Error in resolveSectionComment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to resolve comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },

    reopenSectionComment: async (_: any, { commentId }: { commentId: string }) => {
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Update the comment
        const { data: comment, error: updateError } = await supabase
          .from('section_comments')
          .update({
            is_resolved: false,
            resolved_by: null,
            resolved_at: null,
          })
          .eq('id', commentId)
          .select(`
            *,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .single();

        if (updateError || !comment) {
          console.error('Error reopening comment:', updateError);
          throw new GraphQLError('Failed to reopen comment', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          });
        }

        return {
          success: true,
          comment: mapSectionComment(comment),
        };
      } catch (error: any) {
        console.error('Error in reopenSectionComment:', error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(error.message || 'Failed to reopen comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },

  // Type resolvers to map database fields to GraphQL schema
  Project: {
    clientId: (parent: any) => parent.client_id || parent.clientId,
    status: (parent: any) => (parent.status || '').toUpperCase(),
    createdAt: (parent: any) => parent.created_at || parent.createdAt,
    updatedAt: (parent: any) => parent.updated_at || parent.updatedAt,
    additionalInfoRequirements: (parent: any) => parent.additional_info_requirements || parent.additionalInfoRequirements || [],
  },

  AdditionalInfoRequirement: {
    fieldType: (parent: any) => (parent.fieldType || parent.fieldType || '').toUpperCase(),
  },
};

// ============================================================================
// Helper Functions for Section Comments
// ============================================================================

/**
 * Maps database comment to GraphQL SectionComment type
 */
function mapSectionComment(comment: any): any {
  const user = comment.users;
  return {
    id: comment.id,
    sectionId: comment.section_id,
    documentId: comment.document_id,
    userId: comment.user_id,
    user: user
      ? {
          id: user.id,
          name: user.raw_user_meta_data?.name || 'Unknown User',
          email: user.raw_user_meta_data?.email || '',
        }
      : undefined,
    content: comment.content,
    isResolved: comment.is_resolved,
    resolvedBy: comment.resolved_by,
    resolvedAt: comment.resolved_at,
    parentId: comment.parent_id,
    replies: [],
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  };
}

/**
 * Sends notifications for new comment
 */
async function sendCommentNotifications(
  comment: any,
  authorId: string,
  supabase: any
): Promise<void> {
  try {
    const { NotificationService } = await import('@/lib/notification-service');

    // Get section details
    const { data: section } = await supabase
      .from('document_sections')
      .select('title, assigned_to')
      .eq('id', comment.section_id)
      .single();

    if (!section) return;

    // Notify section assignee if exists and not the author
    if (section.assigned_to && section.assigned_to !== authorId) {
      await NotificationService.createNotification({
        userId: section.assigned_to,
        type: 'document_comment_added',
        title: 'New comment on your section',
        body: `A comment was added to "${section.title}"`,
        data: {
          sectionId: comment.section_id,
          commentId: comment.id,
          documentId: comment.document_id,
        },
        sendEmail: true,
      });
    }

    // If it's a reply, notify the parent comment author
    if (comment.parent_id) {
      const { data: parentComment } = await supabase
        .from('section_comments')
        .select('user_id')
        .eq('id', comment.parent_id)
        .single();

      if (parentComment && parentComment.user_id !== authorId) {
        await NotificationService.createNotification({
          userId: parentComment.user_id,
          type: 'document_comment_added',
          title: 'Reply to your comment',
          body: `Someone replied to your comment on "${section.title}"`,
          data: {
            sectionId: comment.section_id,
            commentId: comment.id,
            parentCommentId: comment.parent_id,
            documentId: comment.document_id,
          },
          sendEmail: true,
        });
      }
    }
  } catch (error) {
    console.error('Error sending comment notifications:', error);
  }
}

export default resolvers;
