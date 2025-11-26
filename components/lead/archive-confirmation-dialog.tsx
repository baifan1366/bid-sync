"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { ARCHIVE_PROPOSAL } from "@/lib/graphql/mutations"
import { Archive, Loader2, AlertTriangle } from "lucide-react"

interface ArchiveConfirmationDialogProps {
  proposalId: string
  proposalTitle: string
  proposalStatus: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchiveConfirmationDialog({
  proposalId,
  proposalTitle,
  proposalStatus,
  open,
  onOpenChange,
}: ArchiveConfirmationDialogProps) {
  const [reason, setReason] = useState("")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: ARCHIVE_PROPOSAL,
          variables: {
            proposalId,
            reason: reason || undefined,
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to archive proposal")
      }

      return result.data.archiveProposal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["archived-count"] })
      onOpenChange(false)
      setReason("")
      toast({
        title: "Proposal Archived",
        description: `"${proposalTitle}" has been moved to archived proposals.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Archive Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleArchive = () => {
    archiveMutation.mutate()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20 sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-black dark:text-white">
            <Archive className="h-5 w-5 text-yellow-400" />
            Archive Proposal
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to archive{" "}
              <strong className="text-black dark:text-white">"{proposalTitle}"</strong>?
            </p>

            <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
              <p className="text-sm font-semibold text-yellow-400 mb-1">
                ℹ️ What happens when you archive
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>The proposal will be moved to archived proposals</li>
                <li>All data will be preserved for reference</li>
                <li>The proposal will be read-only</li>
                <li>You can unarchive it later if needed</li>
              </ul>
            </div>

            {proposalStatus === "draft" && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    This proposal is still in <strong>draft</strong> status. Consider
                    submitting it before archiving.
                  </p>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="reason" className="text-sm text-black dark:text-white">
            Reason (Optional)
          </Label>
          <Textarea
            id="reason"
            placeholder="Why are you archiving this proposal?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-yellow-400/20 focus-visible:ring-yellow-400 min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            This will be saved for your records
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={archiveMutation.isPending}
            className="border-yellow-400/20"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {archiveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Archive Proposal
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
