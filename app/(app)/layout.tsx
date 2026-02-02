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
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSuspended, setIsSuspended] = useState(false)
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null)
  const { user, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Check for suspension status
  useEffect(() => {
    if (user?.user_metadata?.is_suspended) {
      setIsSuspended(true)
      setSuspensionReason(user.user_metadata?.suspended_reason || "Your account has been suspended.")
    }
  }, [user])

  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev)
  }, [])

  const handleMobileMenuClose = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Show loading skeleton while fetching user data
  if (loading) {
    return <LayoutSkeleton />
  }

  // Don't render layout if no user (will redirect)
  if (!user) {
    return null
  }

  // Show suspension message if user is suspended
  if (isSuspended) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Account Suspended</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p className="text-sm">
                Your account has been suspended and you can no longer access the platform.
              </p>
              {suspensionReason && (
                <div className="mt-3 rounded-md bg-white dark:bg-black p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium">Reason:</p>
                  <p className="text-sm mt-1">{suspensionReason}</p>
                </div>
              )}
              <p className="text-sm mt-3">
                If you believe this is a mistake, please contact support.
              </p>
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleLogout} 
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Log Out
          </Button>
        </div>
      </div>
    )
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
