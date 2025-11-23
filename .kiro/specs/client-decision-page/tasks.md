# Implementation Plan: Client Decision Page

## Overview

This implementation plan breaks down the Client Decision Page into discrete, actionable coding tasks. Each task builds incrementally, ensuring the system remains functional throughout development. The plan focuses on creating a comprehensive interface for clients to evaluate proposals, communicate with bidding teams, and make final decisions.

## Task List

- [x] 1. Database schema and GraphQL setup




- [x] 1.1 Create database migrations for chat and decisions


  - Create migration for chat_messages table with all fields
  - Create migration for proposal_decisions table
  - Add indexes for performance (project_id, proposal_id, created_at)
  - Create RLS policies for chat_messages (client and team access)
  - Create RLS policies for proposal_decisions
  - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 1.2 Extend GraphQL schema with new queries and mutations


  - Add projectWithProposals query to fetch project with all proposals
  - Add proposalDetail query for detailed proposal view
  - Add chatMessages query with pagination
  - Add unreadMessageCount query
  - Add sendMessage mutation
  - Add markMessagesAsRead mutation
  - Add acceptProposal mutation
  - Add rejectProposal mutation
  - Add GraphQL types for all new entities
  - _Requirements: 1.1, 2.1, 3.1, 6.1, 8.1, 8.4_

- [x] 1.3 Implement GraphQL resolvers for queries


  - Write projectWithProposals resolver with proposal counts
  - Write proposalDetail resolver with all related data
  - Write chatMessages resolver with filtering and pagination
  - Write unreadMessageCount resolver
  - Add authorization checks to all resolvers
  - _Requirements: 1.1, 2.1, 3.1, 6.1_

- [x] 1.4 Implement GraphQL resolvers for mutations


  - Write sendMessage resolver with validation
  - Write markMessagesAsRead resolver
  - Write acceptProposal resolver with cascading updates
  - Write rejectProposal resolver with feedback storage
  - Add authorization checks to all mutations
  - _Requirements: 6.2, 8.2, 8.3, 8.5_

- [ ]* 1.5 Write property test for proposal filtering
  - **Property 2: Proposals list consistency**
  - **Validates: Requirements 2.1, 12.1**
  - Generate random project and proposal data
  - Apply various filters
  - Verify filtered results only contain matching proposals

- [x] 2. Utility functions and helpers




- [x] 2.1 Create proposal utility functions


  - Write function to calculate proposal counts by status
  - Write function to format proposal budget
  - Write function to calculate team size
  - Write function to determine proposal urgency
  - Add to `lib/proposal-utils.ts`
  - _Requirements: 2.2, 2.3, 9.4_

- [x] 2.2 Create chat utility functions


  - Write function to format message timestamps
  - Write function to group messages by date
  - Write function to detect unread messages
  - Write function to generate message preview
  - Add to `lib/chat-utils.ts`
  - _Requirements: 6.1, 6.3, 11.2_


- [x] 2.3 Create comparison utility functions

  - Write function to align proposal sections
  - Write function to detect differences between proposals
  - Write function to calculate comparison metrics
  - Add to `lib/comparison-utils.ts`
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 2.4 Write property test for budget formatting
  - **Property 4: Budget formatting consistency**
  - **Validates: Requirements 1.1, 2.3**
  - Generate random budget values (including null/undefined)
  - Verify formatting is consistent across all components
  - Test currency symbols, decimal places, thousands separators


- [x] 3. Skeleton loading components


- [x] 3.1 Create ProjectHeaderSkeleton component


  - Use shadcn/ui Skeleton component
  - Match layout of ProjectHeader
  - Support theme-aware styling
  - Create file `components/client/project-header-skeleton.tsx`
  - _Requirements: 15.1_

- [x] 3.2 Create ProposalCardSkeleton component


  - Use shadcn/ui Skeleton component
  - Match layout of ProposalCard
  - Support theme-aware styling
  - Create file `components/client/proposal-card-skeleton.tsx`
  - _Requirements: 15.1_

- [x] 3.3 Create ProposalDetailSkeleton component


  - Use shadcn/ui Skeleton component
  - Match layout of ProposalDetailView
  - Support theme-aware styling
  - Create file `components/client/proposal-detail-skeleton.tsx`
  - _Requirements: 15.1_

- [x] 3.4 Create ChatMessageSkeleton component


  - Use shadcn/ui Skeleton component
  - Match layout of message bubbles
  - Support theme-aware styling
  - Create file `components/client/chat-message-skeleton.tsx`
  - _Requirements: 15.1_

- [x] 4. Project header and progress tracking




- [x] 4.1 Create ProjectHeader component


  - Display project title, description, budget range, timeline
  - Show project status badge with color coding
  - Display deadline with countdown indicator
  - Show document list with download links
  - Support responsive layout (stacks on mobile)
  - Support theme-aware styling with yellow accents
  - Create file `components/client/project-header.tsx`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 4.2 Write property test for status badge accuracy
  - **Property 3: Status badge accuracy**
  - **Validates: Requirements 1.4, 2.2, 9.2**
  - Generate random status values
  - Verify badge colors match status values
  - Test all possible status types

- [x] 4.3 Create ProgressTracker component


  - Display progress bar showing evaluation completion
  - Show counts for total, submitted, under review, accepted, rejected
  - Add visual indicators for each stage
  - Support responsive design
  - Support theme-aware styling
  - Create file `components/client/progress-tracker.tsx`
  - _Requirements: 9.1, 9.4_

- [ ]* 4.4 Write property test for progress tracker accuracy
  - **Property 20: Progress tracker accuracy**
  - **Validates: Requirements 9.1, 9.4**
  - Generate random proposal arrays with various statuses
  - Calculate counts
  - Verify sum equals total and individual counts match filters

- [x] 5. Proposals list and controls




- [x] 5.1 Create ProposalsControls component


  - Add Select dropdown for status filtering
  - Add Select dropdown for sort field (submission_date, budget, team_size)
  - Add Button for sort order toggle (asc/desc)
  - Add comparison mode toggle button
  - Show selected proposals counter
  - Support theme-aware styling
  - Create file `components/client/proposals-controls.tsx`
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 5.1_

- [x] 5.2 Create ProposalCard component


  - Display proposal title, team name, submission date, status
  - Show budget estimate with formatting
  - Display team size indicator
  - Show unread messages badge
  - Add checkbox for comparison selection
  - Implement hover effects with yellow border
  - Handle click to expand/navigate
  - Support theme-aware styling
  - Create file `components/client/proposal-card.tsx`
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 5.3 Create ProposalsList component


  - Render ProposalCard components in responsive grid
  - Show ProposalCardSkeleton during loading
  - Display empty state when no proposals
  - Support filtering and sorting
  - Handle proposal selection for comparison
  - Create file `components/client/proposals-list.tsx`
  - _Requirements: 2.1, 2.4, 12.1, 12.2, 12.3, 12.4_

- [ ]* 5.4 Write property test for message ordering
  - **Property 6: Chat message ordering**
  - **Validates: Requirements 6.1**
  - Generate random arrays of messages with timestamps
  - Verify messages are always sorted chronologically
  - Test with various timestamp patterns

- [x] 6. Proposal detail view



- [x] 6.1 Create ProposalDetailView component structure


  - Set up tabbed interface (Overview, Sections, Documents, Team, History)
  - Create responsive layout
  - Add close/back button
  - Support theme-aware styling
  - Create file `components/client/proposal-detail-view.tsx`
  - _Requirements: 3.1, 10.1, 10.2, 10.3_

- [x] 6.2 Implement Overview tab


  - Display proposal summary information
  - Show bidding lead information with avatar
  - Display submission date and status
  - Show budget and timeline estimates
  - Display compliance checklist status
  - _Requirements: 3.1, 3.3, 4.1_

- [x] 6.3 Implement Sections tab


  - Render all proposal sections in order
  - Display rich text content with proper formatting
  - Support collapsible sections
  - Add section navigation
  - _Requirements: 3.1, 3.4_

- [x] 6.4 Implement Documents tab


  - Display all documents grouped by category
  - Show document name, type, size, upload date
  - Add download buttons with progress indicators
  - Handle download errors with retry
  - _Requirements: 3.2, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 6.5 Implement Team tab


  - Display bidding lead with profile information
  - Show all team members with avatars and roles
  - Display assigned sections for each member
  - Show experience/credentials when available
  - Make names clickable to view profiles
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6.6 Implement History tab


  - Display version history timeline
  - Show version numbers, timestamps, creators
  - Add "View Version" buttons
  - Add "Compare Versions" functionality
  - _Requirements: 3.5_

- [ ]* 6.7 Write property test for version display
  - **Property 18: Proposal version display**
  - **Validates: Requirements 3.5**
  - Generate proposals with multiple versions
  - Verify latest version is displayed by default
  - Test version selection logic
- [x] 7. Proposal comparison view




- [ ] 7. Proposal comparison view

- [x] 7.1 Create ProposalComparisonView component


  - Set up side-by-side layout (responsive: stacks on mobile)
  - Add sticky headers for each proposal
  - Implement synchronized scrolling
  - Add close button to exit comparison
  - Support theme-aware styling
  - Create file `components/client/proposal-comparison-view.tsx`
  - _Requirements: 5.1, 5.5, 10.1, 10.2, 10.3_

- [x] 7.2 Implement comparison grid layout


  - Align corresponding sections horizontally
  - Display budget comparison with visual indicators
  - Show timeline comparison
  - Display team size comparison
  - Show compliance score comparison
  - Highlight key differences
  - _Requirements: 5.2, 5.3_

- [x] 7.3 Add comparison selection logic


  - Validate 2-4 proposals selected
  - Handle selection/deselection
  - Show error if invalid selection
  - _Requirements: 5.1_

- [ ]* 7.4 Write property test for comparison selection limit
  - **Property 5: Proposal comparison selection limit**
  - **Validates: Requirements 5.1**
  - Test selection validation (min 2, max 4)
  - Verify error handling for invalid selections

- [x] 8. Chat interface




- [x] 8.1 Create ChatSection component structure


  - Set up responsive layout (full-width on mobile, sidebar on desktop)
  - Add chat header with proposal/project info
  - Create messages container
  - Add message composer at bottom
  - Support theme-aware styling
  - Create file `components/client/chat-section.tsx`
  - _Requirements: 6.1, 6.5, 10.1, 10.2, 10.3_



- [x] 8.2 Implement MessagesList component

  - Display messages in chronological order
  - Group messages by sender and time
  - Show sender avatars and names
  - Display timestamps
  - Implement auto-scroll to latest message
  - Show ChatMessageSkeleton during loading
  - Support virtualization for long lists (react-window)
  - Create file `components/client/messages-list.tsx`
  - _Requirements: 6.1, 6.3_



- [x] 8.3 Create MessageBubble component

  - Display message content
  - Show sender info (name, avatar, role)
  - Display timestamp


  - Use theme-aware styling (yellow for client, white/black for others)
  - Support different styles for sent vs received
  - Create file `components/client/message-bubble.tsx`
  - _Requirements: 6.3, 6.5_

- [x] 8.4 Implement MessageComposer component

  - Create auto-expanding textarea
  - Add send button with loading state

  - Implement Enter to send (Shift+Enter for new line)
  - Handle message submission
  - Show error states with retry
  - Support theme-aware styling
  - Create file `components/client/message-composer.tsx`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.5 Set up Supabase Realtime for chat

  - Create useRealtimeMessages hook
  - Subscribe to new messages for project/proposal
  - Handle message updates in real-time
  - Implement connection status tracking
  - Add reconnection logic with exponential backoff
  - Create file `hooks/use-realtime-messages.ts`
  - _Requirements: 6.2, 11.1, 11.2, 11.3, 11.4_

- [ ]* 8.6 Write property test for real-time message delivery
  - **Property 8: Real-time message delivery**
  - **Validates: Requirements 6.2, 11.2**
  - Simulate message sending
  - Verify message appears within acceptable timeframe
  - Test with multiple concurrent messages

- [x] 9. Decision actions and workflows




- [x] 9.1 Create DecisionActions component


  - Add Accept button (green with yellow accent)
  - Add Reject button (red with yellow accent)
  - Show buttons only for submitted proposals
  - Disable buttons during operations
  - Support theme-aware styling
  - Create file `components/client/decision-actions.tsx`
  - _Requirements: 8.1, 8.4_

- [x] 9.2 Implement AcceptProposalDialog


  - Create confirmation dialog
  - Display proposal summary
  - Show warning about auto-rejecting other proposals
  - Add confirm and cancel buttons
  - Handle acceptance mutation
  - Show success/error notifications
  - Create file `components/client/accept-proposal-dialog.tsx`
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 9.3 Implement RejectProposalDialog


  - Create feedback form dialog
  - Add textarea for rejection reason (required)
  - Validate feedback is non-empty
  - Add submit and cancel buttons
  - Handle rejection mutation
  - Show success/error notifications
  - Create file `components/client/reject-proposal-dialog.tsx`
  - _Requirements: 8.4, 8.5_

- [ ]* 9.4 Write property test for decision exclusivity
  - **Property 9: Decision action exclusivity**
  - **Validates: Requirements 8.3**
  - Generate project with multiple proposals
  - Accept one proposal
  - Verify all others are automatically rejected

- [ ]* 9.5 Write property test for rejection feedback requirement
  - **Property 10: Rejection feedback requirement**
  - **Validates: Requirements 8.4, 8.5**
  - Test rejection with empty feedback
  - Verify validation prevents submission
  - Test rejection with valid feedback succeeds

- [x] 10. Main page integration



- [x] 10.1 Create ClientDecisionPage component


  - Set up page layout with responsive grid
  - Add ProjectHeader at top
  - Add ProgressTracker below header
  - Create main content area with proposals section
  - Add ChatSection in sidebar (desktop) or bottom (mobile)
  - Support theme-aware styling
  - Create file `app/(app)/(client)/projects/[projectId]/decision/client-decision-page.tsx`
  - _Requirements: 1.1, 2.1, 6.1, 9.1, 10.1, 10.2, 10.3_

- [x] 10.2 Implement data fetching and state management


  - Use useUser hook for authentication
  - Fetch project data with useGraphQLQuery
  - Fetch proposals data with useGraphQLQuery
  - Set up local state for filters, sorts, view mode
  - Implement filter logic
  - Implement sort logic
  - Handle proposal selection for comparison
  - _Requirements: 2.1, 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 10.3 Wire up all child components


  - Render ProjectHeader with project data
  - Render ProgressTracker with proposal counts
  - Render ProposalsControls with state handlers
  - Render ProposalsList with filtered/sorted proposals
  - Render ProposalDetailView when proposal selected
  - Render ProposalComparisonView when in comparison mode
  - Render ChatSection with selected proposal
  - Pass loading states to all components
  - _Requirements: 1.1, 2.1, 3.1, 5.1, 6.1, 9.1_

- [x] 10.4 Implement navigation and routing


  - Handle URL parameters for selected proposal
  - Update URL when proposal selected
  - Handle back navigation
  - Preserve filter/sort state in URL
  - _Requirements: 2.5, 12.5_

- [ ]* 10.5 Write property test for filter persistence
  - **Property 12: Filter and sort persistence**
  - **Validates: Requirements 12.5**
  - Apply filters and sorts
  - Navigate to detail view and back
  - Verify settings persist

- [x] 11. Create page entry point




- [x] 11.1 Create server component page

  - Fetch initial project data server-side
  - Verify user authorization
  - Render ClientDecisionPage with initial data
  - Add proper metadata for SEO
  - Create file `app/(app)/(client)/projects/[projectId]/decision/page.tsx`
  - _Requirements: 1.1, 2.1_

- [x] 12. Real-time updates and notifications




- [x] 12.1 Implement proposal updates subscription


  - Create useRealtimeProposals hook
  - Subscribe to proposal status changes
  - Update UI when proposals change
  - Show notification for new proposals
  - Create file `hooks/use-realtime-proposals.ts`
  - _Requirements: 11.1, 11.3, 11.4_

- [x] 12.2 Implement unread message notifications


  - Track unread message count per proposal
  - Display badge on proposal cards
  - Display badge on chat interface
  - Update count when messages read
  - _Requirements: 11.2_

- [x] 12.3 Add connection status indicator


  - Display connection status in UI
  - Show reconnecting state
  - Show disconnected state with retry
  - _Requirements: 11.3, 11.4_

- [ ]* 12.4 Write property test for unread count accuracy
  - **Property 17: Unread message count accuracy**
  - **Validates: Requirements 11.2**
  - Generate messages with various read states
  - Calculate expected unread count
  - Verify displayed count matches
-

- [x] 13. Responsive behavior and theme support




- [x] 13.1 Implement responsive layouts


  - Test mobile viewport (< 640px)
  - Test tablet viewport (640px - 1024px)
  - Test desktop viewport (> 1024px)
  - Verify proposals grid adapts correctly
  - Verify chat section positioning
  - Verify comparison view stacking
  - _Requirements: 10.1, 10.2, 10.3_

- [ ]* 13.2 Write property test for responsive layout adaptation
  - **Property 14: Responsive layout adaptation**
  - **Validates: Requirements 10.1, 10.2, 10.3**
  - Simulate various viewport sizes
  - Verify layout adapts without overflow
  - Test all breakpoints

- [x] 13.3 Verify theme support


  - Test all components in light mode
  - Test all components in dark mode
  - Verify yellow accent colors throughout
  - Verify color contrast meets WCAG standards
  - Test smooth theme transitions
  - _Requirements: 1.5, 6.5, 14.3_

- [ ]* 13.4 Write property test for theme consistency
  - **Property 13: Theme consistency**
  - **Validates: Requirements 1.5, 14.3**
  - Toggle theme multiple times
  - Verify all components update colors
  - Verify yellow accent scheme maintained
-

- [x] 14. Accessibility implementation



- [x] 14.1 Implement keyboard navigation


  - Ensure all interactive elements are keyboard accessible
  - Add proper tab order
  - Implement keyboard shortcuts (Escape to close, Enter to submit)
  - Add yellow focus indicators
  - Test with keyboard only
  - _Requirements: 14.1, 14.5_

- [x] 14.2 Add ARIA labels and semantic HTML


  - Add ARIA labels to all interactive elements
  - Use semantic HTML elements (nav, main, aside, article)
  - Add ARIA live regions for real-time updates
  - Add alt text for images and avatars
  - Test with screen reader
  - _Requirements: 14.2_

- [x] 14.3 Verify color contrast


  - Test all text colors against backgrounds
  - Ensure minimum 4.5:1 for normal text
  - Ensure minimum 3:1 for large text
  - Test in both light and dark modes
  - _Requirements: 14.4_

- [ ]* 14.4 Write property test for keyboard navigation
  - **Property 16: Keyboard navigation completeness**
  - **Validates: Requirements 14.1**
  - Identify all interactive elements
  - Verify each is keyboard accessible
  - Test tab order is logical
- [x] 15. Performance optimization




- [ ] 15. Performance optimization

- [x] 15.1 Implement pagination for proposals


  - Add pagination controls
  - Fetch proposals in pages of 20
  - Implement infinite scroll as alternative
  - Show loading indicators during fetch
  - _Requirements: 15.4_

- [x] 15.2 Implement message virtualization


  - Use react-window for long message lists
  - Render only visible messages
  - Maintain scroll position
  - _Requirements: 6.1, 15.4_

- [x] 15.3 Add prefetching and caching


  - Prefetch proposal details on card hover
  - Cache GraphQL responses with TanStack Query
  - Implement stale-while-revalidate strategy
  - _Requirements: 15.2_

- [x] 15.4 Optimize bundle size


  - Lazy load ProposalDetailView
  - Lazy load ProposalComparisonView
  - Lazy load ChatSection
  - Code split by route
  - _Requirements: 15.2_

- [ ]* 15.5 Write property test for loading states
  - **Property 15: Loading state visibility**
  - **Validates: Requirements 15.1, 15.2, 15.3**
  - Simulate data fetching
  - Verify loading indicators appear
  - Verify indicators disappear when loaded

- [ ] 16. Error handling and edge cases
- [ ] 16.1 Implement error boundaries
  - Add error boundary to main page
  - Add error boundary to chat section
  - Add error boundary to proposal detail
  - Display user-friendly error messages
  - Add retry functionality
  - _Requirements: Design document error handling_

- [ ] 16.2 Handle network errors
  - Display toast notifications for errors
  - Implement retry logic with exponential backoff
  - Queue messages for retry when offline
  - Show connection status
  - _Requirements: 7.5, 11.4_

- [ ] 16.3 Handle authorization errors
  - Redirect to login if session expired
  - Display access denied message
  - Log security events
  - _Requirements: Design document security_

- [ ] 16.4 Handle empty states
  - Display empty state when no proposals
  - Display empty state when no messages
  - Display empty state when no documents
  - Provide helpful guidance in empty states
  - _Requirements: 2.1, 6.1, 13.1_

- [ ] 17. Testing and quality assurance
- [ ]* 17.1 Write unit tests for utility functions
  - Test proposal utility functions
  - Test chat utility functions
  - Test comparison utility functions
  - Test formatting functions
  - _Requirements: All utility functions_

- [ ]* 17.2 Write component rendering tests
  - Test ProjectHeader renders correctly
  - Test ProposalCard renders correctly
  - Test MessageBubble renders correctly
  - Test DecisionActions renders correctly
  - _Requirements: All components_

- [ ]* 17.3 Write integration tests for workflows
  - Test complete proposal review workflow
  - Test chat conversation workflow
  - Test decision workflow (accept/reject)
  - Test comparison workflow
  - _Requirements: All workflows_

- [ ]* 17.4 Write E2E tests for critical flows
  - Test client views project and proposals
  - Test client compares proposals
  - Test client chats with team
  - Test client accepts proposal
  - Test client rejects proposal with feedback
  - _Requirements: All requirements_

- [ ] 18. Final polish and deployment preparation
- [ ] 18.1 Add loading states and transitions
  - Implement skeleton loaders for all sections
  - Add smooth transitions for view changes
  - Add loading spinners for operations
  - Add progress indicators for file downloads
  - _Requirements: 15.1, 15.5_

- [ ] 18.2 Add success and error notifications
  - Implement toast notifications for all actions
  - Show success messages for decisions
  - Show error messages with retry options
  - Add notification queue management
  - _Requirements: 8.2, 8.5, 7.5_

- [ ] 18.3 Implement confirmation dialogs
  - Add confirmation for accept proposal
  - Add confirmation for reject proposal
  - Add confirmation for destructive actions
  - Use consistent dialog styling
  - _Requirements: 8.1, 8.4_

- [ ] 18.4 Final responsive testing
  - Test on real mobile devices
  - Test on tablets
  - Test on various desktop sizes
  - Fix any layout issues
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 18.5 Final accessibility audit
  - Run automated accessibility tests
  - Test with screen reader
  - Test keyboard navigation
  - Verify color contrast
  - Fix any issues found
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 19. Documentation and handoff
- [ ]* 19.1 Write component documentation
  - Document all component props and usage
  - Add JSDoc comments
  - Create Storybook stories (optional)
  - _Requirements: All components_

- [ ]* 19.2 Write API documentation
  - Document all GraphQL queries and mutations
  - Document expected inputs and outputs
  - Add usage examples
  - _Requirements: All GraphQL operations_

- [ ]* 19.3 Create user guide
  - Document how to use the decision page
  - Add screenshots
  - Explain all features
  - _Requirements: All features_
