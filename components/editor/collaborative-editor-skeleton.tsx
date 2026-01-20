import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export function CollaborativeEditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header Skeleton */}
      <div className="border-b border-yellow-400/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-auto">
          <Card className="border-yellow-400/20 p-6">
            <Skeleton className="h-8 w-3/4 mb-6" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="w-80 border-l border-yellow-400/20 p-4 space-y-4">
          <Card className="border-yellow-400/20 p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>

          <Card className="border-yellow-400/20 p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
