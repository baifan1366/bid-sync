/**
 * Example usage of the ConfirmationStep component
 * This file demonstrates both success and error states
 */

import { ConfirmationStep } from "./confirmation-step"

// Example 1: Success State
export function ConfirmationStepSuccessExample() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Success State Example</h2>
      <ConfirmationStep
        success={true}
        proposalId="123e4567-e89b-12d3-a456-426614174000"
        projectId="987fcdeb-51a2-43f7-b123-456789abcdef"
        submittedAt="2024-01-15T10:30:00Z"
        proposalTitle="Enterprise Software Development Proposal"
        onRetry={() => console.log("Retry clicked")}
      />
    </div>
  )
}

// Example 2: Error State
export function ConfirmationStepErrorExample() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Error State Example</h2>
      <ConfirmationStep
        success={false}
        proposalId="123e4567-e89b-12d3-a456-426614174000"
        projectId="987fcdeb-51a2-43f7-b123-456789abcdef"
        errors={[
          "Budget estimate must be a positive number",
          "Executive summary is required",
          "Required field 'Company Registration Number' is missing",
        ]}
        proposalTitle="Enterprise Software Development Proposal"
        onRetry={() => console.log("Retry clicked")}
      />
    </div>
  )
}

// Example 3: Error State with Single Error
export function ConfirmationStepSingleErrorExample() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Single Error Example</h2>
      <ConfirmationStep
        success={false}
        proposalId="123e4567-e89b-12d3-a456-426614174000"
        projectId="987fcdeb-51a2-43f7-b123-456789abcdef"
        errors={["Network connection failed. Please check your internet connection and try again."]}
        proposalTitle="Enterprise Software Development Proposal"
        onRetry={() => console.log("Retry clicked")}
      />
    </div>
  )
}

// Example 4: Error State with No Specific Errors
export function ConfirmationStepUnknownErrorExample() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Unknown Error Example</h2>
      <ConfirmationStep
        success={false}
        proposalId="123e4567-e89b-12d3-a456-426614174000"
        projectId="987fcdeb-51a2-43f7-b123-456789abcdef"
        errors={[]}
        proposalTitle="Enterprise Software Development Proposal"
        onRetry={() => console.log("Retry clicked")}
      />
    </div>
  )
}
