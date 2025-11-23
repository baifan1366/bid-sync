import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Fetch users by role
    const { data: usersByRole } = await supabase
      .from('users')
      .select('role')

    const roleCount = {
      admin: 0,
      client: 0,
      bidding_lead: 0,
      bidding_member: 0,
    }

    usersByRole?.forEach((user: any) => {
      if (user.role in roleCount) {
        roleCount[user.role as keyof typeof roleCount]++
      }
    })

    // Fetch total projects
    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })

    // Fetch approved projects
    const { count: approvedProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Fetch total proposals
    const { count: totalProposals } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })

    // Fetch pending verifications
    const { count: pendingVerifications } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'client')
      .eq('verification_status', 'pending')

    // Fetch active users (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_sign_in_at', sevenDaysAgo.toISOString())

    // Fetch today's activity
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: newUsersToday } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    const { count: newProjectsToday } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    const { count: newProposalsToday } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Calculate trends (mock data for now - would need historical data)
    const trends = {
      usersGrowth: 12.5,
      projectsGrowth: 8.3,
      proposalsGrowth: 15.7,
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalProjects: totalProjects || 0,
      totalProposals: totalProposals || 0,
      activeUsers: activeUsers || 0,
      pendingVerifications: pendingVerifications || 0,
      approvedProjects: approvedProjects || 0,
      usersByRole: roleCount,
      recentActivity: {
        newUsersToday: newUsersToday || 0,
        newProjectsToday: newProjectsToday || 0,
        newProposalsToday: newProposalsToday || 0,
      },
      trends,
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
