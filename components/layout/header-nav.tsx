"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/hooks/use-user"
import { UserRole } from "@/lib/roles/constants"

interface NavItem {
  label: string
  href: string
  matchPaths?: string[] // Additional paths that should mark this nav item as active
}

// Navigation items for different user roles
const roleNavigation: Record<UserRole, NavItem[]> = {
  client: [
    { 
      label: "Projects", 
      href: "/projects",
      matchPaths: ["/projects"]
    },
  ],
  bidding_lead: [
    { 
      label: "Dashboard", 
      href: "/lead-dashboard",
      matchPaths: ["/lead-dashboard"]
    },
    { 
      label: "Workspace", 
      href: "/workspace",
      matchPaths: ["/workspace"]
    },
    { 
      label: "Documents", 
      href: "/documents",
      matchPaths: ["/documents", "/editor"]
    },
  ],
  bidding_member: [
    { 
      label: "Workspace", 
      href: "/workspace",
      matchPaths: ["/workspace"]
    },
    { 
      label: "Documents", 
      href: "/documents",
      matchPaths: ["/documents", "/editor"]
    },
  ],
  admin: [
    { 
      label: "Admin Dashboard", 
      href: "/admin-dashboard",
      matchPaths: ["/admin-dashboard"]
    },
  ],
}

interface HeaderNavProps {
  className?: string
}

export const HeaderNav = memo(function HeaderNav({ className }: HeaderNavProps) {
  const pathname = usePathname()
  const { user } = useUser()
  
  // Get user role from metadata
  const userRole = user?.user_metadata?.role as UserRole | undefined

  // Get navigation items for the current user role
  const navItems = userRole ? roleNavigation[userRole] : []

  // Don't render nav if user is not logged in or has no nav items
  if (!user || navItems.length === 0) {
    return null
  }

  const isActive = (item: NavItem) => {
    if (!pathname) return false
    
    // Check if current path matches the item's href
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      return true
    }
    
    // Check if current path matches any of the additional match paths
    if (item.matchPaths) {
      return item.matchPaths.some(path => 
        pathname === path || pathname.startsWith(path + "/")
      )
    }
    
    return false
  }

  return (
    <nav className={cn("flex items-center gap-0.5", className)} role="navigation" aria-label="Main navigation">
      {navItems.map((item) => {
        const active = isActive(item)
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150",
              "hover:bg-yellow-100 dark:hover:bg-yellow-900/50 hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "text-foreground bg-yellow-50 dark:bg-yellow-900/30"
                : "text-muted-foreground"
            )}
            aria-current={active ? "page" : undefined}
            tabIndex={0}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-1 -bottom-[17px] h-[2px] bg-yellow-500 rounded-full" aria-hidden="true" />
            )}
          </Link>
        )
      })}
    </nav>
  )
})
