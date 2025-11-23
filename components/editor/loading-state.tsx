"use client"

import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingStateProps {
  message?: string
  className?: string
}

/**
 * Loading State Component
 * 
 * Displays a loading spinner with optional message
 */
export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/**
 * Full Page Loading State
 */
export function FullPageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <LoadingState message={message} />
    </div>
  )
}

/**
 * Editor Loading Skeleton
 * 
 * Skeleton loader for the collaborative editor
 */
export function EditorLoadingSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header skeleton */}
      <div className="border-b border-border p-4 space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Editor content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="absolute right-0 top-0 h-full w-80 border-l border-border p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * Document List Loading Skeleton
 */
export function DocumentListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Inline Loading Spinner
 */
export function InlineLoading({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {message && <span>{message}</span>}
    </div>
  )
}
