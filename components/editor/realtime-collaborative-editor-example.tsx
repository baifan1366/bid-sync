/**
 * Realtime Collaborative Editor Example
 * 
 * Example implementation showing how to integrate:
 * - TipTap editor
 * - Yjs CRDT synchronization
 * - Supabase Realtime for presence and cursors
 * - Connection status monitoring
 * 
 * This is a reference implementation demonstrating the complete integration.
 * 
 * Requirements: 3.1, 3.2, 3.4, 9.1, 9.2, 10.4
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useRealtimeDocument } from '@/hooks/use-realtime-document'
import { ConnectionStatusIndicator } from './connection-status-indicator'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export interface RealtimeCollaborativeEditorExampleProps {
  documentId: string
  userId: string
  userName: string
  userColor: string
  initialContent?: any
  onSave?: (content: any) => void
}

/**
 * Realtime Collaborative Editor Example
 * 
 * This component demonstrates the complete integration of:
 * 1. TipTap editor for rich text editing
 * 2. Yjs for CRDT-based document synchronization
 * 3. Supabase Realtime for presence and cursor tracking
 * 4. Connection status monitoring
 */
export function RealtimeCollaborativeEditorExample({
  documentId,
  userId,
  userName,
  userColor,
  initialContent,
  onSave,
}: RealtimeCollaborativeEditorExampleProps) {
  const [ydoc] = useState(() => new Y.Doc())
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)

  // Set up Realtime integration for presence and notifications
  const {
    connectionStatus,
    activeUsers,
    broadcastCursor,
    broadcastPresence,
    reconnect,
  } = useRealtimeDocument({
    documentId,
    userId,
    userName,
    userColor,
    enabled: true,
    onUserJoined: (payload) => {
      console.log('User joined:', payload.userName)
    },
    onUserLeft: (payload) => {
      console.log('User left:', payload.userId)
    },
    onRollback: (payload) => {
      console.log('Document rolled back to version:', payload.versionNumber)
      // Optionally reload the document or show a notification
    },
  })

  // Set up Yjs WebSocket provider
  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL || 'ws://localhost:1234',
      documentId,
      ydoc,
      {
        connect: true,
      }
    )

    setProvider(wsProvider)

    return () => {
      wsProvider.disconnect()
      wsProvider.destroy()
    }
  }, [documentId, ydoc])

  // Set up TipTap editor with Yjs collaboration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[400px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      // Broadcast cursor position via Realtime
      const { from, to } = editor.state.selection
      broadcastCursor({ from, to }).catch(console.error)

      // Update presence to active
      broadcastPresence('active').catch(console.error)
    },
  })

  // Handle idle detection
  useEffect(() => {
    let idleTimeout: NodeJS.Timeout

    const resetIdleTimer = () => {
      clearTimeout(idleTimeout)
      broadcastPresence('active').catch(console.error)

      idleTimeout = setTimeout(() => {
        broadcastPresence('idle').catch(console.error)
      }, 60000) // 1 minute
    }

    const handleActivity = () => {
      resetIdleTimer()
    }

    // Listen for user activity
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)

    resetIdleTimer()

    return () => {
      clearTimeout(idleTimeout)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
    }
  }, [broadcastPresence])

  // Handle save
  const handleSave = useCallback(() => {
    if (editor && onSave) {
      const content = editor.getJSON()
      onSave(content)
    }
  }, [editor, onSave])

  return (
    <div className="space-y-4">
      {/* Header with connection status and active users */}
      <Card className="p-4 border-yellow-400/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ConnectionStatusIndicator
              status={connectionStatus}
              onReconnect={reconnect}
            />

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Active users:
              </span>
              <div className="flex -space-x-2">
                {Array.from(activeUsers.values()).map((user) => (
                  <Avatar
                    key={user.userId}
                    className="h-8 w-8 border-2 border-white dark:border-black"
                    style={{ borderColor: user.userColor }}
                  >
                    <AvatarFallback
                      style={{ backgroundColor: user.userColor }}
                      className="text-white text-xs"
                    >
                      {user.userName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <Badge variant="secondary" className="ml-2">
                {activeUsers.size}
              </Badge>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-md text-sm font-medium"
          >
            Save
          </button>
        </div>
      </Card>

      {/* Editor */}
      <Card className="border-yellow-400/20">
        <EditorContent editor={editor} />
      </Card>

      {/* Active users list */}
      <Card className="p-4 border-yellow-400/20">
        <h3 className="text-sm font-medium mb-2">Active Collaborators</h3>
        <div className="space-y-2">
          {Array.from(activeUsers.values()).map((user) => (
            <div
              key={user.userId}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: user.userColor }}
              />
              <span>{user.userName}</span>
              <Badge
                variant="secondary"
                className="ml-auto text-xs"
              >
                {user.status}
              </Badge>
            </div>
          ))}
          {activeUsers.size === 0 && (
            <p className="text-sm text-muted-foreground">
              No other users currently editing
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
