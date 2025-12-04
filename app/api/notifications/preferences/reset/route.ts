/**
 * Notification Preferences Reset API Route
 * 
 * Provides endpoint for resetting user notification preferences to defaults.
 * Implements requirement 4.2: Save preference toggles to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NotificationPreferencesService } from '@/lib/notification-preferences-service'

/**
 * POST /api/notifications/preferences/reset
 * 
 * Requirement 4.2: Reset preferences to defaults
 * Resets the current user's notification preferences to default values
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Reset preferences to defaults
    const result = await NotificationPreferencesService.resetToDefaults(user.id)

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to reset preferences' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences: result.preferences,
    })
  } catch (error) {
    console.error('Error resetting notification preferences:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reset notification preferences' 
      },
      { status: 500 }
    )
  }
}
