"use client"

import { useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    async function refreshSession() {
      // Refresh the session to get latest user metadata from server
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.user) {
        setUser(session.user)
        
        // Check if user is suspended and log them out
        if (session.user.user_metadata?.is_suspended) {
          console.log('[useUser] User is suspended, logging out...')
          await supabase.auth.signOut()
          setUser(null)
        }
      }
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setLoading(false)
      
      // Check if user is suspended and log them out
      if (currentUser?.user_metadata?.is_suspended) {
        console.log('[useUser] User is suspended (auth state change), logging out...')
        await supabase.auth.signOut()
        setUser(null)
      }
    })

    // Refresh session every 30 seconds to get latest metadata and check suspension
    const refreshInterval = setInterval(() => {
      refreshSession()
    }, 30 * 1000) // 30 seconds for faster suspension detection

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [])

  return { user, loading }
}
