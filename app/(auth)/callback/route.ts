import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isRegistrationComplete } from '@/lib/auth/registration'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next')
  const invitationCode = searchParams.get('invitation')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get user to check if registration is complete
      const { data: { user } } = await supabase.auth.getUser()
      
      // If registration not complete, redirect to registration
      if (user && !isRegistrationComplete(user)) {
        const registerUrl = invitationCode 
          ? `/join/${invitationCode}` 
          : '/register'
        return NextResponse.redirect(`${origin}${registerUrl}`)
      }
      
      // If next param exists, use it; otherwise use role-based redirect
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      
      // Role-based redirect for completed registrations
      const role = user?.user_metadata?.role
      if (role === 'admin') {
        return NextResponse.redirect(`${origin}/admin-dashboard`)
      } else if (role === 'client') {
        return NextResponse.redirect(`${origin}/projects`)
      } else if (role === 'bidding_lead') {
        return NextResponse.redirect(`${origin}/lead-dashboard`)
      } else if (role === 'bidding_member') {
        // Bidding members go to root marketplace
        return NextResponse.redirect(`${origin}/`)
      }
      
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
