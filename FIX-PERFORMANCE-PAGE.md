# Fix Performance Page Error

## Problem
The performance page (`/performance`) was failing with timeout errors because:
1. Missing API routes for analytics data
2. Missing database function `get_bid_performance`
3. No timeout handling in fetch requests

## Solution Applied

### 1. Created Missing API Routes
Created two new API endpoints:
- `app/api/analytics/statistics/route.ts` - Returns proposal statistics
- `app/api/analytics/timeline/route.ts` - Returns activity timeline data

### 2. Added Database Function
Created migration file: `db/migrations/add_get_bid_performance_function.sql`

This function calculates:
- Total proposals
- Win rate
- Status breakdown
- Average team size
- Average sections count
- Average time to submit

### 3. Improved Error Handling
Updated `components/lead/bid-performance-dashboard.tsx` with:
- Request timeouts (15s for GraphQL, 10s for API routes)
- Better error messages
- Response validation
- Console logging for debugging

## How to Apply the Fix

### Step 1: Apply Database Migration
Run this SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of db/migrations/add_get_bid_performance_function.sql
```

Or use the Supabase CLI:
```bash
supabase db push
```

### Step 2: Verify the Function Exists
Run this query in Supabase SQL Editor:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_bid_performance';
```

You should see one result.

### Step 3: Test the Performance Page
1. Restart your development server
2. Navigate to `/performance` as a bidding lead
3. The page should now load without errors

## What Each Component Does

### API Routes
- **`/api/analytics/statistics`**: Fetches proposal statistics including recent proposals and performance metrics
- **`/api/analytics/timeline`**: Fetches activity timeline showing proposal creation, submissions, and acceptances over time

### Database Function
- **`get_bid_performance(p_lead_id)`**: Aggregates proposal data and calculates performance metrics efficiently in the database

### Component Updates
- Added timeout protection to prevent infinite loading
- Added better error messages for debugging
- Added response validation

## Troubleshooting

### If you still see timeout errors:
1. Check your Supabase connection in `.env`
2. Verify the database function exists (Step 2 above)
3. Check browser console for specific error messages
4. Verify you're logged in as a bidding lead

### If you see "No performance data":
1. Make sure you have proposals in the database
2. Check that your user has the `bidding_lead` role
3. Verify proposals are linked to your user ID

### If GraphQL errors appear:
1. Check `/api/graphql` is responding
2. Verify the schema includes `getBidPerformance` query
3. Check the resolver in `lib/graphql/resolvers.ts`

## Testing Checklist
- [ ] Database function created successfully
- [ ] API routes return data (test with curl or Postman)
- [ ] Performance page loads without errors
- [ ] Metrics display correctly
- [ ] Charts render properly
- [ ] Timeline data shows activity

## Related Files
- `app/(app)/(lead)/performance/page.tsx` - Performance page
- `components/lead/bid-performance-dashboard.tsx` - Main dashboard component
- `lib/analytics-service.ts` - Analytics business logic
- `lib/graphql/resolvers.ts` - GraphQL resolver for getBidPerformance
- `db/bidsync.sql` - Full database schema

## Design System Compliance
All components follow the BidSync design system:
- Yellow-400 (#FBBF24) accent color
- Border: `border-yellow-400/20`
- Hover states: `hover:bg-yellow-400/10`
- Dark mode support
- Consistent typography and spacing
