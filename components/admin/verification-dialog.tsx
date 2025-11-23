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
import { CheckCircle, XCircle, FileText, Building, Mail, Calendar, Clock } from "lucide-react"
import type { User } from "@/lib/graphql/types"

interface VerificationDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDecision: (approved: boolean, reason?: string) => Promise<void>
}

export function VerificationDialog({
  user,
  open,
  onOpenChange,
  onDecision
}: VerificationDialogProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectForm, setShowRejectForm] = useState(false)
  const rejectionTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus rejection textarea when reject form is shown
  useEffect(() => {
    if (showRejectForm) {
      setTimeout(() => {
        rejectionTextareaRef.current?.focus()
      }, 0)
    }
  }, [showRejectForm])

  if (!user) return null

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onDecision(true)
      onOpenChange(false)
      setShowRejectForm(false)
      setRejectionReason("")
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      return
    }
    setIsApproving(true)
    try {
      await onDecision(false, rejectionReason)
      onOpenChange(false)
      setShowRejectForm(false)
      setRejectionReason("")
    } finally {
      setIsApproving(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>User Verification</DialogTitle>
          <DialogDescription>
            Review user information and decide whether to approve or reject their verification request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Information */}
          <div className="border border-yellow-400/20 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              User Information
            </h3>
            <div className="grid gap-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted-foreground">Email:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium break-all">{user.email}</span>
                  {user.emailVerified ? (
                    <Badge className="bg-green-500 text-white w-fit">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-yellow-400 text-yellow-400 w-fit">
                      <Clock className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-medium">{user.fullName || 'Not provided'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted-foreground">Role:</span>
                <Badge className="bg-blue-500 text-white w-fit">
                  {user.role.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted-foreground">Registration Date:</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Business Details (for clients) */}
          {user.role === 'client' && (
            <div className="border border-yellow-400/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Building className="h-4 w-4" />
                Business Details
              </h3>
              <div className="text-sm text-muted-foreground">
                Business information would be displayed here once the user profile system is extended.
              </div>
            </div>
          )}

          {/* Verification Documents */}
          <div className="border border-yellow-400/20 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Verification Documents
            </h3>
            <div className="text-sm text-muted-foreground">
              Document viewer will be implemented once document upload system is in place.
            </div>
          </div>

          {/* Current Status */}
          <div className="border border-yellow-400/20 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Current Status</h3>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-400 text-black">
                {user.verificationStatus === 'pending_verification' && 'Pending Verification'}
                {user.verificationStatus === 'verified' && 'Verified'}
                {user.verificationStatus === 'rejected' && 'Rejected'}
              </Badge>
            </div>
            {user.verificationReason && (
              <div className="text-sm">
                <span className="text-muted-foreground">Reason: </span>
                <span>{user.verificationReason}</span>
              </div>
            )}
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="border border-red-500/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-red-500">Rejection Reason</h3>
              <Textarea
                ref={rejectionTextareaRef}
                placeholder="Please provide a reason for rejecting this verification..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="resize-none"
                aria-label="Rejection reason"
                aria-required="true"
              />
              <p className="text-sm text-muted-foreground">
                This reason will be sent to the user via email.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!showRejectForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
                disabled={isApproving}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="bg-yellow-400 hover:bg-yellow-500 text-black w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectForm(false)
                  setRejectionReason("")
                }}
                disabled={isApproving}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isApproving || !rejectionReason.trim()}
                className="w-full sm:w-auto"
              >
                <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                {isApproving ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
