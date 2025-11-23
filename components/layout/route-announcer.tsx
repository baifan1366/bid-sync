"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * RouteAnnouncer component for screen reader accessibility
 * Announces route changes to screen readers using ARIA live regions
 */
export function RouteAnnouncer() {
  const pathname = usePathname()
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    // Get the page title from the pathname
    const getPageTitle = (path: string): string => {
      const segments = path.split("/").filter(Boolean)
      if (segments.length === 0) return "Home"
      
      // Convert path segments to readable titles
      const lastSegment = segments[segments.length - 1]
      return lastSegment
        .split("-")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    }

    const pageTitle = getPageTitle(pathname)
    setAnnouncement(`Navigated to ${pageTitle} page`)

    // Clear announcement after a delay to allow for re-announcement on same page
    const timer = setTimeout(() => setAnnouncement(""), 1000)
    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  )
}
