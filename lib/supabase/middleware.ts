import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Log unauthorized access attempt
 */
async function logUnauthorizedAccessAttempt(
  supabase: any,
  userId: string | undefined,
  attemptedPath: string,
  reason: string
) {
  try {
    await supabase.from('user_activity_logs').insert({
      user_id: userId || null,
      action: 'unauthorized_access_attempt',
      resource_type: 'route',
      resource_id: null,
      metadata: {
        attempted_path: attemptedPath,
        reason,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Log error but don't throw - logging failure shouldn't block middleware
    console.error('Failed to log unauthorized access:', error)
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check session validity
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = request.nextUrl.pathname

  // Protected routes
  if (
    path.startsWith('/admin-dashboard') ||
    path.startsWith('/lead-dashboard') ||
    path.startsWith('/member-dashboard') ||
    path.startsWith('/projects') ||
    path.startsWith('/workspace') ||
    path.startsWith('/profile') ||
    path.startsWith('/editor') ||
    path.startsWith('/documents')
  ) {
    // Check authentication
    if (!user) {
      await logUnauthorizedAccessAttempt(
        supabase,
        undefined,
        path,
        'not_authenticated'
      )
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', path)
      return NextResponse.redirect(url)
    }

    // Check session expiration
    if (session) {
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      
      if (expiresAt <= now) {
        await logUnauthorizedAccessAttempt(
          supabase,
          user.id,
          path,
          'session_expired'
        )
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', path)
        url.searchParams.set('reason', 'session_expired')
        return NextResponse.redirect(url)
      }
    }

    const role = user.user_metadata?.role

    // Admin route protection
    if (path.startsWith('/admin-dashboard') && role !== 'admin') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=admin`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Lead dashboard protection
    if (path.startsWith('/lead-dashboard') && role !== 'bidding_lead') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=bidding_lead`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Member dashboard protection
    if (path.startsWith('/member-dashboard') && role !== 'bidding_member') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=bidding_member`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Editor and Documents - allow bidding_lead and bidding_member
    // Document-level permissions are checked in the component
    if ((path.startsWith('/editor') || path.startsWith('/documents')) && 
        role !== 'bidding_lead' && 
        role !== 'bidding_member' && 
        role !== 'admin') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=bidding_lead or bidding_member`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Workspace - allow bidding_lead and bidding_member
    if (path.startsWith('/workspace') && 
        role !== 'bidding_lead' && 
        role !== 'bidding_member' && 
        role !== 'admin') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=bidding_lead or bidding_member`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }

    // Client route protection (projects page)
    // Allow both clients and bidding leads to access projects
    if (path.startsWith('/projects') && role !== 'client' && role !== 'bidding_lead') {
      await logUnauthorizedAccessAttempt(
        supabase,
        user.id,
        path,
        `insufficient_permissions: role=${role}, required=client or bidding_lead`
      )
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  // Auth routes (redirect to role-based dashboard if already logged in)
  if (path.startsWith('/login') || path.startsWith('/register')) {
    if (user) {
      const role = user.user_metadata?.role
      const url = request.nextUrl.clone()
      
      if (role === 'admin') {
        url.pathname = '/admin-dashboard'
      } else if (role === 'client') {
        url.pathname = '/projects'
      } else if (role === 'bidding_lead') {
        url.pathname = '/lead-dashboard'
      } else {
        url.pathname = '/'
      }
      
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
