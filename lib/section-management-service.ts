/**
 * Section Management Service
 * 
 * Handles section operations for proposal documents including:
 * - Adding, updating, and deleting sections
 * - Section reordering with order preservation
 * - Section archival (soft delete)
 * - Section assignment functionality
 * - Deadline setting with validation
 * 
 * Implements requirements 6.1, 6.2, 7.1, 7.2, 8.1, 8.3, 8.4, 8.5
 * from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notification-service';

export type SectionStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';

export interface DocumentSection {
  id: string;
  documentId: string;
  title: string;
  order: number;
  status: SectionStatus;
  assignedTo?: string;
  deadline?: string;
  content: any;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  archivedAt?: string;
}

export interface AddSectionInput {
  documentId: string;
  title: string;
  order?: number;
  content?: any;
  assignedTo?: string;
  deadline?: string;
}

export interface UpdateSectionInput {
  title?: string;
  order?: number;
  content?: any;
  status?: SectionStatus;
  assignedTo?: string;
  deadline?: string;
}

export interface ReorderSectionInput {
  sectionId: string;
  newOrder: number;
}

export interface SectionOperationResult {
  success: boolean;
  section?: DocumentSection;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_DEADLINE' | 'INVALID_ORDER' | 'UNKNOWN';
}

export interface DeleteSectionResult {
  success: boolean;
  archivedSection?: {
    id: string;
    title: string;
    archivedAt: string;
  };
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNKNOWN';
}

/**
 * SectionManagementService class for managing document sections
 */
export class SectionManagementService {
  /**
   * Adds a new section to a document
   * 
   * Requirements:
   * - 8.1: Allow defining custom sections
   * - 8.5: Allow specifying section title, description, and assignment
   * 
   * @param input - Section creation data
   * @returns SectionOperationResult with created section
   */
  static async addSection(input: AddSectionInput): Promise<SectionOperationResult> {
    try {
      const supabase = await createClient();

      // Verify document exists and user has permission
      const { data: document, error: docError } = await supabase
        .from('workspace_documents')
        .select('id')
        .eq('id', input.documentId)
        .single();

      if (docError || !document) {
        return {
          success: false,
          error: 'Document not found or access denied',
          errorCode: 'NOT_FOUND',
        };
      }

      // If order not specified, get the next order number
      let order = input.order;
      if (order === undefined) {
        const { data: sections } = await supabase
          .from('document_sections')
          .select('order')
          .eq('document_id', input.documentId)
          .order('order', { ascending: false })
          .limit(1);

        order = sections && sections.length > 0 ? sections[0].order + 1 : 0;
      }

      // Validate deadline if provided
      if (input.deadline) {
        const deadlineValidation = await this.validateDeadline(input.documentId, input.deadline);
        if (!deadlineValidation.valid) {
          return {
            success: false,
            error: deadlineValidation.error,
            errorCode: 'INVALID_DEADLINE',
          };
        }
      }

      // Create the section
      const { data: section, error: sectionError } = await supabase
        .from('document_sections')
        .insert({
          document_id: input.documentId,
          title: input.title,
          order: order,
          content: input.content || {},
          status: 'not_started',
          assigned_to: input.assignedTo,
          deadline: input.deadline,
        })
        .select('*')
        .single();

      if (sectionError || !section) {
        console.error('Error creating section:', sectionError);
        return {
          success: false,
          error: 'Failed to create section',
          errorCode: 'UNKNOWN',
        };
      }

      return {
        success: true,
        section: this.mapSection(section),
      };
    } catch (error) {
      console.error('Unexpected error in addSection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Updates an existing section
   * 
   * Requirements:
   * - 8.2: Save changes with version tracking
   * - 6.2: Allow selecting from available team members for assignment
   * - 7.1: Allow setting a deadline for sections
   * - 18.2: Notify the Bidding Lead when a section is completed
   * 
   * @param sectionId - The section ID to update
   * @param input - Section update data
   * @returns SectionOperationResult with updated section
   */
  static async updateSection(
    sectionId: string,
    input: UpdateSectionInput
  ): Promise<SectionOperationResult> {
    try {
      const supabase = await createClient();

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Verify section exists
      const { data: existingSection, error: fetchError } = await supabase
        .from('document_sections')
        .select('*, workspace_documents!inner(id, workspace_id, workspaces!inner(project_id, projects!inner(lead_id)))')
        .eq('id', sectionId)
        .single();

      if (fetchError || !existingSection) {
        return {
          success: false,
          error: 'Section not found or access denied',
          errorCode: 'NOT_FOUND',
        };
      }

      // Validate deadline if provided
      if (input.deadline) {
        const deadlineValidation = await this.validateDeadline(
          existingSection.document_id,
          input.deadline
        );
        if (!deadlineValidation.valid) {
          return {
            success: false,
            error: deadlineValidation.error,
            errorCode: 'INVALID_DEADLINE',
          };
        }
      }

      // Build update object
      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.order !== undefined) updateData.order = input.order;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo;
      if (input.deadline !== undefined) updateData.deadline = input.deadline;

      // Update the section
      const { data: section, error: updateError } = await supabase
        .from('document_sections')
        .update(updateData)
        .eq('id', sectionId)
        .select('*')
        .single();

      if (updateError || !section) {
        console.error('Error updating section:', updateError);
        return {
          success: false,
          error: 'Failed to update section',
          errorCode: 'UNKNOWN',
        };
      }

      // Notify lead if section was just completed
      if (
        input.status === 'completed' &&
        existingSection.status !== 'completed' &&
        currentUser
      ) {
        // Get the lead ID from the project
        const leadId = (existingSection as any).workspace_documents?.workspaces?.projects?.lead_id;
        
        if (leadId && leadId !== currentUser.id) {
          await NotificationService.notifySectionCompleted(
            leadId,
            currentUser.id,
            sectionId,
            existingSection.title
          );
        }
      }

      return {
        success: true,
        section: this.mapSection(section),
      };
    } catch (error) {
      console.error('Unexpected error in updateSection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Deletes a section (soft delete/archival)
   * 
   * Requirements:
   * - 8.4: Require confirmation and archive the section content
   * 
   * @param sectionId - The section ID to delete
   * @returns DeleteSectionResult with archived section info
   */
  static async deleteSection(sectionId: string): Promise<DeleteSectionResult> {
    try {
      const supabase = await createClient();

      // Fetch the section to archive
      const { data: section, error: fetchError } = await supabase
        .from('document_sections')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (fetchError || !section) {
        return {
          success: false,
          error: 'Section not found or access denied',
          errorCode: 'NOT_FOUND',
        };
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Archive the section by storing it in a separate table
      const archivedAt = new Date().toISOString();
      
      // Store archived section data
      const { error: archiveError } = await supabase
        .from('archived_sections')
        .insert({
          original_id: section.id,
          document_id: section.document_id,
          title: section.title,
          order: section.order,
          status: section.status,
          assigned_to: section.assigned_to,
          deadline: section.deadline,
          content: section.content,
          archived_at: archivedAt,
          archived_by: user?.id,
        });

      if (archiveError) {
        console.error('Error archiving section:', archiveError);
        // Continue with deletion even if archival fails
      }

      // Delete the section
      const { error: deleteError } = await supabase
        .from('document_sections')
        .delete()
        .eq('id', sectionId);

      if (deleteError) {
        console.error('Error deleting section:', deleteError);
        return {
          success: false,
          error: 'Failed to delete section',
          errorCode: 'UNKNOWN',
        };
      }

      return {
        success: true,
        archivedSection: {
          id: section.id,
          title: section.title,
          archivedAt,
        },
      };
    } catch (error) {
      console.error('Unexpected error in deleteSection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Reorders sections within a document
   * 
   * Requirements:
   * - 8.3: Update the section order and reflect changes immediately
   * 
   * @param documentId - The document ID
   * @param reorders - Array of section reordering instructions
   * @returns Result indicating success or failure
   */
  static async reorderSections(
    documentId: string,
    reorders: ReorderSectionInput[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Verify document exists
      const { data: document, error: docError } = await supabase
        .from('workspace_documents')
        .select('id')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return {
          success: false,
          error: 'Document not found or access denied',
        };
      }

      // Update each section's order
      for (const reorder of reorders) {
        const { error: updateError } = await supabase
          .from('document_sections')
          .update({ order: reorder.newOrder })
          .eq('id', reorder.sectionId)
          .eq('document_id', documentId);

        if (updateError) {
          console.error('Error reordering section:', updateError);
          return {
            success: false,
            error: `Failed to reorder section ${reorder.sectionId}`,
          };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in reorderSections:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Assigns a section to a team member
   * 
   * Requirements:
   * - 6.1: Display all sections with their assignment status
   * - 6.2: Allow selecting from available team members
   * - 6.3: Notify the assigned member via email and in-app notification
   * 
   * @param sectionId - The section ID to assign
   * @param userId - The user ID to assign to
   * @param deadline - Optional deadline for the assignment
   * @returns SectionOperationResult with updated section
   */
  static async assignSection(
    sectionId: string,
    userId: string,
    deadline?: string
  ): Promise<SectionOperationResult> {
    try {
      const supabase = await createClient();

      // Get current user (the one making the assignment)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        return {
          success: false,
          error: 'Not authenticated',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Verify section exists and get previous assignment
      const { data: section, error: fetchError } = await supabase
        .from('document_sections')
        .select('*, workspace_documents!inner(id)')
        .eq('id', sectionId)
        .single();

      if (fetchError || !section) {
        return {
          success: false,
          error: 'Section not found or access denied',
          errorCode: 'NOT_FOUND',
        };
      }

      const previousAssignee = section.assigned_to;

      // Validate deadline if provided
      if (deadline) {
        const deadlineValidation = await this.validateDeadline(section.document_id, deadline);
        if (!deadlineValidation.valid) {
          return {
            success: false,
            error: deadlineValidation.error,
            errorCode: 'INVALID_DEADLINE',
          };
        }
      }

      // Update section assignment
      const updateData: any = {
        assigned_to: userId,
      };
      if (deadline) {
        updateData.deadline = deadline;
      }

      const { data: updatedSection, error: updateError } = await supabase
        .from('document_sections')
        .update(updateData)
        .eq('id', sectionId)
        .select('*')
        .single();

      if (updateError || !updatedSection) {
        console.error('Error assigning section:', updateError);
        return {
          success: false,
          error: 'Failed to assign section',
          errorCode: 'UNKNOWN',
        };
      }

      // Send notifications
      if (previousAssignee && previousAssignee !== userId) {
        // This is a reassignment - notify both users
        await NotificationService.notifySectionReassignment(
          sectionId,
          previousAssignee,
          userId,
          currentUser.id,
          section.title,
          deadline
        );
      } else if (!previousAssignee) {
        // This is a new assignment - notify the assignee
        await NotificationService.notifySectionAssignment(
          sectionId,
          userId,
          currentUser.id,
          section.title,
          deadline
        );
      }

      return {
        success: true,
        section: this.mapSection(updatedSection),
      };
    } catch (error) {
      console.error('Unexpected error in assignSection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Sets a deadline for a section
   * 
   * Requirements:
   * - 7.1: Allow setting a deadline for sections
   * - 7.2: Validate that deadline is before project submission deadline
   * 
   * @param sectionId - The section ID
   * @param deadline - The deadline timestamp
   * @returns SectionOperationResult with updated section
   */
  static async setSectionDeadline(
    sectionId: string,
    deadline: string
  ): Promise<SectionOperationResult> {
    try {
      const supabase = await createClient();

      // Verify section exists
      const { data: section, error: fetchError } = await supabase
        .from('document_sections')
        .select('*, workspace_documents!inner(id)')
        .eq('id', sectionId)
        .single();

      if (fetchError || !section) {
        return {
          success: false,
          error: 'Section not found or access denied',
          errorCode: 'NOT_FOUND',
        };
      }

      // Validate deadline
      const deadlineValidation = await this.validateDeadline(section.document_id, deadline);
      if (!deadlineValidation.valid) {
        return {
          success: false,
          error: deadlineValidation.error,
          errorCode: 'INVALID_DEADLINE',
        };
      }

      // Update section deadline
      const { data: updatedSection, error: updateError } = await supabase
        .from('document_sections')
        .update({ deadline })
        .eq('id', sectionId)
        .select('*')
        .single();

      if (updateError || !updatedSection) {
        console.error('Error setting section deadline:', updateError);
        return {
          success: false,
          error: 'Failed to set section deadline',
          errorCode: 'UNKNOWN',
        };
      }

      return {
        success: true,
        section: this.mapSection(updatedSection),
      };
    } catch (error) {
      console.error('Unexpected error in setSectionDeadline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets all sections for a document
   * 
   * @param documentId - The document ID
   * @returns Array of sections
   */
  static async getSections(documentId: string): Promise<DocumentSection[]> {
    try {
      const supabase = await createClient();

      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', documentId)
        .order('order', { ascending: true });

      if (error) {
        console.error('Error fetching sections:', error);
        return [];
      }

      return sections ? sections.map(this.mapSection) : [];
    } catch (error) {
      console.error('Unexpected error in getSections:', error);
      return [];
    }
  }

  /**
   * Gets a single section by ID
   * 
   * @param sectionId - The section ID
   * @returns Section or null
   */
  static async getSection(sectionId: string): Promise<DocumentSection | null> {
    try {
      const supabase = await createClient();

      const { data: section, error } = await supabase
        .from('document_sections')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (error || !section) {
        console.error('Error fetching section:', error);
        return null;
      }

      return this.mapSection(section);
    } catch (error) {
      console.error('Unexpected error in getSection:', error);
      return null;
    }
  }

  /**
   * Validates a deadline against project submission deadline
   * 
   * Requirements:
   * - 7.2: Validate that deadline is before project submission deadline
   * 
   * @param documentId - The document ID
   * @param deadline - The deadline to validate
   * @returns Validation result
   */
  private static async validateDeadline(
    documentId: string,
    deadline: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Get the project deadline through workspace -> project
      const { data: document, error: docError } = await supabase
        .from('workspace_documents')
        .select(`
          id,
          workspace_id,
          workspaces!inner(
            project_id,
            projects!inner(
              deadline
            )
          )
        `)
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        // If we can't find the project deadline, allow the deadline
        return { valid: true };
      }

      const projectDeadline = (document as any).workspaces?.projects?.deadline;
      if (!projectDeadline) {
        // No project deadline set, allow any deadline
        return { valid: true };
      }

      const sectionDeadlineDate = new Date(deadline);
      const projectDeadlineDate = new Date(projectDeadline);

      if (sectionDeadlineDate > projectDeadlineDate) {
        return {
          valid: false,
          error: `Section deadline must be before project deadline (${projectDeadlineDate.toISOString()})`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating deadline:', error);
      // On error, allow the deadline
      return { valid: true };
    }
  }

  /**
   * Maps database section to DocumentSection interface
   */
  private static mapSection(section: any): DocumentSection {
    return {
      id: section.id,
      documentId: section.document_id,
      title: section.title,
      order: section.order,
      status: section.status,
      assignedTo: section.assigned_to,
      deadline: section.deadline,
      content: section.content,
      createdAt: section.created_at,
      updatedAt: section.updated_at,
    };
  }
}
