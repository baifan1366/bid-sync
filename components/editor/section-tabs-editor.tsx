'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  GripVertical, 
  MessageSquare, 
  Paperclip, 
  User,
  Calendar,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { CollaborativeEditor } from './collaborative-editor'
import { SectionCommentPanel } from './section-comment-panel'
import { SectionAttachmentPanel } from './section-attachment-panel'
import { SectionAssignmentDialog } from './section-assignment-dialog'
import { AddSectionDialog } from './add-section-dialog'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface DocumentSection {
  id: string
  documentId: string
  title: string
  order: number
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  assignedTo?: string
  assignedToName?: string
  deadline?: string
  content: any
  unresolvedCommentsCount?: number
  attachmentsCount?: number
}

interface SectionTabsEditorProps {
  documentId: string
  sections: DocumentSection[]
  currentUserId: string
  isLead: boolean
  canUpload?: boolean // Whether user can upload attachments
  onSectionUpdate: (sectionId: string, content: any) => Promise<void>
  onSectionAdd: (title: string) => Promise<void>
  onSectionDelete: (sectionId: string) => Promise<void>
  onSectionReorder: (sections: DocumentSection[]) => Promise<void>
  onSectionAssign: (sectionId: string, userId: string, deadline?: string) => Promise<void>
  teamMembers: Array<{ id: string; name: string; email: string }>
}

/**
 * Section Tabs Editor Component
 * 
 * A tab-based collaborative editor where each section is a separate tab.
 * Similar to Google Docs tabs, with section assignment, comments, and attachments.
 * 
 * Features:
 * - Tab-based section navigation
 * - Section assignment to team members
 * - Section-specific comments (Word-style)
 * - Section-specific attachments (Teams-style)
 * - Drag-and-drop section reordering
 * - Status tracking per section
 */
export function SectionTabsEditor({
  documentId,
  sections,
  currentUserId,
  isLead,
  canUpload = true, // Default to true, RLS will control actual permissions
  onSectionUpdate,
  onSectionAdd,
  onSectionDelete,
  onSectionReorder,
  onSectionAssign,
  teamMembers,
}: SectionTabsEditorProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || '')
  const [showComments, setShowComments] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false)
  const [draggedSection, setDraggedSection] = useState<string | null>(null)

  // Update active section when sections change
  useEffect(() => {
    if (!activeSection && sections.length > 0) {
      setActiveSection(sections[0].id)
    }
  }, [sections, activeSection])

  const currentSection = sections.find(s => s.id === activeSection)

  const handleSectionSave = async (content: any) => {
    if (activeSection) {
      await onSectionUpdate(activeSection, content)
    }
  }

  const handleDragStart = (sectionId: string) => {
    setDraggedSection(sectionId)
  }

  const handleDragOver = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault()
    if (!draggedSection || draggedSection === targetSectionId) return

    const draggedIndex = sections.findIndex(s => s.id === draggedSection)
    const targetIndex = sections.findIndex(s => s.id === targetSectionId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newSections = [...sections]
    const [removed] = newSections.splice(draggedIndex, 1)
    newSections.splice(targetIndex, 0, removed)

    // Update order numbers
    const reorderedSections = newSections.map((section, index) => ({
      ...section,
      order: index,
    }))

    onSectionReorder(reorderedSections)
  }

  const handleDragEnd = () => {
    setDraggedSection(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'in_review':
        return 'bg-blue-500'
      case 'in_progress':
        return 'bg-yellow-400'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'in_review':
        return 'In Review'
      case 'in_progress':
        return 'In Progress'
      default:
        return 'Not Started'
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="flex-1 flex flex-col">
        <div className="border-b border-yellow-400/20 bg-white dark:bg-black">
          <div className="flex items-center justify-between px-4 py-2">
            <TabsList className="h-auto bg-transparent p-0 gap-1">
              {sections.map((section) => (
                <div
                  key={section.id}
                  draggable={isLead}
                  onDragStart={() => handleDragStart(section.id)}
                  onDragOver={(e) => handleDragOver(e, section.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'relative group',
                    draggedSection === section.id && 'opacity-50'
                  )}
                >
                  <TabsTrigger
                    value={section.id}
                    className={cn(
                      'relative px-4 py-2 rounded-t-md border-b-2 transition-colors',
                      'data-[state=active]:border-yellow-400 data-[state=active]:bg-yellow-400/10',
                      'data-[state=inactive]:border-transparent hover:bg-yellow-400/5'
                    )}
                  >
                    {isLead && (
                      <GripVertical className="h-4 w-4 mr-2 text-muted-foreground cursor-grab" />
                    )}
                    <span className="font-medium">{section.title}</span>
                    
                    {/* Status indicator */}
                    <div className={cn('ml-2 h-2 w-2 rounded-full', getStatusColor(section.status))} />
                    
                    {/* Badges for comments and attachments */}
                    <div className="ml-2 flex items-center gap-1">
                      {section.unresolvedCommentsCount ? (
                        <Badge variant="outline" className="h-5 px-1 text-xs border-yellow-400 text-yellow-400">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {section.unresolvedCommentsCount}
                        </Badge>
                      ) : null}
                      {section.attachmentsCount ? (
                        <Badge variant="outline" className="h-5 px-1 text-xs border-yellow-400 text-yellow-400">
                          <Paperclip className="h-3 w-3 mr-1" />
                          {section.attachmentsCount}
                        </Badge>
                      ) : null}
                    </div>

                    {/* Section menu (only for leads) */}
                    {isLead && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                            <User className="h-4 w-4 mr-2" />
                            Assign Member
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSectionDelete(section.id)} className="text-red-500">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Section
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TabsTrigger>
                </div>
              ))}

              {/* Add Section Button */}
              {isLead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddSectionDialogOpen(true)}
                  className="ml-2 hover:bg-yellow-400/10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Section
                </Button>
              )}
            </TabsList>

            {/* Section Info and Actions */}
            {currentSection && (
              <div className="flex items-center gap-2">
                {/* Assignment info */}
                {currentSection.assignedTo && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                    <User className="h-3 w-3 mr-1" />
                    {currentSection.assignedToName || 'Assigned'}
                  </Badge>
                )}

                {/* Deadline info */}
                {currentSection.deadline && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(currentSection.deadline).toLocaleDateString()}
                  </Badge>
                )}

                {/* Status badge */}
                <Badge className={cn('text-white', getStatusColor(currentSection.status))}>
                  {currentSection.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {currentSection.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                  {getStatusLabel(currentSection.status)}
                </Badge>

                {/* Toggle Comments */}
                <Button
                  variant={showComments ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setShowComments(!showComments)
                    setShowAttachments(false)
                  }}
                  className={cn(
                    showComments && 'bg-yellow-400 hover:bg-yellow-500 text-black',
                    !showComments && 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10'
                  )}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Comments
                  {currentSection.unresolvedCommentsCount ? (
                    <Badge className="ml-2 bg-red-500 text-white">
                      {currentSection.unresolvedCommentsCount}
                    </Badge>
                  ) : null}
                </Button>

                {/* Toggle Attachments */}
                <Button
                  variant={showAttachments ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setShowAttachments(!showAttachments)
                    setShowComments(false)
                  }}
                  className={cn(
                    showAttachments && 'bg-yellow-400 hover:bg-yellow-500 text-black',
                    !showAttachments && 'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10'
                  )}
                >
                  <Paperclip className="h-4 w-4 mr-1" />
                  Attachments
                  {currentSection.attachmentsCount ? (
                    <Badge className="ml-2 bg-yellow-400 text-black">
                      {currentSection.attachmentsCount}
                    </Badge>
                  ) : null}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Section Content */}
        <div className="flex-1 flex overflow-hidden">
          {sections.map((section) => (
            <TabsContent
              key={section.id}
              value={section.id}
              className="flex-1 m-0 overflow-hidden"
            >
              <div className="h-full flex">
                {/* Editor Area */}
                <div className={cn(
                  'flex-1 overflow-auto transition-all',
                  (showComments || showAttachments) && 'mr-96'
                )}>
                  <div className="p-6">
                    <CollaborativeEditor
                      documentId={section.id}
                      initialContent={section.content}
                      placeholder={`Write content for ${section.title}...`}
                      editable={!section.assignedTo || section.assignedTo === currentUserId || isLead}
                      onSave={handleSectionSave}
                      autoSave={true}
                      showToolbar={true}
                      className="min-h-[600px]"
                    />
                  </div>
                </div>

                {/* Side Panels */}
                {showComments && (
                  <div className="fixed right-0 top-0 bottom-0 w-96 border-l border-yellow-400/20 bg-white dark:bg-black overflow-auto">
                    <SectionCommentPanel
                      sectionId={section.id}
                      documentId={documentId}
                      currentUserId={currentUserId}
                      isLead={isLead}
                      onClose={() => setShowComments(false)}
                    />
                  </div>
                )}

                {showAttachments && (
                  <div className="fixed right-0 top-0 bottom-0 w-96 border-l border-yellow-400/20 bg-white dark:bg-black overflow-auto">
                    <SectionAttachmentPanel
                      sectionId={section.id}
                      documentId={documentId}
                      currentUserId={currentUserId}
                      isLead={isLead}
                      canUpload={canUpload}
                      onClose={() => setShowAttachments(false)}
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Dialogs */}
      {currentSection && (
        <SectionAssignmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          sectionId={currentSection.id}
          sectionTitle={currentSection.title}
          currentAssignee={currentSection.assignedTo}
          currentDeadline={currentSection.deadline}
          teamMembers={teamMembers}
          onAssign={onSectionAssign}
        />
      )}

      <AddSectionDialog
        open={addSectionDialogOpen}
        onOpenChange={setAddSectionDialogOpen}
        onAdd={onSectionAdd}
      />
    </div>
  )
}
