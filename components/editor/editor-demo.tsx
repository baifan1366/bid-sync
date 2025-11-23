'use client'

import { useState } from 'react'
import { CollaborativeEditor } from './collaborative-editor'
import { JSONContent } from '@tiptap/core'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Demo component to showcase the TipTap editor functionality
 * This can be used for testing and demonstration purposes
 */
export function EditorDemo() {
  const [content, setContent] = useState<JSONContent | null>(null)

  const handleSave = async (newContent: JSONContent) => {
    console.log('Saving content:', newContent)
    setContent(newContent)
    // In a real application, this would save to the database
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Collaborative Proposal Editor
          </CardTitle>
          <CardDescription>
            A rich text editor with formatting, tables, task lists, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CollaborativeEditor
            documentId="demo-document"
            placeholder="Start writing your proposal here..."
            onSave={handleSave}
            autoSave={true}
            autoSaveDelay={2000}
            showToolbar={true}
          />

          {/* Debug output */}
          {content && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">
                Document Content (JSON):
              </h3>
              <pre className="bg-black dark:bg-white/5 text-white p-4 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(content, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature List */}
      <Card className="mt-8 border-yellow-400/20">
        <CardHeader>
          <CardTitle>Editor Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-yellow-400">
                Text Formatting
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Bold, Italic, Strikethrough</li>
                <li>Inline code</li>
                <li>Headings (H1-H6)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-yellow-400">
                Lists
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Bullet lists</li>
                <li>Ordered lists</li>
                <li>Task lists with checkboxes</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-yellow-400">
                Block Elements
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Blockquotes</li>
                <li>Code blocks</li>
                <li>Horizontal rules</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-yellow-400">
                Advanced Features
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Tables with resizable columns</li>
                <li>Undo/Redo history</li>
                <li>Auto-save functionality</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
