'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Loader2, MoreVertical, UserPlus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface SimpleSectionTabsProps {
  documentId: string
  currentUserId: string
  isLead?: boolean  // Add this prop
  children: (sectionId: string | null) => React.ReactNode
}

interface Section {
  id: string
  title: string
  order: number
  assigned_to?: string
  status?: string
}

export function SimpleSectionTabs({ documentId, currentUserId, isLead = false, children }: SimpleSectionTabsProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([])
  const { toast } = useToast()

  useEffect(() => {
    console.log('[SimpleSectionTabs] Component mounted')
    console.log('[SimpleSectionTabs] documentId:', documentId)
    console.log('[SimpleSectionTabs] currentUserId:', currentUserId)
    console.log('[SimpleSectionTabs] isLead:', isLead)
    console.log('[SimpleSectionTabs] isLead type:', typeof isLead)
    loadSections()
    if (isLead) {
      loadTeamMembers()
    }
  }, [documentId, isLead])

  const loadTeamMembers = async () => {
    try {
      const supabase = createClient()
      
      // Get workspace to find proposal
      const { data: doc } = await supabase
        .from('workspace_documents')
        .select('workspace_id, workspaces!inner(project_id)')
        .eq('id', documentId)
        .single()

      if (doc) {
        const workspace = doc.workspaces as any
        
        // Get proposal for this project
        const { data: proposal } = await supabase
          .from('proposals')
          .select('id')
          .eq('project_id', workspace.project_id)
          .single()

        if (proposal) {
          // Get team members with user info via RPC function
          const { data: members, error: membersError } = await supabase
            .rpc('get_proposal_team_with_users', { 
              p_proposal_id: proposal.id 
            })

          if (membersError) {
            console.error('[SimpleSectionTabs] Error loading team members:', membersError)
          } else if (members && members.length > 0) {
            const teamList = members.map((member: any) => ({
              id: member.user_id,
              name: member.user_name || member.user_email || 'Unknown',
            }))
            
            console.log('[SimpleSectionTabs] Team members loaded:', teamList.length)
            setTeamMembers(teamList)
          }
        }
      }
    } catch (err) {
      console.error('[SimpleSectionTabs] Error loading team members:', err)
    }
  }

  const loadSections = async () => {
    console.log('[SimpleSectionTabs] loadSections called')
    try {
      setLoading(true)
      const supabase = createClient()
      console.log('[SimpleSectionTabs] Supabase client created')

      const { data, error } = await supabase
        .from('document_sections')
        .select('id, title, order, assigned_to, status')
        .eq('document_id', documentId)
        .order('order', { ascending: true })

      console.log('[SimpleSectionTabs] Query result:', { data, error })

      if (error) {
        console.error('[SimpleSectionTabs] Error loading sections:', error)
        toast({
          title: 'Error',
          description: `Failed to load sections: ${error.message}`,
          variant: 'destructive',
        })
        return
      }

      console.log('[SimpleSectionTabs] Sections loaded:', data?.length || 0)
      setSections(data || [])
      
      if (data && data.length > 0) {
        console.log('[SimpleSectionTabs] Setting active section to:', data[0].id)
        setActiveSection(data[0].id)
      } else {
        console.log('[SimpleSectionTabs] No sections found')
      }
    } catch (err) {
      console.error('[SimpleSectionTabs] Unexpected error:', err)
      toast({
        title: 'Error',
        description: 'Failed to load sections',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      console.log('[SimpleSectionTabs] Loading complete')
    }
  }

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return

    console.log('[SimpleSectionTabs] Creating section:', newSectionTitle)
    try {
      const supabase = createClient()
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.order)) : -1
      console.log('[SimpleSectionTabs] Creating section with order:', maxOrder + 1)

      const { data, error } = await supabase
        .from('document_sections')
        .insert({
          document_id: documentId,
          title: newSectionTitle,
          order: maxOrder + 1,
          content: {},
          status: 'not_started',
        })
        .select('id, title, order, assigned_to, status')
        .single()

      console.log('[SimpleSectionTabs] Insert result:', { data, error })

      if (error) {
        console.error('[SimpleSectionTabs] Error creating section:', error)
        toast({
          title: 'Error',
          description: `Failed to create section: ${error.message}`,
          variant: 'destructive',
        })
        return
      }

      console.log('[SimpleSectionTabs] Section created successfully')
      setShowAddDialog(false)
      setNewSectionTitle('')
      await loadSections()
      toast({
        title: 'Section added',
        description: `"${newSectionTitle}" has been added`,
      })
    } catch (err) {
      console.error('[SimpleSectionTabs] Unexpected error:', err)
      toast({
        title: 'Error',
        description: 'Failed to create section',
        variant: 'destructive',
      })
    }
  }

  const handleAssignSection = async (sectionId: string, userId: string) => {
    console.log('[SimpleSectionTabs] handleAssignSection called')
    console.log('[SimpleSectionTabs] sectionId:', sectionId)
    console.log('[SimpleSectionTabs] userId:', userId)
    
    try {
      const supabase = createClient()
      
      console.log('[SimpleSectionTabs] Updating section assignment...')
      const { error } = await supabase
        .from('document_sections')
        .update({ assigned_to: userId })
        .eq('id', sectionId)

      console.log('[SimpleSectionTabs] Update result:', { error })

      if (error) {
        console.error('[SimpleSectionTabs] Error assigning section:', error)
        toast({
          title: 'Error',
          description: 'Failed to assign section',
          variant: 'destructive',
        })
        return
      }

      console.log('[SimpleSectionTabs] Section assigned successfully, reloading...')
      await loadSections()
      toast({
        title: 'Section assigned',
        description: 'The section has been assigned successfully',
      })
    } catch (err) {
      console.error('[SimpleSectionTabs] Unexpected error assigning section:', err)
      toast({
        title: 'Error',
        description: 'Failed to assign section',
        variant: 'destructive',
      })
    }
  }

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

      await loadSections()
      toast({
        title: 'Section deleted',
        description: 'The section has been deleted',
      })
    } catch (err) {
      console.error('[SimpleSectionTabs] Error deleting section:', err)
      toast({
        title: 'Error',
        description: 'Failed to delete section',
        variant: 'destructive',
      })
    }
  }

  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null
    const member = teamMembers.find(m => m.id === userId)
    return member?.name || 'Unknown'
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white text-xs">Completed</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white text-xs">In Progress</Badge>
      case 'in_review':
        return <Badge className="bg-yellow-400 text-black text-xs">In Review</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Not Started</Badge>
    }
  }

  console.log('[SimpleSectionTabs] Render - loading:', loading, 'sections:', sections.length)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 border-b border-yellow-400/20">
        <Loader2 className="h-5 w-5 animate-spin text-yellow-400 mr-2" />
        <span className="text-sm text-muted-foreground">Loading sections...</span>
      </div>
    )
  }

  if (sections.length === 0) {
    console.log('[SimpleSectionTabs] Rendering empty state')
    
    // Members see a message if no sections
    if (!isLead) {
      return (
        <div className="p-4 border-b border-yellow-400/20 bg-white dark:bg-black">
          <p className="text-sm text-muted-foreground text-center">
            No sections available yet. The lead will create sections and assign them to team members.
          </p>
        </div>
      )
    }
    
    // Leads can create sections
    return (
      <div className="p-4 border-b border-yellow-400/20 bg-white dark:bg-black">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">No sections yet. Create your first section to get started.</p>
          <Button
            onClick={() => setShowAddDialog(true)}
            size="sm"
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
              }}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
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
      </div>
    )
  }

  console.log('[SimpleSectionTabs] Rendering tabs with', sections.length, 'sections')
  console.log('[SimpleSectionTabs] Active section:', activeSection)

  // Filter sections for members - only show assigned sections
  const visibleSections = isLead 
    ? sections 
    : sections.filter(s => s.assigned_to === currentUserId)

  console.log('[SimpleSectionTabs] ===== FILTERING DEBUG =====')
  console.log('[SimpleSectionTabs] isLead:', isLead)
  console.log('[SimpleSectionTabs] currentUserId:', currentUserId)
  console.log('[SimpleSectionTabs] Total sections:', sections.length)
  console.log('[SimpleSectionTabs] Sections assigned_to values:', sections.map(s => ({ id: s.id, title: s.title, assigned_to: s.assigned_to })))
  console.log('[SimpleSectionTabs] Visible sections for user:', visibleSections.length)
  console.log('[SimpleSectionTabs] =============================')

  if (!isLead && visibleSections.length === 0) {
    return (
      <div className="p-4 border-b border-yellow-400/20 bg-white dark:bg-black">
        <p className="text-sm text-muted-foreground text-center">
          No sections assigned to you yet. The lead will assign sections to you soon.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
        <Tabs value={activeSection || visibleSections[0]?.id} onValueChange={setActiveSection}>
          <div className="flex items-center gap-4 px-4 py-2">
            <ScrollArea className="flex-1">
              <TabsList className="bg-transparent h-auto">
                {visibleSections.map((section) => {
                  const assignedName = getAssignedMemberName(section.assigned_to)
                  const isAssignedToCurrentUser = section.assigned_to === currentUserId
                  
                  return (
                    <div key={section.id} className="inline-flex items-center gap-1 mr-2">
                      <TabsTrigger
                        value={section.id}
                        className={cn(
                          "data-[state=active]:bg-yellow-400 data-[state=active]:text-black",
                          "flex items-center gap-2 px-4 py-2"
                        )}
                      >
                        <span>{section.title}</span>
                        {assignedName && (
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs ml-2",
                              isAssignedToCurrentUser && "bg-yellow-400/20 border-yellow-400"
                            )}
                          >
                            {isAssignedToCurrentUser ? "You" : assignedName}
                          </Badge>
                        )}
                        {getStatusBadge(section.status)}
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
                                      section.assigned_to === member.id && "bg-yellow-400/20"
                                    )}
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    {member.name}
                                    {section.assigned_to === member.id && " ✓"}
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
            </ScrollArea>
            
            {/* Add Section Button - Only for Lead */}
            {isLead && (
              <Button
                onClick={() => setShowAddDialog(true)}
                size="sm"
                className="bg-yellow-400 hover:bg-yellow-500 text-black shrink-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            )}
          </div>

          {visibleSections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="m-0">
              {children(section.id)}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Section Dialog - Only for Lead */}
      {isLead && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
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
    </>
  )
}
