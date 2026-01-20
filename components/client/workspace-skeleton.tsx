import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function WorkspaceSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header Skeleton */}
      <div className="mb-6">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Proposals List Skeleton */}
        <div className="xl:col-span-3 space-y-4">
          <Skeleton className="h-7 w-48" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 border-yellow-400/20">
                <div className="space-y-3">
                  <div>
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="xl:col-span-6 space-y-6">
          <Card className="p-4 border-yellow-400/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-7 w-64 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-48" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-yellow-400/20">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="pt-4">
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="p-6 border-yellow-400/20">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Card>

          <Card className="p-6 border-yellow-400/20">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
