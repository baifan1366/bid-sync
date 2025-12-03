import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/analytics-service'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId parameter is required' },
        { status: 400 }
      )
    }

    // Verify user is requesting their own data or is admin
    if (user.id !== leadId) {
      const userRole = user.user_metadata?.role
      if (userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
    }

    const statistics = await AnalyticsService.getProposalStatistics(leadId)

    return NextResponse.json(statistics)
  } catch (error) {
    console.error('Error fetching proposal statistics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
