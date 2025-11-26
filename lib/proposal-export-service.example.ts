/**
 * Proposal Export Service Usage Examples
 * 
 * Demonstrates how to use the Proposal Export Service
 */

import { ProposalExportService } from './proposal-export-service';

/**
 * Example 1: Export a proposal to PDF
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */
export async function exampleExportProposal() {
  console.log('=== Example: Export Proposal to PDF ===\n');

  const result = await ProposalExportService.exportProposal({
    proposalId: 'proposal-uuid-here',
    userId: 'user-uuid-here',
    includeVersionHistory: true,
    includeTeamStats: true,
    includeDocuments: true,
  });

  if (result.success && result.pdfBuffer && result.fileName) {
    console.log(`✓ PDF generated successfully`);
    console.log(`  File name: ${result.fileName}`);
    console.log(`  Size: ${result.pdfBuffer.length} bytes`);
    
    // In a real application, you would:
    // 1. Save to file system
    // 2. Upload to cloud storage
    // 3. Provide download link to user
    
    // Example: Save to file (Node.js)
    // const fs = require('fs');
    // fs.writeFileSync(result.fileName, result.pdfBuffer);
  } else {
    console.error(`✗ Export failed: ${result.error}`);
  }
}

/**
 * Example 2: Export with selective content
 */
export async function exampleSelectiveExport() {
  console.log('\n=== Example: Selective Export ===\n');

  // Export without version history
  const result1 = await ProposalExportService.exportProposal({
    proposalId: 'proposal-uuid-here',
    userId: 'user-uuid-here',
    includeVersionHistory: false,
    includeTeamStats: true,
    includeDocuments: true,
  });

  if (result1.success) {
    console.log('✓ Exported without version history');
  }

  // Export only core content (no team stats or documents)
  const result2 = await ProposalExportService.exportProposal({
    proposalId: 'proposal-uuid-here',
    userId: 'user-uuid-here',
    includeVersionHistory: false,
    includeTeamStats: false,
    includeDocuments: false,
  });

  if (result2.success) {
    console.log('✓ Exported core content only');
  }
}

/**
 * Example 3: Export and email to recipient
 * Requirement 19.5: Email delivery of exported files
 */
export async function exampleExportAndEmail() {
  console.log('\n=== Example: Export and Email ===\n');

  const result = await ProposalExportService.exportAndEmail({
    proposalId: 'proposal-uuid-here',
    userId: 'user-uuid-here',
    recipientEmail: 'client@example.com',
    includeVersionHistory: true,
    includeTeamStats: true,
    includeDocuments: true,
  });

  if (result.success) {
    console.log('✓ PDF exported and emailed successfully');
    console.log('  Recipient: client@example.com');
  } else {
    console.error(`✗ Failed: ${result.error}`);
  }
}

/**
 * Example 4: Email to multiple recipients
 */
export async function exampleEmailMultipleRecipients() {
  console.log('\n=== Example: Email Multiple Recipients ===\n');

  const recipients = [
    'client@example.com',
    'stakeholder1@example.com',
    'stakeholder2@example.com',
  ];

  const results = await Promise.all(
    recipients.map((email) =>
      ProposalExportService.exportAndEmail({
        proposalId: 'proposal-uuid-here',
        userId: 'user-uuid-here',
        recipientEmail: email,
        includeVersionHistory: true,
        includeTeamStats: true,
        includeDocuments: true,
      })
    )
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✓ Sent to ${successful} recipients`);
  if (failed > 0) {
    console.log(`✗ Failed to send to ${failed} recipients`);
  }
}

/**
 * Example 5: Error handling
 */
export async function exampleErrorHandling() {
  console.log('\n=== Example: Error Handling ===\n');

  // Invalid proposal ID
  const result1 = await ProposalExportService.exportProposal({
    proposalId: 'invalid-id',
    userId: 'user-uuid-here',
  });

  if (!result1.success) {
    console.log(`Validation error: ${result1.error}`);
  }

  // Proposal not found
  const result2 = await ProposalExportService.exportProposal({
    proposalId: '00000000-0000-0000-0000-000000000000',
    userId: 'user-uuid-here',
  });

  if (!result2.success) {
    console.log(`Not found error: ${result2.error}`);
  }

  // Access denied (user not on team)
  const result3 = await ProposalExportService.exportProposal({
    proposalId: 'proposal-uuid-here',
    userId: 'unauthorized-user-uuid',
  });

  if (!result3.success) {
    console.log(`Access error: ${result3.error}`);
  }
}

/**
 * Example 6: Integration with UI download
 */
export async function exampleUIDownload() {
  console.log('\n=== Example: UI Download Integration ===\n');

  // In a React component or API route:
  const handleDownload = async (proposalId: string, userId: string) => {
    const result = await ProposalExportService.exportProposal({
      proposalId,
      userId,
      includeVersionHistory: true,
      includeTeamStats: true,
      includeDocuments: true,
    });

    if (result.success && result.pdfBuffer && result.fileName) {
      // Create blob and trigger download
      const blob = new Blob([result.pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      link.click();
      
      URL.revokeObjectURL(url);
      
      console.log('✓ Download initiated');
    } else {
      console.error('✗ Export failed:', result.error);
      // Show error toast to user
    }
  };

  console.log('UI download handler created');
}

/**
 * Example 7: API route for export
 */
export async function exampleAPIRoute() {
  console.log('\n=== Example: API Route ===\n');

  // In Next.js API route: /api/proposals/[id]/export
  const handler = async (req: any, res: any) => {
    const { id } = req.query;
    const userId = req.user.id; // From auth middleware

    const result = await ProposalExportService.exportProposal({
      proposalId: id,
      userId,
      includeVersionHistory: true,
      includeTeamStats: true,
      includeDocuments: true,
    });

    if (result.success && result.pdfBuffer && result.fileName) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.pdfBuffer);
    } else {
      res.status(400).json({ error: result.error });
    }
  };

  console.log('API route handler created');
}

/**
 * Example 8: Scheduled export and email
 */
export async function exampleScheduledExport() {
  console.log('\n=== Example: Scheduled Export ===\n');

  // Example: Weekly export to stakeholders
  const exportAndEmailWeekly = async (proposalId: string, userId: string) => {
    console.log(`Running weekly export for proposal ${proposalId}...`);

    const stakeholders = [
      'manager@example.com',
      'director@example.com',
    ];

    for (const email of stakeholders) {
      const result = await ProposalExportService.exportAndEmail({
        proposalId,
        userId,
        recipientEmail: email,
        includeVersionHistory: true,
        includeTeamStats: true,
        includeDocuments: true,
      });

      if (result.success) {
        console.log(`  ✓ Sent to ${email}`);
      } else {
        console.error(`  ✗ Failed to send to ${email}: ${result.error}`);
      }
    }
  };

  console.log('Scheduled export function created');
}

/**
 * Example 9: Export with progress tracking
 */
export async function exampleProgressTracking() {
  console.log('\n=== Example: Progress Tracking ===\n');

  const exportWithProgress = async (proposalId: string, userId: string) => {
    console.log('Starting export...');
    console.log('  [1/4] Fetching proposal data...');
    
    const result = await ProposalExportService.exportProposal({
      proposalId,
      userId,
      includeVersionHistory: true,
      includeTeamStats: true,
      includeDocuments: true,
    });

    if (result.success) {
      console.log('  [2/4] Generating PDF...');
      console.log('  [3/4] Finalizing document...');
      console.log('  [4/4] Complete!');
      console.log(`✓ Export successful: ${result.fileName}`);
    } else {
      console.error(`✗ Export failed at step: ${result.error}`);
    }
  };

  console.log('Progress tracking example created');
}

/**
 * Example 10: Batch export for multiple proposals
 */
export async function exampleBatchExport() {
  console.log('\n=== Example: Batch Export ===\n');

  const proposalIds = [
    'proposal-1-uuid',
    'proposal-2-uuid',
    'proposal-3-uuid',
  ];

  const userId = 'user-uuid-here';

  console.log(`Exporting ${proposalIds.length} proposals...`);

  const results = await Promise.all(
    proposalIds.map((proposalId) =>
      ProposalExportService.exportProposal({
        proposalId,
        userId,
        includeVersionHistory: false, // Faster for batch
        includeTeamStats: false,
        includeDocuments: false,
      })
    )
  );

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n✓ Successfully exported: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed exports:');
    failed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.error}`);
    });
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await exampleExportProposal();
    await exampleSelectiveExport();
    await exampleExportAndEmail();
    await exampleEmailMultipleRecipients();
    await exampleErrorHandling();
    await exampleUIDownload();
    await exampleAPIRoute();
    await exampleScheduledExport();
    await exampleProgressTracking();
    await exampleBatchExport();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run examples
// runAllExamples();
