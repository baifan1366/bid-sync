import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Bell } from 'lucide-react'

export function NotificationPreferencesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Browser Notification Settings Skeleton */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Main Preferences Card Skeleton */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-400" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Manage how you receive notifications across the platform
              </CardDescription>
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i}>
              {i > 1 && <Separator className="bg-yellow-400/10 mb-4" />}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Skeleton className="h-5 w-5 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </div>
          ))}

          <Separator className="bg-yellow-400/10 my-6" />

          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
