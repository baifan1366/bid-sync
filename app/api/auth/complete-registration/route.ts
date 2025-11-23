import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RegistrationData } from '@/types/registration'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body: RegistrationData = await request.json()
    
    // Validate required fields based on role
    if (body.role === 'client') {
      if (!body.client_type || !body.full_name) {
        return NextResponse.json(
          { error: 'Missing required fields for client registration' },
          { status: 400 }
        )
      }
      
      if (body.client_type === 'business' && !body.business_name) {
        return NextResponse.json(
          { error: 'Business name required for business clients' },
          { status: 400 }
        )
      }
    } else if (body.role === 'bidding_lead' || body.role === 'bidding_member') {
      if (!body.full_name) {
        return NextResponse.json(
          { error: 'Missing required fields for bidding team registration' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    
    // Prepare user metadata with verification status
    // Clients need admin approval, others are auto-verified
    const userMetadata = {
      ...body,
      verification_status: body.role === 'client' ? 'pending_verification' : 'verified',
      email_verified: true,
    }
    
    // Update user metadata
    const { data: updatedUser, error: updateError } =
      await supabase.auth.updateUser({
        data: userMetadata,
      })
    
    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete registration' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      {
        success: true,
        user: updatedUser.user,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in POST /api/auth/complete-registration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
