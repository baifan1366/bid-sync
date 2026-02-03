import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function ProposalDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <main className="lg:col-span-8 space-y-6">
            {/* Proposal Header */}
            <Card className="border-yellow-400/20">
              <CardHeader>
                <div className="space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-32 rounded-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Team Info */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-yellow-400/20">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Card className="border-yellow-400/20">
              <div className="p-4 flex items-center gap-2 border-b border-yellow-400/20">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-32" />
              </div>
              <CardContent className="p-6 space-y-4">
                {/* Content Skeleton */}
                <div className="space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-3 pt-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </CardContent>
            </Card>
          </main>

          {/* Sidebar */}
          <aside className="hidden lg:block lg:col-span-4">
            <Card className="border-yellow-400/20 sticky top-6">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
