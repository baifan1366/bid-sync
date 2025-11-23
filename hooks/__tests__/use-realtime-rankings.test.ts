import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRealtimeRankings } from '../use-realtime-rankings'

// Mock Supabase client
const mockUnsubscribe = vi.fn()
const mockSubscribe = vi.fn()
const mockOn = vi.fn()
const mockChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: mockChannel,
  }),
}))

describe('useRealtimeRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock chain
    mockOn.mockReturnThis()
    mockSubscribe.mockImplementation((callback) => {
      // Simulate successful subscription
      setTimeout(() => callback('SUBSCRIBED'), 0)
      return { unsubscribe: mockUnsubscribe }
    })
    mockChannel.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should initialize with connecting status', () => {
    const { result } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    expect(result.current.connectionStatus.status).toBe('connecting')
  })

  it('should transition to connected status on successful subscription', async () => {
    const { result } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    await waitFor(() => {
      expect(result.current.connectionStatus.status).toBe('connected')
    })
  })

  it('should create channel with correct name', () => {
    const projectId = 'test-project-123'
    
    renderHook(() =>
      useRealtimeRankings({
        projectId,
      })
    )

    expect(mockChannel).toHaveBeenCalledWith(`proposal_rankings:project:${projectId}`)
  })

  it('should subscribe to UPDATE events', () => {
    renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'proposal_rankings',
      }),
      expect.any(Function)
    )
  })

  it('should subscribe to INSERT events', () => {
    renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'proposal_rankings',
      }),
      expect.any(Function)
    )
  })

  it('should subscribe to DELETE events', () => {
    renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'DELETE',
        schema: 'public',
        table: 'proposal_rankings',
      }),
      expect.any(Function)
    )
  })

  it('should call onRankingUpdated when UPDATE event occurs', async () => {
    const onRankingUpdated = vi.fn()
    let updateCallback: any

    const mockChannelInstance = {
      on: vi.fn().mockImplementation((event, config, callback) => {
        if (config.event === 'UPDATE') {
          updateCallback = callback
        }
        return mockChannelInstance
      }),
      subscribe: vi.fn().mockImplementation((callback) => {
        setTimeout(() => callback('SUBSCRIBED'), 0)
        return { unsubscribe: mockUnsubscribe }
      }),
      unsubscribe: mockUnsubscribe,
    }

    mockChannel.mockReturnValue(mockChannelInstance)

    renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
        onRankingUpdated,
      })
    )

    await waitFor(() => {
      expect(updateCallback).toBeDefined()
    })

    // Simulate UPDATE event
    const mockRanking = {
      id: 'ranking-1',
      project_id: 'test-project-id',
      proposal_id: 'proposal-1',
      total_score: 85.5,
      rank: 1,
      is_fully_scored: true,
      calculated_at: new Date().toISOString(),
    }

    updateCallback({ new: mockRanking })

    expect(onRankingUpdated).toHaveBeenCalledWith(mockRanking)
  })

  it('should cleanup subscription on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('should provide reconnect function', () => {
    const { result } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    expect(typeof result.current.reconnect).toBe('function')
  })

  it('should handle connection errors', async () => {
    mockSubscribe.mockImplementation((callback) => {
      setTimeout(() => callback('CHANNEL_ERROR'), 0)
      return { unsubscribe: mockUnsubscribe }
    })

    const { result } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    await waitFor(() => {
      expect(result.current.connectionStatus.status).toBe('disconnected')
      expect(result.current.connectionStatus.error).toBe('Connection error')
    })
  })

  it('should handle timeout errors', async () => {
    mockSubscribe.mockImplementation((callback) => {
      setTimeout(() => callback('TIMED_OUT'), 0)
      return { unsubscribe: mockUnsubscribe }
    })

    const { result } = renderHook(() =>
      useRealtimeRankings({
        projectId: 'test-project-id',
      })
    )

    await waitFor(() => {
      expect(result.current.connectionStatus.status).toBe('disconnected')
      expect(result.current.connectionStatus.error).toBe('Connection timed out')
    })
  })
})
