# Requirements Document

## Introduction

This document specifies the requirements for the **Proposal Submission Workflow** feature in BidSync. This feature enables Project Leads to submit proposals through a multi-step guided process after a project has been approved by an admin. The workflow collects client-required information, validates proposal completeness, and sends email notifications to relevant stakeholders upon successful submission.

## Glossary

- **Project Lead**: A user with the role of bidding_lead who manages a bidding team and is responsible for submitting proposals
- **Proposal**: A bid document created by a Project Lead and their team in response to a client's project opening
- **Client**: A user who creates project openings and reviews submitted proposals
- **Admin**: A user with administrative privileges who approves project openings
- **Submission Workflow**: A multi-step guided process for submitting a proposal with all required information
- **Additional Info Requirements**: Custom fields and information that clients specify they need from proposals
- **Email Service**: The nodemailer-based email notification system located in lib/email/

## Requirements

### Requirement 1

**User Story:** As a Project Lead, I want to submit my proposal through a guided multi-step workflow, so that I can ensure all required information is provided before submission.

#### Acceptance Criteria

1. WHEN a Project Lead clicks "Submit Proposal" on a draft proposal THEN the system SHALL display a multi-step submission wizard
2. WHEN the submission wizard opens THEN the system SHALL display the current step indicator and total number of steps
3. WHEN a Project Lead completes a step THEN the system SHALL validate the step data before allowing progression to the next step
4. WHEN a Project Lead navigates between steps THEN the system SHALL preserve previously entered data
5. WHEN a Project Lead exits the wizard before completion THEN the system SHALL save the partial submission as a draft

### Requirement 2

**User Story:** As a Client, I want to specify additional information requirements when creating a project, so that I receive all necessary details from bidding teams.

#### Acceptance Criteria

1. WHEN a Client creates a project THEN the system SHALL provide an interface to define additional information requirements
2. WHEN a Client adds an additional info requirement THEN the system SHALL allow specification of field name, field type, whether it is required, and help text
3. WHEN a Client saves a project with additional requirements THEN the system SHALL persist these requirements in the database
4. WHEN a Project Lead views a project THEN the system SHALL display all additional information requirements specified by the Client
5. WHERE a project has additional requirements, WHEN a Project Lead submits a proposal THEN the system SHALL include a step to collect all additional information

### Requirement 3

**User Story:** As a Project Lead, I want to review and edit proposal details during submission, so that I can ensure accuracy before final submission.

#### Acceptance Criteria

1. WHEN a Project Lead reaches the proposal details step THEN the system SHALL display all current proposal information including title, budget estimate, timeline estimate, and team composition
2. WHEN a Project Lead edits proposal details THEN the system SHALL validate the changes in real-time
3. WHEN a Project Lead provides invalid data THEN the system SHALL display clear error messages and prevent progression
4. WHEN a Project Lead confirms proposal details THEN the system SHALL update the proposal record with the modified information
5. WHEN proposal details include budget estimates THEN the system SHALL validate that the budget is a positive number

### Requirement 4

**User Story:** As a Project Lead, I want to provide responses to client-required additional information, so that my proposal meets all submission requirements.

#### Acceptance Criteria

1. WHEN a Project Lead reaches the additional info step THEN the system SHALL display all client-specified additional information fields
2. WHEN an additional info field is marked as required THEN the system SHALL prevent submission until the field is completed
3. WHEN a Project Lead enters data into an additional info field THEN the system SHALL validate the data according to the field type
4. WHEN a Project Lead completes all additional info fields THEN the system SHALL enable progression to the next step
5. WHEN additional info includes file uploads THEN the system SHALL validate file types and sizes before accepting uploads

### Requirement 5

**User Story:** As a Project Lead, I want to review all submission information before final confirmation, so that I can verify everything is correct.

#### Acceptance Criteria

1. WHEN a Project Lead reaches the review step THEN the system SHALL display a comprehensive summary of all submission data
2. WHEN the review summary is displayed THEN the system SHALL organize information by category including proposal details, additional info, and team information
3. WHEN a Project Lead identifies an error during review THEN the system SHALL allow navigation back to any previous step to make corrections
4. WHEN a Project Lead confirms the review THEN the system SHALL enable the final submit button
5. WHEN the review displays file attachments THEN the system SHALL show file names, types, and sizes

### Requirement 6

**User Story:** As a Project Lead, I want to receive confirmation when my proposal is successfully submitted, so that I know the submission was processed.

#### Acceptance Criteria

1. WHEN a Project Lead clicks the final submit button THEN the system SHALL update the proposal status from draft to submitted
2. WHEN a proposal status changes to submitted THEN the system SHALL record the submission timestamp
3. WHEN a proposal is successfully submitted THEN the system SHALL display a success confirmation message
4. WHEN a proposal submission succeeds THEN the system SHALL redirect the Project Lead to the proposal detail view
5. IF a proposal submission fails THEN the system SHALL display an error message and allow the Project Lead to retry

### Requirement 7

**User Story:** As a Client, I want to receive an email notification when a proposal is submitted for my project, so that I can review it promptly.

#### Acceptance Criteria

1. WHEN a proposal is successfully submitted THEN the system SHALL send an email notification to the project owner
2. WHEN the email is sent THEN the email SHALL include the project title, proposal title, bidding team name, and submission timestamp
3. WHEN the email is sent THEN the email SHALL include a direct link to view the submitted proposal
4. WHEN the email is sent THEN the email SHALL use the existing nodemailer service in lib/email/
5. IF the email fails to send THEN the system SHALL log the error and continue with the submission process

### Requirement 8

**User Story:** As a Project Lead, I want to receive an email confirmation when my proposal is submitted, so that I have a record of the submission.

#### Acceptance Criteria

1. WHEN a proposal is successfully submitted THEN the system SHALL send a confirmation email to the Project Lead
2. WHEN the confirmation email is sent THEN the email SHALL include the project title, proposal title, and submission timestamp
3. WHEN the confirmation email is sent THEN the email SHALL include a summary of submitted information
4. WHEN the confirmation email is sent THEN the email SHALL include a link to view the submitted proposal
5. WHEN the confirmation email is sent THEN the email SHALL use the existing nodemailer service in lib/email/

### Requirement 9

**User Story:** As an Admin, I want to receive notifications when proposals are submitted, so that I can monitor platform activity.

#### Acceptance Criteria

1. WHEN a proposal is successfully submitted THEN the system SHALL send a notification email to all admins
2. WHEN the admin notification is sent THEN the email SHALL include the project title, client name, bidding team name, and submission timestamp
3. WHEN the admin notification is sent THEN the email SHALL include links to both the project and the proposal
4. WHEN the admin notification is sent THEN the email SHALL use the existing nodemailer service in lib/email/
5. WHEN multiple admins exist THEN the system SHALL send individual emails to each admin

### Requirement 10

**User Story:** As a system administrator, I want proposal submission data to be stored securely and atomically, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN a proposal submission begins THEN the system SHALL use database transactions to ensure atomicity
2. WHEN any step of the submission fails THEN the system SHALL roll back all changes and maintain the proposal in draft status
3. WHEN a proposal is submitted THEN the system SHALL validate all required fields are present before committing to the database
4. WHEN additional info is stored THEN the system SHALL store it in a structured JSONB format for efficient querying
5. WHEN a submission completes THEN the system SHALL log the activity for audit purposes
