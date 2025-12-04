/**
 * Deadline Reminder Service
 * 
 * Handles deadline calculations and reminder notifications for projects and sections.
 * 
 * Implements requirements from notification-system spec:
 * - 9.1: Project deadline reminders (7 days)
 * - 9.2: Awarded project deadline reminders (7 days)
 * - 9.3: Section deadline reminders (3 days)
 * - 9.4: Include days remaining in notifications
 * - 9.5: Send both in-app and email notifications
 */

import { createClient } from '@/lib/supabase/server';
import { NotificationService, NotificationPriority } from '@/lib/notification-service';

export interface DeadlineReminderResult {
  success: boolean;
  projectReminders: number;
  sectionReminders: number;
  errors: string[];
}

/**
 * DeadlineReminderService class for managing deadline reminders
 */
export class DeadlineReminderService {
  /**
   * Sends reminders for all approaching deadlines
   * 
   * This is the main entry point called by cron jobs
   * 
   * @returns Result with counts of reminders sent
   */
  static async sendAllDeadlineReminders(): Promise<DeadlineReminderResult> {
    const errors: string[] = [];
    let projectReminders = 0;
    let sectionReminders = 0;

    try {
      // Send project deadline reminders
      const projectResult = await this.sendProjectDeadlineReminders();
      projectReminders = projectResult.remindersSent;
      errors.push(...projectResult.errors);

      // Send section deadline reminders
      const sectionResult = await this.sendSectionDeadlineReminders();
      sectionReminders = sectionResult.remindersSent;
      errors.push(...sectionResult.errors);

      return {
        success: errors.length === 0,
        projectReminders,
        sectionReminders,
        errors,
      };
    } catch (error) {
      console.error('Error in sendAllDeadlineReminders:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        projectReminders,
        sectionReminders,
        errors,
      };
    }
  }

  /**
   * Sends deadline reminders for projects
   * 
   * Requirements:
   * - 9.1: Notify project client daily when deadline is within 7 days
   * - 9.2: Notify all team members daily for awarded projects within 7 days
   * - 9.4: Include days remaining in notification
   * - 9.5: Send both in-app and email notifications
   * 
   * @returns Result with count of reminders sent
   */
  static async sendProjectDeadlineReminders(): Promise<{
    remindersSent: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let remindersSent = 0;

    try {
      const supabase = await createClient();

      // Calculate date 7 days from now
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      sevenDaysFromNow.setHours(23, 59, 59, 999); // End of day

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day

      // Requirement 9.1: Get projects with deadlines within 7 days
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          title,
          deadline,
          client_id,
          status
        `)
        .not('deadline', 'is', null)
        .gte('deadline', today.toISOString().split('T')[0])
        .lte('deadline', sevenDaysFromNow.toISOString().split('T')[0])
        .in('status', ['open', 'awarded']);

      if (projectsError) {
        console.error('Error fetching projects for deadline reminders:', projectsError);
        errors.push(`Failed to fetch projects: ${projectsError.message}`);
        return { remindersSent, errors };
      }

      if (!projects || projects.length === 0) {
        return { remindersSent, errors };
      }

      // Process each project
      for (const project of projects) {
        try {
          const daysRemaining = this.calculateDaysRemaining(project.deadline);

          // Requirement 9.1: Notify project client
          await NotificationService.createNotification({
            userId: project.client_id,
            type: 'project_deadline_approaching',
            title: 'Project Deadline Approaching',
            body: `Your project "${project.title}" is due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`,
            data: {
              projectId: project.id,
              projectTitle: project.title,
              deadline: project.deadline,
              daysRemaining,
            },
            sendEmail: true, // Requirement 9.5: Send email
            priority: daysRemaining <= 2 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          });
          remindersSent++;

          // Requirement 9.2: If project is awarded, notify all team members
          if (project.status === 'awarded') {
            const teamResult = await this.notifyProjectTeamMembers(
              project.id,
              project.title,
              project.deadline,
              daysRemaining
            );
            remindersSent += teamResult.remindersSent;
            errors.push(...teamResult.errors);
          }
        } catch (error) {
          console.error(`Error sending reminder for project ${project.id}:`, error);
          errors.push(`Project ${project.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { remindersSent, errors };
    } catch (error) {
      console.error('Error in sendProjectDeadlineReminders:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { remindersSent, errors };
    }
  }

  /**
   * Sends deadline reminders for document sections
   * 
   * Requirements:
   * - 9.3: Notify assigned team member daily when section deadline is within 3 days
   * - 9.4: Include days remaining in notification
   * - 9.5: Send both in-app and email notifications
   * 
   * @returns Result with count of reminders sent
   */
  static async sendSectionDeadlineReminders(): Promise<{
    remindersSent: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let remindersSent = 0;

    try {
      const supabase = await createClient();

      // Calculate date 3 days from now
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999); // End of day

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day

      // Requirement 9.3: Get sections with deadlines within 3 days that are assigned
      // Note: Sections are stored in the documents table as JSONB
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          sections,
          workspace_id
        `)
        .not('sections', 'is', null);

      if (documentsError) {
        console.error('Error fetching documents for section deadline reminders:', documentsError);
        errors.push(`Failed to fetch documents: ${documentsError.message}`);
        return { remindersSent, errors };
      }

      if (!documents || documents.length === 0) {
        return { remindersSent, errors };
      }

      // Process each document's sections
      for (const document of documents) {
        try {
          const sections = document.sections as any[] || [];

          for (const section of sections) {
            // Check if section has a deadline and is assigned
            if (!section.deadline || !section.assignedTo) {
              continue;
            }

            const sectionDeadline = new Date(section.deadline);
            
            // Check if deadline is within 3 days
            if (sectionDeadline >= today && sectionDeadline <= threeDaysFromNow) {
              const daysRemaining = this.calculateDaysRemaining(section.deadline);

              // Requirement 9.3, 9.4, 9.5: Notify assigned team member
              await NotificationService.createNotification({
                userId: section.assignedTo,
                type: 'section_deadline_approaching',
                title: 'Section Deadline Approaching',
                body: `Your assigned section "${section.title}" in document "${document.title}" is due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`,
                data: {
                  documentId: document.id,
                  documentTitle: document.title,
                  sectionId: section.id,
                  sectionTitle: section.title,
                  deadline: section.deadline,
                  daysRemaining,
                  workspaceId: document.workspace_id,
                },
                sendEmail: true, // Requirement 9.5: Send email
                priority: daysRemaining <= 1 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
              });
              remindersSent++;
            }
          }
        } catch (error) {
          console.error(`Error processing sections for document ${document.id}:`, error);
          errors.push(`Document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { remindersSent, errors };
    } catch (error) {
      console.error('Error in sendSectionDeadlineReminders:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { remindersSent, errors };
    }
  }

  /**
   * Notifies all team members of an awarded project about approaching deadline
   * 
   * Requirements:
   * - 9.2: Notify all team members for awarded projects
   * - 9.4: Include days remaining in notification
   * - 9.5: Send both in-app and email notifications
   * 
   * @private
   */
  private static async notifyProjectTeamMembers(
    projectId: string,
    projectTitle: string,
    deadline: string,
    daysRemaining: number
  ): Promise<{
    remindersSent: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let remindersSent = 0;

    try {
      const supabase = await createClient();

      // Get the awarded proposal for this project
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, lead_id')
        .eq('project_id', projectId)
        .eq('status', 'approved')
        .single();

      if (proposalError || !proposal) {
        // No awarded proposal found, skip team notifications
        return { remindersSent, errors };
      }

      // Get all team members for this proposal
      const { data: teamMembers, error: teamError } = await supabase
        .from('proposal_team_members')
        .select('user_id')
        .eq('proposal_id', proposal.id);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
        errors.push(`Failed to fetch team members: ${teamError.message}`);
        return { remindersSent, errors };
      }

      if (!teamMembers || teamMembers.length === 0) {
        return { remindersSent, errors };
      }

      // Notify each team member
      for (const member of teamMembers) {
        try {
          // Requirement 9.2, 9.4, 9.5: Notify team member
          await NotificationService.createNotification({
            userId: member.user_id,
            type: 'project_deadline_approaching',
            title: 'Project Deadline Approaching',
            body: `The project "${projectTitle}" you're working on is due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}.`,
            data: {
              projectId,
              projectTitle,
              deadline,
              daysRemaining,
              proposalId: proposal.id,
            },
            sendEmail: true, // Requirement 9.5: Send email
            priority: daysRemaining <= 2 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          });
          remindersSent++;
        } catch (error) {
          console.error(`Error notifying team member ${member.user_id}:`, error);
          errors.push(`Team member ${member.user_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { remindersSent, errors };
    } catch (error) {
      console.error('Error in notifyProjectTeamMembers:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { remindersSent, errors };
    }
  }

  /**
   * Calculates days remaining until a deadline
   * 
   * Requirements:
   * - 9.4: Include days remaining in notifications
   * 
   * @param deadline - The deadline date string
   * @returns Number of days remaining (rounded up)
   */
  private static calculateDaysRemaining(deadline: string): number {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Never return negative days
  }
}
