/**
 * Offline Warning Banner
 * 
 * Displays warnings and status information for offline editing.
 * Shows sync status, pending changes, and conflict notifications.
 * 
 * Requirements: 10.1, 10.2, 10.4, 10.5
 */

'use client'

import { AlertCircle, CloudOff, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConnectionStatus } from '@/lib/sync-service'

export interface OfflineWarningBannerProps {
  connectionStatus: ConnectionStatus
  hasPendingChanges: boolean
  isSynced: boolean
  conflictCount: number
  onSync?: () => void
  onViewConflicts?: () => void
  className?: string
}

/**
 * Offline Warning Banner Component
 * 
 * Displays appropriate warnings based on connection and sync status:
 * - Offline warning when disconnected
 * - Syncing indicator during sync
 * - Pending changes notification
 * - Conflict alerts
 */
export function OfflineWarningBanner({
  connectionStatus,
  hasPendingChanges,
  isSynced,
  conflictCount,
  onSync,
  onViewConflicts,
  className = '',
}: OfflineWarningBannerProps) {
  // Don't show banner if everything is fine
  if (
    connectionStatus === 'connected' &&
    isSynced &&
    !hasPendingChanges &&
    conflictCount === 0
  ) {
    return null
  }

  // Show conflict alert (highest priority)
  if (conflictCount > 0) {
    return (
      <Alert
        variant="destructive"
        className={`border-red-500 bg-red-50 dark:bg-red-950 ${className}`}
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="font-semibold">Sync Conflicts Detected</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'} found between
            your local changes and the server. Please resolve to continue.
          </span>
          {onViewConflicts && (
            <Button
              size="sm"
              variant="outline"
              onClick={onViewConflicts}
              className="ml-4 border-red-500 text-red-500 hover:bg-red-500/10"
            >
              View Conflicts
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Show syncing status
  if (connectionStatus === 'syncing') {
    return (
      <Alert className={`border-yellow-400 bg-yellow-50 dark:bg-yellow-950 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin text-yellow-400" />
        <AlertTitle className="font-semibold text-yellow-400">Syncing Changes</AlertTitle>
        <AlertDescription className="text-yellow-400">
          Synchronizing your changes with the server...
        </AlertDescription>
      </Alert>
    )
  }

  // Show offline warning
  if (connectionStatus === 'disconnected') {
    return (
      <Alert className={`border-yellow-400 bg-yellow-50 dark:bg-yellow-950 ${className}`}>
        <CloudOff className="h-4 w-4 text-yellow-400" />
        <AlertTitle className="font-semibold text-yellow-400">
          You're Offline
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between text-yellow-400">
          <span>
            Your changes are being saved locally and will sync when you're back online.
            {hasPendingChanges && (
              <Badge variant="secondary" className="ml-2 bg-yellow-400 text-black">
                {hasPendingChanges ? 'Pending Changes' : 'No Changes'}
              </Badge>
            )}
          </span>
          {onSync && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              className="ml-4 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry Sync
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Show reconnecting status
  if (connectionStatus === 'reconnecting') {
    return (
      <Alert className={`border-yellow-400 bg-yellow-50 dark:bg-yellow-950 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin text-yellow-400" />
        <AlertTitle className="font-semibold text-yellow-400">Reconnecting</AlertTitle>
        <AlertDescription className="text-yellow-400">
          Attempting to restore connection...
        </AlertDescription>
      </Alert>
    )
  }

  // Show pending changes notification
  if (hasPendingChanges && !isSynced) {
    return (
      <Alert className={`border-yellow-400 bg-yellow-50 dark:bg-yellow-950 ${className}`}>
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertTitle className="font-semibold text-yellow-400">
          Pending Changes
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between text-yellow-400">
          <span>You have unsaved changes that need to be synchronized.</span>
          {onSync && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              className="ml-4 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync Now
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

/**
 * Compact Offline Indicator
 * 
 * Minimal indicator for showing offline status in toolbars
 */
export function CompactOfflineIndicator({
  connectionStatus,
  hasPendingChanges,
  className = '',
}: {
  connectionStatus: ConnectionStatus
  hasPendingChanges: boolean
  className?: string
}) {
  if (connectionStatus === 'connected' && !hasPendingChanges) {
    return (
      <Badge
        variant="secondary"
        className={`bg-green-500 text-white hover:bg-green-600 ${className}`}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Synced
      </Badge>
    )
  }

  if (connectionStatus === 'syncing') {
    return (
      <Badge
        variant="secondary"
        className={`bg-yellow-400 text-black hover:bg-yellow-500 ${className}`}
      >
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Syncing
      </Badge>
    )
  }

  if (connectionStatus === 'disconnected') {
    return (
      <Badge
        variant="secondary"
        className={`bg-red-500 text-white hover:bg-red-600 ${className}`}
      >
        <CloudOff className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    )
  }

  if (connectionStatus === 'reconnecting') {
    return (
      <Badge
        variant="secondary"
        className={`bg-yellow-400 text-black hover:bg-yellow-500 ${className}`}
      >
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
        Reconnecting
      </Badge>
    )
  }

  if (hasPendingChanges) {
    return (
      <Badge
        variant="secondary"
        className={`bg-yellow-400 text-black hover:bg-yellow-500 ${className}`}
      >
        <AlertCircle className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    )
  }

  return null
}

