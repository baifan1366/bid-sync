/**
 * Example usage of the ReviewStep component
 * This file demonstrates how to use the ReviewStep in the proposal submission workflow
 */

import { ReviewStep } from "./review-step"
import type { ProposalDetails } from "./proposal-submission-wizard"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

// Example proposal details
const exampleProposalDetails: ProposalDetails = {
  title: "Enterprise Software Development Proposal",
  budgetEstimate: 150000,
  timelineEstimate: "6 months",
  executiveSummary: `We propose to develop a comprehensive enterprise software solution that addresses your organization's needs for improved workflow automation and data management. Our team brings 10+ years of experience in enterprise software development.

Key deliverables include:
- Custom workflow automation system
- Integrated data management platform
- User training and documentation
- 6 months of post-launch support

Our approach emphasizes agile development methodology, ensuring regular client feedback and iterative improvements throughout the project lifecycle.`,
}

// Example additional info requirements
const exampleRequirements: AdditionalInfoRequirement[] = [
  {
    id: "req-1",
    fieldName: "Company Registration Number",
    fieldType: "text",
    required: true,
    helpText: "Please provide your official company registration number",
    order: 1,
  },
  {
    id: "req-2",
    fieldName: "Years in Business",
    fieldType: "number",
    required: true,
    helpText: "How many years has your company been operating?",
    order: 2,
  },
  {
    id: "req-3",
    fieldName: "Project Start Date",
    fieldType: "date",
    required: true,
    helpText: "When would you like to start the project?",
    order: 3,
  },
  {
    id: "req-4",
    fieldName: "Technical Approach",
    fieldType: "textarea",
    required: true,
    helpText: "Describe your technical approach in detail",
    order: 4,
  },
  {
    id: "req-5",
    fieldName: "Company Profile",
    fieldType: "file",
    required: false,
    helpText: "Upload your company profile document (optional)",
    order: 5,
  },
  {
    id: "req-6",
    fieldName: "Industry Sector",
    fieldType: "select",
    required: true,
    helpText: "Select your primary industry sector",
    options: ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail"],
    order: 6,
  },
]

// Example additional info data
const exampleAdditionalInfo = {
  "req-1": "ABC123456789",
  "req-2": 15,
  "req-3": "2024-03-01",
  "req-4": `Our technical approach leverages modern cloud-native architecture with the following key components:

1. Microservices Architecture
   - Independent, scalable services
   - API-first design
   - Event-driven communication

2. Technology Stack
   - Frontend: React with TypeScript
   - Backend: Node.js with Express
   - Database: PostgreSQL with Redis caching
   - Infrastructure: AWS with Kubernetes

3. Development Process
   - Agile/Scrum methodology
   - 2-week sprints
   - Continuous integration/deployment
   - Automated testing at all levels`,
  "req-5": {
    url: "https://example.com/company-profile.pdf",
    name: "company-profile.pdf",
    type: "application/pdf",
    size: 2457600, // 2.4 MB
  },
  "req-6": "Technology",
}

// Example usage in a component
export function ReviewStepExample() {
  const handleSubmit = async () => {
    console.log("Submitting proposal...")
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log("Proposal submitted successfully!")
  }

  const handleBack = () => {
    console.log("Going back to previous step")
  }

  const handleEditStep = (stepIndex: number) => {
    console.log(`Navigating to step ${stepIndex}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ReviewStep
        proposalDetails={exampleProposalDetails}
        additionalInfo={exampleAdditionalInfo}
        requirements={exampleRequirements}
        onSubmit={handleSubmit}
        onBack={handleBack}
        onEditStep={handleEditStep}
        isSubmitting={false}
      />
    </div>
  )
}

// Example with minimal data (showing how component handles missing values)
export function ReviewStepMinimalExample() {
  const minimalProposalDetails: ProposalDetails = {
    title: "Basic Proposal",
    budgetEstimate: null,
    timelineEstimate: "",
    executiveSummary: "",
  }

  const minimalAdditionalInfo = {
    "req-1": "ABC123",
    // Other fields not provided
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ReviewStep
        proposalDetails={minimalProposalDetails}
        additionalInfo={minimalAdditionalInfo}
        requirements={exampleRequirements}
        onSubmit={async () => {}}
        onBack={() => {}}
        onEditStep={() => {}}
      />
    </div>
  )
}

// Example with no additional requirements
export function ReviewStepNoRequirementsExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <ReviewStep
        proposalDetails={exampleProposalDetails}
        additionalInfo={{}}
        requirements={[]} // No additional requirements
        onSubmit={async () => {}}
        onBack={() => {}}
        onEditStep={() => {}}
      />
    </div>
  )
}
