"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRealtimeRankings } from "@/hooks/use-realtime-rankings"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Loader2, FileText, Calendar, Users, CheckCircle2, AlertCircle } from "lucide-react"
import { EXPORT_SCORING } from "@/lib/graphql/mutations"
import { GET_PROJECT, GET_PROPOSAL_RANKINGS } from "@/lib/graphql/queries"
import type { ScoringExport } from "@/lib/graphql/types"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

interface ScoringExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export function ScoringExportDialog({
  open,
  onOpenChange,
  projectId,
}: ScoringExportDialogProps) {
  const { toast } = useToast()
  const [exportResult, setExportResult] = useState<ScoringExport | null>(null)

  // Fetch project details
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_PROJECT,
          variables: { id: projectId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch project')
      return result.data.project
    },
    enabled: open,
  })

  // Fetch proposal rankings to get counts
  const { data: rankingsData, isLoading: isLoadingRankings, refetch: refetchRankings } = useQuery({
    queryKey: ['proposalRankings', projectId],
    queryFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_PROPOSAL_RANKINGS,
          variables: { projectId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to fetch rankings')
      return result.data.proposalRankings
    },
    enabled: open,
  })

  // Set up real-time updates for rankings (Requirements: 5.5)
  useRealtimeRankings({
    projectId,
    onRankingUpdated: () => {
      if (open) refetchRankings()
    },
    onRankingInserted: () => {
      if (open) refetchRankings()
    },
  })

  // Export scoring mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: EXPORT_SCORING,
          variables: { projectId },
        }),
      })
      const result = await response.json()
      if (result.errors) throw new Error(result.errors[0]?.message || 'Failed to export scoring')
      return result.data.exportScoring as ScoringExport
    },
    onSuccess: (data) => {
      setExportResult(data)
      toast({
        title: "Export Generated",
        description: "Your scoring report is ready to download.",
      })
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate export",
        variant: "destructive",
      })
    },
  })

  const handleExport = () => {
    setExportResult(null)
    exportMutation.mutate()
  }

  const handleDownload = () => {
    if (exportResult?.url) {
      window.open(exportResult.url, '_blank')
      toast({
        title: "Download Started",
        description: "Your scoring report is being downloaded.",
      })
    }
  }

  const handleClose = () => {
    setExportResult(null)
    onOpenChange(false)
  }

  const isLoading = isLoadingProject || isLoadingRankings
  const scoredCount = rankingsData?.filter((r: any) => r.isFullyScored).length || 0
  const totalCount = rankingsData?.length || 0
  const unscoredCount = totalCount - scoredCount

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Export Scoring Report</DialogTitle>
          <DialogDescription>
            Generate a comprehensive PDF report of all proposal scores and rankings for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
            </div>
          )}

          {/* Export Preview */}
          {!isLoading && !exportResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-yellow-400" />
                  Export Contents
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Project Name:</span>
                    <span className="font-medium">{projectData?.title || 'Loading...'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Proposals:</span>
                    <span className="font-medium">{totalCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fully Scored:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {scoredCount}
                    </span>
                  </div>
                  {unscoredCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Unscored:</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        {unscoredCount}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Export Date:</span>
                    <span className="font-medium">{format(new Date(), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>

              {/* What's Included */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Report Includes:</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <span>Project information and client details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <span>Scoring template with criteria and weights</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <span>All proposals with scores, rankings, and notes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <span>Summary of unscored proposals (if any)</span>
                  </li>
                </ul>
              </div>

              {/* Warning for unscored proposals */}
              {unscoredCount > 0 && (
                <Alert className="border-orange-500/50 bg-orange-500/5">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-orange-700 dark:text-orange-400">
                    {unscoredCount} {unscoredCount === 1 ? 'proposal has' : 'proposals have'} not been scored yet.
                    The export will include a summary of unscored proposals.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Export Success */}
          {exportResult && (
            <div className="space-y-4">
              <Alert className="border-green-500/50 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Your scoring report has been generated successfully!
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="font-medium">Scoring Report - {projectData?.title}</div>
                      <div className="text-sm text-muted-foreground">
                        Generated on {format(new Date(), 'MMM dd, yyyy \'at\' h:mm a')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Link expires on {format(new Date(exportResult.expiresAt), 'MMM dd, yyyy \'at\' h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert className="border-blue-500/50 bg-blue-500/5">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  Download link expires in 24 hours. Please save the file to your device.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          {!exportResult ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={exportMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending || isLoading}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Export
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Close
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
