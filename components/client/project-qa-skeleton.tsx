import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageCircle } from 'lucide-react'

export function ProjectQASkeleton() {
  return (
    <Card className="border-yellow-400/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-yellow-400" />
          <CardTitle>Questions & Answers</CardTitle>
          <Skeleton className="h-6 w-20 ml-auto" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ask Question Form Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Questions List Skeleton */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-yellow-400/20 rounded-lg p-4 space-y-4">
              {/* Question Skeleton */}
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>

              {/* Answer Skeleton */}
              <div className="ml-13 space-y-3 border-l-2 border-yellow-400/20 pl-4">
                <div className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
