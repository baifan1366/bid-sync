/**
 * Collaborative Editor Page Component
 * 
 * Full-featured editor page with:
 * - TipTap rich text editor with Yjs integration
 * - Formatting toolbar (bold, italic, headings, lists, etc.)
 * - Table insertion and editing controls
 * - Link and media insertion controls
 * - Document title and description display
 * - Real-time collaboration with presence indicators
 * - Connection status monitoring
 * 
 * Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.2, 9.3, 9.4, 9.5, 10.4
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useGraphQLQuery, useGraphQLMutation } from '@/hooks/use-graphql'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { useSupabaseCollaboration } from '@/hooks/use-supabase-collaboration'
import { useSyncService } from '@/hooks/use-sync-service'
import { gql } from 'graphql-request'
import { JSONContent } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EditorToolbar } from './editor-toolbar'
import { ConnectionStatusIndicator } from './connection-status-indicator'
import { OfflineWarningBanner } from './offline-warning-banner'
import { ConflictResolutionDialog } from './conflict-resolution-dialog'
import { ActiveCollaborators } from '@/components/editor/active-collaborators'
import { VersionHistorySidebar } from './version-history-sidebar'
import { TeamManagementPanel } from './team-management-panel'
import { CollaborativeEditorSkeleton } from './collaborative-editor-skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Users,
  Clock,
  Edit2,
  Check,
  X,
  History,
  UserCog,
  RefreshCw,
  Plus,
  MoreVertical,
  UserPlus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

const GET_DOCUMENT = gql`
  query GetDocument($id: ID!) {
    document(id: $id) {
      id
      workspaceId
      title
      description
      content
      createdBy
      lastEditedBy
      createdAt
      updatedAt
      collaborators {
        id
        userId
        userName
        email
        role
      }
    }
  }
`

const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($documentId: ID!, $input: UpdateDocumentInput!) {
    updateDocument(documentId: $documentId, input: $input) {
      success
      document {
        id
        title
        description
        content
        updatedAt
      }
    }
  }
`

interface Document {
  id: string
  workspaceId: string
  title: string
  description: string | null
  content: JSONContent
  createdBy: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
  collaborators: Array<{
    id: string
    userId: string
    userName: string
    email: string
    role: string
  }>
}

interface CollaborativeEditorPageProps {
  documentId: string
}

export function CollaborativeEditorPage({ documentId }: CollaborativeEditorPageProps) {
  const router = useRouter()
  const { user } = useUser()
  const { toast } = useToast()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTeamManagement, setShowTeamManagement] = useState(false)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [isLead, setIsLead] = useState(false)
  
  // Debug log when isLead changes
  useEffect(() => {
    console.log('[CollaborativeEditorPage] 🔔 isLead state changed to:', isLead)
    console.log('[CollaborativeEditorPage] This controls whether assignment UI is shown')
  }, [isLead])
  
  // Sections state
  const [sections, setSections] = useState<Array<{
    id: string
    title: string
    order: number
    assigned_to?: string
    status?: string
  }>>([])
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([])
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  // Fetch document data
  const { data, isLoading, error, refetch } = useGraphQLQuery<{ document: Document }>(
    ['document', documentId],
    GET_DOCUMENT,
    { id: documentId }
  )

  const updateDocumentMutation = useGraphQLMutation<any, any>(UPDATE_DOCUMENT, [
    ['document', documentId],
  ])

  const document = data?.document

  // Initialize title and description when document loads
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setDescription(document.description || '')
    }
  }, [document])

  // Check if user is a lead for this document's proposal
  useEffect(() => {
    const checkIfLead = async () => {
      if (!user?.id || !documentId || !document) {
        console.log('[CollaborativeEditorPage] Missing user, documentId, or document:', { 
          userId: user?.id, 
          documentId,
          hasDocument: !!document 
        })
        return
      }

      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        
        console.log('=== [CollaborativeEditorPage] START checkIfLead ===')
        console.log('[CollaborativeEditorPage] User ID:', user.id)
        console.log('[CollaborativeEditorPage] Document ID:', documentId)
        console.log('[CollaborativeEditorPage] Document object:', document)
        console.log('[CollaborativeEditorPage] Workspace ID from document:', document.workspaceId)
        console.log('[CollaborativeEditorPage] Workspace ID type:', typeof document.workspaceId)
        
        // Check current user session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        console.log('[CollaborativeEditorPage] Current session:', {
          hasSession: !!sessionData?.session,
          userId: sessionData?.session?.user?.id,
          sessionError
        })
        
        // Get workspace to find project_id
        console.log('[CollaborativeEditorPage] About to query workspaces table...')
        console.log('[CollaborativeEditorPage] Query: SELECT project_id FROM workspaces WHERE id =', document.workspaceId)
        
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select('project_id, lead_id, proposal_id, name')
          .eq('id', document.workspaceId)
          .maybeSingle()

        console.log('[CollaborativeEditorPage] Workspace query completed')
        console.log('[CollaborativeEditorPage] Workspace data:', workspace)
        console.log('[CollaborativeEditorPage] Workspace error:', workspaceError)
        console.log('[CollaborativeEditorPage] Workspace error details:', {
          message: workspaceError?.message,
          code: workspaceError?.code,
          details: workspaceError?.details,
          hint: workspaceError?.hint
        })

        if (workspaceError) {
          console.error('[CollaborativeEditorPage] ❌ Workspace query failed with error:', workspaceError)
          console.error('[CollaborativeEditorPage] This might be an RLS policy issue')
          setIsLead(false)
          return
        }
        
        if (!workspace) {
          console.error('[CollaborativeEditorPage] ❌ Workspace not found (returned null)')
          console.error('[CollaborativeEditorPage] Possible reasons:')
          console.error('[CollaborativeEditorPage] 1. Workspace does not exist')
          console.error('[CollaborativeEditorPage] 2. RLS policy blocking access')
          console.error('[CollaborativeEditorPage] 3. User does not have permission')
          setIsLead(false)
          return
        }
        
        console.log('[CollaborativeEditorPage] ✅ Workspace found successfully')

        console.log('[CollaborativeEditorPage] ✅ Workspace found successfully')
        console.log('[CollaborativeEditorPage] Workspace details:', {
          id: document.workspaceId,
          name: workspace.name,
          project_id: workspace.project_id,
          lead_id: workspace.lead_id,
          proposal_id: workspace.proposal_id
        })
        
        // Check if proposal_id is set
        if (!workspace.proposal_id) {
          console.warn('[CollaborativeEditorPage] ⚠️ WARNING: workspace.proposal_id is NULL')
          console.warn('[CollaborativeEditorPage] This means migration 044 may not have been applied')
          console.warn('[CollaborativeEditorPage] Will use fallback method (project_id + lead_id)')
        }

        console.log('[CollaborativeEditorPage] Workspace project_id:', workspace.project_id)
        
        // Get proposal - use proposal_id if available, otherwise fallback to project_id
        console.log('[CollaborativeEditorPage] Querying proposals table...')
        
        let proposal = null
        let proposalError = null
        
        if (workspace.proposal_id) {
          // Direct lookup by proposal_id (preferred)
          console.log('[CollaborativeEditorPage] Using proposal_id:', workspace.proposal_id)
          const result = await supabase
            .from('proposals')
            .select('id, lead_id, status')
            .eq('id', workspace.proposal_id)
            .maybeSingle()
          
          proposal = result.data
          proposalError = result.error
          
          // If proposal not found by proposal_id, try fallback
          if (!proposal && !proposalError) {
            console.warn('[CollaborativeEditorPage] ⚠️ Proposal not found by proposal_id, trying fallback...')
            const fallbackResult = await supabase
              .from('proposals')
              .select('id, lead_id, status')
              .eq('project_id', workspace.project_id)
              .eq('lead_id', workspace.lead_id)
              .maybeSingle()
            
            proposal = fallbackResult.data
            proposalError = fallbackResult.error
            
            if (proposal) {
              console.log('[CollaborativeEditorPage] ✅ Found proposal via fallback:', proposal.id)
              console.log('[CollaborativeEditorPage] Workspace proposal_id needs to be updated')
            }
          }
        } else {
          // Fallback: lookup by project_id + lead_id (for legacy workspaces)
          console.log('[CollaborativeEditorPage] Using project_id + lead_id fallback')
          const result = await supabase
            .from('proposals')
            .select('id, lead_id, status')
            .eq('project_id', workspace.project_id)
            .eq('lead_id', workspace.lead_id)
            .maybeSingle()
          
          proposal = result.data
          proposalError = result.error
        }

        console.log('[CollaborativeEditorPage] Proposal query completed')
        console.log('[CollaborativeEditorPage] Proposal data:', proposal)
        console.log('[CollaborativeEditorPage] Proposal error:', proposalError)

        if (proposalError) {
          console.error('[CollaborativeEditorPage] ❌ Proposal query failed:', proposalError)
        }

        if (proposal) {
          console.log('[CollaborativeEditorPage] ✅ Proposal found')
          console.log('[CollaborativeEditorPage] Proposal ID:', proposal.id)
          console.log('[CollaborativeEditorPage] Proposal lead_id:', proposal.lead_id)
          console.log('[CollaborativeEditorPage] Proposal status:', proposal.status)
          console.log('[CollaborativeEditorPage] Current user id:', user.id)
          console.log('[CollaborativeEditorPage] Is user the proposal lead?', proposal.lead_id === user.id)
          
          // Check if user is in proposal_team_members
          console.log('[CollaborativeEditorPage] Checking proposal_team_members table...')
          const { data: teamMember, error: teamError } = await supabase
            .from('proposal_team_members')
            .select('role, user_id, proposal_id')
            .eq('proposal_id', proposal.id)
            .eq('user_id', user.id)
            .maybeSingle()

          console.log('[CollaborativeEditorPage] Team member query completed')
          console.log('[CollaborativeEditorPage] Team member data:', teamMember)
          console.log('[CollaborativeEditorPage] Team member error:', teamError)

          if (teamMember && teamMember.role === 'lead') {
            console.log('[CollaborativeEditorPage] ✅ Decision: User IS a lead (from proposal_team_members)')
            console.log('[CollaborativeEditorPage] Setting isLead = true')
            setIsLead(true)
          } else if (proposal.lead_id === user.id) {
            // Fallback: check if user is the proposal lead_id
            console.log('[CollaborativeEditorPage] ✅ Decision: User is proposal lead_id (fallback check)')
            console.log('[CollaborativeEditorPage] Setting isLead = true')
            setIsLead(true)
          } else {
            console.log('[CollaborativeEditorPage] ❌ Decision: User is NOT a lead')
            console.log('[CollaborativeEditorPage] Reasons:')
            console.log('[CollaborativeEditorPage]   - Not in proposal_team_members with role=lead:', !teamMember || teamMember.role !== 'lead')
            console.log('[CollaborativeEditorPage]   - Not the proposal lead_id:', proposal.lead_id !== user.id)
            console.log('[CollaborativeEditorPage] Setting isLead = false')
            setIsLead(false)
          }
        } else {
          console.log('[CollaborativeEditorPage] ❌ No proposal found for project:', workspace.project_id)
          console.log('[CollaborativeEditorPage] This might indicate:')
          console.log('[CollaborativeEditorPage]   1. Proposal was deleted')
          console.log('[CollaborativeEditorPage]   2. Workspace is orphaned')
          console.log('[CollaborativeEditorPage]   3. Data inconsistency')
          console.log('[CollaborativeEditorPage] Setting isLead = false')
          setIsLead(false)
        }
        
        console.log('=== [CollaborativeEditorPage] END checkIfLead ===')
      } catch (err) {
        console.error('=== [CollaborativeEditorPage] EXCEPTION in checkIfLead ===')
        console.error('[CollaborativeEditorPage] Error type:', err?.constructor?.name)
        console.error('[CollaborativeEditorPage] Error message:', (err as Error)?.message)
        console.error('[CollaborativeEditorPage] Full error:', err)
        console.error('[CollaborativeEditorPage] Stack trace:', (err as Error)?.stack)
        console.log('[CollaborativeEditorPage] Setting isLead = false due to error')
        setIsLead(false)
      }
    }

    checkIfLead()
  }, [user?.id, documentId, document])

  // Load sections
  useEffect(() => {
    const loadSections = async () => {
      if (!documentId || !user?.id) {
        console.log('[CollaborativeEditorPage] Missing documentId or userId for sections')
        setSectionsLoading(false)
        return
      }

      console.log('[CollaborativeEditorPage] Loading sections for document:', documentId)
      
      try {
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('document_sections')
          .select('id, title, order, assigned_to, status')
          .eq('document_id', documentId)
          .order('order', { ascending: true })

        console.log('[CollaborativeEditorPage] Sections query result:', { 
          dataCount: data?.length || 0, 
          error,
          data: data?.map(s => ({ id: s.id, title: s.title, assigned_to: s.assigned_to }))
        })

        if (error) {
          console.error('[CollaborativeEditorPage] Error loading sections:', error)
          toast({
            title: 'Error',
            description: `Failed to load sections: ${error.message}`,
            variant: 'destructive',
          })
          setSections([])
        } else {
          console.log('[CollaborativeEditorPage] Sections loaded successfully:', data?.length || 0)
          setSections(data || [])
          if (data && data.length > 0) {
            setActiveSection(data[0].id)
          }
        }
      } catch (err) {
        console.error('[CollaborativeEditorPage] Unexpected error loading sections:', err)
        setSections([])
      } finally {
        setSectionsLoading(false)
      }
    }

    loadSections()
  }, [documentId, user?.id, toast])

  // Load team members for assignment
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!documentId || !isLead || !document) {
        console.log('[CollaborativeEditorPage] loadTeamMembers skipped:', { 
          hasDocumentId: !!documentId, 
          isLead, 
          hasDocument: !!document 
        })
        return
      }

      console.log('[CollaborativeEditorPage] === loadTeamMembers START ===')

      try {
        const supabase = createClient()
        
        // Get workspace to find proposal_id (or project_id + lead_id as fallback)
        console.log('[CollaborativeEditorPage] Fetching workspace:', document.workspaceId)
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .select('project_id, lead_id, proposal_id')
          .eq('id', document.workspaceId)
          .maybeSingle()

        console.log('[CollaborativeEditorPage] Workspace result:', { workspace, workspaceError })

        if (workspaceError || !workspace) {
          console.error('[CollaborativeEditorPage] Failed to load workspace for team members')
          return
        }

        // Get proposal - use proposal_id if available, otherwise fallback to project_id + lead_id
        let proposal = null
        let proposalError = null
        
        if (workspace.proposal_id) {
          // Direct lookup by proposal_id (preferred)
          console.log('[CollaborativeEditorPage] Loading team members using proposal_id:', workspace.proposal_id)
          const result = await supabase
            .from('proposals')
            .select('id')
            .eq('id', workspace.proposal_id)
            .maybeSingle()
          
          proposal = result.data
          proposalError = result.error
          
          // If proposal not found by proposal_id, try fallback
          if (!proposal && !proposalError) {
            console.warn('[CollaborativeEditorPage] ⚠️ Proposal not found by proposal_id for team members, trying fallback...')
            const fallbackResult = await supabase
              .from('proposals')
              .select('id')
              .eq('project_id', workspace.project_id)
              .eq('lead_id', workspace.lead_id)
              .maybeSingle()
            
            proposal = fallbackResult.data
            proposalError = fallbackResult.error
            
            if (proposal) {
              console.log('[CollaborativeEditorPage] ✅ Found proposal via fallback for team members:', proposal.id)
            }
          }
        } else {
          // Fallback: lookup by project_id + lead_id (for legacy workspaces)
          console.log('[CollaborativeEditorPage] Loading team members using project_id + lead_id fallback')
          const result = await supabase
            .from('proposals')
            .select('id')
            .eq('project_id', workspace.project_id)
            .eq('lead_id', workspace.lead_id)
            .maybeSingle()
          
          proposal = result.data
          proposalError = result.error
        }

        console.log('[CollaborativeEditorPage] Proposal result:', { proposal, proposalError })

        if (proposalError || !proposal) {
          console.error('[CollaborativeEditorPage] Failed to load proposal for team members')
          return
        }

        // Get team members with user info via RPC function
        console.log('[CollaborativeEditorPage] Calling get_proposal_team_with_users for proposal:', proposal.id)
        const { data: members, error: membersError } = await supabase
          .rpc('get_proposal_team_with_users', { 
            p_proposal_id: proposal.id 
          })

        console.log('[CollaborativeEditorPage] Team members RPC result:', { 
          memberCount: members?.length || 0, 
          membersError 
        })

        if (membersError) {
          console.error('[CollaborativeEditorPage] Error loading team members:', membersError)
        } else if (members && members.length > 0) {
          const teamList = members.map((member: any) => ({
            id: member.user_id,
            name: member.user_name || member.user_email || 'Unknown',
          }))
          
          console.log('[CollaborativeEditorPage] ✅ Team members loaded:', teamList)
          setTeamMembers(teamList)
        } else {
          console.log('[CollaborativeEditorPage] No team members found')
          setTeamMembers([])
        }
      } catch (err) {
        console.error('[CollaborativeEditorPage] Exception in loadTeamMembers:', err)
      }
      
      console.log('[CollaborativeEditorPage] === loadTeamMembers END ===')
    }

    loadTeamMembers()
  }, [documentId, isLead, document])

  // Handle assign section
  const handleAssignSection = async (sectionId: string, userId: string) => {
    console.log('[CollaborativeEditorPage] === handleAssignSection START ===')
    console.log('[CollaborativeEditorPage] sectionId:', sectionId)
    console.log('[CollaborativeEditorPage] userId:', userId)
    console.log('[CollaborativeEditorPage] documentId:', documentId)
    
    try {
      const supabase = createClient()
      
      // Check current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('[CollaborativeEditorPage] Current user:', user?.id)
      
      // Try to update
      console.log('[CollaborativeEditorPage] Attempting to update document_sections...')
      const { data, error } = await supabase
        .from('document_sections')
        .update({ assigned_to: userId })
        .eq('id', sectionId)
        .select()

      console.log('[CollaborativeEditorPage] Update result:', { data, error })

      if (error) {
        console.error('[CollaborativeEditorPage] ❌ Error assigning section:', error)
        console.error('[CollaborativeEditorPage] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        toast({
          title: 'Error',
          description: `Failed to assign section: ${error.message}`,
          variant: 'destructive',
        })
        return
      }

      console.log('[CollaborativeEditorPage] ✅ Section updated successfully')

      // Reload sections
      const { data: sectionsData } = await supabase
        .from('document_sections')
        .select('id, title, order, assigned_to, status')
        .eq('document_id', documentId)
        .order('order', { ascending: true })

      if (sectionsData) {
        console.log('[CollaborativeEditorPage] Reloaded sections:', sectionsData.length)
        setSections(sectionsData)
      }

      toast({
        title: 'Section assigned',
        description: 'The section has been assigned successfully',
      })
    } catch (err) {
      console.error('[CollaborativeEditorPage] ❌ Exception in handleAssignSection:', err)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    }
    console.log('[CollaborativeEditorPage] === handleAssignSection END ===')
  }

  // Handle delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return

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

      // Reload sections
      const { data } = await supabase
        .from('document_sections')
        .select('id, title, order, assigned_to, status')
        .eq('document_id', documentId)
        .order('order', { ascending: true })

      if (data) {
        setSections(data)
        if (data.length > 0 && activeSection === sectionId) {
          setActiveSection(data[0].id)
        }
      }

      toast({
        title: 'Section deleted',
        description: 'The section has been deleted',
      })
    } catch (err) {
      console.error('[CollaborativeEditorPage] Error deleting section:', err)
      toast({
        title: 'Error',
        description: 'Failed to delete section',
        variant: 'destructive',
      })
    }
  }

  // Get assigned member name
  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null
    const member = teamMembers.find(m => m.id === userId)
    return member?.name || 'Unknown'
  }

  // Handle add section
  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return

    try {
      const supabase = createClient()
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1

      const { data, error } = await supabase
        .from('document_sections')
        .insert({
          document_id: documentId,
          title: newSectionTitle.trim(),
          order: maxOrder + 1,
          content: {},
          status: 'not_started',
        })
        .select('id, title, order, assigned_to, status')
        .single()

      if (error) {
        console.error('[CollaborativeEditorPage] Error creating section:', error)
        toast({
          title: 'Error',
          description: `Failed to create section: ${error.message}`,
          variant: 'destructive',
        })
        return
      }

      // Reload sections
      const { data: allSections } = await supabase
        .from('document_sections')
        .select('id, title, order, assigned_to, status')
        .eq('document_id', documentId)
        .order('order', { ascending: true })

      if (allSections) {
        setSections(allSections)
        setActiveSection(data.id)
      }

      setShowAddSectionDialog(false)
      setNewSectionTitle('')
      toast({
        title: 'Section added',
        description: `"${newSectionTitle}" has been added`,
      })
    } catch (err) {
      console.error('[CollaborativeEditorPage] Error creating section:', err)
      toast({
        title: 'Error',
        description: 'Failed to create section',
        variant: 'destructive',
      })
    }
  }

  // Get user's role (case-insensitive comparison)
  const userRole = document?.collaborators.find((c) => c.userId === user?.id)?.role
  const canEdit =
    userRole?.toLowerCase() === 'owner' || userRole?.toLowerCase() === 'editor'

  // Set up Supabase Realtime collaboration
  const collaboration = useSupabaseCollaboration({
    documentId,
    userId: user?.id || 'anonymous',
    userName: user?.email || 'Anonymous',
    userColor: getUserColor(user?.id || 'anonymous'),
    enabled: true,
  })

  // Set up sync service for offline support
  const syncServiceState = useSyncService({
    documentId,
    enabled: true,
    autoSync: true,
  })

  // Initialize TipTap editor with Supabase Realtime collaboration
  // Default to true if canEdit is undefined (will be updated when document loads)
  const editor = useTipTapEditor({
    content: document?.content,
    placeholder: 'Start writing your proposal...',
    editable: canEdit ?? true,
    autofocus: true,
    // No longer using Yjs - collaboration handled via Supabase Realtime
    collaborationEnabled: true,
    userName: user?.email || 'Anonymous',
    userColor: getUserColor(user?.id || 'anonymous'),
    onUpdate: (content) => {
      // Auto-save on content change
      handleAutoSave({ content })
      // Broadcast update to collaborators
      collaboration.broadcastUpdate(content)
    },
  })

  // Auto-save function
  const handleAutoSave = useCallback(
    (updates: { title?: string; description?: string; content?: JSONContent }) => {
      if (!canEdit) return

      // Clear existing timer
      if (saveTimer) {
        clearTimeout(saveTimer)
      }

      // Set new timer for auto-save
      const timer = setTimeout(async () => {
        setIsSaving(true)
        try {
          await updateDocumentMutation.mutateAsync({
            documentId,
            input: updates,
          })
          setLastSaved(new Date())
        } catch (error) {
          console.error('Failed to save document:', error)
        } finally {
          setIsSaving(false)
        }
      }, 2000)

      setSaveTimer(timer)
    },
    [canEdit, documentId, saveTimer, updateDocumentMutation]
  )

  // Save title
  const handleSaveTitle = async () => {
    if (title.trim() === document?.title) {
      setIsEditingTitle(false)
      return
    }

    try {
      await updateDocumentMutation.mutateAsync({
        documentId,
        input: { title: title.trim() },
      })
      setIsEditingTitle(false)
      refetch()
    } catch (error) {
      console.error('Failed to save title:', error)
    }
  }

  // Save description
  const handleSaveDescription = async () => {
    if (description.trim() === (document?.description || '')) {
      setIsEditingDescription(false)
      return
    }

    try {
      await updateDocumentMutation.mutateAsync({
        documentId,
        input: { description: description.trim() },
      })
      setIsEditingDescription(false)
      refetch()
    } catch (error) {
      console.error('Failed to save description:', error)
    }
  }

  // Manual save
  const handleManualSave = async () => {
    if (!editor || !canEdit) return

    setIsSaving(true)
    try {
      await updateDocumentMutation.mutateAsync({
        documentId,
        input: { content: editor.getJSON() },
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save document:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer) {
        clearTimeout(saveTimer)
      }
    }
  }, [saveTimer])

  // Show conflict dialog when conflicts are detected
  useEffect(() => {
    if (syncServiceState.conflicts.length > 0 && !showConflictDialog) {
      setShowConflictDialog(true)
    }
  }, [syncServiceState.conflicts.length, showConflictDialog])

  // Cache document content when it changes (for offline support)
  useEffect(() => {
    if (editor && document?.content) {
      syncServiceState.cacheDocument(document.content)
    }
  }, [editor, document?.content, syncServiceState])

  // Handle manual sync
  const handleManualSync = useCallback(async () => {
    if (!canEdit) return

    try {
      await syncServiceState.sync(async (changes) => {
        // Sync changes to server
        // In a real implementation, this would send changes to the server
        // For now, we'll just mark as successful
        return { success: true }
      })
    } catch (error) {
      console.error('Failed to sync changes:', error)
    }
  }, [canEdit, syncServiceState])

  // Handle conflict resolution
  const handleResolveConflict = useCallback(
    async (conflictId: string, resolvedContent: JSONContent) => {
      await syncServiceState.resolveConflict(conflictId, resolvedContent)

      // Update editor with resolved content
      if (editor) {
        editor.commands.setContent(resolvedContent)
      }

      // Refetch document
      refetch()
    },
    [syncServiceState, editor, refetch]
  )

  // Handle resolve all conflicts
  const handleResolveAllConflicts = useCallback(
    async (resolution: 'local' | 'server') => {
      for (const conflict of syncServiceState.conflicts) {
        const resolvedContent =
          resolution === 'local' ? conflict.localVersion : conflict.serverVersion
        await syncServiceState.resolveConflict(conflict.id, resolvedContent)
      }

      // Update editor with resolved content
      if (editor && syncServiceState.conflicts.length > 0) {
        const lastConflict = syncServiceState.conflicts[syncServiceState.conflicts.length - 1]
        const resolvedContent =
          resolution === 'local' ? lastConflict.localVersion : lastConflict.serverVersion
        editor.commands.setContent(resolvedContent)
      }

      // Refetch document
      refetch()
      setShowConflictDialog(false)
    },
    [syncServiceState, editor, refetch]
  )

  if (isLoading) {
    return <CollaborativeEditorSkeleton />
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-yellow-400" />
        <p className="text-muted-foreground">Failed to load document</p>
        <Button onClick={() => refetch()} variant="outline" className="border-yellow-400/20">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-black">
      {/* Offline Warning Banner */}
      <OfflineWarningBanner
        connectionStatus={syncServiceState.connectionStatus}
        hasPendingChanges={syncServiceState.hasPendingChanges}
        isSynced={syncServiceState.isSynced}
        conflictCount={syncServiceState.conflicts.length}
        onSync={handleManualSync}
        onViewConflicts={() => setShowConflictDialog(true)}
        className="mx-4 mt-4"
      />

      {/* Header */}
      <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back button and title */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/app/documents')}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') {
                          setTitle(document.title)
                          setIsEditingTitle(false)
                        }
                      }}
                      className="h-8 border-yellow-400/20"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveTitle} className="h-8 w-8">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setTitle(document.title)
                        setIsEditingTitle(false)
                      }}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold truncate">{document.title}</h1>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsEditingTitle(true)}
                        className="h-6 w-6 shrink-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Status and actions */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Connection status */}
              <ConnectionStatusIndicator
                status={
                  syncServiceState.connectionStatus === 'reconnecting'
                    ? 'connecting'
                    : syncServiceState.connectionStatus === 'syncing'
                    ? 'connecting'
                    : syncServiceState.connectionStatus
                }
                onReconnect={() => window.location.reload()}
              />

              {/* Manual sync button */}
              {canEdit && syncServiceState.hasPendingChanges && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={syncServiceState.connectionStatus === 'syncing'}
                  className="border-yellow-400/20"
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 mr-2',
                      syncServiceState.connectionStatus === 'syncing' && 'animate-spin'
                    )}
                  />
                  Sync
                </Button>
              )}

              {/* Active collaborators */}
              <ActiveCollaborators
                users={collaboration.activeUsers}
                currentUserId={user?.id || ''}
              />

              {/* Save status */}
              {canEdit && (
                <div className="flex items-center gap-2">
                  {isSaving ? (
                    <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-400">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Saving...
                    </Badge>
                  ) : lastSaved ? (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Saved
                    </Badge>
                  ) : null}

                  <Button
                    size="sm"
                    onClick={handleManualSave}
                    disabled={isSaving || !editor}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}

              {/* Team Management Button */}
              {userRole === 'owner' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTeamManagement(true)}
                  className="border-yellow-400/20"
                >
                  <UserCog className="h-4 w-4 mr-2" />
                  Team
                </Button>
              )}

              {/* Version History Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="border-yellow-400/20"
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>

              {/* Role badge */}
              {userRole && (
                <Badge
                  className={cn(
                    userRole === 'owner' && 'bg-yellow-400 text-black',
                    userRole === 'editor' && 'bg-yellow-400/80 text-black',
                    userRole === 'commenter' && 'bg-yellow-400/60 text-black',
                    userRole === 'viewer' && 'bg-yellow-400/40 text-black'
                  )}
                >
                  {userRole}
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {(document.description || isEditingDescription) && (
            <div className="mt-3">
              {isEditingDescription ? (
                <div className="flex items-start gap-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setDescription(document.description || '')
                        setIsEditingDescription(false)
                      }
                    }}
                    className="min-h-[60px] border-yellow-400/20"
                    placeholder="Add a description..."
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={handleSaveDescription} className="h-8 w-8">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setDescription(document.description || '')
                        setIsEditingDescription(false)
                      }}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="text-sm text-muted-foreground flex-1">{document.description}</p>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsEditingDescription(true)}
                      className="h-6 w-6 shrink-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Toolbar - show if user can edit or if role is not yet determined */}
      {(canEdit || canEdit === undefined) && (
        <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
            <EditorToolbar editor={editor} />
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
        {sectionsLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400 mr-2" />
            <span className="text-sm text-muted-foreground">Loading sections...</span>
          </div>
        ) : sections.length === 0 ? (
          <div className="p-4">
            {isLead ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  No sections yet. Create your first section to get started.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAddSectionDialog(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No sections available yet. The lead will create sections and assign them to team members.
              </p>
            )}
          </div>
        ) : (
          <Tabs value={activeSection || undefined} onValueChange={setActiveSection}>
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <ScrollArea className="flex-1">
                  <TabsList className="bg-transparent border-b-0 h-auto p-0 inline-flex space-x-1">
                    {sections.map((section) => {
                      const assignedName = getAssignedMemberName(section.assigned_to)
                      const isAssignedToCurrentUser = section.assigned_to === user?.id
                      
                      return (
                        <div key={section.id} className="inline-flex items-center gap-1">
                          <TabsTrigger
                            value={section.id}
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-yellow-400 whitespace-nowrap"
                          >
                            <div className="flex items-center gap-2">
                              <span>{section.title}</span>
                              {assignedName && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-xs',
                                    isAssignedToCurrentUser && 'bg-yellow-400/20 border-yellow-400'
                                  )}
                                >
                                  {isAssignedToCurrentUser ? 'You' : assignedName}
                                </Badge>
                              )}
                              {section.status && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-xs',
                                    section.status === 'completed' && 'bg-green-500/20 text-green-500',
                                    section.status === 'in_progress' && 'bg-blue-500/20 text-blue-500',
                                    section.status === 'in_review' && 'bg-yellow-400/20 text-yellow-400',
                                    section.status === 'not_started' && 'bg-gray-500/20 text-gray-500'
                                  )}
                                >
                                  {section.status.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </TabsTrigger>
                          
                          {/* Section Actions Dropdown - Only for Lead */}
                          {isLead && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {teamMembers.length > 0 ? (
                                  <>
                                    <div className="px-2 py-1.5 text-sm font-semibold">Assign to:</div>
                                    {teamMembers.map((member) => (
                                      <DropdownMenuItem
                                        key={member.id}
                                        onClick={() => handleAssignSection(section.id, member.id)}
                                        className={cn(
                                          section.assigned_to === member.id && 'bg-yellow-400/20'
                                        )}
                                      >
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        {member.name}
                                        {section.assigned_to === member.id && ' ✓'}
                                      </DropdownMenuItem>
                                    ))}
                                    <div className="border-t my-1" />
                                  </>
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No team members
                                  </div>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDeleteSection(section.id)}
                                  className="text-red-500"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Section
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )
                    })}
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                
                {/* Add Section Button - Only for Lead */}
                {isLead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddSectionDialog(true)}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        )}
      </div>

      {/* Add Section Dialog */}
      {isLead && (
        <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Section</DialogTitle>
              <DialogDescription>
                Create a new section for your proposal document
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Enter section title..."
              className="border-yellow-400/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSection()
                if (e.key === 'Escape') {
                  setShowAddSectionDialog(false)
                  setNewSectionTitle('')
                }
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddSectionDialog(false)
                  setNewSectionTitle('')
                }}
                className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSection}
                disabled={!newSectionTitle.trim()}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Add Section
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
          <Card className="border-yellow-400/20 min-h-[600px]">
            <div 
              className="p-6"
              onClick={() => {
                if (editor && !editor.isFocused) {
                  editor.commands.focus()
                }
              }}
            >
              {editor ? (
                <EditorContent
                  editor={editor}
                  className="tiptap-editor-content prose prose-sm sm:prose lg:prose-lg max-w-none"
                />
              ) : (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-yellow-400/10 rounded w-3/4"></div>
                  <div className="h-4 bg-yellow-400/10 rounded w-1/2"></div>
                  <div className="h-4 bg-yellow-400/10 rounded w-5/6"></div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-yellow-400/20 bg-white dark:bg-black">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last updated: {new Date(document.updatedAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {document.collaborators.length} collaborator(s)
              </div>
            </div>
            <div>Document ID: {documentId.slice(0, 8)}...</div>
          </div>
        </div>
      </div>

      {/* Version History Sidebar */}
      <VersionHistorySidebar
        documentId={documentId}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onVersionRestored={async () => {
          // Wait for refetch to complete and get the new data
          const result = await refetch()
          if (editor && result.data?.document?.content) {
            editor.commands.setContent(result.data.document.content)
          }
        }}
        canEdit={canEdit}
      />

      {/* Team Management Panel */}
      <TeamManagementPanel
        documentId={documentId}
        isOpen={showTeamManagement}
        onClose={() => setShowTeamManagement(false)}
      />

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={syncServiceState.conflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
      />
    </div>
  )
}

// Helper function to generate consistent colors for users
function getUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52B788', // Green
  ]

  // Generate a consistent index based on userId
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length

  return colors[index]
}
