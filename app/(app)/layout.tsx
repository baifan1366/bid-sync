"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { RouteAnnouncer } from "@/components/layout/route-announcer"
import { LayoutErrorBoundary } from "@/components/layout/layout-error-boundary"
import { Toaster } from "@/components/ui/toaster"
import { useUser } from "@/hooks/use-user"
import { Skeleton } from "@/components/ui/skeleton"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev)
  }, [])

  const handleMobileMenuClose = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  // Show loading skeleton while fetching user data
  if (loading) {
    return <LayoutSkeleton />
  }

  // Don't render layout if no user (will redirect)
  if (!user) {
    return null
  }

  return (
    <LayoutErrorBoundary>
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to main content
      </a>
      
      {/* Route announcer for screen readers */}
      <RouteAnnouncer />
      
      <div className="flex h-screen flex-col overflow-hidden transition-colors duration-200">
        {/* Header with mobile menu toggle */}
        <Header onMobileMenuToggle={handleMobileMenuToggle} />
        
        {/* Mobile Navigation */}
        <MobileNav isOpen={isMobileMenuOpen} onClose={handleMobileMenuClose} />
        
        {/* Main content area with proper spacing and overflow handling */}
        <main 
          className="flex-1 overflow-y-auto bg-background scroll-smooth" 
          id="main-content"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
        >
          <div className="container mx-auto p-6 max-w-7xl">
            {children}
          </div>
        </main>
        
        {/* Toast notifications */}
        <Toaster />
      </div>
    </LayoutErrorBoundary>
  )
}

function LayoutSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="h-14 border-b border-border bg-card">
        <div className="flex items-center justify-between h-full px-6">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
      
      {/* Main content skeleton */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto p-6 max-w-7xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    </div>
  )
}
