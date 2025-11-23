"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"
import { ProposalDetailsStep } from "./proposal-details-step"
import { AdditionalInfoStep } from "./additional-info-step"
import { ReviewStep } from "./review-step"
import { ConfirmationStep } from "./confirmation-step"

// Step definitions
const STEPS = [
  { id: 1, name: "Proposal Details", description: "Review and edit proposal information" },
  { id: 2, name: "Additional Information", description: "Provide client-required details" },
  { id: 3, name: "Review", description: "Review all submission data" },
  { id: 4, name: "Confirmation", description: "Submit your proposal" },
] as const

export interface ProposalDetails {
  title: string
  budgetEstimate: number | null
  timelineEstimate: string
  executiveSummary: string
}

export interface WizardData {
  proposalDetails: ProposalDetails
  additionalInfo: Record<string, any>
}

interface ProposalSubmissionWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalId: string
  projectId: string
  initialData?: Partial<WizardData>
  additionalInfoRequirements?: AdditionalInfoRequirement[]
  onComplete: (submissionId: string) => void
}

export function ProposalSubmissionWizard({
  open,
  onOpenChange,
  proposalId,
  projectId,
  initialData,
  additionalInfoRequirements = [],
  onComplete,
}: ProposalSubmissionWizardProps) {
  // Current step state (1-4)
  const [currentStep, setCurrentStep] = useState(1)
  
  // Wizard data state
  const [wizardData, setWizardData] = useState<WizardData>({
    proposalDetails: initialData?.proposalDetails || {
      title: "",
      budgetEstimate: null,
      timelineEstimate: "",
      executiveSummary: "",
    },
    additionalInfo: initialData?.additionalInfo || {},
  })

  // Track which steps have been visited
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]))

  // Submission state
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean
    submittedAt?: string
    errors?: string[]
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ref for screen reader announcements
  const announcementRef = useRef<HTMLDivElement>(null)
  
  // Ref for step content container (for focus management)
  const stepContentRef = useRef<HTMLDivElement>(null)

  // Auto-save draft on data change (debounced)
  useEffect(() => {
    if (!open) return

    const timeoutId = setTimeout(() => {
      saveDraft()
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId)
  }, [wizardData, open])

  // Save draft to backend
  const saveDraft = useCallback(async () => {
    try {
      // TODO: Implement actual API call to saveSubmissionDraft mutation
      console.log("Saving draft:", {
        proposalId,
        step: currentStep,
        data: wizardData,
      })
      
      // Simulate API call
      // await saveSubmissionDraftMutation({ proposalId, step: currentStep, data: wizardData })
    } catch (error) {
      console.error("Error saving draft:", error)
    }
  }, [proposalId, currentStep, wizardData])

  // Handle wizard close - save draft before closing
  const handleClose = useCallback(async () => {
    await saveDraft()
    onOpenChange(false)
  }, [saveDraft, onOpenChange])

  // Navigate to a specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step)
      setVisitedSteps(prev => new Set([...prev, step]))
      
      // Announce step change to screen readers
      const stepInfo = STEPS.find(s => s.id === step)
      if (stepInfo && announcementRef.current) {
        announcementRef.current.textContent = `Now on step ${step} of ${STEPS.length}: ${stepInfo.name}. ${stepInfo.description}`
      }
      
      // Focus the step content container for keyboard users
      setTimeout(() => {
        stepContentRef.current?.focus()
      }, 100)
    }
  }, [])

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    if (currentStep < STEPS.length) {
      goToStep(currentStep + 1)
    }
  }, [currentStep, goToStep])

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1)
    }
  }, [currentStep, goToStep])

  // Keyboard navigation support
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return
      }

      // Alt + Left Arrow: Previous step
      if (e.altKey && e.key === 'ArrowLeft' && currentStep > 1) {
        e.preventDefault()
        goToPreviousStep()
      }

      // Alt + Right Arrow: Next step (only if on steps without their own navigation)
      if (e.altKey && e.key === 'ArrowRight' && currentStep !== 1 && currentStep !== 3 && currentStep !== 4) {
        e.preventDefault()
        goToNextStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, currentStep, goToPreviousStep, goToNextStep])

  // Update proposal details
  const updateProposalDetails = useCallback((details: Partial<ProposalDetails>) => {
    setWizardData(prev => ({
      ...prev,
      proposalDetails: {
        ...prev.proposalDetails,
        ...details,
      },
    }))
  }, [])

  // Handle proposal submission
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    
    try {
      // Prepare additional info array
      const additionalInfoArray = Object.entries(wizardData.additionalInfo).map(([fieldId, fieldValue]) => {
        const requirement = additionalInfoRequirements.find(req => req.id === fieldId)
        return {
          fieldId,
          fieldName: requirement?.fieldName || fieldId,
          fieldValue,
        }
      })

      // Call the submission API
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation SubmitProposal($input: SubmitProposalInput!) {
              submitProposal(input: $input) {
                success
                proposalId
                submittedAt
                errors
              }
            }
          `,
          variables: {
            input: {
              proposalId,
              projectId,
              title: wizardData.proposalDetails.title,
              budgetEstimate: wizardData.proposalDetails.budgetEstimate,
              timelineEstimate: wizardData.proposalDetails.timelineEstimate,
              executiveSummary: wizardData.proposalDetails.executiveSummary,
              additionalInfo: additionalInfoArray,
            },
          },
        }),
      })

      const result = await response.json()
      
      if (result.errors) {
        // GraphQL errors
        setSubmissionResult({
          success: false,
          errors: result.errors.map((e: any) => e.message),
        })
      } else {
        const submissionData = result.data.submitProposal
        setSubmissionResult({
          success: submissionData.success,
          submittedAt: submissionData.submittedAt,
          errors: submissionData.errors,
        })

        // If successful, call onComplete after a delay
        if (submissionData.success) {
          setTimeout(() => {
            onComplete(submissionData.proposalId)
          }, 3000)
        }
      }

      // Move to confirmation step
      goToNextStep()
    } catch (error) {
      console.error('Submission error:', error)
      setSubmissionResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'An unexpected error occurred'],
      })
      goToNextStep()
    } finally {
      setIsSubmitting(false)
    }
  }, [wizardData, proposalId, projectId, additionalInfoRequirements, onComplete, goToNextStep])

  // Handle retry after failed submission
  const handleRetry = useCallback(() => {
    setSubmissionResult(null)
    goToStep(3) // Go back to review step
  }, [goToStep])

  // Determine which steps to show based on requirements
  const activeSteps = additionalInfoRequirements.length > 0 
    ? STEPS 
    : STEPS.filter(step => step.id !== 2) // Skip additional info step if no requirements

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col"
        aria-describedby="wizard-description"
      >
        <DialogHeader>
          <DialogTitle>Submit Proposal</DialogTitle>
          <DialogDescription id="wizard-description">
            Complete all steps to submit your proposal. Use Tab to navigate between fields and Enter to proceed.
          </DialogDescription>
        </DialogHeader>

        {/* Screen reader announcements - visually hidden but accessible */}
        <div
          ref={announcementRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {/* Step Indicator */}
        <nav aria-label="Proposal submission progress" className="py-4">
          <ol className="flex items-center justify-between">
            {activeSteps.map((step, index) => (
              <li key={step.id} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => visitedSteps.has(step.id) && goToStep(step.id)}
                    disabled={!visitedSteps.has(step.id)}
                    aria-label={`${step.name}: ${step.description}`}
                    aria-current={currentStep === step.id ? "step" : undefined}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2",
                      currentStep === step.id
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : visitedSteps.has(step.id)
                        ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20"
                        : "border-gray-300 dark:border-gray-700 text-gray-400",
                      visitedSteps.has(step.id) && "cursor-pointer"
                    )}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </button>
                  <div className="mt-2 text-center">
                    <div
                      className={cn(
                        "text-xs font-medium",
                        currentStep === step.id
                          ? "text-yellow-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.name}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < activeSteps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "flex-1 h-0.5 mx-2 transition-colors",
                      currentStep > step.id
                        ? "bg-yellow-400"
                        : "bg-gray-300 dark:bg-gray-700"
                    )}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Step Content */}
        <div 
          ref={stepContentRef}
          className="flex-1 overflow-y-auto py-4"
          tabIndex={-1}
          role="region"
          aria-label={`Step ${currentStep}: ${STEPS.find(s => s.id === currentStep)?.name}`}
        >
          {currentStep === 1 && (
            <ProposalDetailsStep
              proposalId={proposalId}
              initialData={wizardData.proposalDetails}
              onNext={(details) => {
                updateProposalDetails(details)
                goToNextStep()
              }}
            />
          )}

          {currentStep === 2 && additionalInfoRequirements.length > 0 && (
            <AdditionalInfoStep
              requirements={additionalInfoRequirements}
              initialData={wizardData.additionalInfo}
              onNext={(data) => {
                // Update additional info in wizard data
                setWizardData(prev => ({
                  ...prev,
                  additionalInfo: data,
                }))
                goToNextStep()
              }}
              onBack={goToPreviousStep}
            />
          )}

          {currentStep === 3 && (
            <ReviewStep
              proposalDetails={wizardData.proposalDetails}
              additionalInfo={wizardData.additionalInfo}
              requirements={additionalInfoRequirements}
              onSubmit={handleSubmit}
              onBack={goToPreviousStep}
              onEditStep={goToStep}
              isSubmitting={isSubmitting}
            />
          )}

          {currentStep === 4 && submissionResult && (
            <ConfirmationStep
              success={submissionResult.success}
              proposalId={proposalId}
              projectId={projectId}
              submittedAt={submissionResult.submittedAt}
              errors={submissionResult.errors}
              onRetry={handleRetry}
              proposalTitle={wizardData.proposalDetails.title}
            />
          )}
        </div>

        {/* Navigation Footer - Only show for steps without their own navigation */}
        {currentStep !== 1 && currentStep !== 3 && currentStep !== 4 && (
          <div 
            className="flex items-center justify-between pt-4 border-t border-yellow-400/20"
            role="navigation"
            aria-label="Step navigation"
          >
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className="border-yellow-400/40 hover:bg-yellow-400/10 focus-visible:ring-2 focus-visible:ring-yellow-400"
              aria-label="Go to previous step"
            >
              Previous
            </Button>

            <div 
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              Step {currentStep} of {activeSteps.length}
            </div>

            <Button
              onClick={goToNextStep}
              className="bg-yellow-400 hover:bg-yellow-500 text-black focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
              aria-label="Go to next step"
            >
              Next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
