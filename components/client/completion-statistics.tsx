'use client';

/**
 * CompletionStatistics Component
 * 
 * Displays comprehensive completion statistics including completion count,
 * average time to completion, revision statistics, deliverables count,
 * and date range filter controls.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  BarChart3,
  Filter,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface CompletionStatisticsProps {
  statistics: CompletionStatistics;
  onRefresh?: () => Promise<void>;
  onDateRangeChange?: (dateFrom?: Date, dateTo?: Date) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

/**
 * Format month string to readable format
 */
function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Format date for input field
 */
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * StatCard component for displaying individual statistics
 */
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconColor = 'text-yellow-400',
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  iconColor?: string;
  className?: string;
}) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md border-yellow-400/20', className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between space-x-3 sm:space-x-4">
          <div className="flex-1 space-y-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {label}
            </p>
            <p className="text-xl sm:text-2xl font-bold truncate">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn(
            'flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-yellow-400/10 shrink-0',
            iconColor
          )}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompletionStatistics({
  statistics,
  onRefresh,
  onDateRangeChange,
  isLoading = false,
  className,
}: CompletionStatisticsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);

  const hasActiveFilter = dateFrom || dateTo;

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyFilter = async () => {
    if (!onDateRangeChange) return;

    setIsApplyingFilter(true);
    try {
      const from = dateFrom ? new Date(dateFrom) : undefined;
      const to = dateTo ? new Date(dateTo) : undefined;
      await onDateRangeChange(from, to);
    } finally {
      setIsApplyingFilter(false);
    }
  };

  const handleClearFilter = async () => {
    setDateFrom('');
    setDateTo('');
    
    if (onDateRangeChange) {
      setIsApplyingFilter(true);
      try {
        await onDateRangeChange(undefined, undefined);
      } finally {
        setIsApplyingFilter(false);
      }
    }
  };

  // Calculate revision rate
  const revisionRate = statistics.totalCompleted > 0
    ? Math.round((statistics.projectsRequiringRevisions / statistics.totalCompleted) * 100)
    : 0;

  // Get max count for chart scaling
  const maxMonthlyCount = Math.max(...statistics.completionsByMonth.map(m => m.count), 1);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-yellow-400" />
                Completion Statistics
              </CardTitle>
              <CardDescription className="mt-1">
                Overview of project completion metrics and performance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilter && (
                <Badge variant="outline" className="border-yellow-400/20">
                  <Filter className="h-3 w-3 mr-1" />
                  Filtered
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="border-yellow-400/20 hover:bg-yellow-400/10"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide' : 'Filter'}
              </Button>
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Date Range Filters */}
        {showFilters && (
          <CardContent className="border-t border-yellow-400/20 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                  className="border-yellow-400/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  max={formatDateForInput(new Date())}
                  className="border-yellow-400/20"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleApplyFilter}
                disabled={isApplyingFilter || (!dateFrom && !dateTo)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                {isApplyingFilter ? 'Applying...' : 'Apply Filter'}
              </Button>
              {hasActiveFilter && (
                <Button
                  variant="outline"
                  onClick={handleClearFilter}
                  disabled={isApplyingFilter}
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filter
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Requirement 10.1: Display count of completed projects */}
        <StatCard
          icon={CheckCircle2}
          label="Completed Projects"
          value={statistics.totalCompleted}
          iconColor="text-yellow-400"
        />

        {/* Requirement 10.2: Show average time from award to completion */}
        <StatCard
          icon={Clock}
          label="Avg. Time to Complete"
          value={`${statistics.averageTimeToCompletion} days`}
          subtitle={statistics.totalCompleted > 0 ? 'From award to completion' : 'No data'}
          iconColor="text-yellow-400"
        />

        {/* Requirement 10.3: Display count of projects requiring revisions */}
        <StatCard
          icon={RefreshCw}
          label="Projects with Revisions"
          value={statistics.projectsRequiringRevisions}
          subtitle={`${revisionRate}% revision rate`}
          iconColor="text-yellow-400"
        />

        {/* Requirement 10.4: Show total number of deliverables received */}
        <StatCard
          icon={FileText}
          label="Total Deliverables"
          value={statistics.totalDeliverablesReceived}
          subtitle={statistics.totalCompleted > 0 
            ? `${Math.round(statistics.totalDeliverablesReceived / statistics.totalCompleted)} avg per project`
            : 'No data'
          }
          iconColor="text-yellow-400"
        />
      </div>

      {/* Monthly Completions Chart */}
      {statistics.completionsByMonth.length > 0 && (
        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-400" />
              Completions by Month
            </CardTitle>
            <CardDescription>
              Monthly breakdown of completed projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statistics.completionsByMonth.map((monthData) => {
                const percentage = (monthData.count / maxMonthlyCount) * 100;
                
                return (
                  <div key={monthData.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatMonth(monthData.month)}</span>
                      <span className="text-muted-foreground">
                        {monthData.count} project{monthData.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {statistics.totalCompleted === 0 && (
        <Card className="border-yellow-400/20">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No completed projects yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Statistics will appear once projects are completed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
