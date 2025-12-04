"use client"

import { memo, useState, useEffect } from "react"
import { LogOut, Moon, Settings, Sun, User } from "lucide-react"
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
import { NotificationCenter } from "@/components/notifications"
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
          <NotificationCenter userId={user.id} />

          {/* Divider */}
          <div className="hidden lg:block h-6 w-px bg-border mx-2" aria-hidden="true" />

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 gap-2 px-2 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded-lg"
                  aria-label={`User menu for ${userName || user?.email}`}
                  aria-haspopup="true"
                >
                  <Avatar className="h-7 w-7 ring-2 ring-yellow-400/20">
                    <AvatarImage src={avatarUrl} alt={`${userName || "User"} avatar`} />
                    <AvatarFallback aria-label={`${userName || user?.email} initials`} className="text-xs bg-yellow-400 text-black font-semibold">
                      {getUserInitials(userName, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:flex flex-col items-start gap-0.5">
                    <span className="text-sm font-semibold text-black dark:text-white leading-tight">{userName}</span>
                    <span className="text-xs text-yellow-400 font-medium leading-tight">{getRoleLabel(userRole)}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-0" role="menu">
                <DropdownMenuLabel className="p-5 pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 ring-2 ring-yellow-400/30 shrink-0">
                      <AvatarImage src={avatarUrl} alt={`${userName || "User"} avatar`} />
                      <AvatarFallback className="text-xl bg-yellow-400 text-black font-bold">
                        {getUserInitials(userName, user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="space-y-1">
                        <p className="text-lg font-bold leading-tight text-black dark:text-white truncate">{userName}</p>
                        <p className="text-xs leading-tight text-muted-foreground truncate break-all">
                          {user?.email}
                        </p>
                      </div>
                      <Badge className="w-fit text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-500 border-0 px-2.5 py-1">
                        {getRoleLabel(userRole)}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-0" />
                <div className="p-2">
                  <DropdownMenuItem 
                    onClick={() => router.push("/profile")} 
                    role="menuitem"
                    className="cursor-pointer rounded-md py-2.5 px-3 hover:bg-yellow-400/10 focus:bg-yellow-400/10"
                  >
                    <User className="mr-3 h-4 w-4 text-yellow-400" aria-hidden="true" />
                    <span className="font-medium">Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => router.push("/settings")} 
                    role="menuitem"
                    className="cursor-pointer rounded-md py-2.5 px-3 hover:bg-yellow-400/10 focus:bg-yellow-400/10"
                  >
                    <Settings className="mr-3 h-4 w-4 text-yellow-400" aria-hidden="true" />
                    <span className="font-medium">Settings</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="my-0" />
                <div className="p-2">
                  <DropdownMenuItem 
                    onClick={handleSignOut} 
                    role="menuitem"
                    className="cursor-pointer rounded-md py-2.5 px-3 hover:bg-red-50 dark:hover:bg-red-950/20 focus:bg-red-50 dark:focus:bg-red-950/20 text-red-600 dark:text-red-400"
                  >
                    <LogOut className="mr-3 h-4 w-4" aria-hidden="true" />
                    <span className="font-medium">Log out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
    </div>
  )
})
