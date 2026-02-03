# Fix: Add 'under_review' to Database Enum

## Problem
```
Error: invalid input value for enum proposal_status: "under_review"
```

When clicking "Mark Under Review" button, the application tries to set the proposal status to `'under_review'`, but the database enum `proposal_status` doesn't include this value.

## Root Cause

**Database Enum Definition:**
```sql
CREATE TYPE proposal_status AS ENUM (
  'draft', 
  'submitted', 
  'reviewing',    -- ← Has this
  'approved', 
  'rejected', 
  'archived'
);
-- Missing: 'under_review'
```

**Application Code:**
```typescript
// Frontend sends
status: 'under_review'

// But database only accepts
// 'draft', 'submitted', 'reviewing', 'approved', 'rejected', 'archived'
```

## Solution

Add `'under_review'` to the database enum.

### Option 1: Quick Fix (Recommended)

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
```

### Option 2: Run Migration File

Execute the migration file:
```bash
# File: db/migrations/049_add_under_review_status.sql
```

### Option 3: Use Quick Script

Run the script:
```bash
# File: ADD-UNDER-REVIEW-STATUS.sql
```

## Steps to Fix

1. **Open Supabase Dashboard**
   - Go to your project
   - Navigate to SQL Editor

2. **Run the SQL Command**
   ```sql
   ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
   ```

3. **Verify the Change**
   ```sql
   SELECT enumlabel 
   FROM pg_enum 
   WHERE enumtypid = 'proposal_status'::regtype 
   ORDER BY enumsortorder;
   ```

4. **Expected Output**
   ```
   draft
   submitted
   under_review  ← NEW
   reviewing
   approved
   rejected
   archived
   ```

5. **Test the Application**
   - Refresh your browser
   - Click "Mark Under Review" button
   - Should work without errors

## Why This Happened

The GraphQL schema and application code were updated to use `'under_review'`, but the database enum was not updated to include this new value.

## Status Values Mapping

| Frontend | GraphQL Enum | Database Enum |
|----------|--------------|---------------|
| `draft` | `DRAFT` | `draft` |
| `submitted` | `SUBMITTED` | `submitted` |
| `under_review` | `UNDER_REVIEW` | `under_review` ← **ADDED** |
| `reviewing` | `REVIEWING` | `reviewing` |
| `approved` | `APPROVED` | `approved` |
| `rejected` | `REJECTED` | `rejected` |
| `archived` | `ARCHIVED` | `archived` |

## Important Notes

1. **Safe Operation**: Adding an enum value is safe and doesn't affect existing data
2. **No Downtime**: This can be done while the application is running
3. **No Data Migration**: Existing proposals are not affected
4. **Backward Compatible**: Old code using 'reviewing' still works

## Alternative: Use 'reviewing' Instead

If you cannot modify the database, you can map `'under_review'` to `'reviewing'` in the code:

```typescript
// In the mutation handler
const dbStatus = status === 'under_review' ? 'reviewing' : status;
```

But adding the enum value is the cleaner solution.

## Verification

After running the SQL:

1. Check enum values:
   ```sql
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = 'proposal_status'::regtype 
   ORDER BY enumsortorder;
   ```

2. Test in application:
   - Click "Mark Under Review"
   - Should succeed without errors
   - Proposal status should update

3. Check database:
   ```sql
   SELECT id, status FROM proposals 
   WHERE status = 'under_review';
   ```

## Files Updated

1. ✅ `db/bidsync.sql` - Updated enum definition
2. ✅ `db/migrations/049_add_under_review_status.sql` - Migration file
3. ✅ `ADD-UNDER-REVIEW-STATUS.sql` - Quick fix script
4. ✅ `fix-proposal-status-enum.sql` - Detailed fix script

---

**Status:** Ready to apply
**Risk:** Low (safe operation)
**Downtime:** None required
**Rollback:** Not needed (adding enum value is safe)
