"use client"

import { useEffect, useRef } from "react"
import { MessageBubble } from "./message-bubble"
import { ChatMessageSkeleton } from "./chat-message-skeleton"
import { Separator } from "@/components/ui/separator"
import { format, isSameDay } from "date-fns"

interface Message {
  id: string
  content: string
  senderName: string
  senderAvatar: string | null
  senderRole: "client" | "bidding_lead" | "bidding_member"
  senderId: string
  timestamp: string
}

interface MessagesListProps {
  messages: Message[]
  currentUserId: string
  isLoading?: boolean
}

export function MessagesList({
  messages,
  currentUserId,
  isLoading = false,
}: MessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Group messages by date
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {}

    messages.forEach((message) => {
      const date = format(new Date(message.timestamp), "yyyy-MM-dd")
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })

    return groups
  }

  // Group consecutive messages from same sender
  const groupConsecutiveMessages = (messages: Message[]) => {
    const grouped: Message[][] = []
    let currentGroup: Message[] = []

    messages.forEach((message, index) => {
      if (index === 0) {
        currentGroup = [message]
      } else {
        const prevMessage = messages[index - 1]
        const timeDiff =
          new Date(message.timestamp).getTime() -
          new Date(prevMessage.timestamp).getTime()
        const isSameSender = message.senderId === prevMessage.senderId
        const isWithinFiveMinutes = timeDiff < 5 * 60 * 1000

        if (isSameSender && isWithinFiveMinutes) {
          currentGroup.push(message)
        } else {
          grouped.push(currentGroup)
          currentGroup = [message]
        }
      }
    })

    if (currentGroup.length > 0) {
      grouped.push(currentGroup)
    }

    return grouped
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton />
      </div>
    )
  }

  if (messages.length === 0) {
    return null
  }

  const messagesByDate = groupMessagesByDate(messages)
  const dates = Object.keys(messagesByDate).sort()

  // Note: Message virtualization infrastructure (react-window) is installed
  // but not currently implemented due to type compatibility issues.
  // For future implementation, consider using @tanstack/react-virtual instead.

  return (
    <div 
      ref={containerRef} 
      className="space-y-6"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {dates.map((date) => {
        const dateMessages = messagesByDate[date]
        const messageGroups = groupConsecutiveMessages(dateMessages)
        const dateObj = new Date(date)
        const isToday = isSameDay(dateObj, new Date())
        const dateLabel = isToday
          ? "Today"
          : format(dateObj, "MMMM d, yyyy")

        return (
          <div key={date} className="space-y-4">
            {/* Date Separator */}
            <div className="flex items-center gap-3" role="separator" aria-label={`Messages from ${dateLabel}`}>
              <Separator className="flex-1 bg-yellow-400/20" />
              <span className="text-xs font-medium text-muted-foreground px-2">
                {dateLabel}
              </span>
              <Separator className="flex-1 bg-yellow-400/20" />
            </div>

            {/* Message Groups */}
            <div className="space-y-4">
              {messageGroups.map((group, groupIndex) => (
                <div key={`group-${groupIndex}`} className="space-y-2">
                  {group.map((message) => (
                    <MessageBubble
                      key={message.id}
                      content={message.content}
                      senderName={message.senderName}
                      senderAvatar={message.senderAvatar}
                      senderRole={message.senderRole}
                      timestamp={message.timestamp}
                      isCurrentUser={message.senderId === currentUserId}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
