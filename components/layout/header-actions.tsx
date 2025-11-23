"use client"

import { memo, useState, useEffect } from "react"
import { Bell, LogOut, Moon, Settings, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface HeaderActionsProps {
  className?: string
}

const getRoleLabel = (role?: string): string => {
  const roleLabels: Record<string, string> = {
    admin: "Admin",
    client: "Client",
    bidding_lead: "Bidding Lead",
    bidding_member: "Bidding Member",
  }
  return role ? roleLabels[role] || "User" : "User"
}

const getUserInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  if (email) {
    return email.substring(0, 2).toUpperCase()
  }
  return "U"
}

export const HeaderActions = memo(function HeaderActions({ className }: HeaderActionsProps) {
  const { user } = useUser()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Mock notification count - in real app, this would come from API
  const notificationCount = 3

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const userMetadata = user?.user_metadata
  const userName = userMetadata?.full_name || user?.email?.split("@")[0]
  const userRole = userMetadata?.role
  const avatarUrl = userMetadata?.avatar_url

  return (
    <div className={cn("flex items-center gap-1", className)} role="toolbar" aria-label="User actions">
      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
        title={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {!user ? (
        /* Login/Register buttons for non-authenticated users */
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/login")}
            className="ml-2 text-black dark:text-white hover:bg-yellow-400/10"
          >
            Sign in
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/register")}
            className="bg-yellow-400 text-black hover:bg-yellow-500"
          >
            Employer site
          </Button>
        </>
      ) : (
        <>
          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
              aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
              title="View notifications"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </Button>
            {notificationCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[10px] font-medium"
                aria-label={`${notificationCount} unread notifications`}
              >
                {notificationCount}
              </Badge>
            )}
          </div>

          {/* Divider */}
          <div className="hidden lg:block h-6 w-px bg-border mx-2" aria-hidden="true" />

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 gap-2 px-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                  aria-label={`User menu for ${userName || user?.email}`}
                  aria-haspopup="true"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={avatarUrl} alt={`${userName || "User"} avatar`} />
                    <AvatarFallback aria-label={`${userName || user?.email} initials`} className="text-xs">
                      {getUserInitials(userName, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:block text-sm font-medium">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" role="menu">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      {getRoleLabel(userRole)}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")} role="menuitem">
                  <User className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/settings")} role="menuitem">
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} role="menuitem">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  )
})
