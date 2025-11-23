"use client"

/**
 * Example usage of ProposalSubmissionWizard component
 * This file demonstrates how to integrate the wizard into a proposal detail page
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ProposalSubmissionWizard } from "./proposal-submission-wizard"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

export function ProposalSubmissionWizardExample() {
  const [wizardOpen, setWizardOpen] = useState(false)

  // Example data - in real usage, this would come from GraphQL queries
  const proposalId = "example-proposal-id"
  const projectId = "example-project-id"
  
  const additionalInfoRequirements: AdditionalInfoRequirement[] = [
    {
      id: "1",
      fieldName: "Company Registration Number",
      fieldType: "text",
      required: true,
      helpText: "Please provide your official company registration number",
      order: 1,
    },
    {
      id: "2",
      fieldName: "Years of Experience",
      fieldType: "number",
      required: true,
      helpText: "How many years has your company been in business?",
      order: 2,
    },
    {
      id: "3",
      fieldName: "Project Start Date",
      fieldType: "date",
      required: false,
      helpText: "When can you start this project?",
      order: 3,
    },
  ]

  const handleComplete = (submissionId: string) => {
    console.log("Proposal submitted successfully:", submissionId)
    setWizardOpen(false)
    // In real usage, redirect to proposal detail page or show success message
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border border-yellow-400/20 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-2">Proposal Draft</h2>
          <p className="text-muted-foreground mb-4">
            Your proposal is ready to submit. Click the button below to start the submission process.
          </p>
          
          <Button
            onClick={() => setWizardOpen(true)}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Submit Proposal
          </Button>
        </div>

        <div className="border border-yellow-400/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">What happens next?</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Review and edit your proposal details</li>
            <li>Provide additional information required by the client</li>
            <li>Review all submission data</li>
            <li>Submit your proposal for review</li>
          </ol>
        </div>
      </div>

      <ProposalSubmissionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        proposalId={proposalId}
        projectId={projectId}
        additionalInfoRequirements={additionalInfoRequirements}
        onComplete={handleComplete}
      />
    </div>
  )
}
