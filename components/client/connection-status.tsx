"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, Loader2 } from "lucide-react"

interface ConnectionStatusProps {
  status: "connected" | "connecting" | "disconnected"
  error?: string | null
  onReconnect?: () => void
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

export function ConnectionStatus({
  status,
  error,
  onReconnect,
  showLabel = true,
  size = "md",
}: ConnectionStatusProps) {
  const iconSize = size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5"
  const badgeSize = size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"

  if (status === "connected") {
    return (
      <Badge
        variant="secondary"
        className={`bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 ${badgeSize}`}
      >
        <Wifi className={`${iconSize} ${showLabel ? "mr-1" : ""}`} />
        {showLabel && "Connected"}
      </Badge>
    )
  }

  if (status === "connecting") {
    return (
      <Badge
        variant="secondary"
        className={`bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 ${badgeSize}`}
      >
        <Loader2 className={`${iconSize} ${showLabel ? "mr-1" : ""} animate-spin`} />
        {showLabel && "Connecting..."}
      </Badge>
    )
  }

  // Disconnected state
  if (onReconnect) {
    const buttonSize = size === "md" ? "default" : size
    return (
      <Button
        variant="ghost"
        size={buttonSize as "default" | "sm" | "lg" | "icon"}
        onClick={onReconnect}
        className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
        title={error || "Connection lost"}
      >
        <WifiOff className={`${iconSize} ${showLabel ? "mr-1" : ""}`} />
        {showLabel && "Reconnect"}
      </Button>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={`bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 ${badgeSize}`}
      title={error || "Connection lost"}
    >
      <WifiOff className={`${iconSize} ${showLabel ? "mr-1" : ""}`} />
      {showLabel && "Disconnected"}
    </Badge>
  )
}
