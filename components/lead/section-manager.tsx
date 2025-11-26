"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Loader2,
  FileText,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import type { DocumentSection } from "@/lib/section-management-service"

interface SectionManagerProps {
  documentId: string
  sections: DocumentSection[]
  teamMembers?: Array<{ id: string; name: string; email: string }>
  onAddSection: (title: string) => Promise<void>
  onUpdateSection: (sectionId: string, updates: { title?: string; order?: number }) => Promise<void>
  onDeleteSection: (sectionId: string) => Promise<void>
  onReorderSections: (reorders: Array<{ sectionId: string; newOrder: number }>) => Promise<void>
  onAssignSection?: (sectionId: string, userId: string, deadline?: string) => void
  onSetDeadline?: (sectionId: string, deadline: string) => void
  className?: string
}

/**
 * SectionManager Component
 * 
 * Manages proposal sections with operations for:
 * - Adding new sections
 * - Editing section titles
 * - Deleting sections (with archival)
 * - Reordering sections via drag and drop
 * - Viewing section status and assignments
 * 
 * Requirements: 6.1, 6.2, 8.1, 8.3, 8.4, 8.5
 */
export function SectionManager({
  documentId,
  sections,
  teamMembers = [],
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  onAssignSection,
  onSetDeadline,
  className,
}: SectionManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [newSectionTitle, setNewSectionTitle] = React.useState("")
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = React.useState("")
  const [deletingSectionId, setDeletingSectionId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)

  // Sort sections by order
  const sortedSections = React.useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections]
  )

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return

    setIsLoading(true)
    try {
      await onAddSection(newSectionTitle.trim())
      setNewSectionTitle("")
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error("Error adding section:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSection = async () => {
    if (!editingSectionId || !editingSectionTitle.trim()) return

    setIsLoading(true)
    try {
      await onUpdateSection(editingSectionId, { title: editingSectionTitle.trim() })
      setEditingSectionId(null)
      setEditingSectionTitle("")
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Error editing section:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSection = async () => {
    if (!deletingSectionId) return

    setIsLoading(true)
    try {
      await onDeleteSection(deletingSectionId)
      setDeletingSectionId(null)
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting section:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const openEditDialog = (section: DocumentSection) => {
    setEditingSectionId(section.id)
    setEditingSectionTitle(section.title)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (sectionId: string) => {
    setDeletingSectionId(sectionId)
    setIsDeleteDialogOpen(true)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const reorderedSections = [...sortedSections]
    const [draggedSection] = reorderedSections.splice(draggedIndex, 1)
    reorderedSections.splice(dropIndex, 0, draggedSection)

    // Create reorder instructions
    const reorders = reorderedSections.map((section, index) => ({
      sectionId: section.id,
      newOrder: index,
    }))

    setIsLoading(true)
    try {
      await onReorderSections(reorders)
    } catch (error) {
      console.error("Error reordering sections:", error)
    } finally {
      setIsLoading(false)
      setDraggedIndex(null)
      setDragOverIndex(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case "in_progress":
        return (
          <Badge className="bg-yellow-400 text-black">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        )
      case "in_review":
        return (
          <Badge className="bg-blue-500 text-white">
            <AlertCircle className="h-3 w-3 mr-1" />
            In Review
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-yellow-400/20">
            Not Started
          </Badge>
        )
    }
  }

  const getAssigneeName = (assignedTo?: string) => {
    if (!assignedTo) return "Unassigned"
    const member = teamMembers.find((m) => m.id === assignedTo)
    return member?.name || "Unknown"
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-black dark:text-white">
            Proposal Sections
          </h3>
          <Badge variant="outline" className="border-yellow-400/20">
            {sortedSections.length} sections
          </Badge>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Section
        </Button>
      </div>

      {/* Sections List */}
      <div className="space-y-2">
        {sortedSections.length === 0 ? (
          <Card className="p-8 border-yellow-400/20 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No sections yet. Add your first section to get started.
            </p>
          </Card>
        ) : (
          sortedSections.map((section, index) => (
            <Card
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "p-4 border-yellow-400/20 cursor-move transition-all",
                draggedIndex === index && "opacity-50",
                dragOverIndex === index && "border-yellow-400 border-2"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div className="mt-1">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Section Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-black dark:text-white">
                        {index + 1}. {section.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(section.status)}
                    </div>
                  </div>

                  {/* Section Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{getAssigneeName(section.assignedTo)}</span>
                    </div>
                    {section.deadline && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Due: {new Date(section.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(section)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDeleteDialog(section.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Section Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>
              Create a new section for your proposal. You can assign it to a team member later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="section-title">Section Title *</Label>
              <Input
                id="section-title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Executive Summary, Technical Approach"
                className="border-yellow-400/20 focus:border-yellow-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAddSection()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSection}
              disabled={!newSectionTitle.trim() || isLoading}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>
              Update the section title.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-section-title">Section Title *</Label>
              <Input
                id="edit-section-title"
                value={editingSectionTitle}
                onChange={(e) => setEditingSectionTitle(e.target.value)}
                placeholder="Enter section title"
                className="border-yellow-400/20 focus:border-yellow-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleEditSection()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSection}
              disabled={!editingSectionTitle.trim() || isLoading}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? The content will be archived
              and can be recovered if needed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Section"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
