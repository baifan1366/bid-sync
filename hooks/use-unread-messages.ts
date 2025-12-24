"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

interface UseUnreadMessagesOptions {
  projectId: string
  proposalId: string | null
  currentUserId: string | null
}

export function useUnreadMessages({
  projectId,
  proposalId,
  currentUserId,
}: UseUnreadMessagesOptions) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) {
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    try {
      let query = supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("read", false)
        .neq("sender_id", currentUserId)

      if (proposalId) {
        query = query.eq("proposal_id", proposalId)
      } else {
        query = query.is("proposal_id", null)
      }

      const { count, error } = await query

      if (error) throw error

      setUnreadCount(count || 0)
    } catch (error) {
      console.error("Error fetching unread count:", error)
      setUnreadCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, proposalId, currentUserId, supabase])

  // Mark messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!currentUserId) return

    try {
      let query = supabase
        .from("chat_messages")
        .update({ read: true })
        .eq("project_id", projectId)
        .eq("read", false)
        .neq("sender_id", currentUserId)

      if (proposalId) {
        query = query.eq("proposal_id", proposalId)
      } else {
        query = query.is("proposal_id", null)
      }

      const { error } = await query
      
      if (error) throw error
      
      setUnreadCount(0)
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }, [projectId, proposalId, currentUserId, supabase])

  // Fetch unread count on mount and when dependencies change
  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  // Subscribe to new messages to update count
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`unread:${projectId}:${proposalId || "null"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newMessage = payload.new as any
          
          // Filter by proposal_id in callback since Supabase Realtime
          // doesn't support multiple filter conditions
          if (proposalId) {
            if (newMessage.proposal_id !== proposalId) return
          } else {
            if (newMessage.proposal_id !== null) return
          }
          
          // Only increment if message is from someone else
          if (newMessage.sender_id !== currentUserId) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any
          
          // Filter by proposal_id in callback
          if (proposalId) {
            if (updatedMessage.proposal_id !== proposalId) return
          } else {
            if (updatedMessage.proposal_id !== null) return
          }
          
          // Refetch count when messages are marked as read
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [projectId, proposalId, currentUserId, supabase, fetchUnreadCount])

  return {
    unreadCount,
    isLoading,
    markMessagesAsRead,
    refetch: fetchUnreadCount,
  }
}
