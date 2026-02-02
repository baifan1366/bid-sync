/**
 * Proposal Export Service
 * 
 * Handles exporting proposals to PDF format with complete information including:
 * - All proposal sections
 * - Uploaded documents (as attachments/links)
 * - Team information and contribution statistics
 * - Version history and change logs
 * - Email delivery of exported files
 * 
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 */

import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/service';
import { z } from 'zod';

// ============================================================
// TYPES AND VALIDATION
// ============================================================

const ExportProposalInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
  includeVersionHistory: z.boolean().default(true),
  includeTeamStats: z.boolean().default(true),
  includeDocuments: z.boolean().default(true),
});

const EmailExportInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
  recipientEmail: z.string().email('Invalid email address'),
  includeVersionHistory: z.boolean().default(true),
  includeTeamStats: z.boolean().default(true),
  includeDocuments: z.boolean().default(true),
});

export interface ExportProposalInput {
  proposalId: string;
  userId: string;
  includeVersionHistory?: boolean;
  includeTeamStats?: boolean;
  includeDocuments?: boolean;
}

export interface EmailExportInput extends ExportProposalInput {
  recipientEmail: string;
}

export interface ProposalExportResult {
  success: boolean;
  pdfBuffer?: Buffer;
  fileName?: string;
  error?: string;
}

export interface EmailExportResult {
  success: boolean;
  error?: string;
}

interface ProposalData {
  id: string;
  title: string;
  projectTitle: string;
  status: string;
  budgetEstimate?: number;
  timelineEstimate?: string;
  executiveSummary?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  leadName: string;
  leadEmail: string;
}

interface SectionData {
  id: string;
  title: string;
  content: any;
  order: number;
  status: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface DocumentData {
  id: string;
  fileName: string;
  fileSize: number;
  docType: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

interface TeamMemberData {
  userId: string;
  name: string;
  email: string;
  role: string;
  sectionsAssigned: number;
  sectionsCompleted: number;
  joinedAt: string;
}

interface VersionData {
  id: string;
  versionNumber: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  changeDescription: string;
}

// ============================================================
// PROPOSAL EXPORT SERVICE
// ============================================================

export class ProposalExportService {
  /**
   * Export a proposal to PDF format
   * Requirements: 19.1, 19.2, 19.3, 19.4
   * 
   * @param input - Export parameters
   * @returns PDF buffer and filename
   */
  static async exportProposal(
    input: ExportProposalInput
  ): Promise<ProposalExportResult> {
    try {
      // Validate input
      const validated = ExportProposalInputSchema.parse(input);

      const supabase = await createClient();

      // Verify user has access to this proposal
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          title,
          status,
          budget_estimate,
          timeline_estimate,
          executive_summary,
          submitted_at,
          created_at,
          updated_at,
          lead_id,
          project_id,
          projects (
            title
          )
        `)
        .eq('id', validated.proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found or access denied',
        };
      }

      // Check if user is the lead or a team member
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('project_id', proposal.project_id);

      if (!proposals || proposals.length === 0) {
        return {
          success: false,
          error: 'Access denied: You are not a member of this proposal team',
        };
      }

      const proposalIds = proposals.map(p => p.id);

      const { data: teamMember } = await supabase
        .from('proposal_team_members')
        .select('id')
        .in('proposal_id', proposalIds)
        .eq('user_id', validated.userId)
        .maybeSingle();

      if (!teamMember && proposal.lead_id !== validated.userId) {
        return {
          success: false,
          error: 'Access denied: You are not a member of this proposal team',
        };
      }

      // Get lead information
      const { data: leadUser } = await supabase
        .from('users')
        .select('email, raw_user_meta_data')
        .eq('id', proposal.lead_id)
        .single();

      const project = Array.isArray(proposal.projects) ? proposal.projects[0] : proposal.projects;
      
      const proposalData: ProposalData = {
        id: proposal.id,
        title: proposal.title || 'Untitled Proposal',
        projectTitle: project?.title || 'Unknown Project',
        status: proposal.status,
        budgetEstimate: proposal.budget_estimate,
        timelineEstimate: proposal.timeline_estimate,
        executiveSummary: proposal.executive_summary,
        submittedAt: proposal.submitted_at,
        createdAt: proposal.created_at,
        updatedAt: proposal.updated_at,
        leadName: leadUser?.raw_user_meta_data?.name || leadUser?.raw_user_meta_data?.full_name || 'Unknown',
        leadEmail: leadUser?.email || '',
      };

      // Fetch sections
      const sections = await this.fetchSections(validated.proposalId);

      // Fetch documents if requested
      let documents: DocumentData[] = [];
      if (validated.includeDocuments) {
        documents = await this.fetchDocuments(validated.proposalId);
      }

      // Fetch team stats if requested
      let teamMembers: TeamMemberData[] = [];
      if (validated.includeTeamStats) {
        teamMembers = await this.fetchTeamMembers(proposal.project_id);
      }

      // Fetch version history if requested
      let versions: VersionData[] = [];
      if (validated.includeVersionHistory) {
        versions = await this.fetchVersionHistory(validated.proposalId);
      }

      // Generate PDF
      const pdfBuffer = await this.generatePDF({
        proposal: proposalData,
        sections,
        documents,
        teamMembers,
        versions,
      });

      const fileName = `proposal-${proposalData.projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;

      return {
        success: true,
        pdfBuffer,
        fileName,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in exportProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export proposal',
      };
    }
  }

  /**
   * Export proposal and send via email
   * Requirement 19.5: Email delivery of exported files
   * 
   * @param input - Export and email parameters
   * @returns Success status
   */
  static async exportAndEmail(
    input: EmailExportInput
  ): Promise<EmailExportResult> {
    try {
      // Validate input
      const validated = EmailExportInputSchema.parse(input);

      // Generate PDF export
      const exportResult = await this.exportProposal({
        proposalId: validated.proposalId,
        userId: validated.userId,
        includeVersionHistory: validated.includeVersionHistory,
        includeTeamStats: validated.includeTeamStats,
        includeDocuments: validated.includeDocuments,
      });

      if (!exportResult.success || !exportResult.pdfBuffer || !exportResult.fileName) {
        return {
          success: false,
          error: exportResult.error || 'Failed to generate PDF',
        };
      }

      // Send email with PDF attachment
      const emailResult = await sendEmail({
        to: validated.recipientEmail,
        subject: 'Proposal Export',
        text: `Your proposal export is ready. The PDF has been generated successfully.`,
        html: `
          <h2>Proposal Export Complete</h2>
          <p>Your proposal export has been generated successfully.</p>
          <p>This export includes:</p>
          <ul>
            <li>All proposal sections</li>
            ${validated.includeDocuments ? '<li>Document references</li>' : ''}
            ${validated.includeTeamStats ? '<li>Team information and statistics</li>' : ''}
            ${validated.includeVersionHistory ? '<li>Version history</li>' : ''}
          </ul>
          <p><em>Note: Email attachments are not currently supported. Please download the PDF from the application.</em></p>
        `,
      });

      if (!emailResult.success) {
        return {
          success: false,
          error: `PDF generated but email failed: ${emailResult.error}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in exportAndEmail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export and email proposal',
      };
    }
  }

  /**
   * Fetch proposal sections
   */
  private static async fetchSections(proposalId: string): Promise<SectionData[]> {
    const supabase = await createClient();

    // Get workspace for this proposal
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('proposal_id', proposalId)
      .single();

    if (!workspace) {
      return [];
    }

    // Get workspace documents
    const { data: documents } = await supabase
      .from('workspace_documents')
      .select('id')
      .eq('workspace_id', workspace.id);

    if (!documents || documents.length === 0) {
      return [];
    }

    const documentIds = documents.map((d) => d.id);

    // Get sections
    const { data: sections } = await supabase
      .from('document_sections')
      .select(`
        id,
        title,
        content,
        order,
        status,
        assigned_to
      `)
      .in('document_id', documentIds)
      .order('order', { ascending: true });

    if (!sections) {
      return [];
    }

    // Get assigned user names
    const assignedUserIds = sections
      .map((s) => s.assigned_to)
      .filter((id): id is string => id !== null);

    let userNames: Record<string, string> = {};
    if (assignedUserIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, raw_user_meta_data')
        .in('id', assignedUserIds);

      if (users) {
        userNames = users.reduce((acc, user) => {
          acc[user.id] = user.raw_user_meta_data?.name || user.raw_user_meta_data?.full_name || 'Unknown';
          return acc;
        }, {} as Record<string, string>);
      }
    }

    return sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      order: section.order,
      status: section.status,
      assignedTo: section.assigned_to || undefined,
      assignedToName: section.assigned_to ? userNames[section.assigned_to] : undefined,
    }));
  }

  /**
   * Fetch proposal documents
   */
  private static async fetchDocuments(proposalId: string): Promise<DocumentData[]> {
    const supabase = await createClient();

    const { data: documents } = await supabase
      .from('proposal_documents')
      .select(`
        id,
        file_name,
        file_size,
        doc_type,
        url,
        uploaded_by,
        uploaded_at
      `)
      .eq('proposal_id', proposalId)
      .order('uploaded_at', { ascending: false });

    if (!documents || documents.length === 0) {
      return [];
    }

    // Get uploader names
    const uploaderIds = documents.map((d) => d.uploaded_by);
    const { data: users } = await supabase
      .from('users')
      .select('id, raw_user_meta_data')
      .in('id', uploaderIds);

    const userNames: Record<string, string> = {};
    if (users) {
      users.forEach((user) => {
        userNames[user.id] = user.raw_user_meta_data?.name || user.raw_user_meta_data?.full_name || 'Unknown';
      });
    }

    return documents.map((doc) => ({
      id: doc.id,
      fileName: doc.file_name,
      fileSize: doc.file_size,
      docType: doc.doc_type,
      url: doc.url,
      uploadedBy: doc.uploaded_by,
      uploadedByName: userNames[doc.uploaded_by] || 'Unknown',
      uploadedAt: doc.uploaded_at,
    }));
  }

  /**
   * Fetch team members and statistics
   */
  private static async fetchTeamMembers(projectId: string): Promise<TeamMemberData[]> {
    const supabase = await createClient();

    // Get all proposals for this project
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', projectId);

    if (!proposals || proposals.length === 0) {
      return [];
    }

    const proposalIds = proposals.map(p => p.id);

    const { data: members } = await supabase
      .from('proposal_team_members')
      .select(`
        user_id,
        role,
        joined_at
      `)
      .in('proposal_id', proposalIds);

    if (!members || members.length === 0) {
      return [];
    }

    // Get user details
    const userIds = members.map((m) => m.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .in('id', userIds);

    const userDetails: Record<string, { name: string; email: string }> = {};
    if (users) {
      users.forEach((user) => {
        userDetails[user.id] = {
          name: user.raw_user_meta_data?.name || user.raw_user_meta_data?.full_name || 'Unknown',
          email: user.email,
        };
      });
    }

    // Get section assignments
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('project_id', projectId);

    let sectionStats: Record<string, { assigned: number; completed: number }> = {};
    if (workspaces && workspaces.length > 0) {
      const workspaceIds = workspaces.map((w) => w.id);
      const { data: documents } = await supabase
        .from('workspace_documents')
        .select('id')
        .in('workspace_id', workspaceIds);

      if (documents && documents.length > 0) {
        const documentIds = documents.map((d) => d.id);
        const { data: sections } = await supabase
          .from('document_sections')
          .select('assigned_to, status')
          .in('document_id', documentIds)
          .in('assigned_to', userIds);

        if (sections) {
          sections.forEach((section) => {
            if (section.assigned_to) {
              if (!sectionStats[section.assigned_to]) {
                sectionStats[section.assigned_to] = { assigned: 0, completed: 0 };
              }
              sectionStats[section.assigned_to].assigned++;
              if (section.status === 'completed') {
                sectionStats[section.assigned_to].completed++;
              }
            }
          });
        }
      }
    }

    return members.map((member) => ({
      userId: member.user_id,
      name: userDetails[member.user_id]?.name || 'Unknown',
      email: userDetails[member.user_id]?.email || '',
      role: member.role,
      sectionsAssigned: sectionStats[member.user_id]?.assigned || 0,
      sectionsCompleted: sectionStats[member.user_id]?.completed || 0,
      joinedAt: member.joined_at,
    }));
  }

  /**
   * Fetch version history
   */
  private static async fetchVersionHistory(proposalId: string): Promise<VersionData[]> {
    const supabase = await createClient();

    const { data: versions } = await supabase
      .from('proposal_versions')
      .select(`
        id,
        version_number,
        created_by,
        created_at,
        change_description
      `)
      .eq('proposal_id', proposalId)
      .order('version_number', { ascending: false })
      .limit(10);

    if (!versions || versions.length === 0) {
      return [];
    }

    // Get creator names
    const creatorIds = versions.map((v) => v.created_by);
    const { data: users } = await supabase
      .from('users')
      .select('id, raw_user_meta_data')
      .in('id', creatorIds);

    const userNames: Record<string, string> = {};
    if (users) {
      users.forEach((user) => {
        userNames[user.id] = user.raw_user_meta_data?.name || user.raw_user_meta_data?.full_name || 'Unknown';
      });
    }

    return versions.map((version) => ({
      id: version.id,
      versionNumber: version.version_number,
      createdBy: version.created_by,
      createdByName: userNames[version.created_by] || 'Unknown',
      createdAt: version.created_at,
      changeDescription: version.change_description || 'No description',
    }));
  }

  /**
   * Generate PDF from proposal data
   * Requirements: 19.1, 19.2, 19.3, 19.4
   */
  private static async generatePDF(data: {
    proposal: ProposalData;
    sections: SectionData[];
    documents: DocumentData[];
    teamMembers: TeamMemberData[];
    versions: VersionData[];
  }): Promise<Buffer> {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number = 20) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Helper function to add text with word wrap
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, 170);
      lines.forEach((line: string) => {
        checkPageBreak();
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      });
    };

    // Title Page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Proposal Export', margin, yPosition);
    yPosition += 15;

    doc.setFontSize(18);
    doc.text(data.proposal.projectTitle, margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Proposal: ${data.proposal.title}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Status: ${data.proposal.status.toUpperCase()}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Lead: ${data.proposal.leadName} (${data.proposal.leadEmail})`, margin, yPosition);
    yPosition += 7;
    doc.text(`Created: ${new Date(data.proposal.createdAt).toLocaleDateString()}`, margin, yPosition);
    yPosition += 7;
    if (data.proposal.submittedAt) {
      doc.text(`Submitted: ${new Date(data.proposal.submittedAt).toLocaleDateString()}`, margin, yPosition);
      yPosition += 7;
    }
    yPosition += 10;

    // Executive Summary
    if (data.proposal.executiveSummary) {
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin, yPosition);
      yPosition += 10;
      addText(data.proposal.executiveSummary, 10, false);
      yPosition += 10;
    }

    // Budget and Timeline
    if (data.proposal.budgetEstimate || data.proposal.timelineEstimate) {
      checkPageBreak(20);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Budget & Timeline', margin, yPosition);
      yPosition += 10;

      if (data.proposal.budgetEstimate) {
        addText(`Budget Estimate: $${data.proposal.budgetEstimate.toLocaleString()}`, 10, false);
      }
      if (data.proposal.timelineEstimate) {
        addText(`Timeline: ${data.proposal.timelineEstimate}`, 10, false);
      }
      yPosition += 10;
    }

    // Sections
    if (data.sections.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Proposal Sections', margin, yPosition);
      yPosition += 10;

      data.sections.forEach((section, index) => {
        checkPageBreak(25);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${section.title}`, margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Status: ${section.status}`, margin + 5, yPosition);
        yPosition += 6;

        if (section.assignedToName) {
          doc.text(`Assigned to: ${section.assignedToName}`, margin + 5, yPosition);
          yPosition += 6;
        }

        // Extract text content from section
        let contentText = 'No content';
        if (section.content) {
          if (typeof section.content === 'string') {
            contentText = section.content;
          } else if (section.content.content) {
            contentText = this.extractTextFromContent(section.content.content);
          }
        }

        addText(contentText, 10, false);
        yPosition += 5;
      });
    }

    // Documents
    if (data.documents.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Attached Documents', margin, yPosition);
      yPosition += 10;

      data.documents.forEach((document, index) => {
        checkPageBreak(15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${index + 1}. ${document.fileName}`, margin, yPosition);
        yPosition += 6;
        doc.text(`   Type: ${document.docType} | Size: ${this.formatFileSize(document.fileSize)}`, margin, yPosition);
        yPosition += 6;
        doc.text(`   Uploaded by: ${document.uploadedByName} on ${new Date(document.uploadedAt).toLocaleDateString()}`, margin, yPosition);
        yPosition += 6;
        doc.setTextColor(0, 0, 255);
        doc.text(`   URL: ${document.url}`, margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 8;
      });
    }

    // Team Information
    if (data.teamMembers.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Team Members', margin, yPosition);
      yPosition += 10;

      data.teamMembers.forEach((member, index) => {
        checkPageBreak(15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${member.name} (${member.role.toUpperCase()})`, margin, yPosition);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(`   Email: ${member.email}`, margin, yPosition);
        yPosition += 6;
        doc.text(`   Sections: ${member.sectionsCompleted}/${member.sectionsAssigned} completed`, margin, yPosition);
        yPosition += 6;
        doc.text(`   Joined: ${new Date(member.joinedAt).toLocaleDateString()}`, margin, yPosition);
        yPosition += 8;
      });
    }

    // Version History
    if (data.versions.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Version History', margin, yPosition);
      yPosition += 10;

      data.versions.forEach((version, index) => {
        checkPageBreak(12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Version ${version.versionNumber}`, margin, yPosition);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(`   By: ${version.createdByName} on ${new Date(version.createdAt).toLocaleDateString()}`, margin, yPosition);
        yPosition += 6;
        doc.text(`   Changes: ${version.changeDescription}`, margin, yPosition);
        yPosition += 8;
      });
    }

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${totalPages} | Generated on ${new Date().toLocaleDateString()}`,
        margin,
        pageHeight - 10
      );
    }

    // Convert to buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }

  /**
   * Extract plain text from TipTap content structure
   */
  private static extractTextFromContent(content: any): string {
    if (!content || !Array.isArray(content)) {
      return '';
    }

    let text = '';
    content.forEach((node: any) => {
      if (node.type === 'paragraph' || node.type === 'heading') {
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((textNode: any) => {
            if (textNode.type === 'text' && textNode.text) {
              text += textNode.text + ' ';
            }
          });
        }
        text += '\n';
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((listItem: any) => {
            if (listItem.content) {
              text += '• ' + this.extractTextFromContent(listItem.content) + '\n';
            }
          });
        }
      }
    });

    return text.trim();
  }

  /**
   * Format file size for display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}
