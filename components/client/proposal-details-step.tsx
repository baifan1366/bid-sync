"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { AlertCircle } from "lucide-react"
import type { ProposalDetails } from "./proposal-submission-wizard"

// Validation schema for proposal details
const proposalDetailsSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  budgetEstimate: z.string()
    .min(1, "Budget estimate is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Budget must be a positive number",
    })
    .refine((val) => Number(val) <= 1000000000, {
      message: "Budget must be less than 1 billion",
    }),
  timelineEstimate: z.string()
    .min(1, "Timeline estimate is required")
    .max(100, "Timeline estimate must be less than 100 characters"),
  executiveSummary: z.string()
    .min(1, "Executive summary is required")
    .min(50, "Executive summary must be at least 50 characters")
    .max(5000, "Executive summary must be less than 5000 characters"),
})

type ProposalDetailsFormData = z.infer<typeof proposalDetailsSchema>

interface ProposalDetailsStepProps {
  proposalId: string
  initialData: ProposalDetails
  onNext: (data: ProposalDetails) => void
  onBack?: () => void
}

export function ProposalDetailsStep({
  proposalId,
  initialData,
  onNext,
  onBack,
}: ProposalDetailsStepProps) {
  // Initialize form with react-hook-form and zod validation
  const form = useForm<ProposalDetailsFormData>({
    resolver: zodResolver(proposalDetailsSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: {
      title: initialData.title || "",
      budgetEstimate: initialData.budgetEstimate?.toString() || "",
      timelineEstimate: initialData.timelineEstimate || "",
      executiveSummary: initialData.executiveSummary || "",
    },
  })

  const {
    formState: { errors, isValid, isDirty },
    watch,
  } = form

  // Watch all fields for real-time updates
  const watchedFields = watch()

  // Update parent component when data changes (for auto-save)
  useEffect(() => {
    if (isDirty) {
      const budgetValue = watchedFields.budgetEstimate 
        ? Number(watchedFields.budgetEstimate) 
        : null
      
      const data: ProposalDetails = {
        title: watchedFields.title,
        budgetEstimate: budgetValue,
        timelineEstimate: watchedFields.timelineEstimate,
        executiveSummary: watchedFields.executiveSummary,
      }
      // Notify parent of changes for auto-save functionality
      // This will be handled by the wizard's auto-save mechanism
    }
  }, [watchedFields, isDirty])

  // Handle form submission
  const onSubmit = (data: ProposalDetailsFormData) => {
    // Convert form data to ProposalDetails format
    const proposalDetails: ProposalDetails = {
      title: data.title,
      budgetEstimate: Number(data.budgetEstimate),
      timelineEstimate: data.timelineEstimate,
      executiveSummary: data.executiveSummary,
    }

    // Call onNext to proceed to next step
    onNext(proposalDetails)
  }

  return (
    <div className="space-y-6" role="form" aria-labelledby="step-title">
      {/* Step Description */}
      <div className="space-y-2">
        <h3 id="step-title" className="text-lg font-semibold text-black dark:text-white">
          Proposal Details
        </h3>
        <p className="text-sm text-muted-foreground" id="step-description">
          Review and edit your proposal information. All fields are required to proceed.
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposal Title *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter a descriptive title for your proposal"
                    {...field}
                    aria-required="true"
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? "title-error" : "title-description"}
                    className={errors.title ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                </FormControl>
                <FormDescription id="title-description">
                  A clear, concise title that describes your proposal (max 200 characters)
                </FormDescription>
                {errors.title && <FormMessage id="title-error" />}
              </FormItem>
            )}
          />

          {/* Budget Estimate Field */}
          <FormField
            control={form.control}
            name="budgetEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget Estimate *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
                      $
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      aria-label="Budget estimate in dollars"
                      aria-required="true"
                      aria-invalid={!!errors.budgetEstimate}
                      aria-describedby={errors.budgetEstimate ? "budget-error" : "budget-description"}
                      className={`pl-7 ${errors.budgetEstimate ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormDescription id="budget-description">
                  Your estimated budget for this project (must be a positive number)
                </FormDescription>
                {errors.budgetEstimate && <FormMessage id="budget-error" />}
              </FormItem>
            )}
          />

          {/* Timeline Estimate Field */}
          <FormField
            control={form.control}
            name="timelineEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timeline Estimate *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 3 months, 12 weeks, 90 days"
                    aria-required="true"
                    aria-invalid={!!errors.timelineEstimate}
                    aria-describedby={errors.timelineEstimate ? "timeline-error" : "timeline-description"}
                    {...field}
                    className={errors.timelineEstimate ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                </FormControl>
                <FormDescription id="timeline-description">
                  Estimated time to complete the project (max 100 characters)
                </FormDescription>
                {errors.timelineEstimate && <FormMessage id="timeline-error" />}
              </FormItem>
            )}
          />

          {/* Executive Summary Field */}
          <FormField
            control={form.control}
            name="executiveSummary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Executive Summary *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Provide a comprehensive overview of your proposal, including key objectives, approach, and value proposition..."
                    rows={8}
                    aria-required="true"
                    aria-invalid={!!errors.executiveSummary}
                    aria-describedby={errors.executiveSummary ? "summary-error" : "summary-description"}
                    {...field}
                    className={errors.executiveSummary ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                </FormControl>
                <FormDescription id="summary-description">
                  A detailed summary of your proposal (50-5000 characters) • <span aria-live="polite">{field.value.length} / 5000</span>
                </FormDescription>
                {errors.executiveSummary && <FormMessage id="summary-error" />}
              </FormItem>
            )}
          />

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <div 
              role="alert" 
              aria-live="assertive"
              className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Please fix the following errors to continue:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                    {errors.title && <li>{errors.title.message}</li>}
                    {errors.budgetEstimate && <li>{errors.budgetEstimate.message}</li>}
                    {errors.timelineEstimate && <li>{errors.timelineEstimate.message}</li>}
                    {errors.executiveSummary && <li>{errors.executiveSummary.message}</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4" role="navigation" aria-label="Step navigation">
            {onBack ? (
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="border-yellow-400/40 hover:bg-yellow-400/10 focus-visible:ring-2 focus-visible:ring-yellow-400"
                aria-label="Go to previous step"
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="submit"
              disabled={!isValid}
              className="bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
              aria-label={isValid ? "Proceed to next step" : "Complete all required fields to proceed"}
            >
              Next Step
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
