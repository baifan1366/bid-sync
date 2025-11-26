import { NextRequest, NextResponse } from 'next/server'
import { ProjectDiscoveryServiceServer } from '@/lib/project-discovery-service.server'
import type { ProjectStatus } from '@/types/project'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse filter parameters
    const budgetMin = searchParams.get('budgetMin')
    const budgetMax = searchParams.get('budgetMax')
    const deadlineBefore = searchParams.get('deadlineBefore')
    const deadlineAfter = searchParams.get('deadlineAfter')
    const status = searchParams.get('status')
    const searchTerm = searchParams.get('searchTerm')

    // Build filter object
    const filter = {
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      deadlineBefore: deadlineBefore ? new Date(deadlineBefore) : undefined,
      deadlineAfter: deadlineAfter ? new Date(deadlineAfter) : undefined,
      status: (status?.toUpperCase() as ProjectStatus) || undefined,
      searchTerm: searchTerm || undefined,
    }

    const projects = await ProjectDiscoveryServiceServer.getOpenProjects(filter)

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
