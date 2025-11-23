import { createClient } from "@/lib/supabase/client"
import { UserRole } from "@/lib/roles/constants"
import { useEffect, useState } from "react"

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    async function getRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.user_metadata?.role) {
          setRole(user.user_metadata.role as UserRole)
        }
      } catch (error) {
        console.error('Error fetching role:', error)
      } finally {
        setLoading(false)
      }
    }

    getRole()
  }, [])

  return { role, loading }
}
