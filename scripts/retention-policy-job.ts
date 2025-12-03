#!/usr/bin/env tsx
/**
 * Retention Policy Enforcement Job
 * 
 * Daily cron job to enforce data retention policies:
 * - Check retention periods for archives
 * - Mark archives for deletion
 * - Send deletion notifications
 * - Execute deletions after grace period
 * 
 * Requirements: 8.1, 8.2, 8.3
 * 
 * Usage:
 *   tsx scripts/retention-policy-job.ts
 * 
 * Recommended cron schedule:
 *   0 2 * * * (Daily at 2 AM)
 */

import { RetentionJobService } from '../lib/jobs/retention-job-service';

async function main() {
  console.log('=== Retention Policy Enforcement Job Started ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Step 1: Enforce retention policies (mark archives for deletion and send notifications)
    console.log('Step 1: Enforcing retention policies...');
    const enforcementResult = await RetentionJobService.enforceRetentionPolicies();

    if (enforcementResult.success) {
      console.log(`✓ Archives marked for deletion: ${enforcementResult.archivesMarked}`);
      console.log(`✓ Notifications sent: ${enforcementResult.notificationsSent}`);
      
      if (enforcementResult.errors.length > 0) {
        console.log(`⚠ Warnings during enforcement:`);
        enforcementResult.errors.forEach((error) => {
          console.log(`  - ${error}`);
        });
      }
    } else {
      console.error('✗ Failed to enforce retention policies');
      if (enforcementResult.errors.length > 0) {
        enforcementResult.errors.forEach((error) => {
          console.error(`  - ${error}`);
        });
      }
    }

    console.log('');

    // Step 2: Execute scheduled deletions (delete archives past grace period)
    console.log('Step 2: Executing scheduled deletions...');
    const deletionResult = await RetentionJobService.executeScheduledDeletions();

    if (deletionResult.success) {
      console.log(`✓ Archives deleted: ${deletionResult.archivesDeleted}`);
      
      if (deletionResult.errors.length > 0) {
        console.log(`⚠ Warnings during deletion:`);
        deletionResult.errors.forEach((error) => {
          console.log(`  - ${error}`);
        });
      }
    } else {
      console.error('✗ Failed to execute scheduled deletions');
      if (deletionResult.errors.length > 0) {
        deletionResult.errors.forEach((error) => {
          console.error(`  - ${error}`);
        });
      }
    }

    console.log('');
    console.log('=== Retention Policy Enforcement Job Completed ===');
    console.log(`Total archives marked: ${enforcementResult.archivesMarked}`);
    console.log(`Total archives deleted: ${deletionResult.archivesDeleted}`);
    console.log(`Total notifications sent: ${enforcementResult.notificationsSent}`);

    // Exit with appropriate code
    const hasErrors = 
      enforcementResult.errors.length > 0 || 
      deletionResult.errors.length > 0;
    
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('');
    console.error('=== FATAL ERROR ===');
    console.error('Unexpected error during retention policy enforcement:');
    console.error(error);
    process.exit(1);
  }
}

// Run the job
main();
