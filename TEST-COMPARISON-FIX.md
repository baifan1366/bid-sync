# Testing Guide: Budget & Timeline Display in Comparison View

## Quick Test Steps

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Navigate to a project's decision page**:
   - Log in as a client
   - Go to "My Projects"
   - Click on a project that has multiple proposals
   - Click "View Proposals" or navigate to the decision page

3. **Select proposals for comparison**:
   - Check the boxes next to 2-4 proposals
   - Click the "Compare Selected" button

4. **Check the browser console** (F12 → Console tab):
   Look for these debug logs:
   ```
   [ProposalComparison] Fetched proposals: [...]
   [ProposalComparison] Proposals for comparison summary: [...]
   [ProposalColumn] Proposal data: {...}
   ```

5. **Verify the display**:
   - Budget should show as: **$100** (with dollar sign and formatting)
   - Timeline should show as: **2 weeks** (plain text)
   - If no data: **Not specified**

## What to Look For

### ✅ Success Indicators
- Budget displays with `$` prefix
- Numbers have thousand separators (e.g., `$1,000`, `$50,000`)
- Timeline displays as entered (e.g., "2 weeks", "1 month")
- Console logs show actual values (not null/undefined)
- Yellow border highlights differences between proposals

### ❌ Failure Indicators
- "Not specified" appears when data exists
- Console logs show `budgetEstimate: null` or `undefined`
- Budget displays without dollar sign
- Numbers display without formatting

## Console Log Examples

### Expected (Success):
```javascript
[ProposalComparison] Fetched proposals: [
  {
    id: "09cf9719-f83a-419e-b2df-5b2e9a35e6bb",
    title: "Proposal A",
    budgetEstimate: 100,
    timelineEstimate: "2 weeks"
  },
  {
    id: "abc123...",
    title: "Proposal B", 
    budgetEstimate: 5000,
    timelineEstimate: "1 month"
  }
]

[ProposalColumn] Proposal data: {
  id: "09cf9719-f83a-419e-b2df-5b2e9a35e6bb",
  budgetEstimate: 100,
  budgetEstimate_type: "number",
  timelineEstimate: "2 weeks",
  timelineEstimate_type: "string"
}
```

### Problem (Failure):
```javascript
[ProposalComparison] Fetched proposals: [
  {
    id: "09cf9719-f83a-419e-b2df-5b2e9a35e6bb",
    title: "Proposal A",
    budgetEstimate: null,  // ❌ Should have value
    timelineEstimate: null  // ❌ Should have value
  }
]
```

## Troubleshooting

### If budget/timeline still show "Not specified":

1. **Check GraphQL response**:
   - Open Network tab in DevTools
   - Filter for "graphql"
   - Look for `proposalDetail` query
   - Verify response contains `budgetEstimate` and `timelineEstimate`

2. **Check database values**:
   ```sql
   SELECT id, title, budget_estimate, timeline_estimate 
   FROM proposals 
   WHERE id = 'your-proposal-id';
   ```

3. **Clear cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear browser cache completely

4. **Check React Query cache**:
   - The data might be cached from before the fix
   - Wait for staleTime to expire (1 minute)
   - Or restart the dev server

## Visual Comparison

### Before Fix:
```
Budget:     Not specified
Timeline:   Not specified
```

### After Fix:
```
Budget:     $100
Timeline:   2 weeks
```

## Additional Notes

- The fix maps actual proposal data instead of hardcoded `null` values
- Debug logging helps track data flow through the component
- The GraphQL resolver already returns correct data
- The issue was in the component's data mapping, not the backend

## Files Changed

- ✅ `components/client/proposal-comparison-view.tsx` - Fixed data mapping + added debug logs
- 📝 `FIX-COMPARISON-BUDGET-DISPLAY.md` - Detailed fix documentation
- 📝 `TEST-COMPARISON-FIX.md` - This testing guide

## Next Steps After Testing

If the fix works:
- ✅ Remove or comment out debug console.log statements (optional)
- ✅ Test with different budget values (large numbers, decimals)
- ✅ Test with various timeline formats
- ✅ Test comparison with 2, 3, and 4 proposals

If the fix doesn't work:
- 📋 Share the console logs
- 📋 Share the Network tab GraphQL response
- 📋 Check if proposals have data in the database
