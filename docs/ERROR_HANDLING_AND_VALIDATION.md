# Error Handling and Validation System

## Overview

The BidSync scoring system implements comprehensive error handling and validation at multiple layers:

1. **Client-side validation** - Real-time form validation with user feedback
2. **Server-side validation** - GraphQL resolver validation with detailed error messages
3. **Retry logic** - Automatic retry for transient failures
4. **Error logging** - Centralized error logging with context
5. **User notifications** - Toast notifications for all error states

## Architecture

### Validation Layer

```
User Input → Client Validation → GraphQL Mutation → Server Validation → Database
     ↓              ↓                    ↓                  ↓              ↓
  UI Feedback   Toast Notify      Error Response      Error Logging   Constraint Check
```

## Client-Side Validation

### Form Validation Hooks

#### `useTemplateFormValidation()`

Validates scoring template forms with real-time feedback.

```typescript
import { useTemplateFormValidation } from '@/hooks/use-form-validation';

const {
  errors,
  isValid,
  validateName,
  validateCriteria,
  setFieldError,
  clearFieldError,
  touchField,
  getFieldError,
} = useTemplateFormValidation();

// Validate template name
const nameResult = validateName(templateName);
if (!nameResult.valid) {
  setFieldError('name', nameResult.error);
}

// Validate all criteria
const criteriaResult = validateCriteria(criteria);
if (!criteriaResult.valid) {
  setFieldError('criteria', criteriaResult.error);
}
```

**Validation Rules:**
- Template name: Required, max 100 characters
- Description: Optional, max 500 characters
- Criteria: 1-20 criteria required
- Weights: Must sum to exactly 100%
- Criterion names: Must be unique

#### `useScoreFormValidation()`

Validates proposal scoring forms.

```typescript
import { useScoreFormValidation } from '@/hooks/use-form-validation';

const {
  validateScore,
  validateNotes,
  setFieldError,
} = useScoreFormValidation();

// Validate raw score
const scoreResult = validateScore(rawScore);
if (!scoreResult.valid) {
  setFieldError('score', scoreResult.error);
}
```

**Validation Rules:**
- Raw score: Required, 1-10 range
- Notes: Optional, max 2000 characters

#### `useRevisionFormValidation()`

Validates score revision forms.

```typescript
import { useRevisionFormValidation } from '@/hooks/use-form-validation';

const {
  validateReason,
  validateRevision,
} = useRevisionFormValidation();

// Validate revision reason
const reasonResult = validateReason(reason);
if (!reasonResult.valid) {
  setFieldError('reason', reasonResult.error);
}
```

**Validation Rules:**
- Reason: Required, 10-500 characters
- New score: Required, 1-10 range
- Notes: Optional, max 2000 characters

### Error Handler Hook

#### `useErrorHandler()`

Provides centralized error handling with toast notifications.

```typescript
import { useErrorHandler } from '@/hooks/use-error-handler';

const {
  handleError,
  handleAsyncError,
  handleAsyncOperation,
  showSuccess,
  showWarning,
} = useErrorHandler();

// Handle synchronous error
try {
  // ... operation
} catch (error) {
  handleError(error, {
    message: 'Failed to save template',
    isScoringError: true,
  });
}

// Handle async operation
const result = await handleAsyncError(
  async () => await saveTemplate(data),
  { message: 'Failed to save template' }
);

// Handle async with success/error status
const { success, data, error } = await handleAsyncOperation(
  async () => await scoreProposal(input),
  { isScoringError: true }
);

if (success) {
  showSuccess('Score saved successfully');
}
```

**Features:**
- Automatic error type detection
- User-friendly error messages
- Toast notifications
- Error logging
- Custom error callbacks

## Server-Side Validation

### GraphQL Error Handling

#### Validation Functions

```typescript
import {
  validateTemplateInput,
  validateScoreInput,
  validateRevisionInput,
  checkProposalLocked,
  requireAuth,
  requireRole,
} from '@/lib/graphql/error-handling';

// In resolver
async createScoringTemplate(parent, { input }, context) {
  // Check authentication
  requireAuth(context.user);
  
  // Check role
  requireRole(context.user, ['client']);
  
  // Validate input
  validateTemplateInput(input);
  
  // ... create template
}
```

#### Error Wrapper

```typescript
import { withErrorHandling } from '@/lib/graphql/error-handling';

const resolvers = {
  Mutation: {
    scoreProposal: withErrorHandling(
      async (parent, { input }, context) => {
        // Resolver logic
      },
      {
        operation: 'scoreProposal',
        requireAuth: true,
        requireRoles: ['client'],
        logErrors: true,
      }
    ),
  },
};
```

### Validation Utilities

#### Core Validation Functions

```typescript
import {
  validateRawScore,
  validateWeight,
  validateWeightSum,
  validateScoringTemplate,
  validateProposalScore,
  validateScoreRevision,
  validateComparisonSelection,
  validateProposalNotLocked,
} from '@/lib/scoring-validation';

// Validate raw score
const result = validateRawScore(8);
if (!result.valid) {
  throw new Error(result.error);
}

// Validate weight sum
const weightResult = validateWeightSum([25, 25, 25, 25]);
if (!weightResult.valid) {
  throw new Error(weightResult.error);
}

// Validate entire template
const templateResult = validateScoringTemplate(template);
if (!templateResult.valid) {
  throw new Error(templateResult.error);
}
```

## Retry Logic

### Retry Operations

#### `retryOperation()`

Generic retry with exponential backoff.

```typescript
import { retryOperation } from '@/lib/retry-utils';

const result = await retryOperation(
  async () => await fetchData(),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    useExponentialBackoff: true,
    onRetry: (error, attempt, delay) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
    },
  }
);
```

**Configuration:**
- `maxAttempts`: Maximum retry attempts (default: 3)
- `initialDelay`: Initial delay in ms (default: 1000)
- `maxDelay`: Maximum delay in ms (default: 10000)
- `backoffMultiplier`: Exponential multiplier (default: 2)
- `useExponentialBackoff`: Enable exponential backoff (default: true)

#### `retryGraphQLMutation()`

Specialized retry for GraphQL mutations.

```typescript
import { retryGraphQLMutation } from '@/lib/retry-utils';

const result = await retryGraphQLMutation(
  async () => await client.mutate({ mutation: SCORE_PROPOSAL, variables }),
  { maxAttempts: 3 }
);
```

**Retry Logic:**
- Retries network errors and server errors
- Does NOT retry validation errors (400)
- Does NOT retry auth errors (401, 403)

#### `retryDatabaseOperation()`

Specialized retry for database operations.

```typescript
import { retryDatabaseOperation } from '@/lib/retry-utils';

const result = await retryDatabaseOperation(
  async () => await supabase.from('table').insert(data),
  { maxAttempts: 3 }
);
```

**Retry Logic:**
- Retries connection errors and timeouts
- Does NOT retry constraint violations
- Does NOT retry foreign key violations

### Circuit Breaker

Prevents overwhelming failing services.

```typescript
import { createCircuitBreaker } from '@/lib/retry-utils';

const breaker = createCircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 10000,
});

try {
  const result = await breaker.execute(async () => {
    return await externalService.call();
  });
} catch (error) {
  if (error.message.includes('Circuit breaker is open')) {
    // Service is temporarily unavailable
  }
}
```

## Error Logging

### Error Logger

```typescript
import { errorLogger } from '@/lib/error-logger';

// Log error
errorLogger.error('Failed to save template', error, {
  userId: user.id,
  templateId: template.id,
  operation: 'createTemplate',
});

// Log warning
errorLogger.warn('Weight sum is close to 100% but not exact', {
  actualSum: 99.99,
  expectedSum: 100,
});

// Log info
errorLogger.info('Template created successfully', {
  templateId: template.id,
});
```

**Features:**
- Structured logging with context
- Automatic error serialization
- Development vs production modes
- Integration with monitoring services (Sentry)

## Validation Configuration

### Scoring Validation Config

```typescript
export const SCORING_VALIDATION_CONFIG = {
  // Score range
  minScore: 1,
  maxScore: 10,
  
  // Weight constraints
  totalWeightRequired: 100,
  minWeight: 0.01,
  maxWeight: 100,
  
  // Criteria constraints
  minCriteria: 1,
  maxCriteria: 20,
  maxCriterionNameLength: 100,
  maxCriterionDescriptionLength: 500,
  
  // Template constraints
  maxTemplateNameLength: 100,
  maxTemplateDescriptionLength: 500,
  
  // Notes constraints
  maxNotesLength: 2000,
  
  // Revision constraints
  maxRevisionReasonLength: 500,
  minRevisionReasonLength: 10,
  
  // Comparison constraints
  minProposalsForComparison: 2,
  maxProposalsForComparison: 4,
};
```

## Error Messages

### User-Friendly Messages

The system provides context-specific error messages:

#### Validation Errors
- "Total weight must equal 100% (current: 95%)"
- "Scores must be between 1 and 10"
- "Criterion names must be unique within a template"

#### Authorization Errors
- "You do not have permission to perform this action"
- "Authentication required"

#### Resource Errors
- "The requested resource was not found"
- "This operation conflicts with existing data"

#### Locking Errors
- "Cannot modify scores for accepted or rejected proposals. Scoring is locked once a proposal is accepted or rejected."

## Concurrent Modification Handling

### Optimistic Updates

```typescript
// Optimistic update with rollback
const previousData = queryClient.getQueryData(['scores', proposalId]);

// Update optimistically
queryClient.setQueryData(['scores', proposalId], newData);

try {
  await saveScore(newData);
} catch (error) {
  // Rollback on error
  queryClient.setQueryData(['scores', proposalId], previousData);
  handleError(error);
}
```

### Last-Write-Wins

For concurrent scoring by multiple users, the system uses last-write-wins with notifications:

1. User A and User B both load proposal scores
2. User A saves changes
3. User B saves changes (overwrites User A's changes)
4. User A receives notification about the conflict

## Best Practices

### 1. Always Validate on Both Sides

```typescript
// Client-side
const validation = validateScore(score);
if (!validation.valid) {
  showError(validation.error);
  return;
}

// Server-side (in resolver)
validateScoreInput(input);
```

### 2. Use Specific Error Messages

```typescript
// Bad
throw new Error('Invalid input');

// Good
throw new Error('Score must be between 1 and 10');
```

### 3. Log Errors with Context

```typescript
errorLogger.error('Failed to save score', error, {
  userId: user.id,
  proposalId: proposal.id,
  criterionId: criterion.id,
  operation: 'scoreProposal',
});
```

### 4. Handle Retryable vs Non-Retryable Errors

```typescript
if (isRetryableError(error)) {
  await retryOperation(() => saveData());
} else {
  handleError(error);
}
```

### 5. Provide User Feedback

```typescript
const { success } = await handleAsyncOperation(
  async () => await saveTemplate(data),
  { message: 'Failed to save template' }
);

if (success) {
  showSuccess('Template saved successfully');
}
```

## Testing

### Unit Tests

```typescript
import { validateRawScore } from '@/lib/scoring-validation';

describe('validateRawScore', () => {
  it('should accept valid scores', () => {
    expect(validateRawScore(5).valid).toBe(true);
  });

  it('should reject invalid scores', () => {
    expect(validateRawScore(15).valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
it('should handle validation errors in mutation', async () => {
  const result = await client.mutate({
    mutation: SCORE_PROPOSAL,
    variables: { input: { rawScore: 15 } },
  });

  expect(result.errors).toBeDefined();
  expect(result.errors[0].extensions.code).toBe('BAD_USER_INPUT');
});
```

## Troubleshooting

### Common Issues

#### 1. Weight Sum Validation Fails

**Problem:** Weights sum to 99.99% or 100.01%

**Solution:** Use tolerance in validation (default: 0.01)

```typescript
validateWeightSum(weights, 0.01); // Allows ±0.01% tolerance
```

#### 2. Retry Exhausted

**Problem:** Operation fails after all retry attempts

**Solution:** Check if error is retryable and increase max attempts

```typescript
retryOperation(operation, {
  maxAttempts: 5,
  shouldRetry: (error) => isNetworkError(error),
});
```

#### 3. Concurrent Modification

**Problem:** User's changes are overwritten

**Solution:** Implement version checking or use optimistic locking

```typescript
// Check version before update
if (currentVersion !== expectedVersion) {
  throw new Error('Resource was modified by another user');
}
```

## Future Enhancements

1. **Optimistic Locking** - Prevent concurrent modifications
2. **Validation Caching** - Cache validation results for performance
3. **Custom Validation Rules** - Allow users to define custom validation
4. **Batch Validation** - Validate multiple items efficiently
5. **Validation Middleware** - Centralized validation pipeline
