#!/usr/bin/env tsx
/**
 * Export Worker
 * 
 * Async worker to process export requests:
 * - Process export requests from queue
 * - Generate export packages
 * - Send completion notifications
 * - Handle errors and retries
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 * 
 * Usage:
 *   tsx scripts/export-worker.ts [--once]
 * 
 * Options:
 *   --once    Process pending exports once and exit (useful for cron)
 *   (default) Run continuously, polling for new exports every 30 seconds
 * 
 * Recommended cron schedule (if using --once):
 *   Every 5 minutes: star-slash-5 star star star star
 * 
 * Or run as a long-running process:
 *   tsx scripts/export-worker.ts
 */

import { createServiceRoleClient } from '../lib/supabase/service-role';
import { ExportJobService } from '../lib/jobs/export-job-service';

// Configuration
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

// Verify Supabase credentials
try {
  createServiceRoleClient();
} catch (error) {
  console.error('Error: Missing Supabase credentials');
  console.error('Required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

/**
 * Process a single export request
 */
async function processExport(exportId: string, retryCount: number = 0): Promise<boolean> {
  try {
    console.log(`Processing export ${exportId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
    
    // Process the export using ExportJobService
    await ExportJobService.processExportAsync(exportId);
    
    console.log(`✓ Export ${exportId} processed successfully`);
    return true;
  } catch (error) {
    console.error(`✗ Error processing export ${exportId}:`, error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`  Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return processExport(exportId, retryCount + 1);
    } else {
      console.error(`  Max retries reached for export ${exportId}`);
      
      // Mark export as failed
      try {
        const supabase = createServiceRoleClient();
        await supabase
          .from('project_exports')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error after max retries',
            updated_at: new Date().toISOString(),
          })
          .eq('id', exportId);
      } catch (updateError) {
        console.error(`  Failed to update export status:`, updateError);
      }
      
      return false;
    }
  }
}

/**
 * Get pending export requests
 */
async function getPendingExports(): Promise<string[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data: exports, error } = await supabase
      .from('project_exports')
      .select('id')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(10); // Process up to 10 at a time

    if (error) {
      console.error('Error fetching pending exports:', error);
      return [];
    }

    return (exports || []).map((e) => e.id);
  } catch (error) {
    console.error('Unexpected error fetching pending exports:', error);
    return [];
  }
}

/**
 * Process all pending exports
 */
async function processPendingExports(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pendingExportIds = await getPendingExports();
  
  if (pendingExportIds.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`Found ${pendingExportIds.length} pending export(s)`);
  console.log('');

  let succeeded = 0;
  let failed = 0;

  // Process exports sequentially to avoid overwhelming the system
  for (const exportId of pendingExportIds) {
    const success = await processExport(exportId);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
    console.log('');
  }

  return {
    processed: pendingExportIds.length,
    succeeded,
    failed,
  };
}

/**
 * Main worker loop
 */
async function runWorker(runOnce: boolean = false) {
  console.log('=== Export Worker Started ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Mode: ${runOnce ? 'Single run' : 'Continuous'}`);
  console.log('');

  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  try {
    if (runOnce) {
      // Process pending exports once and exit
      const result = await processPendingExports();
      totalProcessed = result.processed;
      totalSucceeded = result.succeeded;
      totalFailed = result.failed;

      console.log('=== Export Worker Completed ===');
      console.log(`Exports processed: ${totalProcessed}`);
      console.log(`Succeeded: ${totalSucceeded}`);
      console.log(`Failed: ${totalFailed}`);

      process.exit(totalFailed > 0 ? 1 : 0);
    } else {
      // Run continuously
      console.log('Worker running continuously. Press Ctrl+C to stop.');
      console.log(`Polling interval: ${POLL_INTERVAL_MS / 1000} seconds`);
      console.log('');

      // Handle graceful shutdown
      let isShuttingDown = false;
      
      process.on('SIGINT', () => {
        console.log('');
        console.log('Received SIGINT. Shutting down gracefully...');
        isShuttingDown = true;
      });

      process.on('SIGTERM', () => {
        console.log('');
        console.log('Received SIGTERM. Shutting down gracefully...');
        isShuttingDown = true;
      });

      // Main loop
      while (!isShuttingDown) {
        const cycleStart = Date.now();
        
        const result = await processPendingExports();
        totalProcessed += result.processed;
        totalSucceeded += result.succeeded;
        totalFailed += result.failed;

        if (result.processed === 0) {
          console.log(`[${new Date().toISOString()}] No pending exports. Waiting...`);
        } else {
          console.log(`[${new Date().toISOString()}] Cycle complete: ${result.succeeded} succeeded, ${result.failed} failed`);
        }

        // Wait for next poll interval
        const cycleTime = Date.now() - cycleStart;
        const waitTime = Math.max(0, POLL_INTERVAL_MS - cycleTime);
        
        if (waitTime > 0 && !isShuttingDown) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      console.log('');
      console.log('=== Export Worker Stopped ===');
      console.log(`Total exports processed: ${totalProcessed}`);
      console.log(`Total succeeded: ${totalSucceeded}`);
      console.log(`Total failed: ${totalFailed}`);

      process.exit(0);
    }
  } catch (error) {
    console.error('');
    console.error('=== FATAL ERROR ===');
    console.error('Unexpected error in export worker:');
    console.error(error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const runOnce = args.includes('--once');

// Run the worker
runWorker(runOnce);
