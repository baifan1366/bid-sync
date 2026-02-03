# Decision Page Testing Guide

## Overview
This guide helps you test the new proposal status management features on the client decision page.

## Prerequisites
- Logged in as a **Client** user
- Have at least one project with submitted proposals
- Project ID: `933192b6-bb17-4106-a3a4-34d1bfc2e8ee` (or your test project)

## Features to Test

### 1. View Decision Page
**URL:** `/client-projects/[projectId]/decision`

**Expected:**
- ✅ Page loads without errors
- ✅ Project header displays correctly
- ✅ Progress tracker shows proposal counts
- ✅ Proposal cards display in grid layout
- ✅ Status filter dropdown works (All, Draft, Submitted, Under Review, Accepted, Rejected)

### 2. Quick Action Buttons on Proposal Cards

**For Submitted Proposals:**
- ✅ "Mark Under Review" button (yellow outline) is visible
- ✅ "Accept" button (green) is visible
- ✅ "Reject" button (red) is visible

**For Under Review Proposals:**
- ✅ "Accept" button (green) is visible
- ✅ "Reject" button (red) is visible
- ✅ "Mark Under Review" button is NOT visible

**For Accepted/Rejected Proposals:**
- ✅ No action buttons are visible

### 3. Mark Under Review Functionality

**Steps:**
1. Find a proposal with "Submitted" status
2. Click "Mark Under Review" button on the card
3. Wait for success toast notification

**Expected:**
- ✅ Toast shows "Status Updated"
- ✅ Proposal status badge changes to "Under Review"
- ✅ Proposal card updates automatically
- ✅ Progress tracker updates counts
- ✅ Bidding lead receives notification

### 4. Accept Proposal Functionality

**Steps:**
1. Find a proposal with "Submitted" or "Under Review" status
2. Click "Accept" button on the card
3. Review the confirmation dialog:
   - Proposal title
   - Bidding team name
   - Budget estimate
   - Warning message about auto-rejecting other proposals
4. Click "Confirm Accept"

**Expected:**
- ✅ Dialog opens with proposal details
- ✅ Warning message is displayed
- ✅ After confirmation:
  - Toast shows "Proposal Accepted"
  - Selected proposal status → "Accepted"
  - All other proposals → "Rejected"
  - Project status → "Awarded"
  - Progress tracker updates
  - Bidding team receives notifications (lead + members)

### 5. Reject Proposal Functionality

**Steps:**
1. Find a proposal with "Submitted" or "Under Review" status
2. Click "Reject" button on the card
3. Review the rejection dialog:
   - Proposal title
   - Bidding team name
   - Feedback textarea (required)
4. Enter rejection reason (e.g., "Budget exceeds our limit")
5. Click "Confirm Reject"

**Expected:**
- ✅ Dialog opens with proposal details
- ✅ Feedback field is required (shows error if empty)
- ✅ After confirmation:
  - Toast shows "Proposal Rejected"
  - Proposal status → "Rejected"
  - Other proposals remain unchanged
  - Progress tracker updates
  - Bidding lead receives notification with feedback

### 6. Status Filter Integration

**Steps:**
1. Use the status filter dropdown
2. Select "Under Review"
3. Mark a submitted proposal as under review
4. Verify it appears in the filtered list

**Expected:**
- ✅ Filter updates URL parameter (?status=under_review)
- ✅ Only matching proposals are displayed
- ✅ Real-time updates work with filters
- ✅ Empty state shows when no matches

### 7. Real-time Updates

**Steps:**
1. Open decision page in two browser tabs
2. In tab 1, accept a proposal
3. Check tab 2

**Expected:**
- ✅ Tab 2 receives real-time update
- ✅ Proposal statuses update automatically
- ✅ Progress tracker updates
- ✅ Toast notification appears

### 8. Authorization & Security

**Test as Non-Client User:**
1. Try to access decision page as bidding lead
2. Try to perform actions via API

**Expected:**
- ✅ Non-clients cannot access decision page
- ✅ API returns 403 Forbidden for unauthorized users
- ✅ Only project owner can perform actions

## UI/UX Checks

### Design System Compliance
- ✅ Accept button: Green with yellow border accent
- ✅ Reject button: Red with yellow border accent
- ✅ Mark Under Review: Yellow outline button
- ✅ All buttons follow BidSync design system
- ✅ Hover states work correctly
- ✅ Focus states show yellow outline

### Responsive Design
- ✅ Mobile: Buttons stack vertically
- ✅ Tablet: Buttons display properly
- ✅ Desktop: Full layout works

### Accessibility
- ✅ Buttons have proper ARIA labels
- ✅ Keyboard navigation works
- ✅ Screen reader friendly
- ✅ Color contrast meets standards

## Error Scenarios

### 1. Network Error
**Steps:** Disconnect internet, try to accept proposal

**Expected:**
- ✅ Error toast appears
- ✅ User-friendly error message
- ✅ No data corruption

### 2. Concurrent Actions
**Steps:** Two users try to accept different proposals simultaneously

**Expected:**
- ✅ First action succeeds
- ✅ Second action auto-rejects (already awarded)
- ✅ Both users see updated state

### 3. Invalid Status Transition
**Steps:** Try to mark an accepted proposal as under review

**Expected:**
- ✅ Button is not visible for accepted proposals
- ✅ API rejects invalid transitions

## Performance Checks

- ✅ Page loads in < 2 seconds
- ✅ Action buttons respond immediately
- ✅ Dialogs open smoothly
- ✅ No layout shifts
- ✅ Optimistic updates feel instant

## Database Verification

After accepting a proposal, check database:

```sql
-- Check proposal statuses
SELECT id, status FROM proposals WHERE project_id = 'YOUR_PROJECT_ID';

-- Check project status
SELECT id, status FROM projects WHERE id = 'YOUR_PROJECT_ID';

-- Check decision record
SELECT * FROM proposal_decisions WHERE project_id = 'YOUR_PROJECT_ID';

-- Check notifications
SELECT * FROM notifications WHERE type IN ('proposal_accepted', 'proposal_rejected', 'proposal_status_changed');
```

**Expected:**
- ✅ Accepted proposal: status = 'accepted' or 'approved'
- ✅ Other proposals: status = 'rejected'
- ✅ Project: status = 'awarded'
- ✅ Decision record created
- ✅ Notifications sent to team

## Known Issues / Limitations

1. **Status Naming:** Database uses both 'accepted'/'approved' - normalized in resolver
2. **Undo:** No undo functionality yet (future enhancement)
3. **Bulk Actions:** Cannot accept/reject multiple proposals at once (future enhancement)

## Troubleshooting

### Issue: Buttons not showing
- Check proposal status (must be 'submitted' or 'under_review')
- Verify `showQuickActions={true}` prop is passed
- Check user role (must be project client)

### Issue: Actions fail with 403
- Verify logged in as project owner
- Check RLS policies on proposals table
- Verify authorization in resolver

### Issue: Real-time updates not working
- Check Supabase connection status
- Verify realtime subscription is active
- Check browser console for errors

## Success Criteria

All tests pass when:
- ✅ All action buttons work correctly
- ✅ Status transitions are valid
- ✅ Notifications are sent
- ✅ UI updates in real-time
- ✅ Authorization is enforced
- ✅ Design system is followed
- ✅ No console errors
- ✅ Performance is acceptable

## Next Steps After Testing

1. Test with real users
2. Monitor error logs
3. Gather feedback on UX
4. Consider adding:
   - Undo functionality
   - Bulk actions
   - Status change history
   - Custom rejection templates
   - Email notification preferences
