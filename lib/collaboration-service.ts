/**
 * Collaboration Service
 * 
 * Manages real-time collaboration features including:
 * - Session management (join/leave)
 * - Active session tracking
 * - Cursor position broadcasting
 * - Presence status tracking (active, idle, away)
 * - Unique color assignment to collaborators
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { CollaborationSession } from '@/types/document'

/**
 * Validation Schemas
 */

const JoinSessionInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  userId: z.string().uuid('Invalid user ID'),
})

const LeaveSessionInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  userId: z.string().uuid('Invalid user ID'),
})

const BroadcastCursorInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  userId: z.string().uuid('Invalid user ID'),
  position: z.object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  }),
})

const BroadcastPresenceInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  userId: z.string().uuid('Invalid user ID'),
  presence: z.object({
    status: z.enum(['active', 'idle', 'away']),
    lastActivity: z.string(),
  }),
})

/**
 * Input and Output Types
 */

export interface JoinSessionInput {
  documentId: string
  userId: string
}

export interface LeaveSessionInput {
  sessionId: string
  userId: string
}

export interface BroadcastCursorInput {
  sessionId: string
  userId: string
  position: CursorPosition
}

export interface BroadcastPresenceInput {
  sessionId: string
  userId: string
  presence: UserPresence
}

export interface CursorPosition {
  from: number
  to: number
}

export interface UserPresence {
  status: 'active' | 'idle' | 'away'
  lastActivity: string
}

export interface ActiveUser {
  userId: string
  userName: string
  userColor: string
  cursorPosition?: CursorPosition
  lastActive: string
}

export interface CollaborationServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Predefined color palette for collaborators
 * Using distinct, accessible colors
 */
const COLLABORATOR_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Orange
  '#52B788', // Green
  '#E76F51', // Coral
  '#2A9D8F', // Dark Teal
  '#E9C46A', // Gold
  '#F4A261', // Sandy Brown
  '#264653', // Dark Blue
]

/**
 * Collaboration Service Class
 * Manages all real-time collaboration operations
 */
export class CollaborationService {
  /**
   * Join a collaboration session
   * Creates a new session entry and assigns a unique color
   * 
   * @param input - Session join parameters
   * @returns Created session or error
   */
  async joinSession(
    input: JoinSessionInput
  ): Promise<CollaborationServiceResult<CollaborationSession>> {
    try {
      // Validate input
      const validated = JoinSessionInputSchema.parse(input)

      const supabase = await createClient()

      // Check if user has access to the document
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.userId,
          p_required_role: 'viewer'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to join collaboration session',
        }
      }

      // Check if user already has an active session
      const { data: existingSession } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.userId)
        .maybeSingle()

      if (existingSession) {
        // Update existing session to mark as active
        const { data: updatedSession, error: updateError } = await supabase
          .from('collaboration_sessions')
          .update({
            presence_status: 'active',
            last_activity: new Date().toISOString(),
          })
          .eq('id', existingSession.id)
          .select()
          .single()

        if (updateError || !updatedSession) {
          console.error('Failed to update existing session:', updateError)
          return {
            success: false,
            error: updateError?.message || 'Failed to rejoin session',
          }
        }

        // Get user details
        const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)
        const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous'

        const result: CollaborationSession = {
          id: updatedSession.id,
          documentId: updatedSession.document_id,
          userId: updatedSession.user_id,
          userName,
          userColor: updatedSession.user_color,
          cursorPosition: updatedSession.cursor_position as CursorPosition | undefined,
          presenceStatus: updatedSession.presence_status as 'active' | 'idle' | 'away',
          lastActivity: updatedSession.last_activity,
          joinedAt: updatedSession.joined_at,
        }

        // Note: Broadcast join event is handled by the client-side
        // RealtimeDocumentService when the user subscribes to the document

        return {
          success: true,
          data: result,
        }
      }

      // Get all active sessions to determine used colors
      const { data: activeSessions } = await supabase
        .from('collaboration_sessions')
        .select('user_color')
        .eq('document_id', validated.documentId)

      // Assign a unique color
      const usedColors = new Set((activeSessions || []).map(s => s.user_color))
      const availableColor = this.assignUniqueColor(usedColors)

      // Get user details
      const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)
      const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous'

      // Create new session
      const { data: session, error: createError } = await supabase
        .from('collaboration_sessions')
        .insert({
          document_id: validated.documentId,
          user_id: validated.userId,
          user_color: availableColor,
          presence_status: 'active',
          last_activity: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError || !session) {
        console.error('Failed to create session:', createError)
        return {
          success: false,
          error: `Failed to join session: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Note: Broadcast join event is handled by the client-side
      // RealtimeDocumentService when the user subscribes to the document

      // Transform database response to CollaborationSession type
      const result: CollaborationSession = {
        id: session.id,
        documentId: session.document_id,
        userId: session.user_id,
        userName,
        userColor: session.user_color,
        cursorPosition: session.cursor_position as CursorPosition | undefined,
        presenceStatus: session.presence_status as 'active' | 'idle' | 'away',
        lastActivity: session.last_activity,
        joinedAt: session.joined_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in joinSession:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Leave a collaboration session
   * Removes the session entry and broadcasts the leave event
   * 
   * @param input - Session leave parameters
   * @returns Success status or error
   */
  async leaveSession(
    input: LeaveSessionInput
  ): Promise<CollaborationServiceResult<boolean>> {
    try {
      // Validate input
      const validated = LeaveSessionInputSchema.parse(input)

      const supabase = await createClient()

      // Get session details before deletion
      const { data: session, error: sessionError } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('id', validated.sessionId)
        .eq('user_id', validated.userId)
        .single()

      if (sessionError || !session) {
        return {
          success: false,
          error: 'Session not found or access denied',
        }
      }

      // Delete session
      const { error: deleteError } = await supabase
        .from('collaboration_sessions')
        .delete()
        .eq('id', validated.sessionId)
        .eq('user_id', validated.userId)

      if (deleteError) {
        console.error('Failed to leave session:', deleteError)
        return {
          success: false,
          error: deleteError.message || 'Failed to leave session',
        }
      }

      // Note: Broadcast leave event is handled by the client-side
      // RealtimeDocumentService when the user unsubscribes from the document

      return {
        success: true,
        data: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in leaveSession:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get all active sessions for a document
   * Returns list of active users with their presence information
   * 
   * @param documentId - Document ID
   * @param userId - User ID for permission check
   * @returns Array of active users or error
   */
  async getActiveSessions(
    documentId: string,
    userId: string
  ): Promise<CollaborationServiceResult<ActiveUser[]>> {
    try {
      // Validate IDs
      z.string().uuid().parse(documentId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Check if user has access to the document
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: documentId,
          p_user_id: userId,
          p_required_role: 'viewer'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to view active sessions',
        }
      }

      // Get all active sessions (updated within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { data: sessions, error } = await supabase
        .from('collaboration_sessions')
        .select('*')
        .eq('document_id', documentId)
        .gte('last_activity', fiveMinutesAgo)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('Failed to get active sessions:', error)
        return {
          success: false,
          error: error.message || 'Failed to retrieve active sessions',
        }
      }

      // Transform to ActiveUser array with user details
      const results: ActiveUser[] = await Promise.all(
        (sessions || []).map(async (s) => {
          const { data: { user } } = await supabase.auth.admin.getUserById(s.user_id)
          const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous'

          return {
            userId: s.user_id,
            userName,
            userColor: s.user_color,
            cursorPosition: s.cursor_position as CursorPosition | undefined,
            lastActive: s.last_activity,
          }
        })
      )

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid document ID or user ID',
        }
      }

      console.error('Error in getActiveSessions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Broadcast cursor position to other collaborators
   * Updates the session with the new cursor position
   * 
   * @param input - Cursor broadcast parameters
   * @returns Success status or error
   */
  async broadcastCursorPosition(
    input: BroadcastCursorInput
  ): Promise<CollaborationServiceResult<boolean>> {
    try {
      // Validate input
      const validated = BroadcastCursorInputSchema.parse(input)

      const supabase = await createClient()

      // Update session with cursor position
      const { data: session, error: updateError } = await supabase
        .from('collaboration_sessions')
        .update({
          cursor_position: validated.position,
          last_activity: new Date().toISOString(),
        })
        .eq('id', validated.sessionId)
        .eq('user_id', validated.userId)
        .select('document_id')
        .single()

      if (updateError || !session) {
        console.error('Failed to update cursor position:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to broadcast cursor position',
        }
      }

      // Note: Broadcast cursor position is handled by the client-side
      // RealtimeDocumentService.broadcastCursorPosition method

      return {
        success: true,
        data: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in broadcastCursorPosition:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Broadcast presence status to other collaborators
   * Updates the session with the new presence status
   * 
   * @param input - Presence broadcast parameters
   * @returns Success status or error
   */
  async broadcastPresence(
    input: BroadcastPresenceInput
  ): Promise<CollaborationServiceResult<boolean>> {
    try {
      // Validate input
      const validated = BroadcastPresenceInputSchema.parse(input)

      const supabase = await createClient()

      // Update session with presence status
      const { data: session, error: updateError } = await supabase
        .from('collaboration_sessions')
        .update({
          presence_status: validated.presence.status,
          last_activity: validated.presence.lastActivity,
        })
        .eq('id', validated.sessionId)
        .eq('user_id', validated.userId)
        .select('document_id')
        .single()

      if (updateError || !session) {
        console.error('Failed to update presence:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to broadcast presence',
        }
      }

      // Note: Broadcast presence is handled by the client-side
      // RealtimeDocumentService.broadcastPresence method

      return {
        success: true,
        data: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in broadcastPresence:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Assign a unique color to a collaborator
   * Cycles through predefined colors, avoiding already used ones
   * 
   * @param usedColors - Set of colors already in use
   * @returns Unique color hex code
   */
  private assignUniqueColor(usedColors: Set<string>): string {
    // Find first available color
    for (const color of COLLABORATOR_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }

    // If all colors are used, return a random color from the palette
    // This handles cases with more than 15 concurrent users
    const randomIndex = Math.floor(Math.random() * COLLABORATOR_COLORS.length)
    return COLLABORATOR_COLORS[randomIndex]
  }
}
