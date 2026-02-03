"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Folder, Briefcase, FileText, Shield, TrendingUp, User, Users, ClipboardList, Settings as SettingsIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useUser } from "@/hooks/use-user"
import { UserRole } from "@/lib/roles/constants"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  matchPaths?: string[]
}

// Role-based navigation items with icons
const roleNavigation: Record<UserRole, NavItem[]> = {
  client: [
    { 
      label: "Projects", 
      href: "/client-projects", 
      icon: Folder,
      matchPaths: ["/client-projects"]
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: User,
      matchPaths: ["/profile"]
    },
    { 
      label: "Settings", 
      href: "/settings", 
      icon: SettingsIcon,
      matchPaths: ["/settings"]
    },
  ],
  bidding_lead: [
    { 
      label: "Dashboard", 
      href: "/lead-dashboard", 
      icon: Home,
      matchPaths: ["/lead-dashboard"]
    },
    { 
      label: "Projects", 
      href: "/lead-projects", 
      icon: Folder,
      matchPaths: ["/lead-projects"]
    },
    { 
      label: "Proposals", 
      href: "/lead-proposals", 
      icon: ClipboardList,
      matchPaths: ["/lead-proposals"]
    },
    { 
      label: "Team", 
      href: "/team", 
      icon: Users,
      matchPaths: ["/team"]
    },
    { 
      label: "Performance", 
      href: "/performance", 
      icon: TrendingUp,
      matchPaths: ["/performance"]
    },
    { 
      label: "Workspace", 
      href: "/workspace", 
      icon: Briefcase,
      matchPaths: ["/workspace"]
    },
    { 
      label: "Documents", 
      href: "/documents", 
      icon: FileText,
      matchPaths: ["/documents", "/editor"]
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: User,
      matchPaths: ["/profile"]
    },
    { 
      label: "Settings", 
      href: "/settings", 
      icon: SettingsIcon,
      matchPaths: ["/settings"]
    },
  ],
  bidding_member: [
    { 
      label: "Dashboard", 
      href: "/member-dashboard", 
      icon: Home,
      matchPaths: ["/member-dashboard"]
    },
    { 
      label: "Team", 
      href: "/team", 
      icon: Users,
      matchPaths: ["/team"]
    },
    { 
      label: "Workspace", 
      href: "/workspace", 
      icon: Briefcase,
      matchPaths: ["/workspace"]
    },
    { 
      label: "Documents", 
      href: "/documents", 
      icon: FileText,
      matchPaths: ["/documents", "/editor"]
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: User,
      matchPaths: ["/profile"]
    },
    { 
      label: "Settings", 
      href: "/settings", 
      icon: SettingsIcon,
      matchPaths: ["/settings"]
    },
  ],
  admin: [
    { 
      label: "Dashboard", 
      href: "/admin-dashboard", 
      icon: Shield,
      matchPaths: ["/admin-dashboard"]
    },
    { 
      label: "Overview", 
      href: "/overview", 
      icon: Home,
      matchPaths: ["/overview"]
    },
    { 
      label: "Analytics", 
      href: "/analytics", 
      icon: TrendingUp,
      matchPaths: ["/analytics"]
    },
    { 
      label: "Projects", 
      href: "/admin-projects", 
      icon: Folder,
      matchPaths: ["/admin-projects"]
    },
    { 
      label: "Proposals", 
      href: "/admin-proposals", 
      icon: FileText,
      matchPaths: ["/admin-proposals"]
    },
    { 
      label: "Verifications", 
      href: "/verifications", 
      icon: Shield,
      matchPaths: ["/verifications"]
    },
    { 
      label: "Templates", 
      href: "/templates", 
      icon: FileText,
      matchPaths: ["/templates"]
    },
    { 
      label: "Settings", 
      href: "/admin-settings", 
      icon: Briefcase,
      matchPaths: ["/admin-settings"]
    },
  ],
}

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export const MobileNav = memo(function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const { user } = useUser()
  
  // Get user role from metadata
  const userRole = user?.user_metadata?.role as UserRole | undefined
  
  // Get navigation items for the current user role
  const navItems = userRole ? roleNavigation[userRole] : []

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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="left" 
        className="w-[280px] p-0 bg-white dark:bg-black"
        id="mobile-navigation"
        aria-label="Mobile navigation menu"
      >
        <SheetHeader className="p-6 pb-4 border-b border-yellow-400/20">
          <SheetTitle className="text-black dark:text-white">Navigation</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-[calc(100%-5rem)]">
          {/* Navigation items */}
          <nav className="flex-1 px-4 py-4 space-y-1" role="navigation" aria-label="Primary navigation">
            {navItems.length > 0 ? (
              navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400",
                      active
                        ? "bg-yellow-400 text-black"
                        : "text-black dark:text-white hover:bg-yellow-400/10"
                    )}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    tabIndex={0}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No navigation items available
              </div>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
})
