# Client Decision Actions Implementation

## Overview
Added proposal status management functionality to the client decision page, allowing clients to accept, reject, and mark proposals as under review directly from the proposal cards.

## Features Implemented

### 1. Quick Action Buttons on Proposal Cards
- **Accept Button** (Green) - Accept a proposal
- **Reject Button** (Red) - Reject a proposal with feedback
- **Mark Under Review Button** (Yellow) - Change status from submitted to under_review

### 2. Status Management
- **Accept Proposal**: 
  - Automatically rejects all other proposals for the project
  - Updates project status to "awarded"
  - Sends notifications to bidding team
  
- **Reject Proposal**:
  - Requires feedback/reason for rejection
  - Sends feedback to bidding team
  - Maintains other proposals' statuses

- **Mark Under Review**:
  - Changes proposal status from "submitted" to "under_review"
  - Notifies bidding lead
  - Available only for submitted proposals

## Files Modified

### Components
1. **`components/client/proposal-card.tsx`**
   - Added quick action buttons
   - Added props: `onAccept`, `onReject`, `onMarkUnderReview`, `showQuickActions`
   - Buttons only show for `submitted` and `under_review` status
   - Added imports: `CheckCircle`, `XCircle`, `Eye` icons and `Button` component

2. **`components/client/proposals-list.tsx`**
   - Added props to pass action handlers to cards
   - Propagates callbacks from parent

3. **`components/client/accept-proposal-dialog.tsx`**
   - Fixed mutation parameters to match GraphQL schema
   - Changed from `proposal_id` to `proposalId`

4. **`components/client/reject-proposal-dialog.tsx`**
   - Fixed mutation parameters to use `input` object
   - Properly wraps parameters in `input: { proposalId, projectId, feedback }`

5. **`app/(app)/(client)/client-projects/[projectId]/decision/client-decision-page.tsx`**
   - Added dialog state management
   - Implemented action handlers
   - Integrated dialogs with proposal list
   - Added `UPDATE_PROPOSAL_STATUS` mutation
   - Added `updateStatusMutation` hook

### GraphQL Layer
1. **`lib/graphql/mutations.ts`**
   - Added `UPDATE_PROPOSAL_STATUS` mutation

2. **`lib/graphql/schema.ts`**
   - Added `updateProposalStatus` mutation to Mutation type

3. **`lib/graphql/resolvers.ts`**
   - Implemented `updateProposalStatus` resolver
   - Validates status values
   - Checks authorization (only project client)
   - Sends notifications on status change
   - **Fixed `projectWithProposals` resolver:**
     - Changed proposal status from `toUpperCase()` to lowercase
     - Changed project status from `toUpperCase()` to lowercase
     - Fixed `underReviewProposals` count to include both 'under_review' and 'reviewing'
     - Fixed `acceptedProposals` count to include both 'accepted' and 'approved'

## UI/UX Design

### Button Styling (Following Design System)
- **Accept Button**: Green background with yellow border accent
- **Reject Button**: Red background with yellow border accent  
- **Mark Under Review**: Yellow outline button
- All buttons follow the BidSync design system with yellow accents

### Action Flow
1. User clicks action button on proposal card
2. Dialog opens with proposal details
3. User confirms action (with feedback for rejection)
4. Mutation executes
5. Success toast notification
6. Data refetches automatically
7. UI updates with new status

## Authorization
- Only project clients can perform these actions
- Verified at both frontend and backend levels
- GraphQL resolvers check user permissions

## Notifications
- **Accept**: Notifies bidding lead and all team members (HIGH priority, with email)
- **Reject**: Notifies bidding lead with feedback (HIGH priority, with email)
- **Under Review**: Notifies bidding lead (MEDIUM priority, no email)

## Testing Checklist
- [ ] Accept proposal from decision page
- [ ] Verify other proposals are auto-rejected
- [ ] Reject proposal with feedback
- [ ] Mark proposal as under review
- [ ] Check notifications are sent
- [ ] Verify authorization (non-client cannot perform actions)
- [ ] Test with multiple proposals
- [ ] Verify real-time updates work
- [ ] Test status filter with different statuses
- [ ] Verify page loads without 500 errors

## Bug Fixes Applied
1. **Fixed GraphQL 500 Error:**
   - Issue: `projectWithProposals` resolver was returning uppercase status values
   - Fix: Changed to lowercase to match database and frontend expectations
   - Affected fields: `proposal.status`, `project.status`

2. **Fixed Status Counting:**
   - Issue: `underReviewProposals` only counted 'reviewing' status
   - Fix: Now counts both 'under_review' and 'reviewing'
   - Issue: `acceptedProposals` only counted 'approved' status
   - Fix: Now counts both 'accepted' and 'approved'

3. **Fixed Schema Mismatch:**
   - Issue: `updateProposalStatus` defined in resolvers but not in schema
   - Fix: Added mutation to GraphQL schema

## Future Enhancements
- Bulk actions (accept/reject multiple)
- Comparison mode actions
- Undo functionality
- Status change history/audit log
- Custom rejection templates
