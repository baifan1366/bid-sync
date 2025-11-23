"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessagesList } from "./messages-list"
import { MessageComposer } from "./message-composer"
import { ConnectionStatus } from "./connection-status"
import { useRealtimeMessages } from "@/hooks/use-realtime-messages"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"

interface ChatSectionProps {
  projectId: string
  proposalId: string | null
  projectTitle?: string
  proposalTitle?: string
  onClose?: () => void
}

interface Message {
  id: string
  content: string
  senderName: string
  senderAvatar: string | null
  senderRole: "client" | "bidding_lead" | "bidding_member"
  senderId: string
  timestamp: string
}

export function ChatSection({
  projectId,
  proposalId,
  projectTitle,
  proposalTitle,
  onClose,
}: ChatSectionProps) {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = supabase
        .from("chat_messages")
        .select("id, content, created_at, sender_id, read")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })

      if (proposalId) {
        query = query.eq("proposal_id", proposalId)
      } else {
        query = query.is("proposal_id", null)
      }

      const { data, error } = await query

      if (error) throw error

      // For now, use sender_id as the name until we implement proper user lookup
      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        senderName: msg.sender_id === user?.id ? "You" : "User",
        senderAvatar: null,
        senderRole: "bidding_member",
        senderId: msg.sender_id,
        timestamp: msg.created_at,
      }))

      setMessages(formattedMessages)
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, proposalId, supabase, user?.id])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Handle new messages from realtime
  const handleNewMessage = useCallback(
    async (newMessage: any) => {
      const formattedMessage: Message = {
        id: newMessage.id,
        content: newMessage.content,
        senderName: newMessage.sender_id === user?.id ? "You" : "User",
        senderAvatar: null,
        senderRole: "bidding_member",
        senderId: newMessage.sender_id,
        timestamp: newMessage.created_at,
      }

      setMessages((prev) => [...prev, formattedMessage])
    },
    [user?.id]
  )

  // Set up realtime subscription
  const { connectionStatus, reconnect } = useRealtimeMessages({
    projectId,
    proposalId,
    onMessageReceived: handleNewMessage,
  })

  // Track unread messages
  const { unreadCount, markMessagesAsRead } = useUnreadMessages({
    projectId,
    proposalId,
    currentUserId: user?.id || null,
  })

  // Mark messages as read when chat is viewed
  useEffect(() => {
    if (user && unreadCount > 0) {
      // Mark as read after a short delay to ensure user has seen the messages
      const timer = setTimeout(() => {
        markMessagesAsRead()
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [user, unreadCount, markMessagesAsRead])

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!user) {
      throw new Error("You must be logged in to send messages")
    }

    const { error } = await supabase.from("chat_messages").insert({
      project_id: projectId,
      proposal_id: proposalId,
      sender_id: user.id,
      content,
      read: false,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  return (
    <Card 
      className="flex flex-col h-full border-yellow-400/20 bg-white dark:bg-black"
      role="region"
      aria-label="Chat conversation"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-400/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-400 rounded-lg relative">
            <MessageSquare className="w-5 h-5 text-black" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-black dark:text-white truncate">
              {proposalTitle || "Project Chat"}
            </h3>
            {projectTitle && (
              <p className="text-sm text-muted-foreground truncate">
                {projectTitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <ConnectionStatus
            status={connectionStatus.status}
            error={connectionStatus.error}
            onReconnect={reconnect}
            size="sm"
          />
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close chat"
              className="hover:bg-yellow-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">Close chat</span>
            </Button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-yellow-400 mb-3" />
            <p className="text-muted-foreground">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <MessagesList
            messages={messages}
            currentUserId={user?.id || ""}
            isLoading={isLoading}
          />
        )}
      </div>

      <Separator className="bg-yellow-400/20" />

      {/* Message Composer */}
      <div className="p-4">
        <MessageComposer
          projectId={projectId}
          proposalId={proposalId}
          onMessageSent={handleSendMessage}
          disabled={!user}
        />
      </div>
    </Card>
  )
}
