"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  FileText,
  ArrowRight,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmationStepProps {
  success: boolean
  proposalId: string
  projectId: string
  submittedAt?: string
  errors?: string[]
  onRetry?: () => void
  proposalTitle?: string
}

export function ConfirmationStep({
  success,
  proposalId,
  projectId,
  submittedAt,
  errors = [],
  onRetry,
  proposalTitle,
}: ConfirmationStepProps) {
  const router = useRouter()

  // Auto-redirect on success after 3 seconds
  useEffect(() => {
    if (success && submittedAt) {
      const timer = setTimeout(() => {
        handleViewProposal()
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [success, submittedAt])

  // Navigate to proposal detail view
  const handleViewProposal = () => {
    // Navigate to the proposal detail page
    // Adjust the route based on your app's routing structure
    router.push(`/workspace?proposal=${proposalId}`)
  }

  // Format submission timestamp
  const formatSubmissionTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return timestamp
    }
  }

  // Success state
  if (success && submittedAt) {
    return (
      <div className="space-y-6" role="region" aria-labelledby="success-title">
        {/* Success Icon and Message */}
        <div className="flex flex-col items-center justify-center py-8 space-y-4" role="status" aria-live="polite">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl animate-pulse" aria-hidden="true" />
            <div className="relative bg-yellow-400 rounded-full p-6">
              <CheckCircle2 className="w-16 h-16 text-black" aria-hidden="true" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 id="success-title" className="text-2xl font-bold text-black dark:text-white">
              Proposal Submitted Successfully!
            </h3>
            <p className="text-muted-foreground max-w-md">
              Your proposal has been submitted and is now under review. 
              The client will be notified and you'll receive updates via email.
            </p>
          </div>
        </div>

        {/* Submission Details Card */}
        <Card className="border-yellow-400/40 bg-yellow-400/5">
          <div className="p-6 space-y-4" role="region" aria-labelledby="submission-details-heading">
            <div className="flex items-center gap-2 pb-2 border-b border-yellow-400/20">
              <FileText className="w-5 h-5 text-yellow-400" aria-hidden="true" />
              <h4 id="submission-details-heading" className="font-semibold text-black dark:text-white">
                Submission Details
              </h4>
            </div>

            <div className="space-y-3">
              {/* Proposal Title */}
              {proposalTitle && (
                <div className="flex items-start gap-3">
                  <div className="w-32 text-sm text-muted-foreground shrink-0">
                    Proposal Title
                  </div>
                  <div className="flex-1 text-sm font-medium text-black dark:text-white">
                    {proposalTitle}
                  </div>
                </div>
              )}

              {/* Proposal ID */}
              <div className="flex items-start gap-3">
                <div className="w-32 text-sm text-muted-foreground shrink-0">
                  Proposal ID
                </div>
                <div className="flex-1 text-sm font-mono text-black dark:text-white">
                  {proposalId}
                </div>
              </div>

              {/* Submission Time */}
              <div className="flex items-start gap-3">
                <div className="w-32 text-sm text-muted-foreground shrink-0">
                  Submitted At
                </div>
                <div className="flex-1 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  {formatSubmissionTime(submittedAt)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Next Steps Card */}
        <Card className="border-yellow-400/20">
          <div className="p-6 space-y-4">
            <h4 className="font-semibold text-black dark:text-white">
              What Happens Next?
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-yellow-400">1</span>
                </div>
                <span>
                  The client will receive an email notification about your submission
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-yellow-400">2</span>
                </div>
                <span>
                  Your proposal will be reviewed along with other submissions
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-yellow-400">3</span>
                </div>
                <span>
                  You'll receive email updates on the status of your proposal
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-yellow-400">4</span>
                </div>
                <span>
                  You can track your proposal status in your workspace
                </span>
              </li>
            </ul>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            onClick={handleViewProposal}
            className="bg-yellow-400 hover:bg-yellow-500 text-black focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
            aria-label="View submitted proposal"
          >
            View Proposal
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </div>

        {/* Auto-redirect notice */}
        <p className="text-center text-xs text-muted-foreground" role="status" aria-live="polite">
          You will be automatically redirected to your proposal in a few seconds...
        </p>
      </div>
    )
  }

  // Error state
  return (
    <div className="space-y-6" role="region" aria-labelledby="error-title">
      {/* Error Icon and Message */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4" role="alert" aria-live="assertive">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl" aria-hidden="true" />
          <div className="relative bg-red-500 rounded-full p-6">
            <XCircle className="w-16 h-16 text-white" aria-hidden="true" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 id="error-title" className="text-2xl font-bold text-black dark:text-white">
            Submission Failed
          </h3>
          <p className="text-muted-foreground max-w-md">
            We encountered an error while submitting your proposal. 
            Please review the errors below and try again.
          </p>
        </div>
      </div>

      {/* Error Details Card */}
      <Card className="border-red-500/40 bg-red-500/5">
        <div className="p-6 space-y-4" role="region" aria-labelledby="error-details-heading">
          <div className="flex items-center gap-2 pb-2 border-b border-red-500/20">
            <XCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
            <h4 id="error-details-heading" className="font-semibold text-black dark:text-white">
              Error Details
            </h4>
          </div>

          {errors.length > 0 ? (
            <ul className="space-y-2">
              {errors.map((error, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-2" />
                  <span className="text-red-700 dark:text-red-300">
                    {error}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-300">
              An unknown error occurred. Please try again or contact support if the problem persists.
            </p>
          )}
        </div>
      </Card>

      {/* Troubleshooting Tips */}
      <Card className="border-yellow-400/20">
        <div className="p-6 space-y-4">
          <h4 className="font-semibold text-black dark:text-white">
            Troubleshooting Tips
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Check your internet connection and try again</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Ensure all required fields are completed correctly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Verify that file uploads meet size and type requirements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>If the problem persists, contact support for assistance</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-4 pt-4">
        {onRetry && (
          <Button
            onClick={onRetry}
            className="bg-yellow-400 hover:bg-yellow-500 text-black focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
            aria-label="Retry proposal submission"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Retry Submission
          </Button>
        )}
      </div>
    </div>
  )
}
