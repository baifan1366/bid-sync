"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle } from "lucide-react"
import type { Admin } from "@/lib/graphql/types"

interface RemoveAdminDialogProps {
  admin: Admin
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  isLastAdmin: boolean
  isSelf: boolean
}

export function RemoveAdminDialog({ 
  admin, 
  open, 
  onOpenChange, 
  onConfirm, 
  isLastAdmin, 
  isSelf 
}: RemoveAdminDialogProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canRemove = !isLastAdmin && !isSelf

  const handleConfirm = async () => {
    if (!canRemove) return

    setIsSubmitting(true)

    try {
      await onConfirm()
      
      toast({
        title: "Admin privileges removed",
        description: `${admin.email} no longer has admin access`,
      })
      
      // Close dialog and reset form
      onOpenChange(false)
      setReason("")
    } catch (error: any) {
      const errorMessage = error.message || "Failed to remove admin privileges"
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Remove Admin Privileges</DialogTitle>
          <DialogDescription>
            This action will revoke administrator access for this user.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="rounded-lg border border-yellow-400/20 bg-white dark:bg-black p-4">
            <p className="text-sm font-medium mb-1">Administrator</p>
            <p className="text-sm text-muted-foreground">{admin.email}</p>
            {admin.fullName && (
              <p className="text-sm text-muted-foreground">{admin.fullName}</p>
            )}
          </div>

          {isSelf && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-500 mb-1">Cannot Remove Self</h4>
                <p className="text-sm text-muted-foreground">
                  You cannot remove your own admin privileges. Please ask another administrator to perform this action.
                </p>
              </div>
            </div>
          )}

          {isLastAdmin && !isSelf && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-500 mb-1">Last Administrator</h4>
                <p className="text-sm text-muted-foreground">
                  This is the last administrator on the platform. At least one administrator must remain to manage the system.
                </p>
              </div>
            </div>
          )}

          {canRemove && (
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for removing admin privileges..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                aria-label="Reason for removing admin privileges"
              />
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setReason("")
            }}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !canRemove}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Removing..." : "Remove Admin Privileges"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
