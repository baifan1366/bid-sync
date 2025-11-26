"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { GENERATE_INVITATION } from "@/lib/graphql/mutations"
import {
  Copy,
  Check,
  UserPlus,
  Loader2,
  Link as LinkIcon,
  Hash,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamInvitationDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

interface GeneratedInvitation {
  id: string
  code: string
  token: string
  expiresAt: string
  isMultiUse: boolean
}

export function TeamInvitationDialog({
  projectId,
  trigger,
}: TeamInvitationDialogProps) {
  const [open, setOpen] = useState(false)
  const [isMultiUse, setIsMultiUse] = useState(false)
  const [expirationDays, setExpirationDays] = useState(7)
  const [generatedInvitation, setGeneratedInvitation] =
    useState<GeneratedInvitation | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GENERATE_INVITATION,
          variables: {
            input: {
              projectId,
              expirationDays,
              isMultiUse,
            },
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to generate invitation")
      }

      return result.data.generateInvitation
    },
    onSuccess: (data) => {
      setGeneratedInvitation(data)
      queryClient.invalidateQueries({ queryKey: ["active-invitations", projectId] })
      toast({
        title: "Invitation Generated",
        description: "Share the code or link with your team members.",
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

  const handleGenerate = () => {
    // Validate expiration days
    if (!expirationDays || expirationDays < 1 || expirationDays > 30) {
      setValidationError("Expiration must be between 1 and 30 days")
      return
    }

    setValidationError(null)
    generateMutation.mutate()
  }

  const handleCopyCode = async () => {
    if (generatedInvitation) {
      await navigator.clipboard.writeText(generatedInvitation.code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
      toast({
        title: "Code Copied",
        description: "Invitation code copied to clipboard.",
      })
    }
  }

  const handleCopyLink = async () => {
    if (generatedInvitation) {
      const link = `${window.location.origin}/invitations/${generatedInvitation.token}`
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard.",
      })
    }
  }

  const handleClose = () => {
    setOpen(false)
    setGeneratedInvitation(null)
    setCopiedCode(false)
    setCopiedLink(false)
  }

  const invitationLink = generatedInvitation
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invitations/${generatedInvitation.token}`
    : ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-black">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Team Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-white">
            Generate Team Invitation
          </DialogTitle>
          <DialogDescription>
            Create an invitation link or code to add members to your bidding team.
          </DialogDescription>
        </DialogHeader>

        {!generatedInvitation ? (
          <div className="space-y-6 py-4">
            {/* Expiration Days */}
            <div className="space-y-2">
              <Label htmlFor="expiration" className="text-black dark:text-white">
                Expiration (days) *
              </Label>
              <Input
                id="expiration"
                type="number"
                min="1"
                max="30"
                value={expirationDays}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 7
                  setExpirationDays(value)
                  setValidationError(null)
                }}
                className={cn(
                  "border-yellow-400/20 focus-visible:ring-yellow-400",
                  validationError && "border-red-500"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Invitation will expire after {expirationDays} days (1-30 days allowed)
              </p>
              {validationError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationError}
                </p>
              )}
            </div>

            {/* Multi-use Toggle */}
            <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
              <div className="space-y-0.5">
                <Label htmlFor="multi-use" className="text-black dark:text-white">
                  Multi-use Invitation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow multiple team members to use this invitation
                </p>
              </div>
              <Switch
                id="multi-use"
                checked={isMultiUse}
                onCheckedChange={setIsMultiUse}
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Generate Invitation
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Success Message */}
            <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-yellow-400" />
                <p className="font-semibold text-black dark:text-white">
                  Invitation Generated Successfully
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Share the code or link below with your team members.
              </p>
            </div>

            {/* Invitation Details */}
            <div className="space-y-4">
              {/* Code */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-yellow-400" />
                  <Label className="text-black dark:text-white">
                    Invitation Code
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={generatedInvitation.code}
                    readOnly
                    className="font-mono text-lg border-yellow-400/20 bg-yellow-400/5"
                  />
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    className="shrink-0 border-yellow-400/20 hover:bg-yellow-400/10"
                  >
                    {copiedCode ? (
                      <Check className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-yellow-400" />
                  <Label className="text-black dark:text-white">
                    Invitation Link
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={invitationLink}
                    readOnly
                    className="font-mono text-sm border-yellow-400/20 bg-yellow-400/5"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="shrink-0 border-yellow-400/20 hover:bg-yellow-400/10"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge
                  variant="outline"
                  className="border-yellow-400/30 text-yellow-400"
                >
                  {generatedInvitation.isMultiUse ? "Multi-use" : "Single-use"}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-yellow-400/30 text-yellow-400"
                >
                  Expires: {new Date(generatedInvitation.expiresAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>

            {/* Close Button */}
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full border-yellow-400/20 hover:bg-yellow-400/10"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
