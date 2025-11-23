import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = supabase
      .from('proposals')
      .select(`
        id,
        title,
        status,
        budget,
        timeline,
        submitted_at,
        project:projects(title),
        team:bidding_teams(name),
        lead:users(full_name)
      `)
      .order('submitted_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    const proposals = data?.map((p: any) => ({
      id: p.id,
      title: p.title,
      project_title: p.project?.title || 'Unknown Project',
      team_name: p.team?.name || 'Unknown Team',
      lead_name: p.lead?.full_name || 'Unknown Lead',
      status: p.status,
      submitted_at: p.submitted_at,
      budget: p.budget || 0,
      timeline: p.timeline || 'Not specified',
    }))

    return NextResponse.json(proposals || [])
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}
