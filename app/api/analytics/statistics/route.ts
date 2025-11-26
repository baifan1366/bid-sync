import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/analytics-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const leadId = searchParams.get('leadId')

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      )
    }

    const statistics = await AnalyticsService.getProposalStatistics(leadId)

    return NextResponse.json(statistics)
  } catch (error) {
    console.error('Error fetching proposal statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposal statistics' },
      { status: 500 }
    )
  }
}
