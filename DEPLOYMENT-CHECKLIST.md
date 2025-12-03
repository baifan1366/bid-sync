# Deployment Checklist

## ✅ Completed

- [x] Fixed "Submit Proposal" → "Create Proposal" button text
- [x] Updated all Next.js 15 async params (5 files)
- [x] Created RLS policy fix migration script
- [x] Fixed TypeScript compilation errors

## 🔄 Pending - Database Migration

- [ ] **Apply RLS Policy Fix** (CRITICAL)
  - File: `db/migrations/fix-proposal-team-members-rls.sql`
  - Action: Run in Supabase SQL Editor
  - Why: Fixes infinite recursion error when creating proposals
  - See: `APPLY-DATABASE-FIX.md` for instructions

## 📋 Testing After Migration

Once database migration is applied, test:

1. **Create Proposal Flow**
   - [ ] Navigate to `/lead-projects`
   - [ ] Click "Create Proposal" button
   - [ ] Verify no infinite recursion error
   - [ ] Verify proposal is created
   - [ ] Verify workspace is created
   - [ ] Verify redirect to workspace

2. **Team Management**
   - [ ] Add team members to proposal
   - [ ] Remove team members
   - [ ] Verify permissions work correctly

3. **Workspace Access**
   - [ ] Lead can access workspace
   - [ ] Team members can access workspace
   - [ ] Non-members cannot access workspace

## 🚀 Deployment Steps

### 1. Database Migration (Do First!)
```bash
# In Supabase SQL Editor, run:
db/migrations/fix-proposal-team-members-rls.sql
```

### 2. Deploy Application
```bash
# Commit changes
git add .
git commit -m "Fix: Next.js 15 async params and RLS infinite recursion"
git push

# Or deploy to Vercel
vercel --prod
```

### 3. Verify Deployment
- [ ] Check build logs for errors
- [ ] Test create proposal functionality
- [ ] Monitor error logs

## 📝 Summary of Changes

### Code Changes
1. **Button Text** (`components/lead/enhanced-project-card.tsx`)
   - Changed "Submit Proposal" to "Create Proposal"

2. **API Routes** (2 files)
   - `app/api/projects/[id]/route.ts`
   - `app/api/admin/templates/[id]/route.ts`
   - Updated to use `Promise<{ id: string }>`

3. **Page Components** (3 files)
   - `app/(auth)/join/[code]/page.tsx`
   - `app/(app)/invitations/[token]/page.tsx`
   - `app/(app)/editor/[documentId]/page.tsx`
   - Updated to use async params

### Database Changes
1. **RLS Policies** (`db/migrations/fix-proposal-team-members-rls.sql`)
   - Fixed infinite recursion in `proposal_team_members` policies
   - Changed from self-referencing to referencing `proposals` table

## 🔍 Monitoring

After deployment, monitor:
- [ ] Error logs in Vercel/hosting platform
- [ ] Supabase logs for database errors
- [ ] User reports of issues

## 📚 Documentation Created

- [x] `FIX-INFINITE-RECURSION.md` - Explains the RLS fix
- [x] `NEXTJS15-PARAMS-UPDATE.md` - Documents async params migration
- [x] `APPLY-DATABASE-FIX.md` - Step-by-step database fix guide
- [x] `DEPLOYMENT-CHECKLIST.md` - This file

## ⚠️ Important Notes

1. **Database migration MUST be applied before testing**
   - The infinite recursion error will persist until migration is run
   - Migration is safe to run multiple times

2. **Next.js 15 compatibility**
   - All dynamic routes now use async params
   - No breaking changes for users

3. **No breaking changes**
   - Button text change is cosmetic
   - RLS fix maintains same permissions
   - Async params are internal changes
