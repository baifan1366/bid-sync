"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"

interface ProposalUpdate {
  id: string
  project_id: string
  status: string
  submitted_at: string | null
  updated_at: string
}

interface UseRealtimeProposalsOptions {
  projectId: string
  onProposalUpdated?: (proposal: ProposalUpdate) => void
  onProposalInserted?: (proposal: ProposalUpdate) => void
}

interface ConnectionStatus {
  status: "connected" | "connecting" | "disconnected"
  error: string | null
}

export function useRealtimeProposals({
  projectId,
  onProposalUpdated,
  onProposalInserted,
}: UseRealtimeProposalsOptions) {
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

  const connect = useCallback(() => {
    cleanup()

    const supabase = createClient()
    
    // Create channel name based on project
    const channelName = `proposals:project:${projectId}`

    setConnectionStatus({ status: "connecting", error: null })

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "proposals",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updatedProposal = payload.new as ProposalUpdate
          if (onProposalUpdated) {
            onProposalUpdated(updatedProposal)
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proposals",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newProposal = payload.new as ProposalUpdate
          if (onProposalInserted) {
            onProposalInserted(newProposal)
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
  }, [projectId, onProposalUpdated, onProposalInserted, cleanup])

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
      connect()
    }, backoffTime)
  }, [connect])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      cleanup()
    }
  }, [connect, cleanup])

  return {
    connectionStatus,
    reconnect,
  }
}
