import { NextRequest, NextResponse } from 'next/server'
import { ProjectDiscoveryServiceServer } from '@/lib/project-discovery-service.server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const project = await ProjectDiscoveryServiceServer.getProjectDetail(projectId)

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Error fetching project details:', error)
    
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
