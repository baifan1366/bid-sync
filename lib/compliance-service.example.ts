/**
 * Compliance Service Usage Examples
 * 
 * This file demonstrates how to use the ComplianceService
 * for validating proposals before submission.
 */

import { ComplianceService } from './compliance-service';

/**
 * Example 1: Basic compliance check
 */
export async function basicComplianceCheck(proposalId: string) {
  console.log('Running compliance check...');
  
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  if (result.passed) {
    console.log('✓ Compliance check passed!');
    console.log(`Checked ${result.summary.sectionsChecked} sections and ${result.summary.documentsChecked} documents`);
    return true;
  } else {
    console.log('✗ Compliance check failed');
    console.log(`Found ${result.summary.errors} errors and ${result.summary.warnings} warnings`);
    return false;
  }
}

/**
 * Example 2: Detailed compliance report
 */
export async function detailedComplianceReport(proposalId: string) {
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  // Generate human-readable report
  const report = ComplianceService.generateComplianceReport(result);
  console.log(report);
  
  return result;
}

/**
 * Example 3: Pre-submission validation
 */
export async function validateBeforeSubmission(proposalId: string): Promise<{
  canSubmit: boolean;
  issues: string[];
}> {
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  // Only allow submission if there are no errors
  const canSubmit = result.summary.errors === 0;
  
  // Extract error messages for display
  const issues = result.issues
    .filter(issue => issue.severity === 'error')
    .map(issue => issue.message);
  
  return { canSubmit, issues };
}

/**
 * Example 4: Compliance check with issue categorization
 */
export async function categorizedComplianceCheck(proposalId: string) {
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  // Categorize issues by type
  const issuesByType = result.issues.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = [];
    }
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, typeof result.issues>);
  
  console.log('Issues by category:');
  Object.entries(issuesByType).forEach(([type, issues]) => {
    console.log(`\n${type.toUpperCase()}:`);
    issues.forEach(issue => {
      console.log(`  - ${issue.message}`);
    });
  });
  
  return issuesByType;
}

/**
 * Example 5: Compliance check with actionable guidance
 */
export async function complianceCheckWithGuidance(proposalId: string) {
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  if (result.passed) {
    return {
      status: 'ready',
      message: 'Your proposal is ready for submission!',
      nextSteps: ['Review your proposal one final time', 'Click the Submit button'],
    };
  }
  
  // Provide specific guidance based on issues
  const nextSteps: string[] = [];
  
  const hasIncompleteSections = result.issues.some(i => i.type === 'incomplete_section');
  if (hasIncompleteSections) {
    nextSteps.push('Complete all proposal sections and mark them as "completed"');
  }
  
  const hasMissingDocuments = result.issues.some(i => i.type === 'missing_document');
  if (hasMissingDocuments) {
    nextSteps.push('Upload all required documents (company profile, team resumes, references)');
  }
  
  const hasBudgetIssues = result.issues.some(i => i.type === 'invalid_budget' || i.type === 'budget_out_of_range');
  if (hasBudgetIssues) {
    nextSteps.push('Review and adjust your budget estimate to align with project requirements');
  }
  
  const hasMissingInfo = result.issues.some(i => i.type === 'missing_info');
  if (hasMissingInfo) {
    nextSteps.push('Provide all required additional information requested by the client');
  }
  
  return {
    status: 'needs_attention',
    message: `Found ${result.summary.errors} errors that must be fixed before submission`,
    issues: result.issues.filter(i => i.severity === 'error'),
    nextSteps,
  };
}

/**
 * Example 6: Integration with submission workflow
 */
export async function submitProposalWithValidation(proposalId: string) {
  console.log('Step 1: Running compliance check...');
  const complianceResult = await ComplianceService.runComplianceCheck(proposalId);
  
  if (!complianceResult.passed) {
    console.log('❌ Submission blocked due to compliance issues');
    const report = ComplianceService.generateComplianceReport(complianceResult);
    console.log(report);
    
    return {
      success: false,
      error: 'Compliance check failed',
      complianceReport: report,
    };
  }
  
  console.log('✓ Compliance check passed');
  console.log('Step 2: Submitting proposal...');
  
  // Proceed with actual submission
  // ... submission logic here ...
  
  return {
    success: true,
    message: 'Proposal submitted successfully',
  };
}

/**
 * Example 7: Real-time compliance monitoring
 */
export async function monitorComplianceStatus(proposalId: string) {
  const result = await ComplianceService.runComplianceCheck(proposalId);
  
  // Calculate completion percentage
  const totalChecks = 4; // sections, documents, budget, additional info
  const passedChecks = totalChecks - result.summary.errors;
  const completionPercentage = Math.round((passedChecks / totalChecks) * 100);
  
  return {
    completionPercentage,
    readyForSubmission: result.passed,
    summary: result.summary,
    criticalIssues: result.issues.filter(i => i.severity === 'error').length,
    warnings: result.issues.filter(i => i.severity === 'warning').length,
  };
}
