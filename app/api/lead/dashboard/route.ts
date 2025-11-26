import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all proposals for this lead
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select('id, status, budget_estimate, submitted_at, created_at, projects(title)')
      .eq('lead_id', user.id)
      .order('created_at', { ascending: false })

    if (proposalsError) {
      console.error('Error fetching proposals:', proposalsError)
      return NextResponse.json(
        { error: 'Failed to fetch proposals' },
        { status: 500 }
      )
    }

    // Calculate statistics
    const totalProposals = proposals?.length || 0
    const activeProposals = proposals?.filter(p => p.status === 'draft' || p.status === 'in_progress').length || 0
    const submittedProposals = proposals?.filter(p => p.status === 'submitted').length || 0
    const acceptedProposals = proposals?.filter(p => p.status === 'approved' || p.status === 'accepted').length || 0
    const rejectedProposals = proposals?.filter(p => p.status === 'rejected').length || 0
    
    const winRate = totalProposals > 0 
      ? Math.round((acceptedProposals / totalProposals) * 100) 
      : 0

    const totalBidValue = proposals?.reduce((sum, p) => sum + (p.budget_estimate || 0), 0) || 0

    // Calculate average response time (in hours)
    const proposalsWithSubmission = proposals?.filter(p => p.submitted_at) || []
    const avgResponseTime = proposalsWithSubmission.length > 0
      ? Math.round(
          proposalsWithSubmission.reduce((sum, p) => {
            const created = new Date(p.created_at).getTime()
            const submitted = new Date(p.submitted_at!).getTime()
            return sum + (submitted - created) / (1000 * 60 * 60) // Convert to hours
          }, 0) / proposalsWithSubmission.length
        )
      : 0

    // Get recent proposals (last 5)
    const recentProposals = proposals?.slice(0, 5).map(p => ({
      id: p.id,
      projectTitle: (p.projects as any)?.title || 'Untitled Project',
      status: p.status,
      submittedAt: p.submitted_at || p.created_at,
      budgetEstimate: p.budget_estimate || 0,
    })) || []

    return NextResponse.json({
      stats: {
        totalProposals,
        activeProposals,
        submittedProposals,
        acceptedProposals,
        rejectedProposals,
        winRate,
        totalBidValue,
        averageResponseTime: avgResponseTime,
      },
      recentProposals,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
