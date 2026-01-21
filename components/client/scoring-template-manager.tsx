"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Plus, X, GripVertical, AlertCircle, CheckCircle2 } from "lucide-react"
import type { ScoringTemplate, ScoringCriterion, CreateScoringCriterionInput } from "@/lib/graphql/types"

interface ScoringTemplateManagerProps {
  projectId: string
  existingTemplate?: ScoringTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: () => void
}

interface CriterionFormData extends CreateScoringCriterionInput {
  id?: string
}

const DEFAULT_TEMPLATES = [
  {
    name: "Technical",
    description: "Focus on technical approach and innovation",
    criteria: [
      { name: "Technical Approach", description: "Quality and feasibility of technical solution", weight: 30, orderIndex: 0 },
      { name: "Innovation & Creativity", description: "Novel ideas and creative solutions", weight: 20, orderIndex: 1 },
      { name: "Feasibility", description: "Practicality and achievability", weight: 25, orderIndex: 2 },
      { name: "Team Expertise", description: "Technical skills and experience", weight: 25, orderIndex: 3 },
    ],
  },
  {
    name: "Financial",
    description: "Focus on budget and cost considerations",
    criteria: [
      { name: "Budget Competitiveness", description: "Overall cost effectiveness", weight: 40, orderIndex: 0 },
      { name: "Cost Breakdown Clarity", description: "Transparency of pricing", weight: 20, orderIndex: 1 },
      { name: "Value for Money", description: "Quality relative to cost", weight: 25, orderIndex: 2 },
      { name: "Payment Terms", description: "Flexibility and reasonableness", weight: 15, orderIndex: 3 },
    ],
  },
  {
    name: "Balanced",
    description: "Balanced evaluation across all dimensions",
    criteria: [
      { name: "Technical Approach", description: "Quality of technical solution", weight: 25, orderIndex: 0 },
      { name: "Budget", description: "Cost effectiveness", weight: 25, orderIndex: 1 },
      { name: "Timeline", description: "Delivery schedule", weight: 20, orderIndex: 2 },
      { name: "Team Quality", description: "Experience and expertise", weight: 20, orderIndex: 3 },
      { name: "Communication", description: "Clarity and responsiveness", weight: 10, orderIndex: 4 },
    ],
  },
  {
    name: "Fast-Track",
    description: "Prioritize speed and availability",
    criteria: [
      { name: "Timeline", description: "Speed of delivery", weight: 40, orderIndex: 0 },
      { name: "Team Availability", description: "Immediate availability", weight: 30, orderIndex: 1 },
      { name: "Budget", description: "Cost considerations", weight: 20, orderIndex: 2 },
      { name: "Experience", description: "Relevant past work", weight: 10, orderIndex: 3 },
    ],
  },
]

export function ScoringTemplateManager({
  projectId,
  existingTemplate,
  open,
  onOpenChange,
  onSave,
}: ScoringTemplateManagerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDefaultTemplate, setSelectedDefaultTemplate] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [criteria, setCriteria] = useState<CriterionFormData[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Initialize form data when dialog opens or existing template changes
  useEffect(() => {
    if (open) {
      if (existingTemplate) {
        setTemplateName(existingTemplate.name)
        setTemplateDescription(existingTemplate.description || "")
        setCriteria(existingTemplate.criteria.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || "",
          weight: c.weight,
          orderIndex: c.orderIndex,
        })))
        setSelectedDefaultTemplate(null)
      } else {
        // Reset to empty state
        setTemplateName("")
        setTemplateDescription("")
        setCriteria([])
        setSelectedDefaultTemplate(null)
      }
    }
  }, [open, existingTemplate])

  const selectDefaultTemplate = (templateName: string) => {
    const template = DEFAULT_TEMPLATES.find(t => t.name === templateName)
    if (template) {
      setSelectedDefaultTemplate(templateName)
      setTemplateName(template.name)
      setTemplateDescription(template.description)
      setCriteria(template.criteria.map(c => ({ ...c })))
    }
  }

  const addCriterion = () => {
    const newCriterion: CriterionFormData = {
      name: "",
      description: "",
      weight: 0,
      orderIndex: criteria.length,
    }
    setCriteria([...criteria, newCriterion])
  }

  const removeCriterion = (index: number) => {
    const newCriteria = criteria.filter((_, i) => i !== index)
    // Update order indices
    const reorderedCriteria = newCriteria.map((c, idx) => ({
      ...c,
      orderIndex: idx,
    }))
    setCriteria(reorderedCriteria)
  }

  const updateCriterion = (index: number, updates: Partial<CriterionFormData>) => {
    setCriteria(
      criteria.map((c, i) => 
        i === index ? { ...c, ...updates } : c
      )
    )
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newCriteria = [...criteria]
    const draggedItem = newCriteria[draggedIndex]
    newCriteria.splice(draggedIndex, 1)
    newCriteria.splice(index, 0, draggedItem)

    // Update order indices
    const reorderedCriteria = newCriteria.map((c, idx) => ({
      ...c,
      orderIndex: idx,
    }))

    setCriteria(reorderedCriteria)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Calculate total weight
  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0)
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isWeightValid) {
      toast({
        title: "Invalid weights",
        description: "Total weight must equal 100%. Please adjust the weights.",
        variant: "destructive",
      })
      return
    }

    if (criteria.length === 0) {
      toast({
        title: "No criteria",
        description: "Please add at least one criterion.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const isUpdate = !!existingTemplate

      const mutation = isUpdate ? `
        mutation UpdateScoringTemplate($templateId: ID!, $input: UpdateScoringTemplateInput!) {
          updateScoringTemplate(templateId: $templateId, input: $input) {
            id
            projectId
            name
            description
            isDefault
            criteria {
              id
              name
              description
              weight
              orderIndex
            }
            createdBy
            createdAt
            updatedAt
          }
        }
      ` : `
        mutation CreateScoringTemplate($input: CreateScoringTemplateInput!) {
          createScoringTemplate(input: $input) {
            id
            projectId
            name
            description
            isDefault
            criteria {
              id
              name
              description
              weight
              orderIndex
            }
            createdBy
            createdAt
            updatedAt
          }
        }
      `

      const variables = isUpdate ? {
        templateId: existingTemplate.id,
        input: {
          name: templateName,
          description: templateDescription || null,
          criteria: criteria.map(c => ({
            id: c.id || null,
            name: c.name,
            description: c.description || null,
            weight: c.weight,
            orderIndex: c.orderIndex,
          })),
        },
      } : {
        input: {
          projectId,
          name: templateName,
          description: templateDescription || null,
          criteria: criteria.map(c => ({
            name: c.name,
            description: c.description || null,
            weight: c.weight,
            orderIndex: c.orderIndex,
          })),
        },
      }

      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      })

      const result = await response.json()

      if (result.errors) {
        console.error("GraphQL errors:", result.errors)
        const errorMessage = result.errors[0]?.message || `Failed to ${isUpdate ? 'update' : 'create'} scoring template`
        throw new Error(errorMessage)
      }
      
      // Close dialog
      onOpenChange(false)
      
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['scoringTemplate', projectId] })
      
      // Call onSave callback if provided
      if (onSave) {
        onSave()
      }
      
      toast({
        title: "Success",
        description: `Scoring template ${isUpdate ? 'updated' : 'created'} successfully!`,
      })
    } catch (error) {
      console.error(`Error ${existingTemplate ? 'updating' : 'creating'} scoring template:`, error)
      const errorMessage = error instanceof Error ? error.message : `Failed to ${existingTemplate ? 'update' : 'create'} scoring template`
      toast({
        title: `Failed to ${existingTemplate ? 'update' : 'create'} template`,
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <DialogTitle>
            {existingTemplate ? "Edit Scoring Template" : "Create Scoring Template"}
          </DialogTitle>
          <DialogDescription>
            {existingTemplate 
              ? "Update your scoring criteria and weights. Changes will affect future scoring."
              : "Choose a default template or create a custom one to evaluate proposals systematically."
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* Default Templates Selection (only for new templates) */}
            {!existingTemplate && (
              <>
                <div className="space-y-3">
                  <Label className="text-base">Choose a Default Template</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {DEFAULT_TEMPLATES.map((template) => (
                      <Card
                        key={template.name}
                        className={`p-4 cursor-pointer transition-all hover:border-yellow-400/40 ${
                          selectedDefaultTemplate === template.name
                            ? 'border-yellow-400 bg-yellow-400/5'
                            : 'border-yellow-400/20'
                        }`}
                        onClick={() => selectDefaultTemplate(template.name)}
                      >
                        <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                        <div className="text-xs text-muted-foreground">
                          {template.criteria.length} criteria
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator className="bg-yellow-400/20" />
              </>
            )}

            {/* Template Name and Description */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Technical Evaluation"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="template-description">Description (optional)</Label>
                <Textarea
                  id="template-description"
                  placeholder="Describe the purpose of this scoring template..."
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <Separator className="bg-yellow-400/20" />

            {/* Scoring Criteria */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Scoring Criteria</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add criteria to evaluate proposals. Weights must sum to 100%.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCriterion}
                  className="border-yellow-400/40 hover:bg-yellow-400/10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Criterion
                </Button>
              </div>

              {/* Weight Validation Alert */}
              {criteria.length > 0 && (
                <Alert className={isWeightValid ? "border-green-500/50 bg-green-500/5" : "border-yellow-400/50 bg-yellow-400/5"}>
                  {isWeightValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                  )}
                  <AlertDescription className={isWeightValid ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}>
                    Total weight: {totalWeight.toFixed(1)}% / 100%
                    {!isWeightValid && ` (${totalWeight > 100 ? 'reduce' : 'increase'} by ${Math.abs(100 - totalWeight).toFixed(1)}%)`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Criteria List */}
              {criteria.length > 0 && (
                <div className="space-y-3">
                  {criteria.map((criterion, index) => (
                    <div
                      key={index}
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2 space-y-1.5">
                              <Label htmlFor={`criterion-name-${index}`} className="text-sm">
                                Criterion Name *
                              </Label>
                              <Input
                                id={`criterion-name-${index}`}
                                placeholder="e.g., Technical Approach"
                                value={criterion.name}
                                onChange={(e) => updateCriterion(index, { name: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor={`criterion-weight-${index}`} className="text-sm">
                                Weight (%) *
                              </Label>
                              <Input
                                id={`criterion-weight-${index}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="0"
                                value={criterion.weight || ""}
                                onChange={(e) => updateCriterion(index, { weight: parseFloat(e.target.value) || 0 })}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`criterion-description-${index}`} className="text-sm">
                              Description (optional)
                            </Label>
                            <Textarea
                              id={`criterion-description-${index}`}
                              placeholder="Describe what this criterion evaluates..."
                              value={criterion.description || ""}
                              onChange={(e) => updateCriterion(index, { description: e.target.value })}
                              rows={2}
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCriterion(index)}
                          className="shrink-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {criteria.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-yellow-400/20 rounded-lg">
                  No criteria added. Click "Add Criterion" or select a default template to get started.
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
              disabled={isSubmitting || !isWeightValid || criteria.length === 0}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isSubmitting ? "Saving..." : existingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
