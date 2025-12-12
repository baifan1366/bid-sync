/**
 * Collaborative Editor Demo
 * 
 * Example component demonstrating how to use the CollaborativeEditor
 * with Supabase Realtime for real-time collaboration.
 * 
 * This is a reference implementation showing:
 * - How to enable collaboration mode
 * - How to configure user information
 * - How to handle connection status
 * - How to display active collaborators
 */

'use client'

import { useState } from 'react'
import { CollaborativeEditor } from './collaborative-editor'
import { JSONContent } from '@tiptap/core'

export function CollaborativeEditorDemo() {
  const [content, setContent] = useState<JSONContent>({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Collaborative Proposal Editor' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is a demo of the collaborative editor with Supabase Realtime integration. Multiple users can edit this document simultaneously and see each other\'s changes in real-time.',
          },
        ],
      },
    ],
  })

  // In a real application, these would come from your auth system
  const userId = 'demo-user-' + Math.random().toString(36).substring(7)
  const userName = 'Demo User'
  const userColor = '#' + Math.floor(Math.random() * 16777215).toString(16)

  const handleSave = async (newContent: JSONContent) => {
    console.log('Saving content:', newContent)
    setContent(newContent)
    // In a real application, you would save to your database here
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Collaborative Editor Demo</h1>
        <p className="text-muted-foreground">
          This demo shows the editor with Supabase Realtime collaboration enabled.
        </p>
      </div>

      {/* Non-collaborative mode */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Standard Mode (No Collaboration)</h2>
        <CollaborativeEditor
          documentId="demo-doc-standard"
          initialContent={content}
          onSave={handleSave}
          autoSave={true}
          collaborationEnabled={false}
        />
      </div>

      {/* Collaborative mode */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Collaborative Mode (With Supabase Realtime)</h2>
        <div className="mb-4 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-md">
          <p className="text-sm">
            <strong>Note:</strong> To test collaboration:
          </p>
          <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
            <li>Ensure Supabase Realtime is enabled in your project</li>
            <li>Open this page in multiple browser windows</li>
            <li>Edit the document and see changes sync in real-time</li>
          </ol>
        </div>
        <CollaborativeEditor
          documentId="demo-doc-collaborative"
          initialContent={content}
          onSave={handleSave}
          autoSave={false}
          collaborationEnabled={true}
          userId={userId}
          userName={userName}
          userColor={userColor}
        />
      </div>

      {/* User info */}
      <div className="mt-8 p-4 bg-muted rounded-md">
        <h3 className="font-semibold mb-2">Your Session Info</h3>
        <div className="text-sm space-y-1">
          <p>
            <strong>User ID:</strong> {userId}
          </p>
          <p>
            <strong>User Name:</strong> {userName}
          </p>
          <p>
            <strong>User Color:</strong>{' '}
            <span
              className="inline-block w-4 h-4 rounded"
              style={{ backgroundColor: userColor }}
            />
            {' ' + userColor}
          </p>
        </div>
      </div>
    </div>
  )
}
