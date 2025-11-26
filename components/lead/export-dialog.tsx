"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
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
import { useToast } from "@/components/ui/use-toast"
import {
  Download,
  Loader2,
  FileText,
  Mail,
  Check,
  AlertCircle,
} from "lucide-react"

interface ExportDialogProps {
  proposalId: string
  proposalTitle: string
  trigger?: React.ReactNode
}

export function ExportDialog({
  proposalId,
  proposalTitle,
  trigger,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [includeVersionHistory, setIncludeVersionHistory] = useState(true)
  const [includeTeamStats, setIncludeTeamStats] = useState(true)
  const [includeDocuments, setIncludeDocuments] = useState(true)
  const [emailRecipient, setEmailRecipient] = useState("")
  const [sendEmail, setSendEmail] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { toast } = useToast()

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/proposals/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          includeVersionHistory,
          includeTeamStats,
          includeDocuments,
          sendEmail,
          emailRecipient: sendEmail ? emailRecipient : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to export proposal")
      }

      if (sendEmail) {
        return await response.json()
      } else {
        // Download the PDF
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `proposal-${proposalTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        return { success: true }
      }
    },
    onSuccess: () => {
      setOpen(false)
      toast({
        title: "Export Successful",
        description: sendEmail
          ? `Proposal exported and sent to ${emailRecipient}`
          : "Proposal PDF downloaded successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleExport = () => {
    // Validate email if sending via email
    if (sendEmail) {
      if (!emailRecipient || emailRecipient.trim().length === 0) {
        setValidationError("Email address is required")
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailRecipient)) {
        setValidationError("Invalid email address format")
        return
      }
    }

    setValidationError(null)
    exportMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            className="border-yellow-400/20 hover:bg-yellow-400/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Proposal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <DialogTitle className="text-black dark:text-white">
            Export Proposal
          </DialogTitle>
          <DialogDescription>
            Generate a PDF export of your proposal with customizable options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Options */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-black dark:text-white">
              Include in Export
            </Label>

            <div className="space-y-3">
              {/* Version History */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="version-history"
                    className="text-sm text-black dark:text-white"
                  >
                    Version History
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include change logs and version details
                  </p>
                </div>
                <Switch
                  id="version-history"
                  checked={includeVersionHistory}
                  onCheckedChange={setIncludeVersionHistory}
                />
              </div>

              {/* Team Statistics */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-stats"
                    className="text-sm text-black dark:text-white"
                  >
                    Team Statistics
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include team member contributions
                  </p>
                </div>
                <Switch
                  id="team-stats"
                  checked={includeTeamStats}
                  onCheckedChange={setIncludeTeamStats}
                />
              </div>

              {/* Documents */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="documents"
                    className="text-sm text-black dark:text-white"
                  >
                    Document References
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Include uploaded document links
                  </p>
                </div>
                <Switch
                  id="documents"
                  checked={includeDocuments}
                  onCheckedChange={setIncludeDocuments}
                />
              </div>
            </div>
          </div>

          {/* Email Delivery */}
          <div className="space-y-3 pt-2 border-t border-yellow-400/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="send-email"
                  className="text-sm font-semibold text-black dark:text-white"
                >
                  Email Delivery
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send the PDF via email instead of downloading
                </p>
              </div>
              <Switch
                id="send-email"
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
            </div>

            {sendEmail && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label htmlFor="email" className="text-sm text-black dark:text-white">
                  Recipient Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailRecipient}
                  onChange={(e) => {
                    setEmailRecipient(e.target.value)
                    setValidationError(null)
                  }}
                  className={cn(
                    "border-yellow-400/20 focus-visible:ring-yellow-400",
                    validationError && "border-red-500"
                  )}
                />
                {validationError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {validationError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : sendEmail ? (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Export & Email
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
