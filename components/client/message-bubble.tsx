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
        "flex gap-3 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
        isCurrentUser ? "flex-row-reverse" : "flex-row"
      )}
      aria-label={`Message from ${senderName}`}
    >
      {/* Avatar */}
      <Avatar className="w-9 h-9 shrink-0 border-2 border-yellow-400/20">
        <AvatarImage src={senderAvatar || undefined} alt={`${senderName}'s avatar`} />
        <AvatarFallback className="bg-yellow-400 text-black font-semibold text-xs">
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          "flex flex-col gap-1.5 max-w-[75%] sm:max-w-[70%]",
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
          <span className="text-xs font-semibold text-black dark:text-white">
            {senderName}
          </span>
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0.5 h-5", getRoleBadgeColor(senderRole))}
          >
            {getRoleLabel(senderRole)}
          </Badge>
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 wrap-break-word shadow-sm",
            isCurrentUser
              ? "bg-yellow-400 text-black rounded-tr-sm"
              : "bg-gray-50 dark:bg-gray-800/50 text-black dark:text-white border border-yellow-400/20 rounded-tl-sm"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        </div>

        {/* Timestamp */}
        <time 
          className="text-[11px] text-muted-foreground/80 px-1"
          dateTime={timestamp}
        >
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </time>
      </div>
    </article>
  )
}
