/**
 * CompletionStatistics Component Example
 * 
 * This example demonstrates how to use the CompletionStatistics component
 * to display project completion metrics and analytics.
 */

'use client';

import { useState, useEffect } from 'react';
import { CompletionStatistics, CompletionStatistics as Stats } from './completion-statistics';

export function CompletionStatisticsExample() {
  const [statistics, setStatistics] = useState<Stats>({
    totalCompleted: 0,
    averageTimeToCompletion: 0,
    projectsRequiringRevisions: 0,
    totalDeliverablesReceived: 0,
    completionsByMonth: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  // Simulate fetching statistics
  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async (dateFrom?: Date, dateTo?: Date) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock data
    const mockStats: Stats = {
      totalCompleted: 24,
      averageTimeToCompletion: 18.5,
      projectsRequiringRevisions: 8,
      totalDeliverablesReceived: 156,
      completionsByMonth: [
        { month: '2024-01', count: 3 },
        { month: '2024-02', count: 5 },
        { month: '2024-03', count: 7 },
        { month: '2024-04', count: 4 },
        { month: '2024-05', count: 5 },
      ],
    };

    // Apply date filtering if provided
    if (dateFrom || dateTo) {
      // In a real app, this would be handled by the API
      const filteredMonths = mockStats.completionsByMonth.filter((m) => {
        const [year, month] = m.month.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        
        if (dateFrom && monthDate < dateFrom) return false;
        if (dateTo && monthDate > dateTo) return false;
        return true;
      });

      const filteredTotal = filteredMonths.reduce((sum, m) => sum + m.count, 0);
      
      setStatistics({
        ...mockStats,
        totalCompleted: filteredTotal,
        completionsByMonth: filteredMonths,
      });
    } else {
      setStatistics(mockStats);
    }

    setIsLoading(false);
  };

  const handleRefresh = async () => {
    await fetchStatistics();
  };

  const handleDateRangeChange = async (dateFrom?: Date, dateTo?: Date) => {
    await fetchStatistics(dateFrom, dateTo);
  };

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Completion Statistics Example</h1>
        <p className="text-muted-foreground">
          View comprehensive metrics about completed projects
        </p>
      </div>

      <CompletionStatistics
        statistics={statistics}
        onRefresh={handleRefresh}
        onDateRangeChange={handleDateRangeChange}
        isLoading={isLoading}
      />

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Usage:</h2>
        <pre className="text-sm overflow-x-auto">
{`import { CompletionStatistics } from '@/components/client/completion-statistics';
import { useState, useEffect } from 'react';

function StatisticsPage() {
  const [statistics, setStatistics] = useState<CompletionStatistics>({
    totalCompleted: 0,
    averageTimeToCompletion: 0,
    projectsRequiringRevisions: 0,
    totalDeliverablesReceived: 0,
    completionsByMonth: [],
  });

  useEffect(() => {
    async function fetchStats() {
      const response = await fetch('/api/statistics/completion');
      const data = await response.json();
      setStatistics(data.statistics);
    }
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    const response = await fetch('/api/statistics/completion');
    const data = await response.json();
    setStatistics(data.statistics);
  };

  const handleDateRangeChange = async (dateFrom?: Date, dateTo?: Date) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString());
    if (dateTo) params.append('dateTo', dateTo.toISOString());
    
    const response = await fetch(\`/api/statistics/completion?\${params}\`);
    const data = await response.json();
    setStatistics(data.statistics);
  };

  return (
    <CompletionStatistics
      statistics={statistics}
      onRefresh={handleRefresh}
      onDateRangeChange={handleDateRangeChange}
    />
  );
}`}
        </pre>
      </div>

      <div className="mt-4 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Features:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Display total completed projects count</li>
          <li>Show average time from award to completion</li>
          <li>Display projects requiring revisions with percentage</li>
          <li>Show total deliverables received with average per project</li>
          <li>Monthly breakdown chart with visual bars</li>
          <li>Date range filtering with from/to date pickers</li>
          <li>Refresh button to reload statistics</li>
          <li>Empty state when no data available</li>
          <li>Responsive design for mobile and desktop</li>
        </ul>
      </div>
    </div>
  );
}
