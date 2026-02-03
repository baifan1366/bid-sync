import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProjectHeaderSkeleton() {
  return (
    <Card className="border-yellow-400/20">
      <div className="p-6 space-y-4">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        {/* Project Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-yellow-400/20">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>
    </Card>
  )
}
