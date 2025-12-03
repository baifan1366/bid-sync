"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

interface ReadyForDeliveryButtonProps {
  projectId: string
  proposalId: string
  deliverablesCount: number
  onMarkReady: () => Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * ReadyForDeliveryButton Component
 * 
 * Handles marking a project as ready for client review with:
 * - Validation check for deliverables presence
 * - Confirmation dialog
 * - Status update trigger
 * 
 * Requirements: 2.1, 2.3
 */
export function ReadyForDeliveryButton({
  projectId,
  proposalId,
  deliverablesCount,
  onMarkReady,
  disabled = false,
  className,
}: ReadyForDeliveryButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Requirement 2.3: Validation check for deliverables presence
  const hasDeliverables = deliverablesCount > 0
  const canMarkReady = hasDeliverables && !disabled

  const handleClick = () => {
    setError(null)
    
    // Requirement 2.3: Prevent marking ready without deliverables
    if (!hasDeliverables) {
      setError('You must upload at least one deliverable before marking the project ready for delivery.')
      return
    }

    setDialogOpen(true)
  }

  const handleConfirm = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Requirement 2.1: Status update trigger
      await onMarkReady()
      
      setDialogOpen(false)
    } catch (err) {
      console.error('Error marking ready for delivery:', err)
      setError(err instanceof Error ? err.message : 'Failed to mark project ready for delivery')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={className}>
        {/* Requirement 2.3: Display error if no deliverables */}
        {error && (
          <Alert className="mb-4 border-red-500/20 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-500 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleClick}
          disabled={!canMarkReady || loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Marking Ready...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Mark Ready for Delivery
            </>
          )}
        </Button>

        {!hasDeliverables && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Upload at least one deliverable to mark the project ready
          </p>
        )}
      </div>

      {/* Requirement 2.1, 2.3: Confirmation dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-yellow-400" />
              Mark Project Ready for Delivery
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to mark this project as ready for client review. This will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Change the project status to "Pending Completion"</li>
                <li>Notify the client that deliverables are ready for review</li>
                <li>Prevent uploading additional deliverables until the client responds</li>
              </ul>
              <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <p className="text-sm font-medium text-black dark:text-white">
                  {deliverablesCount} deliverable{deliverablesCount !== 1 ? 's' : ''} will be submitted
                </p>
              </div>
              <p className="text-sm">
                Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={loading}
              className="border-yellow-400/20"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm & Mark Ready'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
