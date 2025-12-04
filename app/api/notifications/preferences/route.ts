/**
 * Notification Preferences API Routes
 * 
 * Provides REST API endpoints for managing user notification preferences.
 * Implements requirements from notification-system spec:
 * - 4.1: Display all available notification categories
 * - 4.2: Save preference toggles to database
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NotificationPreferencesService } from '@/lib/notification-preferences-service'

/**
 * GET /api/notifications/preferences
 * 
 * Requirement 4.1: Display all available notification categories
 * Fetches the current user's notification preferences
 */
export async function GET(request: NextRequest) {
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

    // Fetch preferences
    const preferences = await NotificationPreferencesService.getPreferences(user.id)

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch notification preferences' 
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/preferences
 * 
 * Requirement 4.2: Save preference toggles to database
 * Updates the current user's notification preferences
 */
export async function PATCH(request: NextRequest) {
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

    // Parse request body
    const updates = await request.json()

    // Validate that at least one preference is being updated
    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No preferences provided' 
        },
        { status: 400 }
      )
    }

    // Update preferences
    const result = await NotificationPreferencesService.updatePreferences(
      user.id,
      updates
    )

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to update preferences' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      preferences: result.preferences,
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update notification preferences' 
      },
      { status: 500 }
    )
  }
}
