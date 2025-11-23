import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single()

    if (error && error.code !== 'PGRST116') throw error

    const defaultSettings = {
      email: {
        smtp_host: process.env.SMTP_HOST || '',
        smtp_port: parseInt(process.env.SMTP_PORT || '587'),
        smtp_user: process.env.SMTP_USER || '',
        from_email: process.env.FROM_EMAIL || 'noreply@bidsync.com',
      },
      notifications: {
        enable_email_notifications: true,
        enable_proposal_notifications: true,
        enable_project_notifications: true,
        enable_admin_notifications: true,
      },
      security: {
        require_email_verification: true,
        require_client_verification: true,
        session_timeout_minutes: 60,
        max_login_attempts: 5,
      },
    }

    return NextResponse.json(data || defaultSettings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        id: 1,
        ...body,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
