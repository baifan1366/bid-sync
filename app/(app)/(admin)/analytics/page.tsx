import { requireAdmin } from '@/lib/auth/admin-guards'
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard'
import { BarChart3 } from 'lucide-react'

export const metadata = {
  title: "Analytics | Admin Dashboard",
  description: "Platform analytics and insights",
}

export default async function AnalyticsPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <BarChart3 className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Platform Analytics
          </h1>
        </div>
        <p className="text-muted-foreground">
          Monitor platform performance and user activity
        </p>
      </div>
      
      <AnalyticsDashboard />
    </>
  )
}
