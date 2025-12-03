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
import { ProposalService } from '@/lib/proposal-service';

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
        throw new GraphQLError('Failed to fetch projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return projects || [];
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
        throw new GraphQLError('Failed to fetch open projects', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return projects || [];
    },

    project: async (_: any, { id }: { id: string }) => {
      const supabase = await createClient();
      
      // Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Authorization check - only client can view their project
      if (user.user_metadata?.role === 'client' && project.client_id !== user.id) {
        throw new GraphQLError('Forbidden: You do not have access to this project', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return project;
    },

    projectWithProposals: async (_: any, { projectId }: { projectId: string }) => {
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
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
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
      const submittedProposals = proposals?.filter(p => p.status === 'submitted').length || 0;
      const underReviewProposals = proposals?.filter(p => p.status === 'reviewing').length || 0;
      const acceptedProposals = proposals?.filter(p => p.status === 'approved').length || 0;
      const rejectedProposals = proposals?.filter(p => p.status === 'rejected').length || 0;

      // Build proposal summaries
      const adminClient = createAdminClient();
      const proposalSummaries = await Promise.all((proposals || []).map(async (proposal: any) => {
        // Get team members for this proposal
        const { data: teamMembers } = await supabase
          .from('bid_team_members')
          .select('user_id, role')
          .eq('project_id', proposal.project_id);
        
        // Get lead info
        const leadMember = teamMembers?.find((m: any) => m.role === 'lead');
        const { data: leadUser } = await adminClient.auth.admin.getUserById(leadMember?.user_id || proposal.lead_id);
        
        // Get team size
        const teamSize = teamMembers?.length || 0;

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
          title: `Proposal for ${project.title}`,
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
          budgetEstimate: null,
          timelineEstimate: null,
          submissionDate: proposal.submitted_at || proposal.created_at,
          status: proposal.status.toUpperCase(),
          complianceScore,
          unreadMessages: unreadCount || 0,
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
            fieldType: req.fieldType.toUpperCase(),
            required: req.required,
            helpText: req.helpText || null,
            options: req.options || [],
            order: req.order,
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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Fetch proposal with related data
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          projects!inner(client_id)
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Authorization check - only client or team members can view
      const isClient = proposal.projects.client_id === user.id;
      const { data: teamMember } = await supabase
        .from('bid_team_members')
        .select('*')
        .eq('project_id', proposal.project_id)
        .eq('user_id', user.id)
        .single();

      if (!isClient && !teamMember) {
        throw new GraphQLError('Forbidden: You do not have access to this proposal', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch team members
      const { data: teamMembers } = await supabase
        .from('bid_team_members')
        .select('*')
        .eq('project_id', proposal.project_id);

      const adminClient = createAdminClient();
      const teamMembersWithDetails = await Promise.all((teamMembers || []).map(async (member: any) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(member.user_id);
        return {
          id: member.user_id,
          name: userData?.user?.user_metadata?.full_name || userData?.user?.user_metadata?.name || 'Unknown',
          email: userData?.user?.email || '',
          avatarUrl: userData?.user?.user_metadata?.avatar_url || null,
          role: member.role,
          assignedSections: [],
        };
      }));

      const lead = teamMembersWithDetails.find(m => m.role === 'lead') || teamMembersWithDetails[0];
      const members = teamMembersWithDetails.filter(m => m.role !== 'lead');

      // Fetch proposal versions
      const { data: versions } = await supabase
        .from('proposal_versions')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('version_number', { ascending: false });

      const currentVersion = versions?.[0]?.version_number || 1;

      // Fetch documents
      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('proposal_id', proposalId);

      // Fetch checklist items
      const { data: checklistItems } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('proposal_id', proposalId);

      return {
        id: proposal.id,
        title: `Proposal ${proposalId.substring(0, 8)}`,
        status: proposal.status.toUpperCase(),
        submissionDate: proposal.submitted_at || proposal.created_at,
        biddingTeam: {
          lead: lead || { id: '', name: 'Unknown', email: '', avatarUrl: null, role: 'lead', assignedSections: [] },
          members: members || [],
        },
        sections: (versions?.[0]?.content?.sections || []).map((section: any, index: number) => ({
          id: `section-${index}`,
          title: section.title || `Section ${index + 1}`,
          content: section.content || '',
          order: index,
        })),
        documents: (documents || []).map((doc: any) => ({
          id: doc.id,
          name: doc.url.split('/').pop() || 'document',
          fileType: doc.doc_type || 'unknown',
          fileSize: 0,
          category: 'OTHER',
          url: doc.url,
          uploadedAt: doc.created_at,
          uploadedBy: doc.created_by,
        })),
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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
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
        throw new GraphQLError('Failed to fetch messages', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
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
      const { data: teamMember } = await supabase
        .from('bid_team_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single();

      if (!isClient && !teamMember) {
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
          projects (
            id,
            title,
            description,
            deadline,
            status,
            additional_info_requirements
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (proposalsError) {
        throw new GraphQLError('Error fetching proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Transform the data to match the GraphQL schema
      return (proposals || []).map((proposal: any) => ({
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
          title: proposal.projects.title,
          description: proposal.projects.description,
          deadline: proposal.projects.deadline,
          status: proposal.projects.status?.toUpperCase() || 'PENDING_REVIEW',
          additionalInfoRequirements: (proposal.projects.additional_info_requirements || []).map((req: any) => ({
            id: req.id,
            fieldName: req.fieldName,
            fieldType: req.fieldType.toUpperCase(),
            required: req.required,
            helpText: req.helpText || null,
            options: req.options || [],
            order: req.order,
          })),
          createdAt: proposal.projects.created_at,
          updatedAt: proposal.projects.updated_at,
        },
      }));
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

    workspaceByProject: async (_: any, { projectId }: { projectId: string }) => {
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
        .eq('project_id', projectId)
        .single();

      if (error || !workspace) {
        throw new GraphQLError('Workspace not found for this project', {
          extensions: { code: 'NOT_FOUND' },
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
      const supabase = await createClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const versionService = new VersionControlService();
      const result = await versionService.getVersionHistory(documentId, user.id);

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

      // Get pending projects
      const { data: projects, error } = await supabase
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
        const { data: { user: clientUser }, error: clientError } = await supabase.auth.admin.getUserById(clientId);
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
        deadline: project.deadline,
        status: project.status,
        additionalInfoRequirements: project.additional_info_requirements || [],
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

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();

      // Call the analytics function
      const { data, error } = await supabase.rpc('calculate_platform_analytics', {
        p_date_from: from,
        p_date_to: to,
      });

      if (error) {
        throw new GraphQLError('Failed to calculate analytics', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return {
        userGrowth: data.userGrowth || [],
        projectStats: data.projectStats || {
          total: 0,
          pending: 0,
          open: 0,
          closed: 0,
          awarded: 0,
        },
        proposalStats: data.proposalStats || {
          total: 0,
          draft: 0,
          submitted: 0,
          accepted: 0,
          rejected: 0,
        },
        revenueData: [],
        conversionRates: {
          projectApprovalRate: 0,
          proposalAcceptanceRate: 0,
          clientRetentionRate: 0,
        },
      };
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

      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();

      // Calculate scoring usage percentage
      const { data: projectsData, error: projectsError } = await supabase
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

      const { data: templatesData, error: templatesError } = await supabase
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
      const { data: scoresData, error: scoresError } = await supabase
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
      const { data: criteriaData, error: criteriaError } = await supabase
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
      const { data: scoringDurations, error: durationError } = await supabase.rpc(
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
        status: section.status,
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

      // Build query
      let query = supabase
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
        query = query.or(`title.ilike.%${search}%`);
      }

      const { data: proposals, error } = await query;

      if (error) {
        console.error('Error fetching proposals:', error);
        throw new GraphQLError('Failed to fetch proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', details: error },
        });
      }

      // Get related data (projects, users)
      const adminClient = createAdminClient();
      const proposalsWithDetails = await Promise.all(
        (proposals || []).map(async (proposal: any) => {
          // Get project
          const { data: project } = await supabase
            .from('projects')
            .select('id, title')
            .eq('id', proposal.project_id)
            .single();

          // Get bidding lead user info
          const { data: { user: leadUser } } = await adminClient.auth.admin.getUserById(proposal.lead_id);

          // Try to find bidding team through bid_team_members table
          let biddingTeam = null;
          const { data: teamMember } = await supabase
            .from('bid_team_members')
            .select('bidding_team_id, bidding_teams(id, name)')
            .eq('user_id', proposal.lead_id)
            .eq('project_id', proposal.project_id)
            .single();
          
          if (teamMember && teamMember.bidding_teams) {
            const team = Array.isArray(teamMember.bidding_teams) 
              ? teamMember.bidding_teams[0] 
              : teamMember.bidding_teams;
            
            if (team) {
              biddingTeam = {
                id: team.id,
                name: team.name,
              };
            }
          }

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

      // Query contract_templates table (the actual table name)
      const { data: templates, error } = await supabase
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
      const { data: teamMember } = await supabase
        .from('bid_team_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single();

      if (!isClient && !teamMember) {
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

      // Get user details for each score
      const adminClient = createAdminClient();
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
      const { data: teamMember } = await supabase
        .from('bid_team_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single();

      if (!isClient && !teamMember) {
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
          
          // Get team size
          const { count: teamSize } = await supabase
            .from('bid_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('user_id', proposal.lead_id);

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
          
          // Get team size
          const { count: teamSize } = await supabase
            .from('bid_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('user_id', proposal.lead_id);

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
          status: project.status,
          budget: project.budget,
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
          status: project.status,
          budget: project.budget,
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
          status: project.status,
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

        // Then, get projects where user is a team member
        const { data: teamMemberships } = await supabase
          .from('bid_team_members')
          .select('project_id')
          .eq('user_id', user.id);

        const teamProjectIds = teamMemberships?.map(m => m.project_id) || [];

        // Get proposals for those projects
        let memberProposals: any[] = [];
        if (teamProjectIds.length > 0) {
          const { data: memberProps } = await supabase
            .from('proposals')
            .select(`
              id,
              project_id,
              lead_id,
              status,
              projects!inner(id, title, client_id)
            `)
            .in('project_id', teamProjectIds)
            .order('created_at', { ascending: false });
          
          memberProposals = memberProps || [];
        }

        // Combine and deduplicate proposals
        const proposalMap = new Map();
        [...(leadProposals || []), ...memberProposals].forEach(p => {
          proposalMap.set(p.id, p);
        });
        const proposals = Array.from(proposalMap.values());

        // For each proposal, get team members
        const adminClient = createAdminClient();
        const proposalsWithTeams = await Promise.all((proposals || []).map(async (proposal: any) => {
          // Get team members from bid_team_members (legacy) or proposal_team_members (new)
          const { data: teamMembers } = await supabase
            .from('bid_team_members')
            .select('user_id, role, created_at')
            .eq('project_id', proposal.project_id);

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
              joinedAt: member.created_at,
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
        const { TeamManagementService } = await import('@/lib/team-management-service');
        const service = new TeamManagementService();
        
        const result = await service.getTeamMembers({ projectId });

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
      const reviewedByData = completion.reviewedBy 
        ? await adminClient.auth.admin.getUserById(completion.reviewedBy)
        : null;

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
      const exportRecord = await ExportService.getExport(exportId);

      if (!exportRecord) {
        return null;
      }

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
        const urlResult = await ExportService.generateDownloadUrl(exportId);
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
      const exports = await ExportService.getExportsByProject(projectId);

      // Filter to only show user's own exports
      const userExports = exports.filter((exp) => exp.requestedBy === user.id);

      const adminClient = createAdminClient();
      const exportsWithDetails = await Promise.all(
        userExports.map(async (exportRecord) => {
          const { data: requestedByData } = await adminClient.auth.admin.getUserById(exportRecord.requestedBy);

          // Generate download URL if export is completed
          let downloadUrl = null;
          if (exportRecord.status === 'completed' && exportRecord.exportPath) {
            const urlResult = await ExportService.generateDownloadUrl(exportRecord.id);
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

      const statistics = await StatisticsService.getCompletionStatistics(fromDate, toDate);

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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate content is not empty
      if (!input.content.trim()) {
        throw new GraphQLError('Message content cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
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
        throw new GraphQLError('Failed to send message', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
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
        throw new GraphQLError('Forbidden: Only the project client can accept proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update the accepted proposal status
      const { error: acceptError } = await supabase
        .from('proposals')
        .update({ status: 'approved' })
        .eq('id', proposalId);

      if (acceptError) {
        throw new GraphQLError('Failed to accept proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Reject all other proposals for this project
      const { error: rejectError } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('project_id', projectId)
        .neq('id', proposalId);

      if (rejectError) {
        throw new GraphQLError('Failed to reject other proposals', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Update project status to awarded
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({ status: 'awarded' })
        .eq('id', projectId);

      if (projectUpdateError) {
        throw new GraphQLError('Failed to update project status', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
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
        throw new GraphQLError('Failed to record decision', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Validate feedback is not empty
      if (!input.feedback.trim()) {
        throw new GraphQLError('Rejection feedback is required', {
          extensions: { code: 'BAD_USER_INPUT' },
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
        throw new GraphQLError('Forbidden: Only the project client can reject proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update proposal status
      const { error: rejectError } = await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('id', input.proposalId);

      if (rejectError) {
        throw new GraphQLError('Failed to reject proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
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
        throw new GraphQLError('Failed to record decision', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if user is a client
      const userRole = user.user_metadata?.role;
      if (userRole !== 'client') {
        throw new GraphQLError('Only clients can create projects', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check verification status
      const verificationStatus = user.user_metadata?.verification_status;
      if (verificationStatus !== 'verified') {
        throw new GraphQLError('Account verification required. Your account must be verified by a Content Coordinator before you can create projects.', {
          extensions: { 
            code: 'FORBIDDEN',
            verificationStatus: verificationStatus || 'pending_verification'
          },
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
        console.error('Database error creating project:', createError);
        throw new GraphQLError(`Failed to create project: ${createError.message}`, {
          extensions: { 
            code: 'INTERNAL_SERVER_ERROR',
            details: createError 
          },
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
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user is a bidding lead
      const userRole = user.user_metadata?.role;
      if (userRole !== 'bidding_lead') {
        throw new GraphQLError('Forbidden: Only bidding leads can create proposals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Use ProposalService to create proposal with workspace and sections
      const result = await ProposalService.createProposal(projectId, user.id);

      if (!result.success) {
        // Map error codes to GraphQL errors
        const errorCodeMap: Record<string, string> = {
          'DUPLICATE_PROPOSAL': 'BAD_USER_INPUT',
          'PROJECT_NOT_FOUND': 'NOT_FOUND',
          'UNAUTHORIZED': 'FORBIDDEN',
          'WORKSPACE_CREATION_FAILED': 'INTERNAL_SERVER_ERROR',
          'UNKNOWN': 'INTERNAL_SERVER_ERROR',
        };

        throw new GraphQLError(result.error || 'Failed to create proposal', {
          extensions: { 
            code: errorCodeMap[result.errorCode || 'UNKNOWN'] || 'INTERNAL_SERVER_ERROR' 
          },
        });
      }

      // Get project details for response
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        throw new GraphQLError('Project not found', {
          extensions: { code: 'NOT_FOUND' },
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

      const { data: updatedProposal, error: updateError } = await supabase
        .from('proposals')
        .update(updateData)
        .eq('id', proposalId)
        .select()
        .single();

      if (updateError || !updatedProposal) {
        throw new GraphQLError('Failed to update proposal', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

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
        title: updatedProposal.title,
        content: updatedProposal.content,
        status: updatedProposal.status,
        budgetEstimate: updatedProposal.budget_estimate,
        timelineEstimate: updatedProposal.timeline_estimate,
        additionalInfo: updatedProposal.additional_info,
        updatedAt: updatedProposal.updated_at,
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

    saveSubmissionDraft: async (
      _: any,
      { proposalId, step, data }: { proposalId: string; step: number; data: any }
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
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new GraphQLError('Proposal not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (proposal.lead_id !== user.id) {
        throw new GraphQLError('Forbidden: Only the proposal lead can save drafts', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Save draft using the service
      const submissionService = new ProposalSubmissionService();
      const success = await submissionService.saveSubmissionDraft({
        proposalId,
        userId: user.id,
        currentStep: step,
        draftData: data,
      });

      if (!success) {
        throw new GraphQLError('Failed to save submission draft', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return true;
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
        .from('documents')
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

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        await progressTracker.updateSectionStatus(sectionId, status.toLowerCase() as any);

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
          error: error.message || 'Failed to update section status',
        };
      } finally {
        await progressTracker.cleanup();
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

      const progressTracker = new ProgressTrackerService();
      await progressTracker.initialize(user.id);

      try {
        await progressTracker.assignSection(input.sectionId, input.userId);

        // Fetch the updated section
        const { data: section, error: sectionError } = await supabase
          .from('document_sections')
          .select('*')
          .eq('id', input.sectionId)
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

        // TODO: Send notification to assigned user (Requirement 6.3)
        // This would integrate with the notification system

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
          error: error.message || 'Failed to assign section',
        };
      } finally {
        await progressTracker.cleanup();
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

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        deadline: project.deadline,
        status: project.status,
        additionalInfoRequirements: project.additional_info_requirements || [],
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

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        deadline: project.deadline,
        status: project.status,
        additionalInfoRequirements: project.additional_info_requirements || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at,
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

      return {
        id: project.id,
        clientId: project.client_id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        deadline: project.deadline,
        status: project.status,
        additionalInfoRequirements: project.additional_info_requirements || [],
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
        .select('*, projects!inner(client_id)')
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
          
          // Get team size
          const { count: teamSize } = await supabase
            .from('bid_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('user_id', proposal.lead_id);

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
      { input }: { input: { projectId: string; userId: string } }
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
          projectId: input.projectId,
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
      const reviewedByData = result.completion.reviewedBy 
        ? await adminClient.auth.admin.getUserById(result.completion.reviewedBy)
        : null;

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
              email: resolvedByData?.user?.email || '',
              fullName: resolvedByData?.user?.user_metadata?.full_name || resolvedByData?.user?.user_metadata?.name || 'Unknown',
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
      const reviewedByData = result.completion.reviewedBy 
        ? await adminClient.auth.admin.getUserById(result.completion.reviewedBy)
        : null;

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
              email: resolvedByData?.user?.email || '',
              fullName: resolvedByData?.user?.user_metadata?.full_name || resolvedByData?.user?.user_metadata?.name || 'Unknown',
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
          email: resolvedByData?.user?.email || '',
          fullName: resolvedByData?.user?.user_metadata?.full_name || resolvedByData?.user?.user_metadata?.name || 'Unknown',
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
      const result = await ExportService.requestExport(input.projectId, user.id);

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

      const { RetentionService } = await import('@/lib/retention-service');
      const result = await RetentionService.applyLegalHold(archiveId, reason, user.id);

      if (!result.success || !result.archive) {
        throw new GraphQLError(result.error || 'Failed to apply legal hold', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(result.archive.archivedBy);

      return {
        id: result.archive.id,
        projectId: result.archive.projectId,
        archiveIdentifier: result.archive.archiveIdentifier,
        compressedSize: result.archive.compressedSize,
        originalSize: result.archive.originalSize,
        compressionRatio: result.archive.compressionRatio,
        archivedBy: {
          id: result.archive.archivedBy,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: result.archive.archivedAt.toISOString(),
        retentionUntil: result.archive.retentionUntil?.toISOString(),
        legalHold: result.archive.legalHold,
        legalHoldReason: result.archive.legalHoldReason,
        accessCount: result.archive.accessCount,
        lastAccessedAt: result.archive.lastAccessedAt?.toISOString(),
        project: {
          id: result.archive.archiveData.project.id,
          title: result.archive.archiveData.project.title,
          description: result.archive.archiveData.project.description,
          budget: result.archive.archiveData.project.budget,
          deadline: result.archive.archiveData.project.deadline?.toISOString(),
          clientId: result.archive.archiveData.project.clientId,
          status: result.archive.archiveData.project.status,
          proposals: [],
          deliverables: [],
          documents: [],
          comments: [],
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

      const { RetentionService } = await import('@/lib/retention-service');
      const result = await RetentionService.removeLegalHold(archiveId, user.id);

      if (!result.success || !result.archive) {
        throw new GraphQLError(result.error || 'Failed to remove legal hold', {
          extensions: { code: result.errorCode || 'INTERNAL_SERVER_ERROR' },
        });
      }

      const adminClient = createAdminClient();
      const { data: archivedByData } = await adminClient.auth.admin.getUserById(result.archive.archivedBy);

      return {
        id: result.archive.id,
        projectId: result.archive.projectId,
        archiveIdentifier: result.archive.archiveIdentifier,
        compressedSize: result.archive.compressedSize,
        originalSize: result.archive.originalSize,
        compressionRatio: result.archive.compressionRatio,
        archivedBy: {
          id: result.archive.archivedBy,
          email: archivedByData?.user?.email || '',
          fullName: archivedByData?.user?.user_metadata?.full_name || archivedByData?.user?.user_metadata?.name || 'Unknown',
        },
        archivedAt: result.archive.archivedAt.toISOString(),
        retentionUntil: result.archive.retentionUntil?.toISOString(),
        legalHold: result.archive.legalHold,
        legalHoldReason: result.archive.legalHoldReason,
        accessCount: result.archive.accessCount,
        lastAccessedAt: result.archive.lastAccessedAt?.toISOString(),
        project: {
          id: result.archive.archiveData.project.id,
          title: result.archive.archiveData.project.title,
          description: result.archive.archiveData.project.description,
          budget: result.archive.archiveData.project.budget,
          deadline: result.archive.archiveData.project.deadline?.toISOString(),
          clientId: result.archive.archiveData.project.clientId,
          status: result.archive.archiveData.project.status,
          proposals: [],
          deliverables: [],
          documents: [],
          comments: [],
        },
      };
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
