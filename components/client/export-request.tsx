'use client';

/**
 * ExportRequest Component
 * 
 * Allows users to request project exports, displays export status,
 * provides download links when ready, and shows expiry countdown.
 * 
 * Requirements: 9.1, 9.4, 9.5
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, FileDown, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProjectExport {
  id: string;
  projectId: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exportPath?: string;
  exportSize?: number;
  expiresAt?: Date;
  errorMessage?: string;
}

interface ExportRequestProps {
  projectId: string;
  exports?: ProjectExport[];
  onRequestExport: () => Promise<void>;
  onDownload: (exportId: string) => Promise<string | null>;
  className?: string;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Calculate time remaining until expiry
 */
function getTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Expired';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours}h`;
  }
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Get status badge configuration
 */
function getStatusBadge(status: ProjectExport['status']) {
  switch (status) {
    case 'pending':
      return {
        icon: Clock,
        label: 'Pending',
        className: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
      };
    case 'processing':
      return {
        icon: Loader2,
        label: 'Processing',
        className: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
        animate: true,
      };
    case 'completed':
      return {
        icon: CheckCircle2,
        label: 'Ready',
        className: 'bg-yellow-400 text-black hover:bg-yellow-500',
      };
    case 'failed':
      return {
        icon: XCircle,
        label: 'Failed',
        className: 'bg-red-500/10 text-red-500 border-red-500/20',
      };
  }
}

export function ExportRequest({
  projectId,
  exports = [],
  onRequestExport,
  onDownload,
  className,
}: ExportRequestProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleRequestExport = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      await onRequestExport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request export');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDownload = async (exportId: string) => {
    setDownloadingId(exportId);
    setError(null);

    try {
      const url = await onDownload(exportId);
      if (url) {
        // Trigger download
        window.open(url, '_blank');
      } else {
        setError('Failed to generate download link');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download export');
    } finally {
      setDownloadingId(null);
    }
  };

  // Get the most recent export
  const latestExport = exports.length > 0 ? exports[0] : null;
  const hasActiveExport = latestExport && ['pending', 'processing'].includes(latestExport.status);

  return (
    <Card className={cn('border-yellow-400/20', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-yellow-400" />
              Export Project Data
            </CardTitle>
            <CardDescription className="mt-1">
              Download a complete package of all project data including deliverables, documents, and proposals
            </CardDescription>
          </div>
          <Button
            onClick={handleRequestExport}
            disabled={isRequesting || hasActiveExport}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {isRequesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Request Export
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {exports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No exports requested yet</p>
            <p className="text-sm mt-1">Click "Request Export" to create your first export</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exports.map((exportItem) => {
              const statusConfig = getStatusBadge(exportItem.status);
              const StatusIcon = statusConfig.icon;
              const isExpired = exportItem.expiresAt && exportItem.expiresAt < currentTime;
              const canDownload = exportItem.status === 'completed' && !isExpired;

              return (
                <div
                  key={exportItem.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-yellow-400/20 bg-card hover:border-yellow-400/40 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig.className}>
                        <StatusIcon
                          className={cn(
                            'h-3 w-3 mr-1',
                            statusConfig.animate && 'animate-spin'
                          )}
                        />
                        {statusConfig.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Requested {new Date(exportItem.requestedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {exportItem.exportSize && (
                      <p className="text-sm text-muted-foreground">
                        Size: {formatFileSize(exportItem.exportSize)}
                      </p>
                    )}

                    {exportItem.expiresAt && exportItem.status === 'completed' && (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        <span className={cn(
                          isExpired ? 'text-red-500' : 'text-muted-foreground'
                        )}>
                          {isExpired ? 'Expired' : `Expires in ${getTimeRemaining(exportItem.expiresAt)}`}
                        </span>
                      </div>
                    )}

                    {exportItem.errorMessage && (
                      <p className="text-sm text-red-500">
                        Error: {exportItem.errorMessage}
                      </p>
                    )}
                  </div>

                  {canDownload && (
                    <Button
                      onClick={() => handleDownload(exportItem.id)}
                      disabled={downloadingId === exportItem.id}
                      size="sm"
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      {downloadingId === exportItem.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Alert className="border-yellow-400/20">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-sm">
            Export links are valid for 7 days. After expiration, you'll need to request a new export.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
