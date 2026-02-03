import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { ProjectHeaderSkeleton } from "./project-header-skeleton"
import { ProposalCardSkeleton } from "./proposal-card-skeleton"

export function WorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <main className="lg:col-span-8 space-y-6">
            {/* Project Header */}
            <ProjectHeaderSkeleton />

            {/* Progress Tracker */}
            <Card className="border-yellow-400/20">
              <div className="p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Proposals Section */}
            <div className="space-y-4">
              {/* Controls */}
              <Card className="border-yellow-400/20">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                  <Skeleton className="h-9 w-40" />
                </div>
              </Card>

              {/* Proposals List */}
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <ProposalCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </main>

          {/* Chat Sidebar */}
          <aside className="hidden lg:block lg:col-span-4">
            <Card className="border-yellow-400/20 sticky top-6">
              <div className="p-4 space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
