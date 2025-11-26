/**
 * Example Usage: Proposal Submission Workflow
 * 
 * This file demonstrates how to use the ProposalService.submitProposal method
 * in various scenarios including success cases, validation failures, and error handling.
 */

import { ProposalService } from './proposal-service';

/**
 * Example 1: Basic Proposal Submission
 * 
 * This is the most common use case - submitting a proposal that passes all checks.
 */
async function example1_BasicSubmission() {
  console.log('=== Example 1: Basic Proposal Submission ===\n');

  const proposalId = 'proposal-123';
  
  const result = await ProposalService.submitProposal(proposalId);

  if (result.success) {
    console.log('✅ Proposal submitted successfully!');
    console.log('Proposal ID:', result.proposal?.id);
    console.log('Status:', result.proposal?.status);
    console.log('Submitted at:', result.proposal?.submittedAt);
    console.log('Notifications sent:', result.notificationsSent);
    console.log('Notifications failed:', result.notificationsFailed);
  } else {
    console.error('❌ Submission failed:', result.error);
  }
}

/**
 * Example 2: Handling Compliance Failures
 * 
 * When a proposal doesn't meet requirements, the submission is blocked
 * and detailed compliance issues are returned.
 */
async function example2_ComplianceFailure() {
  console.log('\n=== Example 2: Handling Compliance Failures ===\n');

  const proposalId = 'incomplete-proposal-456';
  
  const result = await ProposalService.submitProposal(proposalId);

  if (!result.success && result.errorCode === 'COMPLIANCE_FAILED') {
    console.log('❌ Compliance check failed');
    console.log('\nIssues found:');
    
    // Display each compliance issue
    result.complianceIssues?.forEach((issue, index) => {
      const icon = issue.severity === 'error' ? '🔴' : '⚠️';
      console.log(`${icon} ${index + 1}. [${issue.type}] ${issue.message}`);
      
      if (issue.sectionTitle) {
        console.log(`   Section: ${issue.sectionTitle}`);
      }
      if (issue.field) {
        console.log(`   Field: ${issue.field}`);
      }
    });

    // Display full compliance report
    console.log('\n--- Full Compliance Report ---');
    console.log(result.complianceReport);
    
    // Guide user on next steps
    console.log('\n📋 Next Steps:');
    console.log('1. Address all error-level issues');
    console.log('2. Review warning-level issues');
    console.log('3. Run compliance check again');
    console.log('4. Retry submission');
  }
}

/**
 * Example 3: Handling Invalid Status
 * 
 * Proposals can only be submitted when in "draft" status.
 * This example shows how to handle attempts to submit already-submitted proposals.
 */
async function example3_InvalidStatus() {
  console.log('\n=== Example 3: Handling Invalid Status ===\n');

  const proposalId = 'already-submitted-789';
  
  const result = await ProposalService.submitProposal(proposalId);

  if (!result.success && result.errorCode === 'INVALID_STATUS') {
    console.log('❌ Cannot submit proposal');
    console.log('Reason:', result.error);
    console.log('\n💡 Tip: Only proposals in "draft" status can be submitted.');
    console.log('If you need to make changes, contact an administrator.');
  }
}

/**
 * Example 4: Pre-Submission Validation
 * 
 * Before attempting submission, you can run a compliance check
 * to preview any issues without actually submitting.
 */
async function example4_PreSubmissionValidation() {
  console.log('\n=== Example 4: Pre-Submission Validation ===\n');

  const proposalId = 'proposal-123';
  
  // Import ComplianceService for pre-check
  const { ComplianceService } = await import('./compliance-service');
  
  console.log('Running pre-submission compliance check...');
  const complianceCheck = await ComplianceService.runComplianceCheck(proposalId);

  if (complianceCheck.passed) {
    console.log('✅ Compliance check passed!');
    console.log('Summary:');
    console.log(`  - Sections checked: ${complianceCheck.summary.sectionsChecked}`);
    console.log(`  - Documents checked: ${complianceCheck.summary.documentsChecked}`);
    console.log(`  - Issues found: ${complianceCheck.summary.totalIssues}`);
    
    console.log('\n✨ Ready to submit!');
    
    // Now submit
    const result = await ProposalService.submitProposal(proposalId);
    
    if (result.success) {
      console.log('✅ Proposal submitted successfully!');
    }
  } else {
    console.log('❌ Compliance check failed');
    console.log(`Found ${complianceCheck.summary.errors} errors and ${complianceCheck.summary.warnings} warnings`);
    console.log('\n⚠️ Please fix issues before submitting');
  }
}

/**
 * Example 5: Monitoring Notification Delivery
 * 
 * Track which notifications were sent successfully and which failed.
 */
async function example5_NotificationMonitoring() {
  console.log('\n=== Example 5: Monitoring Notification Delivery ===\n');

  const proposalId = 'proposal-123';
  
  const result = await ProposalService.submitProposal(proposalId);

  if (result.success) {
    console.log('✅ Proposal submitted successfully!');
    
    // Monitor notification delivery
    const totalNotifications = (result.notificationsSent || 0) + (result.notificationsFailed || 0);
    const successRate = totalNotifications > 0 
      ? ((result.notificationsSent || 0) / totalNotifications * 100).toFixed(1)
      : 0;
    
    console.log('\n📧 Notification Delivery:');
    console.log(`  - Total: ${totalNotifications}`);
    console.log(`  - Sent: ${result.notificationsSent}`);
    console.log(`  - Failed: ${result.notificationsFailed}`);
    console.log(`  - Success Rate: ${successRate}%`);
    
    if ((result.notificationsFailed || 0) > 0) {
      console.log('\n⚠️ Some notifications failed to send.');
      console.log('Stakeholders may need to be notified manually.');
    }
  }
}

/**
 * Example 6: Complete Submission Flow with UI Feedback
 * 
 * This example shows a complete submission flow with user feedback
 * at each step, suitable for integration with a UI.
 */
async function example6_CompleteFlowWithFeedback() {
  console.log('\n=== Example 6: Complete Submission Flow ===\n');

  const proposalId = 'proposal-123';
  
  // Step 1: Show loading state
  console.log('⏳ Preparing to submit proposal...');
  
  // Step 2: Attempt submission
  const result = await ProposalService.submitProposal(proposalId);
  
  // Step 3: Handle result
  if (result.success) {
    // Success case
    console.log('\n🎉 Success! Your proposal has been submitted.');
    console.log('\n📋 Submission Details:');
    console.log(`  - Proposal ID: ${result.proposal?.id}`);
    console.log(`  - Status: ${result.proposal?.status}`);
    console.log(`  - Submitted: ${new Date(result.proposal?.submittedAt || '').toLocaleString()}`);
    
    console.log('\n📧 Notifications:');
    console.log(`  - Client has been notified`);
    console.log(`  - Team members have been notified`);
    console.log(`  - Administrators have been notified`);
    
    console.log('\n✨ What happens next?');
    console.log('  1. Your proposal is now under review');
    console.log('  2. You will receive notifications about status changes');
    console.log('  3. The proposal is now locked for editing');
    
  } else {
    // Error cases
    console.log('\n❌ Submission Failed\n');
    
    switch (result.errorCode) {
      case 'COMPLIANCE_FAILED':
        console.log('Your proposal has compliance issues that must be fixed:');
        console.log(`\n${result.complianceReport}`);
        console.log('\n💡 Fix these issues and try again.');
        break;
        
      case 'INVALID_STATUS':
        console.log('This proposal cannot be submitted.');
        console.log(`Reason: ${result.error}`);
        break;
        
      case 'PROPOSAL_NOT_FOUND':
        console.log('Proposal not found.');
        console.log('Please check the proposal ID and try again.');
        break;
        
      case 'UPDATE_FAILED':
        console.log('A system error occurred while updating the proposal.');
        console.log('Please try again in a few moments.');
        break;
        
      default:
        console.log('An unexpected error occurred:');
        console.log(result.error);
        console.log('\nPlease contact support if this persists.');
    }
  }
}

/**
 * Example 7: Batch Status Check
 * 
 * Check the submission status of multiple proposals.
 */
async function example7_BatchStatusCheck() {
  console.log('\n=== Example 7: Batch Status Check ===\n');

  const proposalIds = ['proposal-1', 'proposal-2', 'proposal-3'];
  
  console.log('Checking submission readiness for multiple proposals...\n');
  
  const { ComplianceService } = await import('./compliance-service');
  
  for (const proposalId of proposalIds) {
    const check = await ComplianceService.runComplianceCheck(proposalId);
    
    const status = check.passed ? '✅ Ready' : '❌ Not Ready';
    const issues = check.passed ? '' : ` (${check.summary.errors} errors)`;
    
    console.log(`${status} - ${proposalId}${issues}`);
  }
}

/**
 * Example 8: Error Recovery
 * 
 * Demonstrates how to handle and recover from submission errors.
 */
async function example8_ErrorRecovery() {
  console.log('\n=== Example 8: Error Recovery ===\n');

  const proposalId = 'proposal-123';
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    console.log(`Attempt ${retryCount + 1} of ${maxRetries}...`);
    
    const result = await ProposalService.submitProposal(proposalId);
    
    if (result.success) {
      console.log('✅ Submission successful!');
      break;
    }
    
    // Handle different error types
    if (result.errorCode === 'COMPLIANCE_FAILED') {
      console.log('❌ Compliance failed - cannot retry automatically');
      console.log('User must fix issues first');
      break;
    }
    
    if (result.errorCode === 'INVALID_STATUS') {
      console.log('❌ Invalid status - cannot retry');
      break;
    }
    
    // Retry for transient errors
    if (result.errorCode === 'UPDATE_FAILED' || result.errorCode === 'UNKNOWN') {
      retryCount++;
      if (retryCount < maxRetries) {
        console.log('⏳ Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('❌ Max retries reached. Please try again later.');
      }
    }
  }
}

// Export examples for use in documentation or testing
export {
  example1_BasicSubmission,
  example2_ComplianceFailure,
  example3_InvalidStatus,
  example4_PreSubmissionValidation,
  example5_NotificationMonitoring,
  example6_CompleteFlowWithFeedback,
  example7_BatchStatusCheck,
  example8_ErrorRecovery,
};

// Run all examples if this file is executed directly
if (require.main === module) {
  (async () => {
    await example1_BasicSubmission();
    await example2_ComplianceFailure();
    await example3_InvalidStatus();
    await example4_PreSubmissionValidation();
    await example5_NotificationMonitoring();
    await example6_CompleteFlowWithFeedback();
    await example7_BatchStatusCheck();
    await example8_ErrorRecovery();
  })();
}
