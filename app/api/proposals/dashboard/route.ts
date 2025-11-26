import { NextRequest, NextResponse } from 'next/server';
import { MultiProposalService } from '@/lib/multi-proposal-service';
import { getUser } from '@/lib/auth/get-user';

/**
 * GET /api/proposals/dashboard
 * Get dashboard view of all proposals for the current user
 * 
 * Query Parameters:
 * - filterStatus: Filter by proposal status
 * - filterDeadlineBefore: Filter by deadline before date
 * - filterDeadlineAfter: Filter by deadline after date
 * - filterProjectId: Filter by project ID
 * - sortBy: Sort field (deadline, status, created_at, updated_at, completion)
 * - sortOrder: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filterStatusParam = searchParams.get('filterStatus');
    const filterDeadlineBefore = searchParams.get('filterDeadlineBefore') || undefined;
    const filterDeadlineAfter = searchParams.get('filterDeadlineAfter') || undefined;
    const filterProjectId = searchParams.get('filterProjectId') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';

    // Validate filterStatus parameter
    const validStatuses = ['draft', 'submitted', 'reviewing', 'approved', 'rejected', 'archived'];
    const filterStatus = filterStatusParam && validStatuses.includes(filterStatusParam) 
      ? filterStatusParam as any
      : undefined;

    // Validate sortBy parameter
    const validSortBy = ['deadline', 'status', 'created_at', 'updated_at', 'completion'];
    const validatedSortBy = validSortBy.includes(sortBy) ? sortBy : 'created_at';

    // Validate sortOrder parameter
    const validatedSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';

    // Get proposal dashboard
    const result = await MultiProposalService.getProposalDashboard({
      userId: user.id,
      filterStatus,
      filterDeadlineBefore,
      filterDeadlineAfter,
      filterProjectId,
      sortBy: validatedSortBy,
      sortOrder: validatedSortOrder,
    });

    if (!result.success) {
      console.error('MultiProposalService error:', result.error);
      // Return empty array instead of error for better UX
      return NextResponse.json({
        proposals: [],
        error: result.error,
      });
    }

    return NextResponse.json({
      proposals: result.data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/proposals/dashboard:', error);
    // Return empty array instead of 500 error for better UX
    return NextResponse.json({
      proposals: [],
      error: 'Failed to fetch proposal dashboard',
    });
  }
}
