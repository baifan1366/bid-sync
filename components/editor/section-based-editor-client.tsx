'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { SectionTabsEditor, type DocumentSection } from './section-tabs-editor'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

interface SectionBasedEditorClientProps {
  documentId: string
}

export function SectionBasedEditorClient({ documentId }: SectionBasedEditorClientProps) {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [isLead, setIsLead] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documentTitle, setDocumentTitle] = useState('')

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [documentId, user?.id])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()

      // Load document info
      const { data: doc, error: docError } = await supabase
        .from('workspace_documents')
        .select('title, workspace_id, workspaces!inner(project_id)')
        .eq('id', documentId)
        .single()

      if (docError || !doc) {
        throw new Error('Document not found')
      }

      setDocumentTitle(doc.title)

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', documentId)
        .order('order', { ascending: true })

      if (sectionsError) {
        console.error('Error loading sections:', sectionsError)
      }

      // Load comment and attachment counts for each section
      const sectionsWithCounts = await Promise.all(
        (sectionsData || []).map(async (section) => {
          // Get unresolved comments count
          const { count: commentsCount } = await supabase
            .from('section_comments')
            .select('*', { count: 'exact', head: true })
            .eq('section_id', section.id)
            .eq('is_resolved', false)

          // Get attachments count
          const { count: attachmentsCount } = await supabase
            .from('section_attachments')
            .select('*', { count: 'exact', head: true })
            .eq('section_id', section.id)

          return {
            id: section.id,
            documentId: section.document_id,
            title: section.title,
            order: section.order,
            status: section.status,
            assignedTo: section.assigned_to,
            deadline: section.deadline,
            content: section.content,
            createdAt: section.created_at,
            updatedAt: section.updated_at,
            unresolvedCommentsCount: commentsCount || 0,
            attachmentsCount: attachmentsCount || 0,
          }
        })
      )

      setSections(sectionsWithCounts)

      // Get workspace to find proposal
      const workspace = doc.workspaces as any

      // Get proposal for this project
      const { data: proposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('project_id', workspace.project_id)
        .single()

      if (proposal) {
        // Get team members
        const { data: members } = await supabase
          .from('proposal_team_members')
          .select(`
            user_id,
            role,
            users:user_id (
              id,
              raw_user_meta_data
            )
          `)
          .eq('proposal_id', proposal.id)

        if (members) {
          const teamMembersList = members.map((member: any) => ({
            id: member.user_id,
            name: member.users?.raw_user_meta_data?.name || 'Unknown',
            email: member.users?.raw_user_meta_data?.email || '',
          }))

          setTeamMembers(teamMembersList)

          // Check if current user is lead
          const currentMember = members.find((m: any) => m.user_id === user?.id)
          setIsLead(currentMember?.role === 'lead')
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionUpdate = async (sectionId: string, content: any) => {
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('document_sections')
        .update({ content })
        .eq('id', sectionId)

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update section',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating section:', error)
      toast({
        title: 'Error',
        description: 'Failed to update section',
        variant: 'destructive',
      })
    }
  }

  const handleSectionAdd = async (title: string) => {
    try {
      const supabase = createClient()

      // Get next order number
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1

      const { data: section, error } = await supabase
        .from('document_sections')
        .insert({
          document_id: documentId,
          title,
          order: maxOrder + 1,
          content: {},
          status: 'not_started',
        })
        .select()
        .single()

      if (error || !section) {
        toast({
          title: 'Error',
          description: 'Failed to add section',
          variant: 'destructive',
        })
        return
      }

      await loadData()
      toast({
        title: 'Section added',
        description: `"${title}" has been added`,
      })
    } catch (error) {
      console.error('Error adding section:', error)
      toast({
        title: 'Error',
        description: 'Failed to add section',
        variant: 'destructive',
      })
    }
  }

  const handleSectionDelete = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section? This action cannot be undone.')) {
      return
    }

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('document_sections')
        .delete()
        .eq('id', sectionId)

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete section',
          variant: 'destructive',
        })
        return
      }

      await loadData()
      toast({
        title: 'Section deleted',
        description: 'The section has been deleted',
      })
    } catch (error) {
      console.error('Error deleting section:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete section',
        variant: 'destructive',
      })
    }
  }

  const handleSectionReorder = async (reorderedSections: DocumentSection[]) => {
    try {
      const supabase = createClient()

      // Update order for all sections
      const updates = reorderedSections.map((section, index) =>
        supabase
          .from('document_sections')
          .update({ order: index })
          .eq('id', section.id)
      )

      await Promise.all(updates)

      setSections(reorderedSections)
    } catch (error) {
      console.error('Error reordering sections:', error)
      toast({
        title: 'Error',
        description: 'Failed to reorder sections',
        variant: 'destructive',
      })
      await loadData()
    }
  }

  const handleSectionAssign = async (sectionId: string, userId: string, deadline?: string) => {
    try {
      const supabase = createClient()

      const updateData: any = {
        assigned_to: userId,
      }
      if (deadline) {
        updateData.deadline = deadline
      }

      const { error } = await supabase
        .from('document_sections')
        .update(updateData)
        .eq('id', sectionId)

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to assign section',
          variant: 'destructive',
        })
        return
      }

      await loadData()
      toast({
        title: 'Section assigned',
        description: 'The section has been assigned successfully',
      })
    } catch (error) {
      console.error('Error assigning section:', error)
      toast({
        title: 'Error',
        description: 'Failed to assign section',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-black">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-black">
        <AlertCircle className="h-12 w-12 text-yellow-400" />
        <p className="text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button
            onClick={loadData}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (sections.length === 0 && !isLead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-white dark:bg-black">
        <AlertCircle className="h-12 w-12 text-yellow-400" />
        <p className="text-muted-foreground">No sections available yet</p>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{documentTitle || 'Document'}</h1>
              <p className="text-sm text-muted-foreground">
                Section-based collaborative editor
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs Editor */}
      <div className="flex-1 overflow-hidden">
        <SectionTabsEditor
          documentId={documentId}
          sections={sections}
          currentUserId={user?.id || ''}
          isLead={isLead}
          onSectionUpdate={handleSectionUpdate}
          onSectionAdd={handleSectionAdd}
          onSectionDelete={handleSectionDelete}
          onSectionReorder={handleSectionReorder}
          onSectionAssign={handleSectionAssign}
          teamMembers={teamMembers}
        />
      </div>
    </div>
  )
}
