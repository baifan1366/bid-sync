#!/usr/bin/env tsx
/**
 * Export Cleanup Job
 * 
 * Daily cron job to clean up expired exports:
 * - Find exports past their 7-day expiry
 * - Delete export files from storage
 * - Update/delete export records
 * 
 * Requirement: 9.5
 * 
 * Usage:
 *   tsx scripts/export-cleanup-job.ts
 * 
 * Recommended cron schedule:
 *   0 3 * * * (Daily at 3 AM)
 */

import { ExportJobService } from '../lib/jobs/export-job-service';

async function main() {
  console.log('=== Export Cleanup Job Started ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    console.log('Cleaning up expired exports...');
    
    const result = await ExportJobService.cleanupExpiredExports();

    if (result.success) {
      console.log(`✓ Cleanup completed successfully`);
      console.log(`✓ Exports cleaned: ${result.cleanedCount || 0}`);
      
      if (result.cleanedCount === 0) {
        console.log('  No expired exports found');
      }
    } else {
      console.error('✗ Cleanup failed');
      if (result.error) {
        console.error(`  Error: ${result.error}`);
      }
    }

    console.log('');
    console.log('=== Export Cleanup Job Completed ===');
    console.log(`Total exports cleaned: ${result.cleanedCount || 0}`);

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('=== FATAL ERROR ===');
    console.error('Unexpected error during export cleanup:');
    console.error(error);
    process.exit(1);
  }
}

// Run the job
main();
