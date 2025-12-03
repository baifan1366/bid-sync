/**
 * Vercel Cron Job: Execute Scheduled Archive Deletions
 * 
 * Runs daily to delete archives that have passed their grace period.
 * 
 * Schedule: Daily at 3:00 AM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { RetentionService } from '@/lib/retention-service';
import { LoggingService } from '@/lib/logging-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting scheduled archive deletions...');
    const timer = LoggingService.startTimer();

    // Execute scheduled deletions
    const result = await RetentionService.executeScheduledDeletions();

    const duration = timer();
    console.log(
      `[Cron] Scheduled deletions completed in ${duration}ms:`,
      {
        archivesDeleted: result.archivesDeleted,
        errors: result.errors,
      }
    );

    return NextResponse.json({
      success: result.success,
      archivesDeleted: result.archivesDeleted,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    console.error('[Cron] Error in scheduled deletions:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
