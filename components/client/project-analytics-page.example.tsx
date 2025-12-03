/**
 * Project Analytics Page Example
 * 
 * This example demonstrates how to use both ExportRequest and CompletionStatistics
 * components together to create a comprehensive project analytics dashboard.
 */

'use client';

import { useState, useEffect } from 'react';
import { ExportRequest, ProjectExport } from './export-request';
import { CompletionStatistics, CompletionStatistics as Stats } from './completion-statistics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, FileDown } from 'lucide-react';

interface ProjectAnalyticsPageProps {
  projectId?: string;
}

export function ProjectAnalyticsPageExample({ projectId }: ProjectAnalyticsPageProps) {
  // Statistics state
  const [statistics, setStatistics] = useState<Stats>({
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
  });

  // Exports state
  const [exports, setExports] = useState<ProjectExport[]>([
    {
      id: '1',
      projectId: projectId || 'example-project',
      requestedBy: 'user-1',
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'completed',
      exportPath: 'exports/project-export-1.json',
      exportSize: 1024 * 1024 * 5,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  // Fetch statistics
  const fetchStatistics = async (dateFrom?: Date, dateTo?: Date) => {
    setIsLoading(true);
    
    try {
      // In a real app, this would be an API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Mock filtered data
      if (dateFrom || dateTo) {
        const filteredMonths = statistics.completionsByMonth.filter((m) => {
          const [year, month] = m.month.split('-').map(Number);
          const monthDate = new Date(year, month - 1);
          
          if (dateFrom && monthDate < dateFrom) return false;
          if (dateTo && monthDate > dateTo) return false;
          return true;
        });

        const filteredTotal = filteredMonths.reduce((sum, m) => sum + m.count, 0);
        
        setStatistics({
          ...statistics,
          totalCompleted: filteredTotal,
          completionsByMonth: filteredMonths,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch exports
  const fetchExports = async () => {
    // In a real app, this would be an API call
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  // Handle export request
  const handleRequestExport = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newExport: ProjectExport = {
      id: String(exports.length + 1),
      projectId: projectId || 'example-project',
      requestedBy: 'user-1',
      requestedAt: new Date(),
      status: 'pending',
    };

    setExports([newExport, ...exports]);

    // Simulate processing
    setTimeout(() => {
      setExports((prev) =>
        prev.map((exp) =>
          exp.id === newExport.id
            ? { ...exp, status: 'processing' as const }
            : exp
        )
      );
    }, 2000);

    // Simulate completion
    setTimeout(() => {
      setExports((prev) =>
        prev.map((exp) =>
          exp.id === newExport.id
            ? {
                ...exp,
                status: 'completed' as const,
                exportPath: `exports/project-export-${newExport.id}.json`,
                exportSize: 1024 * 1024 * 4,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              }
            : exp
        )
      );
    }, 5000);
  };

  // Handle export download
  const handleDownload = async (exportId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return `https://example.com/download/${exportId}`;
  };

  // Handle statistics refresh
  const handleRefresh = async () => {
    await fetchStatistics();
  };

  // Handle date range change
  const handleDateRangeChange = async (dateFrom?: Date, dateTo?: Date) => {
    await fetchStatistics(dateFrom, dateTo);
  };

  return (
    <div className="container max-w-7xl py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Analytics</h1>
        <p className="text-muted-foreground">
          View completion statistics and export project data
        </p>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="statistics" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="exports" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exports
          </TabsTrigger>
        </TabsList>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-6">
          <CompletionStatistics
            statistics={statistics}
            onRefresh={handleRefresh}
            onDateRangeChange={handleDateRangeChange}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Exports Tab */}
        <TabsContent value="exports" className="space-y-6">
          <ExportRequest
            projectId={projectId || 'example-project'}
            exports={exports}
            onRequestExport={handleRequestExport}
            onDownload={handleDownload}
          />

          {/* Export Information Card */}
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>About Project Exports</CardTitle>
              <CardDescription>
                What's included in a project export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>Complete project details and metadata</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>All proposals with version history</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>All deliverables with download links</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>Workspace documents and content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>Comments and communication history</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>Export metadata and timestamps</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration Notes */}
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Integration Example:</h2>
        <pre className="text-sm overflow-x-auto">
{`// Server Component (app/analytics/page.tsx)
import { StatisticsService } from '@/lib/statistics-service';
import { ExportService } from '@/lib/export-service';
import { ProjectAnalyticsClient } from './client';

export default async function AnalyticsPage() {
  // Fetch initial data server-side
  const statsResult = await StatisticsService.getCompletionStatistics();
  const exportsResult = await ExportService.getExportsByProject(projectId, userId);

  return (
    <ProjectAnalyticsClient
      initialStatistics={statsResult.statistics}
      initialExports={exportsResult.exports}
      projectId={projectId}
    />
  );
}

// Client Component (app/analytics/client.tsx)
'use client';

import { ExportRequest } from '@/components/client/export-request';
import { CompletionStatistics } from '@/components/client/completion-statistics';

export function ProjectAnalyticsClient({ 
  initialStatistics, 
  initialExports,
  projectId 
}) {
  const [statistics, setStatistics] = useState(initialStatistics);
  const [exports, setExports] = useState(initialExports);

  const handleRequestExport = async () => {
    const response = await fetch(\`/api/projects/\${projectId}/exports\`, {
      method: 'POST',
    });
    const data = await response.json();
    setExports([data.export, ...exports]);
  };

  const handleDownload = async (exportId: string) => {
    const response = await fetch(\`/api/exports/\${exportId}/download\`);
    const data = await response.json();
    return data.url;
  };

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
    <div className="space-y-6">
      <CompletionStatistics
        statistics={statistics}
        onRefresh={handleRefresh}
        onDateRangeChange={handleDateRangeChange}
      />
      
      <ExportRequest
        projectId={projectId}
        exports={exports}
        onRequestExport={handleRequestExport}
        onDownload={handleDownload}
      />
    </div>
  );
}`}
        </pre>
      </div>
    </div>
  );
}
