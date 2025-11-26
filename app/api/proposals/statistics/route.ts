import { NextResponse } from 'next/server';
import { MultiProposalService } from '@/lib/multi-proposal-service';
import { getUser } from '@/lib/auth/get-user';

/**
 * GET /api/proposals/statistics
 * Get aggregate statistics across all proposals for the current user
 */
export async function GET() {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get aggregate statistics
    const result = await MultiProposalService.getAggregateStatistics({
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error in GET /api/proposals/statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal statistics' },
      { status: 500 }
    );
  }
}
