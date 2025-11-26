import { BidPerformanceDashboard } from "@/components/lead/bid-performance-dashboard"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Performance Analytics | BidSync",
  description: "Track your bidding success and team performance",
}

export default async function PerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <BidPerformanceDashboard leadId={user.id} />
}
