/**
 * Version Service
 * 
 * Handles proposal versioning including automatic version creation,
 * version comparison, and version restoration.
 * Implements requirements 8.2, 12.1, 12.2, 12.3, 12.4, 12.5 from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';

export interface ProposalVersion {
  id: string;
  proposalId: string;
  versionNumber: number;
  content: any;
  sectionsSnapshot: any[];
  documentsSnapshot: any[];
  changeSummary?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateVersionResult {
  success: boolean;
  version?: ProposalVersion;
  error?: string;
  errorCode?: 'PROPOSAL_NOT_FOUND' | 'UNAUTHORIZED' | 'SNAPSHOT_FAILED' | 'UNKNOWN';
}

export interface VersionComparison {
  oldVersion: ProposalVersion;
  newVersion: ProposalVersion;
  diff: {
    contentChanges: any;
    sectionsAdded: any[];
    sectionsRemoved: any[];
    sectionsModified: any[];
    documentsAdded: any[];
    documentsRemoved: any[];
  };
}

export interface RestoreVersionResult {
  success: boolean;
  newVersion?: ProposalVersion;
  error?: string;
  errorCode?: 'VERSION_NOT_FOUND' | 'PROPOSAL_NOT_FOUND' | 'UNAUTHORIZED' | 'RESTORE_FAILED' | 'UNKNOWN';
}

/**
 * VersionService class for managing proposal versions
 */
export class VersionService {
  /**
   * Creates a new version of a proposal with complete snapshots
   * 
   * Requirements:
   * - 12.1: Create version on significant changes
   * - 12.5: Include complete snapshots of sections and documents
   * 
   * @param proposalId - The proposal ID
   * @param userId - The user creating the version
   * @param changeSummary - Optional summary of changes
   * @returns CreateVersionResult with version data
   */
  static async createVersion(
    proposalId: string,
    userId: string,
    changeSummary?: string
  ): Promise<CreateVersionResult> {
    try {
      const supabase = await createClient();

      // Verify proposal exists and user has access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          lead_id,
          status,
          content
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
          errorCode: 'PROPOSAL_NOT_FOUND',
        };
      }

      // Verify user is lead or team member
      const isLead = proposal.lead_id === userId;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(proposal.project_id, userId);

      if (!isLead && !isMember) {
        return {
          success: false,
          error: 'Unauthorized to create version',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Get workspace for this proposal
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)
        .eq('lead_id', proposal.lead_id)
        .maybeSingle();

      if (!workspace) {
        return {
          success: false,
          error: 'Workspace not found for proposal',
          errorCode: 'SNAPSHOT_FAILED',
        };
      }

      // Capture sections snapshot
      const { data: sections, error: sectionsError } = await supabase
        .from('document_sections')
        .select(`
          id,
          document_id,
          title,
          order,
          status,
          content,
          assigned_to,
          deadline,
          created_at,
          updated_at
        `)
        .eq('document_id', (
          await supabase
            .from('workspace_documents')
            .select('id')
            .eq('workspace_id', workspace.id)
            .single()
        ).data?.id || '');

      if (sectionsError) {
        console.error('Error capturing sections snapshot:', sectionsError);
        return {
          success: false,
          error: 'Failed to capture sections snapshot',
          errorCode: 'SNAPSHOT_FAILED',
        };
      }

      // Capture documents snapshot
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select(`
          id,
          proposal_id,
          url,
          doc_type,
          file_name,
          file_size,
          uploaded_by,
          uploaded_at,
          is_required
        `)
        .eq('proposal_id', proposalId);

      if (documentsError) {
        console.error('Error capturing documents snapshot:', documentsError);
        return {
          success: false,
          error: 'Failed to capture documents snapshot',
          errorCode: 'SNAPSHOT_FAILED',
        };
      }

      // Get next version number
      const { data: versionNumber } = await supabase
        .rpc('get_next_version_number', { p_proposal_id: proposalId });

      // Create version record
      const { data: version, error: versionError } = await supabase
        .from('proposal_versions')
        .insert({
          proposal_id: proposalId,
          version_number: versionNumber || 1,
          content: proposal.content || {},
          sections_snapshot: sections || [],
          documents_snapshot: documents || [],
          change_summary: changeSummary,
          created_by: userId,
        })
        .select(`
          id,
          proposal_id,
          version_number,
          content,
          sections_snapshot,
          documents_snapshot,
          change_summary,
          created_by,
          created_at
        `)
        .single();

      if (versionError || !version) {
        console.error('Error creating version:', versionError);
        return {
          success: false,
          error: 'Failed to create version',
          errorCode: 'UNKNOWN',
        };
      }

      return {
        success: true,
        version: {
          id: version.id,
          proposalId: version.proposal_id,
          versionNumber: version.version_number,
          content: version.content,
          sectionsSnapshot: version.sections_snapshot,
          documentsSnapshot: version.documents_snapshot,
          changeSummary: version.change_summary,
          createdBy: version.created_by,
          createdAt: version.created_at,
        },
      };
    } catch (error) {
      console.error('Unexpected error in createVersion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets all versions for a proposal
   * 
   * Requirement 12.2: Display version history with timestamps, authors, and change summaries
   * 
   * @param proposalId - The proposal ID
   * @returns Array of versions
   */
  static async getVersionHistory(proposalId: string): Promise<ProposalVersion[]> {
    try {
      const supabase = await createClient();

      const { data: versions, error } = await supabase
        .from('proposal_versions')
        .select(`
          id,
          proposal_id,
          version_number,
          content,
          sections_snapshot,
          documents_snapshot,
          change_summary,
          created_by,
          created_at
        `)
        .eq('proposal_id', proposalId)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('Error fetching version history:', error);
        return [];
      }

      return (versions || []).map((v) => ({
        id: v.id,
        proposalId: v.proposal_id,
        versionNumber: v.version_number,
        content: v.content,
        sectionsSnapshot: v.sections_snapshot,
        documentsSnapshot: v.documents_snapshot,
        changeSummary: v.change_summary,
        createdBy: v.created_by,
        createdAt: v.created_at,
      }));
    } catch (error) {
      console.error('Unexpected error in getVersionHistory:', error);
      return [];
    }
  }

  /**
   * Gets a specific version by ID
   * 
   * @param versionId - The version ID
   * @returns Version data or null
   */
  static async getVersion(versionId: string): Promise<ProposalVersion | null> {
    try {
      const supabase = await createClient();

      const { data: version, error } = await supabase
        .from('proposal_versions')
        .select(`
          id,
          proposal_id,
          version_number,
          content,
          sections_snapshot,
          documents_snapshot,
          change_summary,
          created_by,
          created_at
        `)
        .eq('id', versionId)
        .single();

      if (error || !version) {
        console.error('Error fetching version:', error);
        return null;
      }

      return {
        id: version.id,
        proposalId: version.proposal_id,
        versionNumber: version.version_number,
        content: version.content,
        sectionsSnapshot: version.sections_snapshot,
        documentsSnapshot: version.documents_snapshot,
        changeSummary: version.change_summary,
        createdBy: version.created_by,
        createdAt: version.created_at,
      };
    } catch (error) {
      console.error('Unexpected error in getVersion:', error);
      return null;
    }
  }

  /**
   * Compares two versions and generates a diff
   * 
   * Requirement 12.3: Show side-by-side diff highlighting changes
   * 
   * @param oldVersionId - The older version ID
   * @param newVersionId - The newer version ID
   * @returns VersionComparison with diff data
   */
  static async compareVersions(
    oldVersionId: string,
    newVersionId: string
  ): Promise<VersionComparison | null> {
    try {
      const oldVersion = await this.getVersion(oldVersionId);
      const newVersion = await this.getVersion(newVersionId);

      if (!oldVersion || !newVersion) {
        return null;
      }

      // Compare sections
      const oldSections = oldVersion.sectionsSnapshot || [];
      const newSections = newVersion.sectionsSnapshot || [];

      const oldSectionIds = new Set(oldSections.map((s: any) => s.id));
      const newSectionIds = new Set(newSections.map((s: any) => s.id));

      const sectionsAdded = newSections.filter((s: any) => !oldSectionIds.has(s.id));
      const sectionsRemoved = oldSections.filter((s: any) => !newSectionIds.has(s.id));
      
      const sectionsModified = newSections.filter((newS: any) => {
        const oldS = oldSections.find((s: any) => s.id === newS.id);
        if (!oldS) return false;
        
        // Check if content, title, or status changed
        return (
          JSON.stringify(oldS.content) !== JSON.stringify(newS.content) ||
          oldS.title !== newS.title ||
          oldS.status !== newS.status ||
          oldS.assigned_to !== newS.assigned_to
        );
      });

      // Compare documents
      const oldDocuments = oldVersion.documentsSnapshot || [];
      const newDocuments = newVersion.documentsSnapshot || [];

      const oldDocIds = new Set(oldDocuments.map((d: any) => d.id));
      const newDocIds = new Set(newDocuments.map((d: any) => d.id));

      const documentsAdded = newDocuments.filter((d: any) => !oldDocIds.has(d.id));
      const documentsRemoved = oldDocuments.filter((d: any) => !newDocIds.has(d.id));

      // Compare content
      const contentChanges = this.generateContentDiff(oldVersion.content, newVersion.content);

      return {
        oldVersion,
        newVersion,
        diff: {
          contentChanges,
          sectionsAdded,
          sectionsRemoved,
          sectionsModified,
          documentsAdded,
          documentsRemoved,
        },
      };
    } catch (error) {
      console.error('Unexpected error in compareVersions:', error);
      return null;
    }
  }

  /**
   * Restores a proposal to a previous version
   * 
   * Requirement 12.4: Create new version with restored content (round-trip preservation)
   * 
   * @param versionId - The version ID to restore
   * @param userId - The user performing the restoration
   * @returns RestoreVersionResult with new version data
   */
  static async restoreVersion(
    versionId: string,
    userId: string
  ): Promise<RestoreVersionResult> {
    try {
      const supabase = await createClient();

      // Get the version to restore
      const versionToRestore = await this.getVersion(versionId);
      if (!versionToRestore) {
        return {
          success: false,
          error: 'Version not found',
          errorCode: 'VERSION_NOT_FOUND',
        };
      }

      // Verify proposal exists
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, project_id, lead_id, status')
        .eq('id', versionToRestore.proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
          errorCode: 'PROPOSAL_NOT_FOUND',
        };
      }

      // Verify user has permission
      const isLead = proposal.lead_id === userId;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(proposal.project_id, userId);

      if (!isLead && !isMember) {
        return {
          success: false,
          error: 'Unauthorized to restore version',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Update proposal content
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          content: versionToRestore.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', versionToRestore.proposalId);

      if (updateError) {
        console.error('Error updating proposal:', updateError);
        return {
          success: false,
          error: 'Failed to restore proposal content',
          errorCode: 'RESTORE_FAILED',
        };
      }

      // Get workspace and document
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)
        .eq('lead_id', proposal.lead_id)
        .maybeSingle();

      if (workspace) {
        const { data: document } = await supabase
          .from('workspace_documents')
          .select('id')
          .eq('workspace_id', workspace.id)
          .single();

        if (document) {
          // Restore sections (delete current and recreate from snapshot)
          await supabase
            .from('document_sections')
            .delete()
            .eq('document_id', document.id);

          const sectionsToRestore = versionToRestore.sectionsSnapshot.map((s: any) => ({
            document_id: document.id,
            title: s.title,
            order: s.order,
            status: s.status,
            content: s.content,
            assigned_to: s.assigned_to,
            deadline: s.deadline,
          }));

          if (sectionsToRestore.length > 0) {
            await supabase
              .from('document_sections')
              .insert(sectionsToRestore);
          }
        }
      }

      // Create a new version to record the restoration
      const changeSummary = `Restored from version ${versionToRestore.versionNumber}`;
      const createResult = await this.createVersion(
        versionToRestore.proposalId,
        userId,
        changeSummary
      );

      if (!createResult.success) {
        return {
          success: false,
          error: 'Restoration succeeded but failed to create new version',
          errorCode: 'RESTORE_FAILED',
        };
      }

      return {
        success: true,
        newVersion: createResult.version,
      };
    } catch (error) {
      console.error('Unexpected error in restoreVersion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Generates a content diff between two objects
   * 
   * @param oldContent - The old content object
   * @param newContent - The new content object
   * @returns Diff object with changes
   */
  private static generateContentDiff(oldContent: any, newContent: any): any {
    const diff: any = {
      added: {},
      removed: {},
      modified: {},
    };

    // Handle null/undefined cases
    if (!oldContent) oldContent = {};
    if (!newContent) newContent = {};

    // Find added and modified keys
    for (const key in newContent) {
      if (!(key in oldContent)) {
        diff.added[key] = newContent[key];
      } else if (JSON.stringify(oldContent[key]) !== JSON.stringify(newContent[key])) {
        diff.modified[key] = {
          old: oldContent[key],
          new: newContent[key],
        };
      }
    }

    // Find removed keys
    for (const key in oldContent) {
      if (!(key in newContent)) {
        diff.removed[key] = oldContent[key];
      }
    }

    return diff;
  }

  /**
   * Gets the latest version for a proposal
   * 
   * @param proposalId - The proposal ID
   * @returns Latest version or null
   */
  static async getLatestVersion(proposalId: string): Promise<ProposalVersion | null> {
    try {
      const supabase = await createClient();

      const { data: version, error } = await supabase
        .from('proposal_versions')
        .select(`
          id,
          proposal_id,
          version_number,
          content,
          sections_snapshot,
          documents_snapshot,
          change_summary,
          created_by,
          created_at
        `)
        .eq('proposal_id', proposalId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !version) {
        return null;
      }

      return {
        id: version.id,
        proposalId: version.proposal_id,
        versionNumber: version.version_number,
        content: version.content,
        sectionsSnapshot: version.sections_snapshot,
        documentsSnapshot: version.documents_snapshot,
        changeSummary: version.change_summary,
        createdBy: version.created_by,
        createdAt: version.created_at,
      };
    } catch (error) {
      console.error('Unexpected error in getLatestVersion:', error);
      return null;
    }
  }

  /**
   * Gets version count for a proposal
   * 
   * @param proposalId - The proposal ID
   * @returns Number of versions
   */
  static async getVersionCount(proposalId: string): Promise<number> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .rpc('get_version_count', { p_proposal_id: proposalId });

      if (error) {
        console.error('Error getting version count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Unexpected error in getVersionCount:', error);
      return 0;
    }
  }
}
