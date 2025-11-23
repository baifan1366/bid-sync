import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user exists in auth.users
    const { data, error } = await supabase.rpc('check_user_exists', {
      user_email: email
    })

    if (error) {
      console.error('Error checking user:', error)
      return NextResponse.json(
        { error: 'Failed to check email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      exists: data || false
    })
  } catch (error) {
    console.error('Error in check-email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
