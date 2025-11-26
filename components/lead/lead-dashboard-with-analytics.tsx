import { LeadDashboardWithAnalyticsClient } from "./lead-dashboard-with-analytics-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function LeadDashboardWithAnalytics() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <LeadDashboardWithAnalyticsClient leadId={user.id} />
}
