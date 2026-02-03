/**
 * Collaborative Editor Page (Server Component Wrapper)
 * 
 * Main page for editing proposal documents with real-time collaboration.
 */

import { Metadata } from 'next'
import { CollaborativeEditorPage } from '@/components/editor/collaborative-editor-page'

interface EditorPageProps {
  params: Promise<{
    documentId: string
  }>
}

export async function generateMetadata({ params }: EditorPageProps): Promise<Metadata> {
  const { documentId } = await params
  
  return {
    title: 'Document Editor | BidSync',
    description: 'Collaborate on proposal documents in real-time with your team',
    openGraph: {
      title: 'Document Editor | BidSync',
      description: 'Collaborate on proposal documents in real-time with your team',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Document Editor | BidSync',
      description: 'Collaborate on proposal documents in real-time with your team',
    },
  }
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { documentId } = await params
  return <CollaborativeEditorPage documentId={documentId} />
}
