/**
 * Collaborative Editor Page
 * 
 * Main page for editing proposal documents with real-time collaboration.
 * Integrates TipTap editor with Yjs for collaborative editing.
 * 
 * Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { CollaborativeEditorPage } from '@/components/editor/collaborative-editor-page'

interface EditorPageProps {
  params: {
    documentId: string
  }
}

export default function EditorPage({ params }: EditorPageProps) {
  return <CollaborativeEditorPage documentId={params.documentId} />
}
