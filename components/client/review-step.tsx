"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  FileIcon, 
  DollarSign, 
  Calendar, 
  FileText, 
  Users, 
  Edit,
  CheckCircle2
} from "lucide-react"
import type { ProposalDetails } from "./proposal-submission-wizard"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"
import { cn } from "@/lib/utils"

interface ReviewStepProps {
  proposalDetails: ProposalDetails
  additionalInfo: Record<string, any>
  requirements: AdditionalInfoRequirement[]
  onSubmit: () => Promise<void>
  onBack: () => void
  onEditStep: (stepIndex: number) => void
  isSubmitting?: boolean
}

export function ReviewStep({
  proposalDetails,
  additionalInfo,
  requirements,
  onSubmit,
  onBack,
  onEditStep,
  isSubmitting = false,
}: ReviewStepProps) {
  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "Not specified"
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Get field value display
  const getFieldValueDisplay = (requirement: AdditionalInfoRequirement, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">Not provided</span>
    }

    switch (requirement.fieldType) {
      case 'file':
        if (value.url && value.name) {
          return (
            <div className="flex items-center gap-3 p-3 border border-yellow-400/40 rounded-lg bg-yellow-400/5">
              <FileIcon className="w-6 h-6 text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black dark:text-white truncate">
                  {value.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {value.type} • {formatFileSize(value.size)}
                </p>
              </div>
            </div>
          )
        }
        return <span className="text-muted-foreground italic">No file uploaded</span>

      case 'number':
        return <span className="font-medium">{Number(value).toLocaleString()}</span>

      case 'date':
        try {
          const date = new Date(value)
          return <span className="font-medium">{date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        } catch {
          return <span className="font-medium">{value}</span>
        }

      case 'textarea':
        return (
          <div className="text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            {value}
          </div>
        )

      default:
        return <span className="font-medium">{value}</span>
    }
  }

  return (
    <div className="space-y-6" role="region" aria-labelledby="review-title">
      {/* Step Description */}
      <div className="space-y-2">
        <h3 id="review-title" className="text-lg font-semibold text-black dark:text-white">
          Review Your Submission
        </h3>
        <p className="text-sm text-muted-foreground" id="review-description">
          Please review all information before submitting your proposal. You can go back to any step to make changes.
        </p>
      </div>

      {/* Proposal Details Section */}
      <Card className="border-yellow-400/20">
        <div className="p-6 space-y-4" role="region" aria-labelledby="proposal-details-heading">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-400" aria-hidden="true" />
              <h4 id="proposal-details-heading" className="font-semibold text-black dark:text-white">
                Proposal Details
              </h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(1)}
              className="hover:bg-yellow-400/10 text-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400"
              aria-label="Edit proposal details"
            >
              <Edit className="w-4 h-4 mr-2" aria-hidden="true" />
              Edit
            </Button>
          </div>

          <Separator className="bg-yellow-400/20" />

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Proposal Title</p>
              <p className="font-medium text-black dark:text-white">
                {proposalDetails.title || <span className="text-muted-foreground italic">Not provided</span>}
              </p>
            </div>

            {/* Budget Estimate */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Budget Estimate</p>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <p className="font-medium text-black dark:text-white">
                  {formatCurrency(proposalDetails.budgetEstimate)}
                </p>
              </div>
            </div>

            {/* Timeline Estimate */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Timeline Estimate</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-yellow-400" />
                <p className="font-medium text-black dark:text-white">
                  {proposalDetails.timelineEstimate || <span className="text-muted-foreground italic">Not provided</span>}
                </p>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Executive Summary</p>
              <div className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 whitespace-pre-wrap">
                {proposalDetails.executiveSummary || <span className="text-muted-foreground italic">Not provided</span>}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Additional Information Section */}
      {requirements.length > 0 && (
        <Card className="border-yellow-400/20">
          <div className="p-6 space-y-4" role="region" aria-labelledby="additional-info-heading">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-400" aria-hidden="true" />
                <h4 id="additional-info-heading" className="font-semibold text-black dark:text-white">
                  Additional Information
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditStep(2)}
                className="hover:bg-yellow-400/10 text-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400"
                aria-label="Edit additional information"
              >
                <Edit className="w-4 h-4 mr-2" aria-hidden="true" />
                Edit
              </Button>
            </div>

            <Separator className="bg-yellow-400/20" />

            <div className="space-y-4">
              {requirements
                .sort((a, b) => a.order - b.order)
                .map((requirement) => (
                  <div key={requirement.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-muted-foreground flex-1">
                        {requirement.fieldName}
                        {requirement.required && (
                          <Badge 
                            variant="outline" 
                            className="ml-2 text-xs border-yellow-400/40 text-yellow-400"
                          >
                            Required
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div>
                      {getFieldValueDisplay(requirement, additionalInfo[requirement.id])}
                    </div>
                    {requirement.helpText && (
                      <p className="text-xs text-muted-foreground">
                        {requirement.helpText}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* Submission Confirmation */}
      <Card className="border-yellow-400/40 bg-yellow-400/5">
        <div className="p-6 space-y-4" role="region" aria-labelledby="confirmation-heading">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-2">
              <h4 id="confirmation-heading" className="font-semibold text-black dark:text-white">
                Ready to Submit
              </h4>
              <p className="text-sm text-muted-foreground">
                By submitting this proposal, you confirm that all information provided is accurate and complete. 
                Once submitted, the proposal will be sent to the client for review.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4" role="navigation" aria-label="Submission actions">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="border-yellow-400/40 hover:bg-yellow-400/10 focus-visible:ring-2 focus-visible:ring-yellow-400"
          aria-label="Go to previous step"
        >
          Back
        </Button>

        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          className={cn(
            "bg-yellow-400 hover:bg-yellow-500 text-black focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
          aria-label={isSubmitting ? "Submitting proposal, please wait" : "Submit proposal for review"}
          aria-live="polite"
        >
          {isSubmitting ? (
            <>
              <span className="animate-pulse">Submitting...</span>
            </>
          ) : (
            "Submit Proposal"
          )}
        </Button>
      </div>
    </div>
  )
}
