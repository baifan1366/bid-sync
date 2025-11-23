/**
 * Conflict Resolution Dialog
 * 
 * Displays sync conflicts and allows users to choose which version to keep.
 * Shows both local and server versions side-by-side for comparison.
 * Logs conflicts for audit purposes and notifies users.
 * 
 * Requirements: 3.3, 3.5
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, FileText, Server, Laptop, AlertCircle, Info } from 'lucide-react'
import { SyncConflict } from '@/lib/sync-service'
import { JSONContent } from '@/types/document'
import { useToast } from '@/components/ui/use-toast'
import { errorLogger } from '@/lib/error-logger'

export interface ConflictResolutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: SyncConflict[]
  onResolve: (conflictId: string, resolvedContent: JSONContent) => Promise<void>
  onResolveAll?: (resolution: 'local' | 'server') => Promise<void>
  documentId?: string
  userId?: string
}

/**
 * Conflict Resolution Dialog Component
 * 
 * Allows users to:
 * - View conflicts side-by-side with visual diff indicators
 * - Choose local or server version
 * - Resolve individual conflicts
 * - Resolve all conflicts at once
 * - Logs all conflicts for audit trail
 * - Notifies users of conflict resolution status
 */
export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
  onResolveAll,
  documentId,
  userId,
}: ConflictResolutionDialogProps) {
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<'local' | 'server' | null>(null)
  const { toast } = useToast()

  const currentConflict = conflicts[currentConflictIndex]

  // Log conflict when dialog opens
  useEffect(() => {
    if (open && conflicts.length > 0) {
      conflicts.forEach(conflict => {
        errorLogger.warn('Sync conflict detected', {
          operation: 'conflict_detection',
          documentId: conflict.documentId,
          conflictId: conflict.id,
          timestamp: conflict.timestamp,
          userId,
        })
      })

      // Notify user about conflicts
      toast({
        title: 'Sync Conflict Detected',
        description: `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} need${conflicts.length === 1 ? 's' : ''} your attention`,
        variant: 'destructive',
      })
    }
  }, [open, conflicts, userId, toast])

  const handleResolve = async (version: 'local' | 'server') => {
    if (!currentConflict || resolving) return

    setResolving(true)
    try {
      const resolvedContent =
        version === 'local' ? currentConflict.localVersion : currentConflict.serverVersion

      await onResolve(currentConflict.id, resolvedContent)

      // Log conflict resolution
      errorLogger.info('Conflict resolved', {
        operation: 'conflict_resolution',
        documentId: currentConflict.documentId,
        conflictId: currentConflict.id,
        resolution: version,
        userId,
        timestamp: new Date().toISOString(),
      })

      // Notify user of successful resolution
      toast({
        title: 'Conflict Resolved',
        description: `Kept ${version === 'local' ? 'your local' : 'server'} version`,
      })

      // Move to next conflict or close dialog
      if (currentConflictIndex < conflicts.length - 1) {
        setCurrentConflictIndex(currentConflictIndex + 1)
        setSelectedVersion(null)
      } else {
        onOpenChange(false)
        setCurrentConflictIndex(0)
        setSelectedVersion(null)
        
        // Final success notification
        toast({
          title: 'All Conflicts Resolved',
          description: 'Your document is now synchronized',
        })
      }
    } catch (error) {
      // Log resolution error
      errorLogger.error('Failed to resolve conflict', error as Error, {
        operation: 'conflict_resolution_error',
        documentId: currentConflict.documentId,
        conflictId: currentConflict.id,
        resolution: version,
        userId,
      })

      toast({
        title: 'Resolution Failed',
        description: 'Failed to resolve conflict. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setResolving(false)
    }
  }

  const handleResolveAll = async (resolution: 'local' | 'server') => {
    if (!onResolveAll || resolving) return

    setResolving(true)
    try {
      await onResolveAll(resolution)

      // Log bulk resolution
      errorLogger.info('All conflicts resolved', {
        operation: 'bulk_conflict_resolution',
        documentId: documentId || currentConflict?.documentId,
        conflictCount: conflicts.length,
        resolution,
        userId,
        timestamp: new Date().toISOString(),
      })

      toast({
        title: 'All Conflicts Resolved',
        description: `Kept all ${resolution === 'local' ? 'local' : 'server'} versions`,
      })

      onOpenChange(false)
      setCurrentConflictIndex(0)
      setSelectedVersion(null)
    } catch (error) {
      // Log bulk resolution error
      errorLogger.error('Failed to resolve all conflicts', error as Error, {
        operation: 'bulk_conflict_resolution_error',
        documentId: documentId || currentConflict?.documentId,
        conflictCount: conflicts.length,
        resolution,
        userId,
      })

      toast({
        title: 'Resolution Failed',
        description: 'Failed to resolve all conflicts. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setResolving(false)
    }
  }

  if (!currentConflict) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <DialogTitle>Resolve Sync Conflict</DialogTitle>
          </div>
          <DialogDescription>
            Your local changes conflict with changes on the server. Choose which version to
            keep.
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Info Alert */}
        <Alert className="border-yellow-400/20 bg-yellow-400/10">
          <Info className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-sm">
            <strong>Conflict ID:</strong> {currentConflict.id.split('-').pop()}<br />
            <strong>Detected:</strong> {new Date(currentConflict.timestamp).toLocaleString()}<br />
            <strong>Document:</strong> {currentConflict.documentId}
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between py-2">
          <Badge variant="secondary" className="bg-yellow-400 text-black">
            Conflict {currentConflictIndex + 1} of {conflicts.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {new Date(currentConflict.timestamp).toLocaleString()}
          </span>
        </div>

        <Tabs defaultValue="comparison" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comparison">
              <FileText className="h-4 w-4 mr-2" />
              Comparison
            </TabsTrigger>
            <TabsTrigger value="local">
              <Laptop className="h-4 w-4 mr-2" />
              Your Version
            </TabsTrigger>
            <TabsTrigger value="server">
              <Server className="h-4 w-4 mr-2" />
              Server Version
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Local Version */}
              <div className="flex flex-col border border-yellow-400/20 rounded-lg overflow-hidden">
                <div className="bg-yellow-400/10 px-4 py-2 border-b border-yellow-400/20">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-yellow-400" />
                    <span className="font-semibold text-sm">Your Local Version</span>
                    <Badge variant="outline" className="ml-auto text-xs border-yellow-400 text-yellow-400">
                      Modified locally
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-xs whitespace-pre-wrap wrap-break-word font-mono">
                    {JSON.stringify(currentConflict.localVersion, null, 2)}
                  </pre>
                </ScrollArea>
              </div>

              {/* Server Version */}
              <div className="flex flex-col border border-yellow-400/20 rounded-lg overflow-hidden">
                <div className="bg-yellow-400/10 px-4 py-2 border-b border-yellow-400/20">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-yellow-400" />
                    <span className="font-semibold text-sm">Server Version</span>
                    <Badge variant="outline" className="ml-auto text-xs border-yellow-400 text-yellow-400">
                      Modified on server
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <pre className="text-xs whitespace-pre-wrap wrap-break-word font-mono">
                    {JSON.stringify(currentConflict.serverVersion, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="local" className="flex-1 min-h-0">
            <ScrollArea className="h-full border border-yellow-400/20 rounded-lg p-4">
              <pre className="text-xs whitespace-pre-wrap wrap-break-word font-mono">
                {JSON.stringify(currentConflict.localVersion, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="server" className="flex-1 min-h-0">
            <ScrollArea className="h-full border border-yellow-400/20 rounded-lg p-4">
              <pre className="text-xs whitespace-pre-wrap wrap-break-word font-mono">
                {JSON.stringify(currentConflict.serverVersion, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Conflict Warning */}
        <Alert className="border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm">
            <strong>Warning:</strong> Choosing a version will discard the other. Make sure you review both versions carefully before proceeding.
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {conflicts.length > 1 && onResolveAll && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleResolveAll('local')}
                  disabled={resolving}
                  className="flex-1 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                >
                  Keep All Local
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleResolveAll('server')}
                  disabled={resolving}
                  className="flex-1 border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                >
                  Keep All Server
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve('local')}
              disabled={resolving}
              className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              <Laptop className="h-4 w-4 mr-2" />
              Keep Local
            </Button>
            <Button
              onClick={() => handleResolve('server')}
              disabled={resolving}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <Server className="h-4 w-4 mr-2" />
              Keep Server
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
