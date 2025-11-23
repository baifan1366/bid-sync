# Implementation Plan

- [x] 1. Set up database schema and core functions
  - Create scoring_templates, scoring_criteria, proposal_scores, proposal_score_history, and proposal_rankings tables
  - Add indexes for performance optimization
  - Create database functions: calculate_proposal_total_score(), recalculate_project_rankings(), is_proposal_scoring_locked()
  - Implement RLS policies for all scoring tables
  - Create database migration file
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ]* 1.1 Write property test for weight sum validation
  - **Property 1: Template criterion weights sum to 100%**
  - **Validates: Requirements 1.4**

- [ ]* 1.2 Write property test for template persistence
  - **Property 5: Template persistence round-trip**
  - **Validates: Requirements 1.6**

- [x] 2. Implement GraphQL schema and resolvers

  - [x] 2.1 Define GraphQL types for scoring system
    - Add ScoringTemplate, ScoringCriterion, ProposalScore, ProposalRanking types
    - Add input types for mutations
    - Add query and mutation definitions
    - _Requirements: 1.1, 1.2, 3.1, 5.1_

  - [x] 2.2 Implement scoring template resolvers
    - Create createScoringTemplate mutation
    - Create updateScoringTemplate mutation
    - Create deleteScoringTemplate mutation
    - Create scoringTemplate query
    - Create defaultScoringTemplates query
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.3 Write property test for multiple criteria acceptance
    - **Property 2: Multiple criteria acceptance**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test for criterion weight requirement
    - **Property 3: Criterion weight requirement**
    - **Validates: Requirements 1.3**

  - [ ]* 2.5 Write property test for draft template mutability
    - **Property 4: Draft template mutability**
    - **Validates: Requirements 1.5**

  - [x] 2.6 Implement proposal scoring resolvers





    - Create scoreProposal mutation
    - Create finalizeScoring mutation
    - Create reviseScore mutation
    - Create proposalScores query
    - Create proposalScoreHistory query
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.7 Write property test for raw score validation
    - **Property 8: Raw score validation**
    - **Validates: Requirements 3.2**

  - [ ]* 2.8 Write property test for weighted score calculation
    - **Property 9: Weighted score calculation**
    - **Validates: Requirements 3.3**

  - [ ]* 2.9 Write property test for total score calculation
    - **Property 10: Total score calculation**
    - **Validates: Requirements 3.4**
-

  - [x] 2.10 Implement ranking resolvers




    - Create recalculateRankings mutation
    - Create proposalRankings query
    - Create scoringComparison query
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.5_

  - [ ]* 2.11 Write property test for ranking sort order
    - **Property 16: Ranking sort order**
    - **Validates: Requirements 5.1**

  - [ ]* 2.12 Write property test for tie-breaking logic
    - **Property 17: Tie-breaking by submission date**
    - **Validates: Requirements 5.2**


  - [x] 2.13 Implement export resolver and PDF generation service




    - Create exportScoring mutation
    - Install jsPDF library
    - Implement PDF generation service with project info, scoring template, proposals with scores
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 3. Create default scoring templates
  - Create database seed script or migration for default templates
  - Seed Technical template (Technical Approach 30%, Innovation 20%, Feasibility 25%, Team Expertise 25%)
  - Seed Financial template (Budget 40%, Cost Breakdown 20%, Value 25%, Payment Terms 15%)
  - Seed Balanced template (Technical 25%, Budget 25%, Timeline 20%, Team 20%, Communication 10%)
  - Seed Fast-Track template (Timeline 40%, Availability 30%, Budget 20%, Experience 10%)
  - Mark templates with is_default = true
  - _Requirements: 2.1, 2.2_

- [ ]* 3.1 Write unit test for default template structure
  - Verify each default template has correct criteria and weights
  - _Requirements: 2.1_

- [ ]* 3.2 Write property test for default template customization
  - **Property 6: Default template customization independence**
  - **Validates: Requirements 2.4**


- [ ] 4. Build scoring template management UI
  - [x] 4.1 Create ScoringTemplateManager component





    - Create new component at components/client/scoring-template-manager.tsx
    - Display option to create or configure scoring template
    - Show list of default templates for selection
    - Allow adding/editing/removing criteria
    - Implement drag-and-drop reordering (use existing React DnD patterns or simple state management)
    - Real-time weight sum validation with visual feedback
    - Save and cancel actions with GraphQL mutations
    - Follow BidSync design system (yellow-400 accents, black/white theme)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3, 2.4_
-

  - [x] 4.2 Create ScoringCriterionForm component




    - Create new component at components/client/scoring-criterion-form.tsx
    - Input fields for criterion name and description
    - Weight percentage input with validation (0-100)
    - Order index display
    - Delete criterion button
    - Use shadcn/ui components (Input, Label, Button)
    - _Requirements: 1.2, 1.3_

  - [ ]* 4.3 Write unit test for weight validation UI
    - Test that UI shows error when weights don't sum to 100%
    - Test that save button is disabled when validation fails
    - _Requirements: 1.4_

- [ ] 5. Build proposal scoring interface

  - [x] 5.1 Create ProposalScoringInterface component





    - Create new component at components/client/proposal-scoring-interface.tsx
    - Fetch scoring template and existing scores via GraphQL
    - Display all criteria from project's scoring template
    - Use shadcn/ui Slider for raw scores (1-10 scale)
    - Real-time weighted score calculation display
    - Textarea for notes on each criterion
    - Total score display prominently at top with yellow accent
    - Auto-save draft scores functionality with debouncing
    - Finalize scoring button (yellow-400 primary button)
    - Loading and error states
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

  - [x] 5.2 Create ScoreCriterionCard component




  - [ ] 5.2 Create ScoreCriterionCard component
    - Create new component at components/client/score-criterion-card.tsx
    - Criterion name and description display
    - Score slider with current value display
    - Weighted score calculation display (raw_score × weight/100)
    - Notes textarea with shadcn/ui Textarea
    - Visual feedback for unsaved changes (yellow border or indicator)
    - Use Card component from shadcn/ui
    - _Requirements: 3.2, 3.3, 4.2_

  - [ ]* 5.3 Write property test for draft scores persistence
    - **Property 11: Draft scores persistence**
    - **Validates: Requirements 3.5**

  - [ ]* 5.4 Write property test for finalization
    - **Property 12: Finalization marks completion**
    - **Validates: Requirements 3.6**

  - [ ]* 5.5 Write property test for notes persistence
    - **Property 13: Notes persistence with scores**
    - **Validates: Requirements 4.2**

- [ ] 6. Build proposal rankings list
  - [x] 6.1 Create ProposalRankingsList component




  - [ ] 6.1 Create ProposalRankingsList component

    - Create new component at components/client/proposal-rankings-list.tsx
    - Fetch rankings via proposalRankings GraphQL query
    - Display proposals sorted by total score descending
    - Show rank number (with yellow badge), proposal title, lead name, total score
    - Display scoring status badges (Not Scored, Partially Scored, Fully Scored) using shadcn/ui Badge
    - Filter dropdown by scoring status
    - Quick navigation to scoring interface
    - Real-time updates via Supabase subscriptions on proposal_rankings table
    - Responsive grid layout
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
-

  - [x] 6.2 Create ProposalRankingCard component




    - Create new component at components/client/proposal-ranking-card.tsx
    - Rank badge with yellow-400 accent
    - Proposal summary information (title, lead, budget)
    - Total score display prominently
    - Scoring status indicator badge
    - "Score Proposal" or "View Scores" button (yellow-400)
    - Use Card component with hover effects
    - _Requirements: 5.3_

  - [ ]* 6.3 Write property test for unscored proposals placement
    - **Property 19: Unscored proposals placement**
    - **Validates: Requirements 5.4**

  - [ ]* 6.4 Write property test for ranking recalculation
    - **Property 20: Ranking recalculation on score update**
    - **Validates: Requirements 5.5**

- [ ] 7. Build scoring comparison view

  - [x] 7.1 Create ScoringComparisonView component





    - Create new component at components/client/scoring-comparison-view.tsx
    - Fetch comparison data via scoringComparison GraphQL query
    - Side-by-side layout for 2-4 proposals using grid
    - Display all criteria with scores for each proposal
    - Highlight best scores in green and worst scores in red
    - Total scores and rankings at top with yellow accents
    - Synchronized scrolling across columns using ScrollArea
    - Visual progress bars for each criterion
    - Responsive design (stacked on mobile with tabs, side-by-side on desktop)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 Create ComparisonProposalColumn component





    - Create new component at components/client/comparison-proposal-column.tsx
    - Proposal header with title and lead info
    - Criteria scores list with raw and weighted scores
    - Visual indicators for best/worst (green/red backgrounds)
    - Scoring status badge
    - Use Card component
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ]* 7.3 Write property test for comparison view generation
    - **Property 21: Comparison view generation**
    - **Validates: Requirements 6.1**

  - [ ]* 7.4 Write property test for best/worst identification
    - **Property 23: Best and worst score identification**
    - **Validates: Requirements 6.3**

- [ ] 8. Implement score revision and history
-

  - [x] 8.1 Create ScoreRevisionDialog component



    - Create new component at components/client/score-revision-dialog.tsx
    - Use shadcn/ui Dialog component
    - Display current scores with sliders
    - Allow editing of raw scores and notes
    - Require reason for revision (textarea)
    - Show warning Alert if proposal is accepted/rejected
    - Confirm (yellow-400) and cancel actions
    - Call reviseScore GraphQL mutation
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 8.2 Create ScoreHistoryViewer component





    - Create new component at components/client/score-history-viewer.tsx
    - Fetch history via proposalScoreHistory GraphQL query
    - Display all score revisions chronologically (newest first)
    - Show previous and new values with visual diff
    - Display who made changes and when (user name, timestamp)
    - Show revision reasons
    - Filter dropdown by criterion
    - Diff view for notes changes (highlight additions/deletions)
    - Use ScrollArea for long history
    - _Requirements: 8.4_

  - [ ]* 8.3 Write property test for revision history logging
    - **Property 30: Score revision history logging**
    - **Validates: Requirements 8.2**

  - [ ]* 8.4 Write property test for accepted/rejected locking
    - **Property 33: Accepted/rejected proposal locking**
    - **Validates: Requirements 8.5**

- [ ] 9. Implement scoring export functionality

  - [x] 9.1 Create PDF export service





    - Create new service at lib/scoring-export-service.ts
    - Install jsPDF library: npm install jspdf
    - Generate PDF with project and client information
    - Include scoring template details (criteria, weights)
    - Include all proposals with scores and rankings in table format
    - Include notes for each score
    - Include summary of unscored proposals
    - Add export date and timestamp
    - Return temporary URL with expiration
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_


  - [x] 9.2 Create ScoringExportDialog component


    - Create new component at components/client/scoring-export-dialog.tsx
    - Use shadcn/ui Dialog component
    - Export button (yellow-400) with loading state
    - Preview of export contents (project name, proposal count, etc.)
    - Download link generation via exportScoring GraphQL mutation
    - Expiration notice (e.g., "Link expires in 24 hours")
    - Success/error toast notifications
    - _Requirements: 7.1_

  - [ ]* 9.3 Write property test for export completeness
    - **Property 25: Export data completeness**
    - **Validates: Requirements 7.2**

  - [ ]* 9.4 Write property test for export metadata
    - **Property 27: Export metadata inclusion**

    - **Validates: Requirements 7.4**
-

- [x] 10. Implement lead score visibility



  - [x] 10.1 Add scoring section to lead proposal view


    - Update existing lead proposal detail page/component
    - Fetch proposal scores via proposalScores GraphQL query
    - Display scoring status indicator badge
    - Show total score and ranking when scored (with yellow accents)
    - Display individual criterion scores with progress bars
    - Hide client notes from leads (filter out notes field)
    - Show "Pending Evaluation" message for unscored proposals
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.2 Create LeadScoreCard component


    - Create new component at components/lead/lead-score-card.tsx
    - Total score display prominently with rank badge (yellow-400)
    - Criteria scores list without notes
    - Visual score bars using Progress component
    - Scoring status message
    - Use Card component
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 10.3 Write property test for lead notes privacy
    - **Property 35: Lead notes privacy**
    - **Validates: Requirements 9.3**
-

- [x] 11. Add scoring analytics to admin dashboard




  - [x] 11.1 Create ScoringAnalytics component


    - Create new component at components/admin/scoring-analytics.tsx
    - Display percentage of projects using scoring (card with percentage)
    - Show average proposals scored per project (card with number)
    - Display most commonly used criteria (bar chart or list)
    - Show average time to complete scoring (card with duration)
    - Add date range filter using date-fns
    - Visualize data with simple charts (consider using existing chart patterns or basic HTML/CSS)
    - Integrate into existing admin analytics dashboard
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.2 Implement analytics calculation functions


    - Add analytics queries to GraphQL schema and resolvers
    - Calculate scoring usage percentage from database
    - Calculate average proposals scored per project
    - Identify most common criteria across all templates
    - Calculate average scoring duration (from first score to finalization)
    - Consider caching results for performance
    - _Requirements: 10.2, 10.3, 10.4, 10.5_

  - [ ]* 11.3 Write property test for usage percentage calculation
    - **Property 36: Scoring usage percentage calculation**
    - **Validates: Requirements 10.2**

  - [ ]* 11.4 Write property test for average calculation
    - **Property 37: Average proposals scored calculation**
    - **Validates: Requirements 10.3**

- [x] 12. Integrate scoring into project detail page




  - Update client project detail page to include scoring features
  - Add "Configure Scoring" button for clients (opens ScoringTemplateManager)
  - Add "View Rankings" button when proposals are scored (navigates to rankings view)
  - Add "Compare Proposals" button with checkbox selection UI
  - Add scoring status indicators to existing proposal cards
  - Update proposal list to show scores and ranks when available
  - _Requirements: 1.1, 5.1, 6.1_
- [x] 13. Implement real-time updates








- [ ] 13. Implement real-time updates

  - Set up Supabase Realtime subscriptions for proposal_rankings table
  - Implement optimistic UI updates for scoring operations
  - Add debouncing for auto-save operations (use existing patterns)
  - Implement rollback on operation failure
  - Add connection status indicator (reuse existing connection status component)
  - _Requirements: 5.5_


- [x] 14. Add notification triggers



  - Integrate with existing notification system
  - Send notification to lead when their proposal is scored
  - Send notification to lead when scores are updated
  - Send notification to client when all proposals are scored
  - Use existing notification patterns from the codebase
  - _Requirements: 9.5_

- [x] 15. Implement error handling and validation





  - Add client-side validation for all forms (weight sum, score range)
  - Implement server-side validation in resolvers (already partially done)
  - Add user-friendly error messages with toast notifications
  - Implement retry logic for failed operations
  - Add error logging using existing error-logger
  - Handle concurrent modification scenarios
  - _Requirements: All_

- [ ]* 15.1 Write unit tests for validation logic
  - Test weight sum validation
  - Test score range validation
  - Test required field validation
  - Test duplicate criterion name validation

- [ ] 16. Performance optimization
  - Database indexes already added in migration
  - Implement ranking cache with invalidation strategy
  - Optimize PDF generation for large datasets (pagination, compression)
  - Add pagination for rankings list if needed
  - Implement lazy loading for comparison view
  - _Requirements: All_

- [ ] 17. Accessibility improvements
  - Add keyboard navigation for scoring interface
  - Implement screen reader support with ARIA labels
  - Add ARIA labels to all interactive elements
  - Ensure high contrast mode compatibility
  - Test with accessibility tools
  - Follow existing accessibility patterns in codebase
  - _Requirements: All_

- [ ] 18. Mobile responsiveness
  - Optimize scoring interface for mobile (responsive grid)
  - Implement stacked layout for comparison on mobile
  - Add touch-friendly score sliders
  - Optimize PDF exports for mobile viewing
  - Test on various screen sizes
  - Follow existing responsive patterns (sm:, md:, lg: breakpoints)
  - _Requirements: All_

- [ ] 19. Documentation and testing
  - [ ]* 19.1 Write comprehensive unit tests
    - Install fast-check if not already installed: npm install --save-dev fast-check
    - Test all calculation functions (weighted score, total score)
    - Test validation logic (weight sum, score range)
    - Test ranking algorithm with specific examples
    - Test export generation
    - Use vitest framework (already configured)
    - Achieve 80%+ code coverage

  - [ ]* 19.2 Write property-based tests for all 39 properties
    - Configure fast-check with 100+ iterations per property
    - Tag each test with property number and requirement using comments
    - Implement custom generators for scoring data (templates, scores, rankings)
    - Test edge cases and boundary conditions
    - Create test file at lib/__tests__/scoring-system.test.ts

  - [ ]* 19.3 Write integration tests
    - Test complete scoring workflow (create template → score → rank)
    - Test score revision workflow
    - Test ranking recalculation
    - Test export generation
    - Test concurrent scoring scenarios
    - Use existing test patterns from lib/__tests__

  - [ ] 19.4 Create user documentation
    - Create markdown documentation file
    - Write guide for creating scoring templates
    - Document scoring workflow with screenshots
    - Explain ranking algorithm
    - Provide export instructions
    - Add FAQ section
    - Consider adding to existing README or creating separate docs

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Run all tests: npm test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all core functionality works end-to-end
