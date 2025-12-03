/**
 * Vercel Cron Job: Retention Policy Enforcement
 * 
 * Runs daily to check archives past retention period and mark them for deletion.
 * 
 * Schedule: Daily at 2:00 AM UTC
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

    console.log('[Cron] Starting retention policy enforcement...');
    const timer = LoggingService.startTimer();

    // Enforce retention policies
    const result = await RetentionService.enforceRetentionPolicies();

    const duration = timer();
    console.log(
      `[Cron] Retention policy enforcement completed in ${duration}ms:`,
      {
        archivesMarked: result.archivesMarked,
        notificationsSent: result.notificationsSent,
        errors: result.errors,
      }
    );

    return NextResponse.json({
      success: result.success,
      archivesMarked: result.archivesMarked,
      notificationsSent: result.notificationsSent,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    console.error('[Cron] Error in retention policy enforcement:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
