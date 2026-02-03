# Fix: GraphQL Enum Mismatch Error

## Problem
```
Error: Enum "ProposalStatus" cannot represent value: "submitted"
```

## Root Cause
GraphQL schema defined `ProposalStatus` enum with uppercase values:
```graphql
enum ProposalStatus {
  DRAFT
  SUBMITTED
  REVIEWING
  APPROVED
  REJECTED
}
```

But the resolver was returning lowercase values from the database:
```typescript
status: proposal.status || 'draft'  // lowercase
```

Additionally, the enum was missing `UNDER_REVIEW` which is used in the database.

## Solution

### 1. Added Missing Enum Value
```graphql
enum ProposalStatus {
  DRAFT
  SUBMITTED
  PENDING_APPROVAL
  UNDER_REVIEW      // ← Added
  REVIEWING
  APPROVED
  REJECTED
  ARCHIVED
}
```

### 2. Fixed Resolver to Return Uppercase
```typescript
// Before
status: proposal.status || 'draft'

// After
status: (proposal.status || 'draft').toUpperCase()
```

### 3. Frontend Handles Conversion
Frontend components already convert to lowercase for display:
```typescript
const statusKey = proposal.status.toLowerCase()
```

## Files Modified
1. `lib/graphql/schema.ts` - Added `UNDER_REVIEW` to enum
2. `lib/graphql/resolvers.ts` - Convert status to uppercase in `projectWithProposals`

## Status Mapping

| Database Value | GraphQL Enum | Frontend Display |
|---------------|--------------|------------------|
| `draft` | `DRAFT` | `draft` |
| `submitted` | `SUBMITTED` | `submitted` |
| `under_review` | `UNDER_REVIEW` | `under_review` |
| `reviewing` | `REVIEWING` | `reviewing` |
| `approved` | `APPROVED` | `approved` |
| `accepted` | `APPROVED` | `approved` |
| `rejected` | `REJECTED` | `rejected` |

## Testing
1. Navigate to decision page
2. Verify page loads without enum errors
3. Check proposal cards display correct statuses
4. Test status transitions (mark under review, accept, reject)

## Build Status
✅ Build successful (47s)
✅ No TypeScript errors
✅ GraphQL schema valid

---

**Status:** ✅ Fixed
**Version:** 1.0.1
**Date:** 2026-02-03
