'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface AddSectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (title: string, description?: string) => Promise<void>
}

/**
 * Add Section Dialog Component
 * 
 * Allows bidding leads to add new sections to the document.
 */
export function AddSectionDialog({
  open,
  onOpenChange,
  onAdd,
}: AddSectionDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!title.trim()) return

    setLoading(true)
    try {
      await onAdd(title, description || undefined)
      setTitle('')
      setDescription('')
      onOpenChange(false)
    } catch (error) {
      console.error('Error adding section:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-yellow-400/20">
        <DialogHeader>
          <DialogTitle>Add New Section</DialogTitle>
          <DialogDescription>
            Create a new section for your proposal document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Section Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Section Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Executive Summary, Technical Approach, Budget"
              className="border-yellow-400/20 focus-visible:ring-yellow-400"
            />
          </div>

          {/* Section Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this section should contain..."
              className="min-h-[100px] border-yellow-400/20 focus-visible:ring-yellow-400"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!title.trim() || loading}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {loading ? 'Adding...' : 'Add Section'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
