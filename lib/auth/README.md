# Authentication & Authorization

This directory contains authentication and authorization utilities for the BidSync platform.

## Admin Guards

The admin guards provide server-side authorization for admin-only routes and API endpoints.

### Usage in Server Components (Pages)

```typescript
import { requireAdmin } from '@/lib/auth/admin-guards'

export default async function AdminPage() {
  // This will redirect non-admin users to /unauthorized
  const user = await requireAdmin()
  
  return <div>Admin content for {user.email}</div>
}
```

### Usage in API Routes

```typescript
import { verifyAdminForAPI } from '@/lib/auth/admin-guards'

export async function POST(request: Request) {
  try {
    // This will throw an error if not admin
    const user = await verifyAdminForAPI()
    
    // Admin-only logic here
    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    )
  }
}
```

### Conditional Rendering

```typescript
import { isCurrentUserAdmin } from '@/lib/auth/admin-guards'

export default async function Page() {
  const isAdmin = await isCurrentUserAdmin()
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      <RegularContent />
    </div>
  )
}
```

### Get Admin User Without Redirecting

```typescript
import { getAdminUser } from '@/lib/auth/admin-guards'

export default async function Page() {
  const adminUser = await getAdminUser()
  
  if (!adminUser) {
    return <div>Not authorized</div>
  }
  
  return <div>Admin: {adminUser.email}</div>
}
```

## Session Validation

Session validation utilities help ensure users have valid, non-expired sessions.

### Check Session Status

```typescript
import { validateSession } from '@/lib/auth/session-validation'

export default async function Page() {
  const status = await validateSession()
  
  if (status.isExpired) {
    // Redirect to login
  }
  
  if (status.warningThreshold) {
    // Show warning to user
  }
  
  return <div>Session valid</div>
}
```

### Require Valid Session

```typescript
import { requireValidSession } from '@/lib/auth/session-validation'

export async function POST(request: Request) {
  try {
    // This will throw if session is invalid or expired
    await requireValidSession()
    
    // Process request
    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    )
  }
}
```

### Refresh Session

```typescript
import { refreshSession, shouldRefreshSession } from '@/lib/auth/session-validation'

// Check if refresh is needed
const needsRefresh = await shouldRefreshSession()

if (needsRefresh) {
  const success = await refreshSession()
  if (!success) {
    // Handle refresh failure
  }
}
```

## Middleware Protection

The middleware automatically protects routes based on authentication and role:

- `/admin-dashboard/*` - Requires admin role
- `/dashboard/*` - Requires authentication
- `/projects/*` - Requires authentication

Unauthorized access attempts are automatically logged to the `user_activity_logs` table.

## Activity Logging

All unauthorized access attempts are logged with:
- User ID (if authenticated)
- Attempted path
- Reason for denial
- Timestamp

This provides an audit trail for security monitoring.

## Error Handling

### Admin Guards

- `requireAdmin()` - Redirects to `/unauthorized` or custom path
- `verifyAdminForAPI()` - Throws error with message
- `isCurrentUserAdmin()` - Returns boolean, never throws
- `getAdminUser()` - Returns user or null, never throws

### Session Validation

- `validateSession()` - Returns status object, never throws
- `requireValidSession()` - Throws error if invalid
- `refreshSession()` - Returns boolean, never throws

## Security Considerations

1. **Server-Side Only**: All guards must be used server-side only
2. **Middleware First**: Middleware provides first line of defense
3. **Component Guards**: Add guards to sensitive components for defense in depth
4. **API Verification**: Always verify in API routes, don't trust client
5. **Logging**: All unauthorized attempts are logged for audit
6. **Session Expiry**: Sessions expire after 24 hours
7. **Auto-Refresh**: Sessions auto-refresh when within 1 hour of expiry
