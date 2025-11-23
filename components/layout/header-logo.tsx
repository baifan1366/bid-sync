"use client"

import { memo } from "react"
import Link from "next/link"
import { Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderLogoProps {
  className?: string
}

export const HeaderLogo = memo(function HeaderLogo({ className }: HeaderLogoProps) {
  // Always link to the public home page
  const homeRoute = "/"
  
  return (
    <Link
      href={homeRoute}
      className={cn(
        "flex items-center gap-2 transition-opacity hover:opacity-70",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 rounded-md px-1",
        className
      )}
      aria-label="BidSync home"
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-yellow-400" aria-hidden="true">
        <Briefcase className="h-4 w-4 text-black" />
      </div>
      <span className="text-lg font-semibold text-black dark:text-white tracking-tight">
        BidSync
      </span>
    </Link>
  )
})
