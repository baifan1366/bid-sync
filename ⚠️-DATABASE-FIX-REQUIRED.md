# ⚠️ DATABASE FIX REQUIRED

## 🚨 Action Needed Before Testing

The "Mark Under Review" feature requires a database enum update.

### Quick Fix (2 minutes)

1. **Open Supabase Dashboard**
   - Go to your project
   - Click "SQL Editor"

2. **Run This Command**
   ```sql
   ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
   ```

3. **Verify**
   ```sql
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = 'proposal_status'::regtype 
   ORDER BY enumsortorder;
   ```

4. **Done!**
   - Refresh your browser
   - Test "Mark Under Review" button

### Why?

The database enum `proposal_status` is missing the `'under_review'` value:

**Current:**
```
draft, submitted, reviewing, approved, rejected, archived
```

**Needed:**
```
draft, submitted, under_review, reviewing, approved, rejected, archived
                  ↑ ADD THIS
```

### Files to Help

- `ADD-UNDER-REVIEW-STATUS.sql` - Quick fix script
- `FIX-UNDER-REVIEW-STATUS.md` - Detailed explanation
- `db/migrations/049_add_under_review_status.sql` - Migration file

### Error You'll See Without This Fix

```
Error: invalid input value for enum proposal_status: "under_review"
```

---

**This is a safe, non-breaking change that takes 30 seconds to apply.**
