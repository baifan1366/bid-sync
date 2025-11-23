"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface MessageBubbleProps {
  content: string
  senderName: string
  senderAvatar: string | null
  senderRole: "client" | "bidding_lead" | "bidding_member"
  timestamp: string
  isCurrentUser: boolean
}

export function MessageBubble({
  content,
  senderName,
  senderAvatar,
  senderRole,
  timestamp,
  isCurrentUser,
}: MessageBubbleProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "client":
        return "bg-yellow-400 text-black hover:bg-yellow-500"
      case "bidding_lead":
        return "bg-blue-500 text-white hover:bg-blue-600"
      case "bidding_member":
        return "bg-gray-500 text-white hover:bg-gray-600"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "client":
        return "Client"
      case "bidding_lead":
        return "Lead"
      case "bidding_member":
        return "Team"
      default:
        return role
    }
  }

  return (
    <article
      className={cn(
        "flex gap-3 w-full",
        isCurrentUser ? "flex-row-reverse" : "flex-row"
      )}
      aria-label={`Message from ${senderName}`}
    >
      {/* Avatar */}
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={senderAvatar || undefined} alt={`${senderName}'s avatar`} />
        <AvatarFallback className="bg-yellow-400 text-black font-semibold">
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[70%]",
          isCurrentUser ? "items-end" : "items-start"
        )}
      >
        {/* Sender Info */}
        <div
          className={cn(
            "flex items-center gap-2",
            isCurrentUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="text-sm font-medium text-black dark:text-white">
            {senderName}
          </span>
          <Badge
            variant="secondary"
            className={cn("text-xs", getRoleBadgeColor(senderRole))}
          >
            {getRoleLabel(senderRole)}
          </Badge>
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-2 wrap-break-word",
            isCurrentUser
              ? "bg-yellow-400 text-black"
              : "bg-white dark:bg-gray-800 text-black dark:text-white border border-yellow-400/20"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>

        {/* Timestamp */}
        <time 
          className="text-xs text-muted-foreground"
          dateTime={timestamp}
        >
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </time>
      </div>
    </article>
  )
}
