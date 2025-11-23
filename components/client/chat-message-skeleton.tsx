import { Skeleton } from "@/components/ui/skeleton"

export function ChatMessageSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4">
      {/* Avatar */}
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      
      {/* Message Content */}
      <div className="flex-1 space-y-2">
        {/* Sender Name and Timestamp */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        
        {/* Message Text */}
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  )
}

/**
 * Component for displaying multiple chat message skeletons
 * Useful for initial chat loading state
 */
export function ChatMessagesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} />
      ))}
    </div>
  )
}
