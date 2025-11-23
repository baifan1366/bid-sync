# Design Document

## Overview

The Proposal Submission Workflow feature provides a guided, multi-step process for Project Leads to submit proposals after a project has been approved by an admin. This feature ensures all client-required information is collected, validates proposal completeness, and sends email notifications to relevant stakeholders.

### Key Components

1. **Multi-Step Submission Wizard** - A React component that guides Project Leads through the submission process
2. **Additional Info Requirements System** - Database schema and UI for clients to define custom information requirements
3. **Proposal Details Editor** - Interface for reviewing and editing proposal information before submission
4. **Email Notification Service** - Integration with existing nodemailer service for submission notifications
5. **Database Transaction Layer** - Ensures atomic submission with rollback capabilities

## Architecture

### Frontend Architecture

```
ProposalSubmissionWizard (Container)
├── SubmissionStepIndicator
├── ProposalDetailsStep
│   ├── ProposalDetailsForm
│   └── ValidationMessages
├── AdditionalInfoStep
│   ├── DynamicFieldRenderer
│   └── FileUploadHandler
├── ReviewStep
│   ├── SubmissionSummary
│   └── NavigationControls
└── ConfirmationStep
    └── SuccessMessage
```

### Backend Architecture

```
API Layer (GraphQL)
├── submitProposal mutation
├── saveSubmissionDraft mutation
└── getProjectRequirements query

Service Layer
├── ProposalSubmissionService
│   ├── validateSubmission()
│   ├── processSubmission()
│   └── sendNotifications()
└── AdditionalInfoService
    ├── validateAdditionalInfo()
    └── storeAdditionalInfo()

Data Layer
├── proposals table (updated)
├── projects table (updated with additional_info_requirements)
├── proposal_additional_info table (new)
└── submission_drafts table (new)
```

## Components and Interfaces

### Frontend Components

#### ProposalSubmissionWizard

Main container component that manages the multi-step workflow.

```typescript
interface ProposalSubmissionWizardProps {
  proposalId: string;
  projectId: string;
  onComplete: (submissionId: string) => void;
  onCancel: () => void;
}
```

#### ProposalDetailsStep

Step for reviewing and editing core proposal information.

```typescript
interface ProposalDetailsStepProps {
  proposalId: string;
  initialData: ProposalDetails;
  onNext: (data: ProposalDetails) => void;
  onBack: () => void;
}

interface ProposalDetails {
  title: string;
  budgetEstimate: number;
  timelineEstimate: string;
  teamComposition: TeamMember[];
  executiveSummary: string;
}
```

#### AdditionalInfoStep

Step for collecting client-specified additional information.

```typescript
interface AdditionalInfoStepProps {
  requirements: AdditionalInfoRequirement[];
  initialData: Record<string, any>;
  onNext: (data: Record<string, any>) => void;
  onBack: () => void;
}

interface AdditionalInfoRequirement {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'file' | 'textarea' | 'select';
  required: boolean;
  helpText?: string;
  options?: string[]; // for select type
  validation?: ValidationRule;
}
```

#### ReviewStep

Final review step before submission.

```typescript
interface ReviewStepProps {
  proposalDetails: ProposalDetails;
  additionalInfo: Record<string, any>;
  requirements: AdditionalInfoRequirement[];
  onSubmit: () => Promise<void>;
  onBack: () => void;
  onEditStep: (stepIndex: number) => void;
}
```

### Backend Services

#### ProposalSubmissionService

```typescript
class ProposalSubmissionService {
  async submitProposal(params: SubmitProposalParams): Promise<SubmissionResult> {
    // Validate all required fields
    // Begin database transaction
    // Update proposal status
    // Store additional info
    // Send notifications
    // Commit transaction
    // Return result
  }

  async saveSubmissionDraft(params: SaveDraftParams): Promise<void> {
    // Store partial submission data
  }

  async validateSubmission(params: ValidateParams): Promise<ValidationResult> {
    // Validate proposal details
    // Validate additional info
    // Check file uploads
    // Return validation result
  }
}
```

## Data Models

### Database Schema Changes

#### projects table (updated)

```sql
ALTER TABLE public.projects 
ADD COLUMN additional_info_requirements JSONB DEFAULT '[]'::jsonb;

-- Example structure:
-- [
--   {
--     "id": "uuid",
--     "fieldName": "Company Registration Number",
--     "fieldType": "text",
--     "required": true,
--     "helpText": "Please provide your official company registration number",
--     "order": 1
--   }
-- ]
```

#### proposal_additional_info table (new)

```sql
CREATE TABLE public.proposal_additional_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, field_id)
);

CREATE INDEX idx_proposal_additional_info_proposal ON public.proposal_additional_info(proposal_id);
```

#### proposals table (updated)

```sql
ALTER TABLE public.proposals 
ADD COLUMN title TEXT,
ADD COLUMN budget_estimate NUMERIC,
ADD COLUMN timeline_estimate TEXT,
ADD COLUMN executive_summary TEXT;
```

#### submission_drafts table (new)

```sql
CREATE TABLE public.submission_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 1,
    draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, user_id)
);

CREATE INDEX idx_submission_drafts_proposal ON public.submission_drafts(proposal_id);
CREATE INDEX idx_submission_drafts_user ON public.submission_drafts(user_id);
```

### GraphQL Schema Extensions

```graphql
extend type Project {
  additionalInfoRequirements: [AdditionalInfoRequirement!]!
}

type AdditionalInfoRequirement {
  id: ID!
  fieldName: String!
  fieldType: FieldType!
  required: Boolean!
  helpText: String
  options: [String!]
  order: Int!
}

enum FieldType {
  TEXT
  NUMBER
  DATE
  FILE
  TEXTAREA
  SELECT
}

extend type Proposal {
  title: String
  budgetEstimate: Float
  timelineEstimate: String
  executiveSummary: String
  additionalInfo: [ProposalAdditionalInfo!]!
}

type ProposalAdditionalInfo {
  id: ID!
  fieldId: String!
  fieldName: String!
  fieldValue: JSON!
}

input SubmitProposalInput {
  proposalId: ID!
  projectId: ID!
  title: String!
  budgetEstimate: Float!
  timelineEstimate: String!
  executiveSummary: String!
  additionalInfo: [AdditionalInfoInput!]!
}

input AdditionalInfoInput {
  fieldId: String!
  fieldName: String!
  fieldValue: JSON!
}

type SubmissionResult {
  success: Boolean!
  proposalId: ID!
  submittedAt: String!
  errors: [String!]
}

extend type Mutation {
  submitProposal(input: SubmitProposalInput!): SubmissionResult!
  saveSubmissionDraft(proposalId: ID!, step: Int!, data: JSON!): Boolean!
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Step validation prevents invalid progression

*For any* submission step and any input data, when a Project Lead attempts to progress to the next step, the system should validate the data and only allow progression if validation passes.
**Validates: Requirements 1.3**

### Property 2: Navigation preserves data

*For any* submission step and any entered data, when a Project Lead navigates away from a step and then returns to it, the previously entered data should be preserved exactly as it was entered.
**Validates: Requirements 1.4**

### Property 3: Exit saves draft

*For any* submission step and any partial data, when a Project Lead exits the wizard before completion, the system should save the current state as a draft that can be resumed later.
**Validates: Requirements 1.5**

### Property 4: Requirements persistence

*For any* project and any set of additional info requirements, when a Client saves the project, all requirements should be persisted to the database and retrievable on subsequent loads.
**Validates: Requirements 2.3**

### Property 5: Requirements display completeness

*For any* project with additional info requirements, when a Project Lead views the project, all requirements specified by the Client should be displayed.
**Validates: Requirements 2.4**

### Property 6: Workflow adapts to requirements

*For any* project with additional info requirements, when a Project Lead submits a proposal, the submission workflow should include a step to collect all additional information.
**Validates: Requirements 2.5**

### Property 7: Real-time validation

*For any* proposal detail field and any edit, when a Project Lead modifies the field, validation should occur immediately without requiring form submission.
**Validates: Requirements 3.2**

### Property 8: Invalid data blocks progression

*For any* invalid data in any field, when a Project Lead attempts to progress, the system should display error messages and prevent progression until the data is corrected.
**Validates: Requirements 3.3**

### Property 9: Details update persistence

*For any* modified proposal details, when a Project Lead confirms the changes, the proposal record in the database should be updated with all modifications.
**Validates: Requirements 3.4**

### Property 10: Additional info fields display

*For any* set of client-specified additional info requirements, when a Project Lead reaches the additional info step, all required fields should be displayed.
**Validates: Requirements 4.1**

### Property 11: Required field enforcement

*For any* additional info field marked as required, when a Project Lead attempts to progress without completing the field, the system should prevent progression.
**Validates: Requirements 4.2**

### Property 12: Type-based validation

*For any* additional info field and any entered data, when a Project Lead enters data, the system should validate it according to the field's specified type (text, number, date, etc.).
**Validates: Requirements 4.3**

### Property 13: Complete fields enable progression

*For any* set of additional info fields, when a Project Lead completes all required fields with valid data, the system should enable progression to the next step.
**Validates: Requirements 4.4**

### Property 14: Review displays all data

*For any* submission data including proposal details and additional info, when a Project Lead reaches the review step, all entered data should be displayed in the summary.
**Validates: Requirements 5.1**

### Property 15: Review allows navigation

*For any* previous step in the workflow, when a Project Lead is on the review step, the system should allow navigation back to that step for corrections.
**Validates: Requirements 5.3**

### Property 16: Review confirmation enables submit

*For any* review step, when a Project Lead confirms the review, the final submit button should become enabled.
**Validates: Requirements 5.4**

### Property 17: Submission updates status

*For any* draft proposal, when a Project Lead successfully submits it, the proposal status should change from draft to submitted.
**Validates: Requirements 6.1**

### Property 18: Submission records timestamp

*For any* proposal submission, when the submission succeeds, the system should record a submission timestamp in the database.
**Validates: Requirements 6.2**

### Property 19: Success shows confirmation

*For any* successful proposal submission, when the submission completes, the system should display a success confirmation message to the Project Lead.
**Validates: Requirements 6.3**

### Property 20: Success redirects to detail

*For any* successful proposal submission, when the submission completes, the system should redirect the Project Lead to the proposal detail view.
**Validates: Requirements 6.4**

### Property 21: Failure allows retry

*For any* failed proposal submission, when the failure occurs, the system should display an error message and allow the Project Lead to retry the submission.
**Validates: Requirements 6.5**

### Property 22: Client notification sent

*For any* successful proposal submission, when the submission completes, the system should send an email notification to the project owner (client).
**Validates: Requirements 7.1**

### Property 23: Client email contains required fields

*For any* client notification email, when the email is generated, it should include the project title, proposal title, bidding team name, and submission timestamp.
**Validates: Requirements 7.2**

### Property 24: Client email contains proposal link

*For any* client notification email, when the email is generated, it should include a direct link to view the submitted proposal.
**Validates: Requirements 7.3**

### Property 25: Email failure doesn't block submission

*For any* email sending failure, when the failure occurs, the system should log the error and continue with the submission process without rolling back.
**Validates: Requirements 7.5**

### Property 26: Lead confirmation sent

*For any* successful proposal submission, when the submission completes, the system should send a confirmation email to the Project Lead.
**Validates: Requirements 8.1**

### Property 27: Lead email contains required fields

*For any* Project Lead confirmation email, when the email is generated, it should include the project title, proposal title, and submission timestamp.
**Validates: Requirements 8.2**

### Property 28: Lead email contains summary

*For any* Project Lead confirmation email, when the email is generated, it should include a summary of the submitted information.
**Validates: Requirements 8.3**

### Property 29: Lead email contains proposal link

*For any* Project Lead confirmation email, when the email is generated, it should include a link to view the submitted proposal.
**Validates: Requirements 8.4**

### Property 30: Admin notifications sent to all

*For any* successful proposal submission, when the submission completes, the system should send notification emails to all admin users.
**Validates: Requirements 9.1**

### Property 31: Admin email contains required fields

*For any* admin notification email, when the email is generated, it should include the project title, client name, bidding team name, and submission timestamp.
**Validates: Requirements 9.2**

### Property 32: Admin email contains both links

*For any* admin notification email, when the email is generated, it should include links to both the project and the proposal.
**Validates: Requirements 9.3**

### Property 33: Individual admin emails

*For any* number of admin users, when a proposal is submitted, each admin should receive an individual email notification.
**Validates: Requirements 9.5**

### Property 34: Failure rolls back changes

*For any* submission failure at any point in the process, when the failure occurs, the system should roll back all database changes and maintain the proposal in draft status.
**Validates: Requirements 10.2**

### Property 35: Pre-submission validation

*For any* proposal submission attempt, when the submission is initiated, the system should validate all required fields are present before committing any changes to the database.
**Validates: Requirements 10.3**

### Property 36: Submission creates audit log

*For any* completed proposal submission, when the submission succeeds, the system should create an activity log entry for audit purposes.
**Validates: Requirements 10.5**

## Error Handling

### Validation Errors

**Client-Side Validation:**
- Real-time field validation with immediate feedback
- Clear error messages displayed inline with fields
- Prevention of form submission until all errors are resolved
- Visual indicators (red borders, error icons) for invalid fields

**Server-Side Validation:**
- Duplicate validation of all client-side rules
- Additional business logic validation
- Database constraint validation
- Return structured error responses with field-specific messages

### Submission Errors

**Network Errors:**
- Retry mechanism with exponential backoff
- User-friendly error messages
- Option to save draft and retry later
- Preserve all entered data during retry

**Database Errors:**
- Transaction rollback on any failure
- Maintain proposal in draft status
- Log detailed error information for debugging
- Display generic error message to user

**Email Errors:**
- Non-blocking: submission succeeds even if email fails
- Log email failures for admin review
- Queue failed emails for retry
- Display warning to user about notification failure

### User Experience

**Error Recovery:**
- Clear instructions on how to fix errors
- Ability to navigate back to any step to make corrections
- Auto-save draft to prevent data loss
- Graceful degradation when services are unavailable

**Error Logging:**
- All errors logged with context (user ID, proposal ID, timestamp)
- Stack traces captured for debugging
- Integration with existing activity logging system
- Admin dashboard for monitoring submission failures

## Testing Strategy

### Unit Testing

**Component Tests:**
- Test each wizard step component in isolation
- Verify validation logic for all field types
- Test navigation between steps
- Test data persistence across navigation
- Test error message display

**Service Tests:**
- Test ProposalSubmissionService methods
- Test AdditionalInfoService validation
- Test email template generation
- Test database transaction handling
- Mock external dependencies (database, email service)

**Utility Tests:**
- Test field validation functions
- Test data transformation utilities
- Test error handling utilities

### Property-Based Testing

We will use **fast-check** for JavaScript/TypeScript property-based testing. Each property test should run a minimum of 100 iterations.

**Property Test Configuration:**
```typescript
import fc from 'fast-check';

// Configure to run 100+ iterations
const testConfig = { numRuns: 100 };
```

**Test Generators:**
```typescript
// Generator for proposal details
const proposalDetailsArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  budgetEstimate: fc.float({ min: 0, max: 10000000 }),
  timelineEstimate: fc.string({ minLength: 1 }),
  executiveSummary: fc.string({ maxLength: 5000 }),
});

// Generator for additional info requirements
const additionalInfoRequirementArb = fc.record({
  id: fc.uuid(),
  fieldName: fc.string({ minLength: 1 }),
  fieldType: fc.constantFrom('text', 'number', 'date', 'file', 'textarea', 'select'),
  required: fc.boolean(),
  helpText: fc.option(fc.string()),
});

// Generator for field values based on type
const fieldValueArb = (fieldType: string) => {
  switch (fieldType) {
    case 'text':
    case 'textarea':
      return fc.string();
    case 'number':
      return fc.float();
    case 'date':
      return fc.date().map(d => d.toISOString());
    case 'select':
      return fc.string();
    default:
      return fc.anything();
  }
};
```

**Property Tests:**

Each property-based test must be tagged with a comment referencing the design document property:

```typescript
// **Feature: proposal-submission-workflow, Property 2: Navigation preserves data**
test('navigation preserves entered data', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 3 }), // step number
      proposalDetailsArb,
      (step, data) => {
        // Test implementation
      }
    ),
    testConfig
  );
});
```

### Integration Testing

**API Integration Tests:**
- Test complete submission flow through GraphQL API
- Test with various combinations of additional info requirements
- Test error scenarios (invalid data, network failures)
- Test email notification integration
- Verify database state after submission

**End-to-End Tests:**
- Test complete user journey from opening wizard to confirmation
- Test with real browser interactions (Playwright/Cypress)
- Test across different browsers
- Test responsive behavior on mobile devices

### Test Coverage Goals

- Unit test coverage: >80% for all services and utilities
- Component test coverage: >70% for all React components
- Property test coverage: All 36 correctness properties implemented
- Integration test coverage: All critical user paths
- E2E test coverage: Happy path + major error scenarios

## Implementation Notes

### Performance Considerations

**Frontend:**
- Lazy load wizard steps to reduce initial bundle size
- Debounce validation to avoid excessive API calls
- Use React.memo for step components to prevent unnecessary re-renders
- Implement virtual scrolling for long lists of requirements

**Backend:**
- Use database connection pooling
- Implement query optimization for fetching requirements
- Use batch operations for sending multiple admin emails
- Implement caching for frequently accessed project requirements

### Security Considerations

**Authorization:**
- Verify user is the proposal lead before allowing submission
- Verify proposal belongs to the specified project
- Verify project is in approved status
- Implement rate limiting on submission endpoint

**Data Validation:**
- Sanitize all user inputs
- Validate file uploads (type, size, content)
- Prevent SQL injection through parameterized queries
- Validate JSON structure for additional info

**Audit Trail:**
- Log all submission attempts (success and failure)
- Log all data modifications
- Include user ID, IP address, and timestamp in logs
- Integrate with existing activity logging system

### Accessibility

**WCAG 2.1 AA Compliance:**
- Keyboard navigation support for all wizard steps
- Screen reader announcements for step changes
- ARIA labels for all form fields
- Focus management during navigation
- Error messages associated with form fields
- Sufficient color contrast for all text
- Clear focus indicators

### Internationalization

**Future Considerations:**
- Support for multiple languages in wizard UI
- Localized validation messages
- Localized email templates
- Date/time formatting based on locale
- Currency formatting for budget estimates

## Dependencies

### External Libraries

- **fast-check**: Property-based testing framework
- **react-hook-form**: Form state management and validation
- **zod**: Schema validation for TypeScript
- **date-fns**: Date manipulation and formatting

### Internal Dependencies

- **lib/email/**: Existing email service for notifications
- **lib/activity-logger.ts**: Activity logging service
- **lib/graphql/**: GraphQL client and schema
- **lib/supabase/**: Database client

### Database Migrations

Migration files required:
1. `005_proposal_submission_workflow.sql` - Add new tables and columns
2. `006_proposal_submission_indexes.sql` - Add performance indexes

## Deployment Strategy

### Phased Rollout

**Phase 1: Database Schema**
- Deploy database migrations
- Verify schema changes in staging
- Run data migration scripts if needed

**Phase 2: Backend Services**
- Deploy GraphQL resolvers and mutations
- Deploy email templates
- Enable feature flag for testing

**Phase 3: Frontend Components**
- Deploy wizard components
- Deploy project creation UI updates
- Enable feature flag for beta users

**Phase 4: Full Release**
- Monitor error rates and performance
- Collect user feedback
- Enable for all users

### Rollback Plan

- Feature flag allows instant disable without deployment
- Database migrations include rollback scripts
- Previous proposal submission flow remains available as fallback
- Data migration scripts are reversible

## Monitoring and Observability

### Metrics to Track

**Submission Metrics:**
- Submission success rate
- Average time to complete submission
- Step abandonment rates
- Validation error frequency by field

**Email Metrics:**
- Email delivery success rate
- Email open rates
- Email click-through rates

**Performance Metrics:**
- API response times
- Database query performance
- Frontend rendering performance
- Error rates by type

### Alerts

- Alert on submission success rate < 95%
- Alert on email delivery failure rate > 5%
- Alert on API response time > 2 seconds
- Alert on database transaction failures

### Logging

- Log all submission attempts with outcome
- Log all validation failures with details
- Log all email sending attempts
- Log all database errors with stack traces
- Integrate with existing Sentry error tracking
