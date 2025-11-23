import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PublicProjectCardSkeleton() {
  return (
    <Card className="bg-card text-card-foreground border-border">
      <CardHeader className="pb-3 p-4 sm:p-6">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        
        <div className="pt-2 border-t border-border">
          <Skeleton className="h-3 w-36" />
        </div>
      </CardContent>
    </Card>
  )
}
