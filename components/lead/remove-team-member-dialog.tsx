"use client"

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
import { useToast } from "@/components/ui/use-toast"
import { REMOVE_TEAM_MEMBER } from "@/lib/graphql/mutations"
import { AlertTriangle, Loader2 } from "lucide-react"

interface TeamMember {
  userId: string
  user?: {
    fullName?: string
    email?: string
  }
}

interface RemoveTeamMemberDialogProps {
  member: TeamMember
  proposalId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RemoveTeamMemberDialog({
  member,
  proposalId,
  open,
  onOpenChange,
}: RemoveTeamMemberDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: REMOVE_TEAM_MEMBER,
          variables: {
            input: {
              proposalId,
              userId: member.userId,
            },
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to remove team member")
      }

      return result.data.removeTeamMember
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-proposal-team-members"] })
      queryClient.invalidateQueries({ queryKey: ["team-statistics"] })
      onOpenChange(false)
      toast({
        title: "Member Removed",
        description: `${memberName} has been removed from the team.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleRemove = () => {
    removeMutation.mutate()
  }

  const memberName = member.user?.fullName || member.user?.email || "this member"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-black dark:text-white">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Remove Team Member
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to remove <strong>{memberName}</strong> from this
              proposal team?
            </p>

            <p className="text-sm">
              This action will immediately revoke their access to this proposal.
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={removeMutation.isPending}
            className="border-yellow-400/20"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {removeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              "Remove Member"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
