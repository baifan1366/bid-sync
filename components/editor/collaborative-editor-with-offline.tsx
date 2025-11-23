/**
 * Collaborative Editor with Full Offline Support
 * 
 * Complete example demonstrating all offline support features:
 * - Connection status indicator
 * - Offline warning banner
 * - Conflict resolution dialog
 * - Manual sync trigger
 * - Pending changes indicator
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { CollaborativeEditor } from './collaborative-editor'
import { ConnectionStatusIndicator } from './connection-status-indicator'
import { OfflineWarningBanner } from './offline-warning-banner'
import { ConflictResolutionDialog } from './conflict-resolution-dialog'
import { useSyncService } from '@/hooks/use-sync-service'
import { JSONContent } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CollaborativeEditorWithOfflineProps {
  documentId: string
  initialContent?: JSONContent | string
  userId?: string
  userName?: string
  userColor?: string
  onSave?: (content: JSONContent) => void | Promise<void>
  editable?: boolean
  className?: string
}

/**
 * Collaborative Editor with Offline Support Component
 * 
 * Demonstrates complete offline support integration:
 * - Displays connection status
 * - Shows offline warnings
 * - Handles conflict resolution
 * - Provides manual sync
 * - Caches changes locally
 */
export function CollaborativeEditorWithOffline({
  documentId,
  initialContent,
  userId = 'demo-user',
  userName = 'Demo User',
  userColor = '#4ECDC4',
  onSave,
  editable = true,
  className,
}: CollaborativeEditorWithOfflineProps) {
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [content, setContent] = useState<JSONContent | undefined>(
    typeof initialContent === 'string' ? undefined : initialContent
  )

  // Set up sync service
  const syncService = useSyncService({
    documentId,
    enabled: true,
    autoSync: true,
  })

  // Show conflict dialog when conflicts are detected
  useEffect(() => {
    if (syncService.conflicts.length > 0 && !showConflictDialog) {
      setShowConflictDialog(true)
    }
  }, [syncService.conflicts.length, showConflictDialog])

  // Cache content when it changes
  const handleContentChange = useCallback(
    async (newContent: JSONContent) => {
      setContent(newContent)
      
      // Cache locally for offline support
      await syncService.cacheDocument(newContent)

      // Call parent save handler
      if (onSave) {
        await onSave(newContent)
      }
    },
    [syncService, onSave]
  )

  // Handle manual sync
  const handleManualSync = useCallback(async () => {
    try {
      await syncService.sync(async (changes) => {
        // In a real implementation, this would send changes to the server
        // For demo purposes, we'll simulate a successful sync
        console.log('Syncing changes:', changes)
        return { success: true }
      })
    } catch (error) {
      console.error('Failed to sync changes:', error)
    }
  }, [syncService])

  // Handle conflict resolution
  const handleResolveConflict = useCallback(
    async (conflictId: string, resolvedContent: JSONContent) => {
      await syncService.resolveConflict(conflictId, resolvedContent)
      setContent(resolvedContent)
    },
    [syncService]
  )

  // Handle resolve all conflicts
  const handleResolveAllConflicts = useCallback(
    async (resolution: 'local' | 'server') => {
      for (const conflict of syncService.conflicts) {
        const resolvedContent =
          resolution === 'local' ? conflict.localVersion : conflict.serverVersion
        await syncService.resolveConflict(conflict.id, resolvedContent)
      }

      // Update content with last resolved version
      if (syncService.conflicts.length > 0) {
        const lastConflict = syncService.conflicts[syncService.conflicts.length - 1]
        const resolvedContent =
          resolution === 'local' ? lastConflict.localVersion : lastConflict.serverVersion
        setContent(resolvedContent)
      }

      setShowConflictDialog(false)
    },
    [syncService]
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Status Bar */}
      <Card className="border-yellow-400/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <ConnectionStatusIndicator
              status={
                syncService.connectionStatus === 'syncing'
                  ? 'connecting'
                  : syncService.connectionStatus === 'reconnecting'
                  ? 'connecting'
                  : syncService.connectionStatus
              }
              onReconnect={() => window.location.reload()}
            />

            {/* Sync Status */}
            {syncService.isSynced && syncService.connectionStatus === 'connected' && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                All Changes Synced
              </Badge>
            )}

            {syncService.hasPendingChanges && (
              <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                {syncService.hasPendingChanges ? 'Pending Changes' : 'No Pending Changes'}
              </Badge>
            )}

            {syncService.conflicts.length > 0 && (
              <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                <AlertCircle className="h-3 w-3 mr-1" />
                {syncService.conflicts.length} Conflict(s)
              </Badge>
            )}
          </div>

          {/* Manual Sync Button */}
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSync}
              disabled={
                syncService.connectionStatus === 'syncing' ||
                syncService.connectionStatus === 'disconnected'
              }
              className="border-yellow-400/20"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 mr-2',
                  syncService.connectionStatus === 'syncing' && 'animate-spin'
                )}
              />
              Sync Now
            </Button>
          )}
        </div>
      </Card>

      {/* Offline Warning Banner */}
      <OfflineWarningBanner
        connectionStatus={syncService.connectionStatus}
        hasPendingChanges={syncService.hasPendingChanges}
        isSynced={syncService.isSynced}
        conflictCount={syncService.conflicts.length}
        onSync={handleManualSync}
        onViewConflicts={() => setShowConflictDialog(true)}
      />

      {/* Editor */}
      <CollaborativeEditor
        documentId={documentId}
        initialContent={content || initialContent}
        placeholder="Start writing your proposal..."
        editable={editable}
        onSave={handleContentChange}
        autoSave={true}
        autoSaveDelay={2000}
        showToolbar={true}
        collaborationEnabled={true}
        userId={userId}
        userName={userName}
        userColor={userColor}
      />

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={syncService.conflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
      />
    </div>
  )
}
