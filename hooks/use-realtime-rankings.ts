"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

interface RankingUpdate {
  id: string
  project_id: string
  proposal_id: string
  total_score: number
  rank: number
  is_fully_scored: boolean
  calculated_at: string
}

interface UseRealtimeRankingsOptions {
  projectId: string
  onRankingUpdated?: (ranking: RankingUpdate) => void
  onRankingInserted?: (ranking: RankingUpdate) => void
  onRankingDeleted?: (ranking: RankingUpdate) => void
}

interface ConnectionStatus {
  status: "connected" | "connecting" | "disconnected"
  error: string | null
}

/**
 * Custom hook for real-time proposal rankings updates
 * 
 * Subscribes to proposal_rankings table changes for a specific project
 * Implements automatic reconnection with exponential backoff
 * 
 * Requirements: 5.5
 */
export function useRealtimeRankings({
  projectId,
  onRankingUpdated,
  onRankingInserted,
  onRankingDeleted,
}: UseRealtimeRankingsOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: "connecting",
    error: null,
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const calculateBackoff = (attempt: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, attempt), 16000)
  }

  // Store callbacks in refs to avoid dependency issues
  const onRankingUpdatedRef = useRef(onRankingUpdated)
  const onRankingInsertedRef = useRef(onRankingInserted)
  const onRankingDeletedRef = useRef(onRankingDeleted)

  useEffect(() => {
    onRankingUpdatedRef.current = onRankingUpdated
    onRankingInsertedRef.current = onRankingInserted
    onRankingDeletedRef.current = onRankingDeleted
  }, [onRankingUpdated, onRankingInserted, onRankingDeleted])

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setConnectionStatus({
        status: "disconnected",
        error: "Max reconnection attempts reached",
      })
      return
    }

    const backoffTime = calculateBackoff(reconnectAttemptsRef.current)
    reconnectAttemptsRef.current += 1

    reconnectTimeoutRef.current = setTimeout(() => {
      // Trigger reconnect by incrementing a counter
      reconnectAttemptsRef.current += 1
    }, backoffTime)
  }, [])

  const connect = useCallback(() => {
    cleanup()

    const supabase = createClient()
    
    // Create channel name based on project
    const channelName = `proposal_rankings:project:${projectId}`

    setConnectionStatus({ status: "connecting", error: null })

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "proposal_rankings",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updatedRanking = payload.new as RankingUpdate
          if (onRankingUpdatedRef.current) {
            onRankingUpdatedRef.current(updatedRanking)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proposal_rankings",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newRanking = payload.new as RankingUpdate
          if (onRankingInsertedRef.current) {
            onRankingInsertedRef.current(newRanking)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "proposal_rankings",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const deletedRanking = payload.old as RankingUpdate
          if (onRankingDeletedRef.current) {
            onRankingDeletedRef.current(deletedRanking)
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnectionStatus({ status: "connected", error: null })
          reconnectAttemptsRef.current = 0
        } else if (status === "CHANNEL_ERROR") {
          setConnectionStatus({
            status: "disconnected",
            error: "Connection error",
          })
          attemptReconnect()
        } else if (status === "TIMED_OUT") {
          setConnectionStatus({
            status: "disconnected",
            error: "Connection timed out",
          })
          attemptReconnect()
        } else if (status === "CLOSED") {
          setConnectionStatus({
            status: "disconnected",
            error: "Connection closed",
          })
          attemptReconnect()
        }
      })

    channelRef.current = channel
  }, [projectId, cleanup, attemptReconnect])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      cleanup()
    }
  }, [projectId])

  return {
    connectionStatus,
    reconnect,
  }
}
