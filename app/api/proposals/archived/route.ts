import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProposalArchivalService } from '@/lib/proposal-archival-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || user.id
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const archivedOnly = searchParams.get('archivedOnly') !== 'false' // Default to true for this endpoint

    // Verify user is requesting their own data
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const result = await ProposalArchivalService.getProposals({
      userId,
      includeArchived,
      archivedOnly,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch archived proposals' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: result.data || [] })
  } catch (error) {
    console.error('Error in archived proposals route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
