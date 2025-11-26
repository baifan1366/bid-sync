/**
 * Compliance Service
 * 
 * Handles compliance checking for proposals before submission.
 * Implements requirements 11.1, 11.2, 11.3, 11.4, 11.5 from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';

export type ComplianceIssueType = 
  | 'missing_section' 
  | 'incomplete_section'
  | 'missing_document' 
  | 'invalid_budget' 
  | 'missing_info'
  | 'budget_out_of_range';

export type ComplianceSeverity = 'error' | 'warning';

export interface ComplianceIssue {
  type: ComplianceIssueType;
  severity: ComplianceSeverity;
  message: string;
  field?: string;
  sectionId?: string;
  sectionTitle?: string;
  documentType?: string;
  additionalInfoField?: string;
}

export interface ComplianceCheck {
  passed: boolean;
  issues: ComplianceIssue[];
  checkedAt: Date;
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    sectionsChecked: number;
    documentsChecked: number;
  };
}

export interface ProposalData {
  id: string;
  projectId: string;
  leadId: string;
  budgetEstimate?: number;
  additionalInfo?: Record<string, any>;
}

/**
 * ComplianceService class for validating proposal compliance
 */
export class ComplianceService {
  /**
   * Runs a comprehensive compliance check on a proposal
   * 
   * Requirements:
   * - 11.1: Validate all required sections are completed
   * - 11.2: Verify all required documents are uploaded
   * - 11.3: Validate budget estimates are within project range
   * - 11.4: Check that all client-specified additional info is provided
   * - 11.5: Display a detailed report with actionable items
   * 
   * @param proposalId - The proposal ID to check
   * @returns ComplianceCheck with detailed issues
   */
  static async runComplianceCheck(proposalId: string): Promise<ComplianceCheck> {
    const issues: ComplianceIssue[] = [];
    const checkedAt = new Date();

    try {
      const supabase = await createClient();

      // Get proposal with project details
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          lead_id,
          projects (
            id,
            title,
            budget,
            additional_info_requirements
          )
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        throw new Error('Proposal not found');
      }

      const project = proposal.projects as any;
      let sectionsChecked = 0;
      let documentsChecked = 0;

      // Get workspace for this proposal
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)
        .eq('lead_id', proposal.lead_id)
        .single();

      if (workspace) {
        // Requirement 11.1: Check section completeness
        const sectionIssues = await this.checkSectionCompleteness(
          workspace.id,
          supabase
        );
        issues.push(...sectionIssues);
        sectionsChecked = sectionIssues.length > 0 ? 
          sectionIssues.filter(i => i.type === 'incomplete_section' || i.type === 'missing_section').length : 
          0;
      }

      // Requirement 11.2: Check required documents
      const documentIssues = await this.checkRequiredDocuments(
        proposalId,
        supabase
      );
      issues.push(...documentIssues);
      documentsChecked = documentIssues.length;

      // Requirement 11.3: Check budget range
      if (project.budget) {
        const budgetIssues = await this.checkBudgetRange(
          proposalId,
          project.budget,
          supabase
        );
        issues.push(...budgetIssues);
      }

      // Requirement 11.4: Check additional info requirements
      if (project.additional_info_requirements) {
        const additionalInfoIssues = await this.checkAdditionalInfo(
          proposalId,
          project.additional_info_requirements,
          supabase
        );
        issues.push(...additionalInfoIssues);
      }

      // Calculate summary
      const errors = issues.filter(i => i.severity === 'error').length;
      const warnings = issues.filter(i => i.severity === 'warning').length;

      return {
        passed: errors === 0,
        issues,
        checkedAt,
        summary: {
          totalIssues: issues.length,
          errors,
          warnings,
          sectionsChecked,
          documentsChecked,
        },
      };
    } catch (error) {
      console.error('Error running compliance check:', error);
      
      // Return a failed check with system error
      return {
        passed: false,
        issues: [{
          type: 'missing_section',
          severity: 'error',
          message: error instanceof Error ? error.message : 'Unknown error during compliance check',
        }],
        checkedAt,
        summary: {
          totalIssues: 1,
          errors: 1,
          warnings: 0,
          sectionsChecked: 0,
          documentsChecked: 0,
        },
      };
    }
  }

  /**
   * Checks that all sections are completed
   * Requirement 11.1
   */
  private static async checkSectionCompleteness(
    workspaceId: string,
    supabase: any
  ): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    try {
      // Get all documents in the workspace
      const { data: documents } = await supabase
        .from('workspace_documents')
        .select('id, title')
        .eq('workspace_id', workspaceId);

      if (!documents || documents.length === 0) {
        issues.push({
          type: 'missing_section',
          severity: 'error',
          message: 'No proposal document found. Please create proposal sections.',
        });
        return issues;
      }

      // Check sections for each document
      for (const doc of documents) {
        const { data: sections } = await supabase
          .from('document_sections')
          .select('id, title, status, content')
          .eq('document_id', doc.id)
          .order('order');

        if (!sections || sections.length === 0) {
          issues.push({
            type: 'missing_section',
            severity: 'error',
            message: `Document "${doc.title}" has no sections. Please add sections to your proposal.`,
          });
          continue;
        }

        // Check each section for completion
        for (const section of sections) {
          // Check if section is not completed
          if (section.status !== 'completed') {
            issues.push({
              type: 'incomplete_section',
              severity: 'error',
              message: `Section "${section.title}" is not marked as completed (current status: ${section.status}).`,
              sectionId: section.id,
              sectionTitle: section.title,
            });
          }

          // Check if section has content
          const hasContent = section.content && 
            Object.keys(section.content).length > 0 &&
            JSON.stringify(section.content) !== '{}';

          if (!hasContent) {
            issues.push({
              type: 'incomplete_section',
              severity: 'error',
              message: `Section "${section.title}" has no content. Please add content before submission.`,
              sectionId: section.id,
              sectionTitle: section.title,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking section completeness:', error);
      issues.push({
        type: 'missing_section',
        severity: 'error',
        message: 'Failed to check section completeness',
      });
    }

    return issues;
  }

  /**
   * Checks that all required documents are uploaded
   * Requirement 11.2
   */
  private static async checkRequiredDocuments(
    proposalId: string,
    supabase: any
  ): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    try {
      // Get all documents for this proposal
      const { data: documents } = await supabase
        .from('documents')
        .select('id, doc_type, url')
        .eq('proposal_id', proposalId);

      // Define required document types (this could be made configurable per project)
      const requiredDocTypes = [
        'company_profile',
        'team_resumes',
        'references',
      ];

      const uploadedDocTypes = new Set(
        documents?.map((d: any) => d.doc_type).filter(Boolean) || []
      );

      // Check for missing required documents
      for (const requiredType of requiredDocTypes) {
        if (!uploadedDocTypes.has(requiredType)) {
          issues.push({
            type: 'missing_document',
            severity: 'error',
            message: `Required document type "${requiredType}" is missing. Please upload this document.`,
            documentType: requiredType,
          });
        }
      }

      // Check if there are any documents at all
      if (!documents || documents.length === 0) {
        issues.push({
          type: 'missing_document',
          severity: 'warning',
          message: 'No documents have been uploaded. Consider adding supporting documents to strengthen your proposal.',
        });
      }
    } catch (error) {
      console.error('Error checking required documents:', error);
      issues.push({
        type: 'missing_document',
        severity: 'error',
        message: 'Failed to check required documents',
      });
    }

    return issues;
  }

  /**
   * Checks that budget estimate is within project range
   * Requirement 11.3
   */
  private static async checkBudgetRange(
    proposalId: string,
    projectBudget: number,
    supabase: any
  ): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    try {
      // Get proposal budget estimate from content
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('id', proposalId)
        .single();

      if (!proposal) {
        return issues;
      }

      // Get workspace to check for budget in document content
      const { data: workspace } = await supabase
        .from('workspaces')
        .select(`
          id,
          workspace_documents (
            id,
            content
          )
        `)
        .eq('project_id', proposal.project_id)
        .single();

      if (!workspace) {
        issues.push({
          type: 'invalid_budget',
          severity: 'warning',
          message: 'No budget estimate found in proposal. Please include a budget breakdown.',
          field: 'budget',
        });
        return issues;
      }

      // Extract budget from document content (looking for budget field)
      let proposalBudget: number | null = null;
      const documents = (workspace as any).workspace_documents || [];
      
      for (const doc of documents) {
        if (doc.content && doc.content.budget) {
          proposalBudget = parseFloat(doc.content.budget);
          break;
        }
      }

      if (proposalBudget === null) {
        issues.push({
          type: 'invalid_budget',
          severity: 'warning',
          message: 'No budget estimate found in proposal. Please include a budget breakdown.',
          field: 'budget',
        });
        return issues;
      }

      // Check if budget is within acceptable range (e.g., ±20% of project budget)
      const minBudget = projectBudget * 0.8;
      const maxBudget = projectBudget * 1.2;

      if (proposalBudget < minBudget || proposalBudget > maxBudget) {
        issues.push({
          type: 'budget_out_of_range',
          severity: 'warning',
          message: `Budget estimate ($${proposalBudget.toLocaleString()}) is outside the expected range ($${minBudget.toLocaleString()} - $${maxBudget.toLocaleString()}). Project budget: $${projectBudget.toLocaleString()}.`,
          field: 'budget',
        });
      }

      // Check if budget is unreasonably low (less than 50% of project budget)
      if (proposalBudget < projectBudget * 0.5) {
        issues.push({
          type: 'invalid_budget',
          severity: 'error',
          message: `Budget estimate ($${proposalBudget.toLocaleString()}) is significantly lower than project budget ($${projectBudget.toLocaleString()}). Please review your budget calculation.`,
          field: 'budget',
        });
      }

      // Check if budget is unreasonably high (more than 150% of project budget)
      if (proposalBudget > projectBudget * 1.5) {
        issues.push({
          type: 'invalid_budget',
          severity: 'error',
          message: `Budget estimate ($${proposalBudget.toLocaleString()}) exceeds project budget ($${projectBudget.toLocaleString()}) by more than 50%. Please review your budget calculation.`,
          field: 'budget',
        });
      }
    } catch (error) {
      console.error('Error checking budget range:', error);
      issues.push({
        type: 'invalid_budget',
        severity: 'error',
        message: 'Failed to validate budget range',
        field: 'budget',
      });
    }

    return issues;
  }

  /**
   * Checks that all client-specified additional info is provided
   * Requirement 11.4
   */
  private static async checkAdditionalInfo(
    proposalId: string,
    requirements: any[],
    supabase: any
  ): Promise<ComplianceIssue[]> {
    const issues: ComplianceIssue[] = [];

    try {
      if (!Array.isArray(requirements) || requirements.length === 0) {
        return issues;
      }

      // Get proposal with workspace to check additional info
      const { data: proposal } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          lead_id
        `)
        .eq('id', proposalId)
        .single();

      if (!proposal) {
        return issues;
      }

      // Get workspace documents to check for additional info
      const { data: workspace } = await supabase
        .from('workspaces')
        .select(`
          id,
          workspace_documents (
            id,
            content
          )
        `)
        .eq('project_id', proposal.project_id)
        .eq('lead_id', proposal.lead_id)
        .single();

      // Collect all additional info from document content
      const providedInfo: Record<string, any> = {};
      if (workspace) {
        const documents = (workspace as any).workspace_documents || [];
        for (const doc of documents) {
          if (doc.content && doc.content.additionalInfo) {
            Object.assign(providedInfo, doc.content.additionalInfo);
          }
        }
      }

      // Check each required field
      for (const requirement of requirements) {
        const fieldName = requirement.fieldName || requirement.field_name;
        const isRequired = requirement.required !== false;
        const fieldType = requirement.fieldType || requirement.field_type || 'text';

        if (!isRequired) {
          continue; // Skip optional fields
        }

        const value = providedInfo[fieldName];

        // Check if required field is missing
        if (value === undefined || value === null || value === '') {
          issues.push({
            type: 'missing_info',
            severity: 'error',
            message: `Required additional information "${fieldName}" is missing. Please provide this information.`,
            field: fieldName,
            additionalInfoField: fieldName,
          });
          continue;
        }

        // Validate field type
        if (fieldType === 'number' && isNaN(Number(value))) {
          issues.push({
            type: 'missing_info',
            severity: 'error',
            message: `Additional information "${fieldName}" must be a number.`,
            field: fieldName,
            additionalInfoField: fieldName,
          });
        }

        if (fieldType === 'date') {
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            issues.push({
              type: 'missing_info',
              severity: 'error',
              message: `Additional information "${fieldName}" must be a valid date.`,
              field: fieldName,
              additionalInfoField: fieldName,
            });
          }
        }

        if (fieldType === 'file' && typeof value !== 'string') {
          issues.push({
            type: 'missing_info',
            severity: 'error',
            message: `Additional information "${fieldName}" must be a file URL.`,
            field: fieldName,
            additionalInfoField: fieldName,
          });
        }
      }
    } catch (error) {
      console.error('Error checking additional info:', error);
      issues.push({
        type: 'missing_info',
        severity: 'error',
        message: 'Failed to validate additional information requirements',
      });
    }

    return issues;
  }

  /**
   * Generates a human-readable compliance report
   * Requirement 11.5
   */
  static generateComplianceReport(check: ComplianceCheck): string {
    const { passed, issues, summary } = check;

    let report = '=== PROPOSAL COMPLIANCE REPORT ===\n\n';
    report += `Status: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    report += `Checked at: ${check.checkedAt.toLocaleString()}\n\n`;

    report += '--- Summary ---\n';
    report += `Total Issues: ${summary.totalIssues}\n`;
    report += `Errors: ${summary.errors}\n`;
    report += `Warnings: ${summary.warnings}\n`;
    report += `Sections Checked: ${summary.sectionsChecked}\n`;
    report += `Documents Checked: ${summary.documentsChecked}\n\n`;

    if (issues.length === 0) {
      report += '✓ No issues found. Proposal is ready for submission.\n';
      return report;
    }

    // Group issues by severity
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      report += '--- ERRORS (Must Fix Before Submission) ---\n';
      errors.forEach((issue, index) => {
        report += `${index + 1}. [${issue.type.toUpperCase()}] ${issue.message}\n`;
        if (issue.sectionTitle) {
          report += `   Section: ${issue.sectionTitle}\n`;
        }
        if (issue.field) {
          report += `   Field: ${issue.field}\n`;
        }
        report += '\n';
      });
    }

    if (warnings.length > 0) {
      report += '--- WARNINGS (Recommended to Address) ---\n';
      warnings.forEach((issue, index) => {
        report += `${index + 1}. [${issue.type.toUpperCase()}] ${issue.message}\n`;
        if (issue.sectionTitle) {
          report += `   Section: ${issue.sectionTitle}\n`;
        }
        if (issue.field) {
          report += `   Field: ${issue.field}\n`;
        }
        report += '\n';
      });
    }

    report += '=== END OF REPORT ===\n';
    return report;
  }
}
