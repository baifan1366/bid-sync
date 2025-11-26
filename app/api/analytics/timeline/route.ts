import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/analytics-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const leadId = searchParams.get('leadId')
    const days = searchParams.get('days')

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      )
    }

    const daysBack = days ? parseInt(days, 10) : 30

    const timeline = await AnalyticsService.getActivityTimeline(leadId, daysBack)

    return NextResponse.json(timeline)
  } catch (error) {
    console.error('Error fetching activity timeline:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity timeline' },
      { status: 500 }
    )
  }
}
