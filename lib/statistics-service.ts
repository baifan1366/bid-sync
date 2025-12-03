/**
 * Statistics Service
 * 
 * Handles completion statistics and analytics for completed projects,
 * including average time to completion, monthly aggregations, and date range filtering.
 * 
 * Implements requirements 10.2, 10.5 from the project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';

export interface CompletionStatistics {
  totalCompleted: number;
  averageTimeToCompletion: number; // in days
  projectsRequiringRevisions: number;
  totalDeliverablesReceived: number;
  completionsByMonth: MonthlyCompletion[];
}

export interface MonthlyCompletion {
  month: string; // Format: YYYY-MM
  count: number;
}

export interface StatisticsResult {
  success: boolean;
  statistics?: CompletionStatistics;
  error?: string;
  errorCode?: 
    | 'DATABASE_ERROR'
    | 'INVALID_DATE_RANGE'
    | 'UNKNOWN';
}

/**
 * StatisticsService class for managing completion statistics and analytics
 */
export class StatisticsService {
  /**
   * Gets comprehensive completion statistics
   * 
   * Requirements:
   * - 10.1: Display count of completed projects
   * - 10.2: Show average time from award to completion
   * - 10.3: Display count of projects requiring revisions
   * - 10.4: Show total number of deliverables received
   * - 10.5: Filter statistics by date range
   * 
   * @param dateFrom - Optional start date for filtering
   * @param dateTo - Optional end date for filtering
   * @returns StatisticsResult with completion statistics or error
   */
  static async getCompletionStatistics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<StatisticsResult> {
    try {
      // Validate date range
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return {
          success: false,
          error: 'Start date must be before end date',
          errorCode: 'INVALID_DATE_RANGE',
        };
      }

      const supabase = await createClient();

      // Build base query for completed projects
      let completionsQuery = supabase
        .from('project_completions')
        .select('*, projects!inner(status, created_at)')
        .eq('review_status', 'accepted')
        .not('completed_at', 'is', null);

      // Requirement 10.5: Apply date range filtering
      if (dateFrom) {
        completionsQuery = completionsQuery.gte('completed_at', dateFrom.toISOString());
      }
      if (dateTo) {
        completionsQuery = completionsQuery.lte('completed_at', dateTo.toISOString());
      }

      const { data: completions, error: completionsError } = await completionsQuery;

      if (completionsError) {
        console.error('Error fetching completions:', completionsError);
        return {
          success: false,
          error: 'Failed to fetch completion statistics',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 10.1: Total completed projects
      const totalCompleted = completions?.length || 0;

      // Requirement 10.2: Calculate average time to completion
      const averageTimeToCompletion = await this.calculateAverageTimeToCompletion(
        dateFrom,
        dateTo
      );

      // Requirement 10.3: Count projects requiring revisions
      const projectsRequiringRevisions = completions?.filter(
        (c: any) => c.revision_count > 0
      ).length || 0;

      // Requirement 10.4: Count total deliverables
      const projectIds = completions?.map((c: any) => c.project_id) || [];
      let deliverablesQuery = supabase
        .from('project_deliverables')
        .select('id', { count: 'exact', head: true });

      if (projectIds.length > 0) {
        deliverablesQuery = deliverablesQuery.in('project_id', projectIds);
      } else {
        // No completed projects in range, return 0
        return {
          success: true,
          statistics: {
            totalCompleted: 0,
            averageTimeToCompletion: 0,
            projectsRequiringRevisions: 0,
            totalDeliverablesReceived: 0,
            completionsByMonth: [],
          },
        };
      }

      const { count: totalDeliverablesReceived, error: deliverablesError } = 
        await deliverablesQuery;

      if (deliverablesError) {
        console.error('Error counting deliverables:', deliverablesError);
      }

      // Calculate monthly completions
      const completionsByMonth = await this.getCompletionsByMonth(dateFrom, dateTo);

      return {
        success: true,
        statistics: {
          totalCompleted,
          averageTimeToCompletion,
          projectsRequiringRevisions,
          totalDeliverablesReceived: totalDeliverablesReceived || 0,
          completionsByMonth,
        },
      };
    } catch (error) {
      console.error('Unexpected error in getCompletionStatistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Calculates average time from project award to completion
   * 
   * Requirement 10.2: Show average time from award to completion
   * 
   * @param dateFrom - Optional start date for filtering
   * @param dateTo - Optional end date for filtering
   * @returns Average time in days
   */
  static async calculateAverageTimeToCompletion(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<number> {
    try {
      const supabase = await createClient();

      // Get completed projects with their award and completion dates
      let query = supabase
        .from('project_completions')
        .select('completed_at, projects!inner(created_at, status)')
        .eq('review_status', 'accepted')
        .not('completed_at', 'is', null);

      // Apply date range filtering
      if (dateFrom) {
        query = query.gte('completed_at', dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte('completed_at', dateTo.toISOString());
      }

      const { data: completions, error } = await query;

      if (error || !completions || completions.length === 0) {
        return 0;
      }

      // Calculate time differences in days
      let totalDays = 0;
      let validCount = 0;

      for (const completion of completions) {
        const completedAt = new Date(completion.completed_at);
        const createdAt = new Date((completion.projects as any).created_at);

        if (!isNaN(completedAt.getTime()) && !isNaN(createdAt.getTime())) {
          const diffMs = completedAt.getTime() - createdAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          if (diffDays >= 0) {
            totalDays += diffDays;
            validCount++;
          }
        }
      }

      if (validCount === 0) {
        return 0;
      }

      // Return average rounded to 2 decimal places
      return parseFloat((totalDays / validCount).toFixed(2));
    } catch (error) {
      console.error('Error calculating average time to completion:', error);
      return 0;
    }
  }

  /**
   * Gets monthly completion aggregations
   * 
   * Requirement 10.5: Support date range filtering for monthly aggregations
   * 
   * @param dateFrom - Optional start date for filtering
   * @param dateTo - Optional end date for filtering
   * @returns Array of monthly completion counts
   */
  static async getCompletionsByMonth(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<MonthlyCompletion[]> {
    try {
      const supabase = await createClient();

      // Get completed projects
      let query = supabase
        .from('project_completions')
        .select('completed_at')
        .eq('review_status', 'accepted')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: true });

      // Apply date range filtering
      if (dateFrom) {
        query = query.gte('completed_at', dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte('completed_at', dateTo.toISOString());
      }

      const { data: completions, error } = await query;

      if (error || !completions || completions.length === 0) {
        return [];
      }

      // Group by month
      const monthlyMap = new Map<string, number>();

      for (const completion of completions) {
        const date = new Date(completion.completed_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
      }

      // Convert to array and sort
      const monthlyCompletions: MonthlyCompletion[] = Array.from(monthlyMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return monthlyCompletions;
    } catch (error) {
      console.error('Error getting completions by month:', error);
      return [];
    }
  }

  /**
   * Gets revision statistics for completed projects
   * 
   * @param dateFrom - Optional start date for filtering
   * @param dateTo - Optional end date for filtering
   * @returns Number of projects that required revisions
   */
  static async getRevisionStatistics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<number> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from('project_completions')
        .select('revision_count', { count: 'exact', head: true })
        .eq('review_status', 'accepted')
        .not('completed_at', 'is', null)
        .gt('revision_count', 0);

      // Apply date range filtering
      if (dateFrom) {
        query = query.gte('completed_at', dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte('completed_at', dateTo.toISOString());
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error getting revision statistics:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getRevisionStatistics:', error);
      return 0;
    }
  }

  /**
   * Gets deliverable statistics for completed projects
   * 
   * @param dateFrom - Optional start date for filtering
   * @param dateTo - Optional end date for filtering
   * @returns Total number of deliverables received
   */
  static async getDeliverableStatistics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<number> {
    try {
      const supabase = await createClient();

      // Get completed project IDs in date range
      let completionsQuery = supabase
        .from('project_completions')
        .select('project_id')
        .eq('review_status', 'accepted')
        .not('completed_at', 'is', null);

      if (dateFrom) {
        completionsQuery = completionsQuery.gte('completed_at', dateFrom.toISOString());
      }
      if (dateTo) {
        completionsQuery = completionsQuery.lte('completed_at', dateTo.toISOString());
      }

      const { data: completions, error: completionsError } = await completionsQuery;

      if (completionsError || !completions || completions.length === 0) {
        return 0;
      }

      const projectIds = completions.map((c: any) => c.project_id);

      // Count deliverables for these projects
      const { count, error: deliverablesError } = await supabase
        .from('project_deliverables')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds);

      if (deliverablesError) {
        console.error('Error counting deliverables:', deliverablesError);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getDeliverableStatistics:', error);
      return 0;
    }
  }
}
