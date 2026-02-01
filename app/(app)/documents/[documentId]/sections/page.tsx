/**
 * Section-Based Document Editor Page
 * 
 * Tab-based collaborative editor where each section is a separate tab.
 * Bidding leads can assign sections to team members.
 * Each section supports comments and attachments.
 */

import { SectionBasedEditorClient } from '@/components/editor/section-based-editor-client'

interface SectionEditorPageProps {
  params: Promise<{
    documentId: string
  }>
}

export default async function SectionEditorPage({ params }: SectionEditorPageProps) {
  const { documentId } = await params
  return <SectionBasedEditorClient documentId={documentId} />
}
