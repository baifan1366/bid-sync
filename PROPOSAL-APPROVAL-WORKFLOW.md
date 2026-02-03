# Proposal Approval Workflow

## Overview
This document describes the proposal approval workflow where admin approval is required before proposals become visible to clients.

## Workflow Steps

### 1. Lead Submits Proposal
When a bidding lead clicks "Submit Proposal":
- Status changes from `draft` → `pending_approval`
- `submitted_at` timestamp is recorded
- Proposal is NOT yet visible to client
- Admin receives notification

### 2. Admin Reviews Proposal
Admin can see all proposals with `pending_approval` status in the admin dashboard.

**Admin Actions:**
- **Approve**: Status changes to `submitted`, proposal becomes visible to client
- **Reject**: Status changes to `rejected`, lead is notified with reason

### 3. After Approval
Once approved:
- Status is `submitted`
- Client can now see the proposal
- Normal proposal workflow continues

## Status Flow

```
draft → pending_approval → submitted (approved by admin)
                        ↓
                     rejected (rejected by admin)
```

## Database Changes

### New Status
- Added `pending_approval` to `proposal_status` enum

### New Columns on `proposals` table
- `approved_by` - UUID of admin who approved/rejected
- `approved_at` - Timestamp of approval/rejection
- `rejection_reason` - Reason if rejected

### New Table: `proposal_approvals`
Tracks approval history:
- `proposal_id` - The proposal
- `admin_id` - Admin who took action
- `action` - 'approved' or 'rejected'
- `reason` - Notes or rejection reason
- `created_at` - When action was taken

## Setup Instructions

### 1. Run Database Migration
```bash
psql -U postgres -d bidsync -f ADD-PROPOSAL-APPROVAL-WORKFLOW.sql
```

### 2. Update Application Code
The following files have been updated:
- ✅ `lib/proposal-submission-service.ts` - Changed status to `pending_approval`
- ✅ `lib/graphql/schema.ts` - Added approval mutations
- ✅ `lib/graphql/resolvers.ts` - Added approval resolvers
- ✅ `lib/graphql/proposal-approval-mutations.ts` - GraphQL mutations (NEW)

### 3. Create Admin UI Components
You need to create these components:

#### `components/admin/proposal-approval-queue.tsx`
Shows list of proposals pending approval with:
- Proposal title and details
- Lead information
- Project information
- Approve/Reject buttons

#### `components/admin/proposal-review-dialog.tsx`
Dialog for reviewing proposal details:
- Full proposal content
- Team members
- Documents
- Approve button (with optional notes)
- Reject button (requires reason)

## GraphQL Usage

### Approve a Proposal
```typescript
import { APPROVE_PROPOSAL } from '@/lib/graphql/proposal-approval-mutations';

const result = await graphqlClient.request(APPROVE_PROPOSAL, {
  proposalId: 'uuid-here',
  notes: 'Looks good!' // optional
});

if (result.approveProposal.success) {
  console.log('Approved!');
}
```

### Reject a Proposal
```typescript
import { REJECT_PROPOSAL_SUBMISSION } from '@/lib/graphql/proposal-approval-mutations';

const result = await graphqlClient.request(REJECT_PROPOSAL_SUBMISSION, {
  proposalId: 'uuid-here',
  reason: 'Missing required information' // required
});

if (result.rejectProposalSubmission.success) {
  console.log('Rejected!');
}
```

### Get Pending Proposals
```typescript
import { GET_PENDING_PROPOSALS } from '@/lib/graphql/proposal-approval-mutations';

const result = await graphqlClient.request(GET_PENDING_PROPOSALS);
const pendingProposals = result.proposals;
```

## Notifications

### When Proposal is Submitted
- ✅ Admin receives notification
- ❌ Client does NOT receive notification yet

### When Proposal is Approved
- ✅ Client receives notification
- ✅ Lead receives confirmation
- Proposal appears in client's proposal list

### When Proposal is Rejected
- ✅ Lead receives notification with reason
- ❌ Client does NOT receive notification
- Lead can revise and resubmit

## UI Updates Needed

### Admin Dashboard
Add a new section: "Proposals Pending Approval"
- Show count badge
- List proposals with key details
- Quick approve/reject actions

### Lead Dashboard
Update proposal status display:
- Show "Pending Admin Approval" for `pending_approval` status
- Show rejection reason if rejected
- Allow resubmission after rejection

### Client Dashboard
- Only show proposals with status `submitted` or later
- Do NOT show `pending_approval` proposals

## Testing

### Test Scenario 1: Happy Path
1. Lead submits proposal
2. Verify status is `pending_approval`
3. Verify client cannot see proposal
4. Admin approves proposal
5. Verify status is `submitted`
6. Verify client can now see proposal

### Test Scenario 2: Rejection
1. Lead submits proposal
2. Admin rejects with reason
3. Verify status is `rejected`
4. Verify lead sees rejection reason
5. Lead revises and resubmits
6. Verify status is `pending_approval` again

## Security

### RLS Policies
- Admins can view all proposals
- Leads can view their own proposals (all statuses)
- Clients can only view proposals with status `submitted` or later
- Only admins can call approval functions

### Function Security
- `approve_proposal()` - Checks user is admin
- `reject_proposal()` - Checks user is admin
- Both functions use `SECURITY DEFINER` for elevated privileges

## Migration Checklist

- [x] Database migration script created
- [x] Proposal submission service updated
- [x] GraphQL schema updated
- [x] GraphQL resolvers added
- [x] GraphQL mutations file created
- [ ] Admin UI components created
- [ ] Lead UI updated for new statuses
- [ ] Client UI filtered to hide pending proposals
- [ ] Notification system updated
- [ ] Testing completed

## Next Steps

1. Run the database migration
2. Create admin approval UI components
3. Update lead dashboard to show approval status
4. Update client dashboard to filter proposals
5. Test the complete workflow
6. Deploy to production
