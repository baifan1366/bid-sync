/**
 * Collaborative Editor Page (Server Component Wrapper)
 * 
 * Main page for editing proposal documents with real-time collaboration.
 */

import { CollaborativeEditorPage } from '@/components/editor/collaborative-editor-page'

interface EditorPageProps {
  params: Promise<{
    documentId: string
  }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { documentId } = await params
  return <CollaborativeEditorPage documentId={documentId} />
}
