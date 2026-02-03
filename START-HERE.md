# 🚀 Quick Start Guide - Proposal Approval Workflow

## What Was Fixed

✅ **Proposal submission now requires admin approval**
- Lead submits → Status: `pending_approval`
- Admin approves → Status: `submitted`
- Admin rejects → Status: `rejected`

✅ **UI properly updates after submission**
- Status refreshes immediately
- Edit mode is hidden
- Yellow "Pending Approval" banner appears
- Cannot submit twice

✅ **Fixed `bid_team_members` error**
- Removed deprecated table
- Now uses `proposal_team_members`

## 🎯 Run This ONE Command

```bash
psql -U postgres -d bidsync -f SETUP-APPROVAL-WORKFLOW.sql
```

This single script does everything:
1. ✅ Fixes `bid_team_members` issue
2. ✅ Adds `pending_approval` status
3. ✅ Creates approval tracking tables
4. ✅ Creates approval functions
5. ✅ Sets up all RLS policies

## ✨ What Happens Now

### For Bidding Leads

**Before:**
1. Click "Submit Proposal"
2. Proposal immediately visible to client

**After:**
1. Click "Submit Proposal"
2. See yellow "Pending Admin Approval" banner
3. Form becomes read-only
4. Wait for admin approval
5. Get notified when approved/rejected

### For Admins

**New Responsibilities:**
1. View proposals with `pending_approval` status
2. Review proposal details
3. Approve or reject with reason
4. Lead gets notified of decision

### For Clients

**No Change:**
- Still only see `submitted` proposals
- Don't see `pending_approval` proposals
- Same experience as before

## 📊 Status Flow

```
┌─────────┐
│  Draft  │ ← Lead is editing
└────┬────┘
     │ Lead clicks "Submit"
     ↓
┌──────────────────┐
│ Pending Approval │ ← Waiting for admin
└────┬─────────────┘
     │
     ├─→ Admin Approves → ┌───────────┐
     │                     │ Submitted │ ← Client can see
     │                     └───────────┘
     │
     └─→ Admin Rejects  → ┌──────────┐
                           │ Rejected │ ← Lead can revise
                           └──────────┘
```

## 🎨 UI Changes

### Status Colors

| Status | Color | Icon | Meaning |
|--------|-------|------|---------|
| Draft | Gray | 📄 | Still editing |
| Pending Approval | Yellow | ⏰ | Waiting for admin |
| Submitted | Blue | ✅ | Approved by admin |
| Rejected | Red | ❌ | Needs revision |

### New UI Elements

1. **Yellow Banner** (when pending approval)
   ```
   ⏰ Pending Admin Approval
   Your proposal has been submitted and is awaiting admin approval.
   ```

2. **Status Badge** shows "Pending Approval" instead of raw status

3. **Read-only Mode** automatically enabled after submission

## 🔧 GraphQL Mutations

### Approve Proposal (Admin Only)
```graphql
mutation ApproveProposal($proposalId: ID!, $notes: String) {
  approveProposal(proposalId: $proposalId, notes: $notes) {
    success
    message
    error
  }
}
```

### Reject Proposal (Admin Only)
```graphql
mutation RejectProposalSubmission($proposalId: ID!, $reason: String!) {
  rejectProposalSubmission(proposalId: $proposalId, reason: $reason) {
    success
    message
    error
  }
}
```

## 📝 Next Steps

### 1. Run the Setup Script ✅
```bash
psql -U postgres -d bidsync -f SETUP-APPROVAL-WORKFLOW.sql
```

### 2. Test the Flow ✅
1. Login as bidding lead
2. Create/edit a proposal
3. Click "Submit Proposal"
4. Verify status shows "Pending Approval"
5. Verify you cannot edit anymore

### 3. Create Admin UI 🔲
You need to create these components:

**`components/admin/proposal-approval-queue.tsx`**
- List of proposals with `pending_approval` status
- Show proposal details
- Approve/Reject buttons

**`components/admin/proposal-review-dialog.tsx`**
- Full proposal preview
- Team member list
- Approve button (with optional notes)
- Reject button (requires reason)

See `PROPOSAL-APPROVAL-WORKFLOW.md` for detailed specs.

### 4. Add to Admin Dashboard 🔲
```tsx
import { ProposalApprovalQueue } from '@/components/admin/proposal-approval-queue'

// In your admin dashboard:
<ProposalApprovalQueue />
```

## 🐛 Troubleshooting

### Issue: "relation bid_team_members does not exist"
**Solution**: Run the setup script
```bash
psql -U postgres -d bidsync -f SETUP-APPROVAL-WORKFLOW.sql
```

### Issue: Status not updating after submit
**Solution**: Already fixed in `workspace-content.tsx`
- Calls `refetch()` after submission
- Updates local state immediately
- Switches to view mode

### Issue: Can still edit after submission
**Solution**: Already fixed
- Edit mode only shows when `isDraft` is true
- After submission, status is `pending_approval`, not `draft`

## 📚 Documentation

- **`PROPOSAL-APPROVAL-WORKFLOW.md`** - Complete workflow documentation
- **`PROPOSAL-SUBMISSION-FIX-SUMMARY.md`** - Technical changes summary
- **`lib/graphql/proposal-approval-mutations.ts`** - GraphQL mutations
- **`SETUP-APPROVAL-WORKFLOW.sql`** - Database setup script

## ✅ Verification

After running the setup script, verify:

```sql
-- Check pending_approval status exists
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'proposal_status');

-- Check proposal_approvals table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'proposal_approvals';

-- Check approval functions exist
SELECT proname FROM pg_proc 
WHERE proname IN ('approve_proposal', 'reject_proposal');
```

All should return results! ✅

## 🎉 You're Done!

Your proposal submission now requires admin approval. The UI properly reflects the status, and users cannot submit twice or edit after submission.

**What's Working:**
- ✅ Proposal submission
- ✅ Status updates
- ✅ UI state management
- ✅ Database functions
- ✅ GraphQL mutations

**What's Next:**
- 🔲 Create admin approval UI
- 🔲 Add email notifications
- 🔲 Allow revision after rejection
