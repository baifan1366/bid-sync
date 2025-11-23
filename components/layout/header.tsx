"use client"

import { memo } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HeaderLogo } from "./header-logo"
import { HeaderNav } from "./header-nav"
import { HeaderActions } from "./header-actions"

interface HeaderProps {
  className?: string
  onMobileMenuToggle?: () => void
}

export const Header = memo(function Header({ className, onMobileMenuToggle }: HeaderProps) {
  return (
    <header
      className={cn(
        "w-full z-50 h-14",
        "bg-white dark:bg-black",
        "border-b border-yellow-400/20",
        "flex items-center px-4 lg:px-6",
        "transition-all duration-200",
        className
      )}
      role="banner"
    >
      <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto">
        {/* Logo Area */}
        <div className="flex items-center gap-6">
          {/* Mobile hamburger menu button - visible on screens < 768px */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 hover:bg-yellow-400/10"
            onClick={onMobileMenuToggle}
            aria-label="Open navigation menu"
            aria-expanded={false}
            aria-controls="mobile-navigation"
          >
            <Menu className="h-4 w-4 text-yellow-400" aria-hidden="true" />
          </Button>
          
          <HeaderLogo />
          
          {/* Navigation Area - inline with logo on desktop */}
          <div className="hidden md:flex">
            <HeaderNav />
          </div>
        </div>

        {/* Actions Area */}
        <HeaderActions />
      </div>
    </header>
  )
})
