/**
 * Server-side Realtime Helpers
 * 
 * Provides server-side utilities for broadcasting Realtime events.
 * These are used by server-side services that need to notify clients
 * of important events like rollbacks.
 * 
 * Requirements: 6.4, 9.2
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Broadcast rollback notification to all active collaborators
 * 
 * This is called from the server-side version control service
 * when a rollback operation is performed.
 * 
 * @param documentId - Document ID
 * @param versionId - Version ID that was restored
 * @param versionNumber - Version number
 * @param performedBy - User ID who performed the rollback
 * @param performedByName - User name
 */
export async function broadcastRollbackNotification(
  documentId: string,
  versionId: string,
  versionNumber: number,
  performedBy: string,
  performedByName: string
): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase
      .channel(`document:${documentId}`)
      .send({
        type: 'broadcast',
        event: 'rollback',
        payload: {
          documentId,
          versionId,
          versionNumber,
          performedBy,
          performedByName,
          timestamp: new Date().toISOString(),
        },
      })
  } catch (error) {
    console.error('Failed to broadcast rollback notification:', error)
    // Don't throw - rollback notification is not critical
  }
}

/**
 * Broadcast document update notification
 * 
 * This can be used by server-side services to notify clients
 * of document changes that happen outside of the editor.
 * 
 * @param documentId - Document ID
 * @param userId - User ID who made the update
 * @param userName - User name
 * @param content - Updated content
 */
export async function broadcastDocumentUpdate(
  documentId: string,
  userId: string,
  userName: string,
  content: any
): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase
      .channel(`document:${documentId}`)
      .send({
        type: 'broadcast',
        event: 'document_update',
        payload: {
          documentId,
          userId,
          userName,
          content,
          timestamp: new Date().toISOString(),
        },
      })
  } catch (error) {
    console.error('Failed to broadcast document update:', error)
    // Don't throw - notification is not critical
  }
}
