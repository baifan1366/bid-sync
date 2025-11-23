import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProjectHeaderSkeleton() {
  return (
    <Card className="border-yellow-400/20">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Title and Status */}
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>

          {/* Budget, Timeline, and Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>

          {/* Documents List */}
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-36" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
