import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Archive } from "lucide-react"

export function ArchivedProposalsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header with Search Skeleton */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Archive className="h-5 w-5 text-yellow-400" />
              Archived Proposals
            </CardTitle>
            <Skeleton className="h-6 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Proposals List Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="border-yellow-400/20"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Title and Project */}
                  <div>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>

                  {/* Status Badge */}
                  <Skeleton className="h-6 w-20" />
                </div>

                {/* Actions */}
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
