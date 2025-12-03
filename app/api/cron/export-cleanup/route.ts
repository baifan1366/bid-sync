/**
 * Vercel Cron Job: Export Cleanup
 * 
 * Runs daily to remove expired export files and records.
 * 
 * Schedule: Daily at 4:00 AM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExportService } from '@/lib/export-service';
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

    console.log('[Cron] Starting export cleanup...');
    const timer = LoggingService.startTimer();

    // Clean up expired exports
    const result = await ExportService.cleanupExpiredExports();

    const duration = timer();
    console.log(
      `[Cron] Export cleanup completed in ${duration}ms:`,
      {
        cleanedCount: result.cleanedCount,
      }
    );

    return NextResponse.json({
      success: result.success,
      cleanedCount: result.cleanedCount,
      duration,
    });
  } catch (error) {
    console.error('[Cron] Error in export cleanup:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
