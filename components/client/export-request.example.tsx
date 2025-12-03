/**
 * ExportRequest Component Example
 * 
 * This example demonstrates how to use the ExportRequest component
 * to allow users to request project exports and download them.
 */

'use client';

import { useState, useEffect } from 'react';
import { ExportRequest, ProjectExport } from './export-request';

export function ExportRequestExample() {
  const [exports, setExports] = useState<ProjectExport[]>([]);
  const projectId = 'example-project-id';

  // Simulate fetching exports
  useEffect(() => {
    // In a real app, fetch exports from API
    const mockExports: ProjectExport[] = [
      {
        id: '1',
        projectId,
        requestedBy: 'user-1',
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: 'completed',
        exportPath: 'exports/project-export-1.json',
        exportSize: 1024 * 1024 * 5, // 5 MB
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      },
      {
        id: '2',
        projectId,
        requestedBy: 'user-1',
        requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        status: 'completed',
        exportPath: 'exports/project-export-2.json',
        exportSize: 1024 * 1024 * 3, // 3 MB
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Expired 3 days ago
      },
    ];

    setExports(mockExports);
  }, []);

  const handleRequestExport = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newExport: ProjectExport = {
      id: String(exports.length + 1),
      projectId,
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

  const handleDownload = async (exportId: string) => {
    // Simulate API call to get download URL
    await new Promise((resolve) => setTimeout(resolve, 500));

    // In a real app, this would return a signed URL from the API
    return `https://example.com/download/${exportId}`;
  };

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">Export Request Example</h1>
      
      <ExportRequest
        projectId={projectId}
        exports={exports}
        onRequestExport={handleRequestExport}
        onDownload={handleDownload}
      />

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Usage:</h2>
        <pre className="text-sm overflow-x-auto">
{`import { ExportRequest } from '@/components/client/export-request';

function ProjectPage({ projectId }: { projectId: string }) {
  const [exports, setExports] = useState<ProjectExport[]>([]);

  // Fetch exports on mount
  useEffect(() => {
    async function fetchExports() {
      const response = await fetch(\`/api/projects/\${projectId}/exports\`);
      const data = await response.json();
      setExports(data.exports);
    }
    fetchExports();
  }, [projectId]);

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

  return (
    <ExportRequest
      projectId={projectId}
      exports={exports}
      onRequestExport={handleRequestExport}
      onDownload={handleDownload}
    />
  );
}`}
        </pre>
      </div>
    </div>
  );
}
