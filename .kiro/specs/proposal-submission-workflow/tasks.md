# Implementation Plan

- [x] 1. Database schema and migrations




  - Create migration file for new tables and columns
  - Add additional_info_requirements column to projects table
  - Create proposal_additional_info table
  - Create submission_drafts table
  - Add title, budget_estimate, timeline_estimate, executive_summary columns to proposals table
  - Create indexes for performance
  - Add RLS policies for new tables
  - _Requirements: 2.1, 2.2, 2.3, 10.1, 10.2, 10.3_


- [x] 2. GraphQL schema extensions



  - Add AdditionalInfoRequirement type and FieldType enum
  - Extend Project type with additionalInfoRequirements field
  - Extend Proposal type with new fields
  - Add ProposalAdditionalInfo type
  - Add SubmitProposalInput and AdditionalInfoInput input types
  - Add SubmissionResult type
  - Add submitProposal and saveSubmissionDraft mutations
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2_

- [x] 3. Email templates for submission notifications




  - Create proposal submission notification template for clients
  - Create proposal submission confirmation template for leads
  - Create proposal submission notification template for admins
  - Include all required fields (project title, proposal title, team name, timestamp)
  - Include direct links to view proposals
  - Follow existing BidSync email template design
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_
-

- [x] 4. Backend submission service



  - Create ProposalSubmissionService class
  - Implement validateSubmission method
  - Implement processSubmission method with database transactions
  - Implement sendNotifications method
  - Implement saveSubmissionDraft method
  - Handle rollback on failures
  - Integrate with activity logging
  - _Requirements: 6.1, 6.2, 10.1, 10.2, 10.3, 10.5_

- [ ]* 4.1 Write property test for submission service
  - **Property 17: Submission updates status**
  - **Property 18: Submission records timestamp**
  - **Property 34: Failure rolls back changes**
  - **Property 35: Pre-submission validation**
  - **Property 36: Submission creates audit log**
  - **Validates: Requirements 6.1, 6.2, 10.2, 10.3, 10.5**
-

- [x] 5. Backend additional info service




  - Create AdditionalInfoService class
  - Implement validateAdditionalInfo method with type-based validation
  - Implement storeAdditionalInfo method
  - Handle file upload validation
  - _Requirements: 4.2, 4.3, 4.5_

- [ ]* 5.1 Write property test for additional info validation
  - **Property 11: Required field enforcement**
  - **Property 12: Type-based validation**
  - **Validates: Requirements 4.2, 4.3**
-

- [x] 6. GraphQL resolvers for submission


  - Implement submitProposal mutation resolver
  - Implement saveSubmissionDraft mutation resolver
  - Implement getProjectRequirements query resolver
  - Add authorization checks (verify user is proposal lead)
  - Integrate with ProposalSubmissionService
  - Handle errors and return appropriate GraphQL errors
  - _Requirements: 1.1, 2.4, 6.1, 6.2, 6.5_

- [ ]* 6.1 Write property test for submission mutation
  - **Property 21: Failure allows retry**
  - **Validates: Requirements 6.5**

- [x] 7. Email notification integration




  - Implement sendClientNotification function
  - Implement sendLeadConfirmation function
  - Implement sendAdminNotifications function
  - Handle email failures gracefully (log and continue)
  - Integrate with existing lib/email/ service
  - _Requirements: 7.1, 7.5, 8.1, 9.1, 9.5_

- [ ]* 7.1 Write property tests for email notifications
  - **Property 22: Client notification sent**
  - **Property 23: Client email contains required fields**
  - **Property 24: Client email contains proposal link**
  - **Property 25: Email failure doesn't block submission**
  - **Property 26: Lead confirmation sent**
  - **Property 27: Lead email contains required fields**
  - **Property 28: Lead email contains summary**
  - **Property 29: Lead email contains proposal link**
  - **Property 30: Admin notifications sent to all**
  - **Property 31: Admin email contains required fields**
  - **Property 32: Admin email contains both links**
  - **Property 33: Individual admin emails**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.5**
- [x] 8. Project creation UI for additional info requirements






- [ ] 8. Project creation UI for additional info requirements

  - Add additional info requirements section to create project dialog
  - Implement field type selector (text, number, date, file, textarea, select)
  - Add required checkbox and help text input
  - Allow adding/removing requirements
  - Implement drag-and-drop reordering
  - Save requirements to project on creation
  - _Requirements: 2.1, 2.2, 2.3_

- [ ]* 8.1 Write property test for requirements persistence
  - **Property 4: Requirements persistence**
  - **Validates: Requirements 2.3**
-

- [x] 9. Submission wizard container component




  - Create ProposalSubmissionWizard component
  - Implement step state management
  - Implement navigation between steps
  - Implement data persistence across navigation
  - Implement draft auto-save on exit
  - Add step indicator UI
  - Handle wizard open/close
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ]* 9.1 Write property tests for wizard navigation
  - **Property 2: Navigation preserves data**
  - **Property 3: Exit saves draft**
  - **Validates: Requirements 1.4, 1.5**
-

- [x] 10. Proposal details step component




  - Create ProposalDetailsStep component
  - Implement form with title, budget, timeline, executive summary fields
  - Add real-time validation
  - Display validation errors inline
  - Prevent progression with invalid data
  - Update proposal on confirmation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 10.1 Write property tests for proposal details validation
  - **Property 7: Real-time validation**
  - **Property 8: Invalid data blocks progression**
  - **Property 9: Details update persistence**
  - **Validates: Requirements 3.2, 3.3, 3.4**
- [x] 11. Additional info step component



- [ ] 11. Additional info step component

  - Create AdditionalInfoStep component
  - Implement DynamicFieldRenderer for different field types
  - Add validation based on field type and required status
  - Implement file upload handler
  - Display all client-specified requirements
  - Prevent progression until all required fields completed
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 11.1 Write property tests for additional info step
  - **Property 10: Additional info fields display**
  - **Property 13: Complete fields enable progression**
  - **Validates: Requirements 4.1, 4.4**

- [x] 12. Review step component





  - Create ReviewStep component
  - Display comprehensive summary of all submission data
  - Organize by category (proposal details, additional info, team)
  - Allow navigation back to any previous step
  - Enable submit button on confirmation
  - Display file attachments with details
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 12.1 Write property tests for review step
  - **Property 14: Review displays all data**
  - **Property 15: Review allows navigation**
  - **Property 16: Review confirmation enables submit**
  - **Validates: Requirements 5.1, 5.3, 5.4**

- [x] 13. Confirmation step component





  - Create ConfirmationStep component
  - Display success message
  - Show submission details
  - Implement redirect to proposal detail view
  - Handle submission errors with retry option
  - _Requirements: 6.3, 6.4, 6.5_

- [ ]* 13.1 Write property tests for confirmation step
  - **Property 19: Success shows confirmation**
  - **Property 20: Success redirects to detail**
  - **Validates: Requirements 6.3, 6.4**
-

- [x] 14. Validation utilities




  - Create field validation functions for each type
  - Implement budget validation (positive number)
  - Implement file validation (type, size)
  - Implement required field validation
  - Create validation error message generator
  - _Requirements: 3.2, 3.3, 3.5, 4.3, 4.5_

- [ ]* 14.1 Write unit tests for validation utilities
  - Test each field type validation
  - Test edge cases (empty, null, invalid formats)
  - Test error message generation
  - _Requirements: 3.2, 3.3, 3.5, 4.3, 4.5_

- [x] 15. Integration with proposal detail page





  - Add "Submit Proposal" button to proposal detail page
  - Show button only for draft proposals
  - Show button only to proposal lead
  - Open submission wizard on click
  - Refresh proposal data after successful submission
  - _Requirements: 1.1, 6.4_

- [x] 16. Project requirements display





  - Update project detail view to show additional info requirements
  - Display requirements in proposal workspace
  - Show requirements to project leads viewing the project
  - _Requirements: 2.4, 2.5_

- [ ]* 16.1 Write property test for requirements display
  - **Property 5: Requirements display completeness**
  - **Property 6: Workflow adapts to requirements**
  - **Validates: Requirements 2.4, 2.5**

- [x] 17. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Error handling and user feedback
  - Implement error boundary for wizard
  - Add loading states for async operations
  - Add toast notifications for success/error
  - Implement retry mechanism for network errors
  - Add graceful degradation for email failures
  - _Requirements: 6.5, 7.5_

- [ ]* 18.1 Write integration tests for error scenarios
  - Test network failure handling
  - Test database error handling
  - Test email failure handling
  - Test validation error display
  - _Requirements: 6.5, 7.5_

- [x] 19. Accessibility improvements





  - Add ARIA labels to all form fields
  - Implement keyboard navigation
  - Add screen reader announcements for step changes
  - Ensure focus management during navigation
  - Test with screen reader
  - Verify color contrast
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 19.1 Write accessibility tests
  - Test keyboard navigation
  - Test ARIA labels
  - Test focus management
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 20. Performance optimization
  - Implement lazy loading for wizard steps
  - Add debouncing to validation
  - Optimize database queries
  - Implement connection pooling
  - Add caching for project requirements
  - _Requirements: 1.3, 2.4, 3.2_

- [ ]* 20.1 Write performance tests
  - Test wizard load time
  - Test validation response time
  - Test submission processing time
  - _Requirements: 1.3, 2.4, 3.2_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
