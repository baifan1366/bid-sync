/**
 * Vercel Cron Job: Deadline Reminders
 * 
 * Runs daily to send deadline reminders for:
 * - Projects with deadlines within 7 days
 * - Awarded projects with deadlines within 7 days (to all team members)
 * - Document sections with deadlines within 3 days
 * 
 * Schedule: Daily at 9:00 AM UTC (early morning for most users)
 * 
 * Implements requirements from notification-system spec:
 * - 9.1: Project deadline reminders (7 days)
 * - 9.2: Awarded project deadline reminders (7 days)
 * - 9.3: Section deadline reminders (3 days)
 * - 9.4: Include days remaining in notifications
 * - 9.5: Send both in-app and email notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeadlineReminderService } from '@/lib/deadline-reminder-service';
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

    console.log('[Cron] Starting deadline reminders...');
    const timer = LoggingService.startTimer();

    // Send all deadline reminders
    const result = await DeadlineReminderService.sendAllDeadlineReminders();

    const duration = timer();
    console.log(
      `[Cron] Deadline reminders completed in ${duration}ms:`,
      {
        projectReminders: result.projectReminders,
        sectionReminders: result.sectionReminders,
        totalReminders: result.projectReminders + result.sectionReminders,
        errors: result.errors.length,
      }
    );

    // Log any errors but still return success if some reminders were sent
    if (result.errors.length > 0) {
      console.error('[Cron] Errors during deadline reminders:', result.errors);
    }

    return NextResponse.json({
      success: result.success,
      projectReminders: result.projectReminders,
      sectionReminders: result.sectionReminders,
      totalReminders: result.projectReminders + result.sectionReminders,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    console.error('[Cron] Error in deadline reminders:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
