"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Plus, X, GripVertical } from "lucide-react"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    budget: "",
    deadline: "",
  })
  const [additionalInfoRequirements, setAdditionalInfoRequirements] = useState<AdditionalInfoRequirement[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addRequirement = () => {
    const newRequirement: AdditionalInfoRequirement = {
      id: crypto.randomUUID(),
      fieldName: "",
      fieldType: "text",
      required: false,
      helpText: "",
      order: additionalInfoRequirements.length,
    }
    setAdditionalInfoRequirements([...additionalInfoRequirements, newRequirement])
  }

  const removeRequirement = (id: string) => {
    setAdditionalInfoRequirements(additionalInfoRequirements.filter(req => req.id !== id))
  }

  const updateRequirement = (id: string, updates: Partial<AdditionalInfoRequirement>) => {
    setAdditionalInfoRequirements(
      additionalInfoRequirements.map(req => 
        req.id === id ? { ...req, ...updates } : req
      )
    )
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newRequirements = [...additionalInfoRequirements]
    const draggedItem = newRequirements[draggedIndex]
    newRequirements.splice(draggedIndex, 1)
    newRequirements.splice(index, 0, draggedItem)

    // Update order property
    const reorderedRequirements = newRequirements.map((req, idx) => ({
      ...req,
      order: idx,
    }))

    setAdditionalInfoRequirements(reorderedRequirements)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateProject($input: CreateProjectInput!) {
              createProject(input: $input) {
                id
                title
                additionalInfoRequirements {
                  id
                  fieldName
                  fieldType
                  required
                  helpText
                  options
                  order
                }
              }
            }
          `,
          variables: {
            input: {
              title: formData.title,
              description: formData.description,
              budget: formData.budget ? parseFloat(formData.budget) : null,
              deadline: formData.deadline || null,
              additionalInfoRequirements: additionalInfoRequirements.map(req => ({
                id: req.id,
                fieldName: req.fieldName,
                fieldType: req.fieldType.toUpperCase(),
                required: req.required,
                helpText: req.helpText || null,
                options: req.options || null,
                order: req.order,
              })),
            },
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        console.error("GraphQL errors:", result.errors)
        const errorMessage = result.errors[0]?.message || 'Failed to create project'
        throw new Error(errorMessage)
      }
      
      // Close dialog and reset form
      onOpenChange(false)
      setFormData({ title: "", description: "", budget: "", deadline: "" })
      setAdditionalInfoRequirements([])
      
      // Invalidate projects query to refetch
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      
      // Refresh the page to show new project
      router.refresh()
    } catch (error) {
      console.error("Error creating project:", error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
      alert(`Failed to create project: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new project. You can edit these later.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Website Redesign"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your project requirements..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="budget">Budget (optional)</Label>
              <Input
                id="budget"
                type="number"
                placeholder="e.g., 5000"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline (optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>

            <Separator className="my-2" />

            {/* Additional Info Requirements Section */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Additional Information Requirements</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Specify custom fields that bidding teams must complete when submitting proposals
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRequirement}
                  className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field
                </Button>
              </div>

              {additionalInfoRequirements.length > 0 && (
                <div className="space-y-3">
                  {additionalInfoRequirements.map((requirement, index) => (
                    <div
                      key={requirement.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`border border-yellow-400/20 rounded-lg p-4 space-y-3 cursor-move hover:border-yellow-400/40 transition-colors ${
                        draggedIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                        
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`field-name-${requirement.id}`} className="text-sm">
                                Field Name *
                              </Label>
                              <Input
                                id={`field-name-${requirement.id}`}
                                placeholder="e.g., Company Registration Number"
                                value={requirement.fieldName}
                                onChange={(e) => updateRequirement(requirement.id, { fieldName: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor={`field-type-${requirement.id}`} className="text-sm">
                                Field Type *
                              </Label>
                              <Select
                                value={requirement.fieldType}
                                onValueChange={(value) => updateRequirement(requirement.id, { 
                                  fieldType: value as AdditionalInfoRequirement['fieldType']
                                })}
                              >
                                <SelectTrigger id={`field-type-${requirement.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="textarea">Textarea</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="date">Date</SelectItem>
                                  <SelectItem value="file">File Upload</SelectItem>
                                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`help-text-${requirement.id}`} className="text-sm">
                              Help Text (optional)
                            </Label>
                            <Input
                              id={`help-text-${requirement.id}`}
                              placeholder="Provide guidance for this field..."
                              value={requirement.helpText || ""}
                              onChange={(e) => updateRequirement(requirement.id, { helpText: e.target.value })}
                            />
                          </div>

                          {requirement.fieldType === 'select' && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`options-${requirement.id}`} className="text-sm">
                                Options (comma-separated)
                              </Label>
                              <Input
                                id={`options-${requirement.id}`}
                                placeholder="e.g., Option 1, Option 2, Option 3"
                                value={requirement.optionsString || requirement.options?.join(', ') || ""}
                                onChange={(e) => updateRequirement(requirement.id, { 
                                  optionsString: e.target.value,
                                  options: e.target.value.split(',').map(opt => opt.trim()).filter(Boolean)
                                })}
                              />
                            </div>
                          )}

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`required-${requirement.id}`}
                              checked={requirement.required}
                              onCheckedChange={(checked) => 
                                updateRequirement(requirement.id, { required: checked as boolean })
                              }
                            />
                            <Label
                              htmlFor={`required-${requirement.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Required field
                            </Label>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRequirement(requirement.id)}
                          className="shrink-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {additionalInfoRequirements.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-yellow-400/40 rounded-lg bg-yellow-400/5">
                  No additional requirements added. Click "Add Field" to create custom fields for proposals.
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
