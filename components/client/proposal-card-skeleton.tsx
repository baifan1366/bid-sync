import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProposalCardSkeleton() {
  return (
    <Card className="border-yellow-400/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          {/* Checkbox for comparison */}
          <Skeleton className="h-4 w-4 rounded" />
          
          <div className="flex-1 space-y-2">
            {/* Proposal Title */}
            <Skeleton className="h-6 w-4/5" />
            {/* Team Name */}
            <Skeleton className="h-4 w-2/3" />
          </div>
          
          {/* Status Badge */}
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Budget Estimate */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-28" />
        </div>
        
        {/* Team Size */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        
        {/* Submission Date */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between">
        {/* Unread Messages Badge */}
        <Skeleton className="h-5 w-32 rounded-full" />
        {/* View Details Link */}
        <Skeleton className="h-4 w-24" />
      </CardFooter>
    </Card>
  )
}
