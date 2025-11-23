"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Ban, Mail } from "lucide-react"
import type { User } from "@/lib/graphql/types"

interface SuspendUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void>
}

export function SuspendUserDialog({
  user,
  open,
  onOpenChange,
  onConfirm
}: SuspendUserDialogProps) {
  const [reason, setReason] = useState("")
  const [isSuspending, setIsSuspending] = useState(false)
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus reason textarea when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        reasonTextareaRef.current?.focus()
      }, 0)
    }
  }, [open])

  if (!user) return null

  const handleConfirm = async () => {
    if (!reason.trim()) return

    setIsSuspending(true)
    try {
      await onConfirm(reason)
      onOpenChange(false)
      setReason("")
    } finally {
      setIsSuspending(false)
    }
  }

  const formatRoleLabel = (role: User['role']) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Ban className="h-5 w-5" />
            Suspend User Account
          </DialogTitle>
          <DialogDescription>
            This action will prevent the user from accessing the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Information */}
          <div className="border border-yellow-400/20 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">User Details</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.email}</span>
              </div>
              {user.fullName && (
                <div className="text-sm text-muted-foreground">
                  {user.fullName}
                </div>
              )}
              <Badge className="bg-blue-500 text-white">
                {formatRoleLabel(user.role)}
              </Badge>
            </div>
          </div>

          {/* Suspension Reason */}
          <div className="space-y-2">
            <label htmlFor="suspension-reason" className="text-sm font-medium">
              Suspension Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              ref={reasonTextareaRef}
              id="suspension-reason"
              placeholder="Please provide a detailed reason for suspending this account..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
              aria-required="true"
              aria-invalid={!reason.trim()}
            />
            <p className="text-sm text-muted-foreground">
              This reason will be logged and may be shown to the user.
            </p>
          </div>

          {/* Warning */}
          <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-500">Warning</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• User will be immediately logged out</li>
                  <li>• All login attempts will be blocked</li>
                  <li>• User will see a suspension message</li>
                  <li>• This action will be logged in the audit trail</li>
                  <li>• Account can be reactivated later by an admin</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setReason("")
            }}
            disabled={isSuspending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSuspending || !reason.trim()}
            className="w-full sm:w-auto"
          >
            <Ban className="h-4 w-4 mr-2" aria-hidden="true" />
            {isSuspending ? 'Suspending...' : 'Suspend Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
