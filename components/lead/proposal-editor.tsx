"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Save,
  Send,
  Loader2,
  FileText,
  DollarSign,
  Clock,
  CalendarIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"
import { TipTapEditor } from "@/components/editor/tiptap-editor"
import { TitleEditor } from "@/components/editor/title-editor"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import type { JSONContent } from "@tiptap/core"

interface ProposalEditorProps {
  proposalId: string
  projectId: string
  initialData?: {
    title?: string
    content?: string
    budgetEstimate?: number
    timelineEstimate?: string
    additionalInfo?: Record<string, any>
  }
  requirements: AdditionalInfoRequirement[]
  onSave: (data: ProposalFormData) => Promise<void>
  onSubmit: (data: ProposalFormData) => Promise<void>
}

export interface ProposalFormData {
  title: string
  content: string
  budgetEstimate: number | null
  timelineEstimate: string
  additionalInfo: Record<string, any>
}

export function ProposalEditor({
  proposalId,
  projectId,
  initialData,
  requirements,
  onSave,
  onSubmit,
}: ProposalEditorProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // Parse initial content - it might be a JSON string or JSONContent object
  const parseContent = React.useCallback((content: string | undefined): JSONContent | string => {
    if (!content) return ""
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content)
        // Check if it's a valid TipTap JSONContent (has type: 'doc')
        if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
          return parsed as JSONContent
        }
        return content
      } catch {
        return content
      }
    }
    return content
  }, [])

  const [editorContent, setEditorContent] = React.useState<JSONContent | string>(
    parseContent(initialData?.content)
  )
  const [formData, setFormData] = React.useState<ProposalFormData>({
    title: initialData?.title || "",
    content: initialData?.content || "",
    budgetEstimate: initialData?.budgetEstimate || null,
    timelineEstimate: initialData?.timelineEstimate || "",
    additionalInfo: initialData?.additionalInfo || {},
  })

  // Reset form when proposal changes
  React.useEffect(() => {
    setEditorContent(parseContent(initialData?.content))
    setFormData({
      title: initialData?.title || "",
      content: initialData?.content || "",
      budgetEstimate: initialData?.budgetEstimate || null,
      timelineEstimate: initialData?.timelineEstimate || "",
      additionalInfo: initialData?.additionalInfo || {},
    })
  }, [proposalId, initialData?.title, initialData?.content, initialData?.budgetEstimate, initialData?.timelineEstimate, initialData?.additionalInfo, parseContent])

  const handleEditorUpdate = (content: JSONContent) => {
    // Store as JSON string for database storage
    const jsonString = JSON.stringify(content)
    setFormData((prev) => ({ ...prev, content: jsonString }))
    // Also update editor content state for proper rendering
    setEditorContent(content)
  }

  const sortedRequirements = React.useMemo(
    () => [...requirements].sort((a, b) => a.order - b.order),
    [requirements]
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(formData)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    // Validate required fields
    const validationErrors: string[] = []

    // Check title
    if (!formData.title?.trim()) {
      validationErrors.push("Proposal title is required")
    }

    // Check content
    if (!formData.content?.trim()) {
      validationErrors.push("Proposal content is required")
    }

    // Check budget estimate
    if (!formData.budgetEstimate || formData.budgetEstimate <= 0) {
      validationErrors.push("Budget estimate must be a positive number")
    }

    // Check timeline estimate
    if (!formData.timelineEstimate?.trim()) {
      validationErrors.push("Timeline estimate is required")
    }

    // Check additional info requirements
    const missingRequired = sortedRequirements
      .filter((req) => req.required && !formData.additionalInfo[req.id])
      .map((req) => req.fieldName)

    if (missingRequired.length > 0) {
      validationErrors.push(`Missing required fields: ${missingRequired.join(", ")}`)
    }

    if (validationErrors.length > 0) {
      // Show all validation errors
      toast({
        title: "Validation Error",
        description: validationErrors.join(". "),
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: keyof ProposalFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateAdditionalInfo = (requirementId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      additionalInfo: {
        ...prev.additionalInfo,
        [requirementId]: value,
      },
    }))
  }

  const renderRequirementField = (requirement: AdditionalInfoRequirement) => {
    const value = formData.additionalInfo[requirement.id]
    const fieldType = requirement.fieldType?.toLowerCase()

    switch (fieldType) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) => updateAdditionalInfo(requirement.id, e.target.value)}
            placeholder={requirement.helpText || `Enter ${requirement.fieldName}`}
            className="border-yellow-400/20 focus:border-yellow-400"
          />
        )

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => updateAdditionalInfo(requirement.id, e.target.value)}
            placeholder={requirement.helpText || `Enter ${requirement.fieldName}`}
            rows={4}
            className="border-yellow-400/20 focus:border-yellow-400"
          />
        )

      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => updateAdditionalInfo(requirement.id, parseFloat(e.target.value))}
            placeholder={requirement.helpText || `Enter ${requirement.fieldName}`}
            className="border-yellow-400/20 focus:border-yellow-400"
          />
        )

      case "date":
        return (
          <Input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ""}
            onChange={(e) => updateAdditionalInfo(requirement.id, e.target.value)}
            className="border-yellow-400/20 focus:border-yellow-400"
          />
        )

      case "select":
        // If no options available, fall back to text input
        if (!requirement.options || requirement.options.length === 0) {
          return (
            <Input
              value={value || ""}
              onChange={(e) => updateAdditionalInfo(requirement.id, e.target.value)}
              placeholder={requirement.helpText || `Enter ${requirement.fieldName}`}
              className="border-yellow-400/20 focus:border-yellow-400"
            />
          )
        }
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => updateAdditionalInfo(requirement.id, val)}
          >
            <SelectTrigger className="border-yellow-400/20">
              <SelectValue placeholder={`Select ${requirement.fieldName}`} />
            </SelectTrigger>
            <SelectContent>
              {requirement.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "file":
        return (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  updateAdditionalInfo(requirement.id, file.name)
                }
              }}
              className="border-yellow-400/20"
            />
            {value && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                File selected: {value}
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="p-6 border-yellow-400/20">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-black dark:text-white">
              Proposal Details
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Proposal Title *</Label>
              <TitleEditor
                value={formData.title}
                onChange={(value) => updateField("title", value)}
                placeholder="Enter a descriptive title for your proposal"
              />
            </div>

            <div>
              <Label htmlFor="content">Proposal Content *</Label>
              <div className="border border-yellow-400/20 rounded-lg overflow-hidden focus-within:border-yellow-400">
                <TipTapEditor
                  content={editorContent}
                  placeholder="Describe your approach, methodology, and why you're the best fit for this project..."
                  onUpdate={handleEditorUpdate}
                  minHeight="300px"
                  className="bg-white dark:bg-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget">Budget Estimate *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budgetEstimate || ""}
                    onChange={(e) =>
                      updateField("budgetEstimate", parseFloat(e.target.value) || null)
                    }
                    placeholder="Enter your budget estimate"
                    className="pl-9 border-yellow-400/20 focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="timeline">Timeline Estimate *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="timeline"
                    value={formData.timelineEstimate}
                    onChange={(e) => updateField("timelineEstimate", e.target.value)}
                    placeholder="e.g., 2-3 weeks"
                    className="pl-9 border-yellow-400/20 focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Additional Information Requirements */}
      {sortedRequirements.length > 0 && (
        <Card className="p-6 border-yellow-400/20">
          <div className="space-y-4">
            <div className="flex items-start gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  Additional Information Required
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The client has requested the following additional information
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {sortedRequirements.map((requirement, index) => (
                <div
                  key={requirement.id}
                  className="p-4 rounded-lg border border-yellow-400/10 bg-white dark:bg-black space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Label htmlFor={requirement.id} className="text-base">
                      {index + 1}. {requirement.fieldName}
                      {requirement.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    <div className="flex gap-1">
                      {requirement.required && (
                        <Badge className="bg-red-500 text-white text-xs">Required</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="border-yellow-400/20 text-xs capitalize"
                      >
                        {requirement.fieldType}
                      </Badge>
                    </div>
                  </div>

                  {requirement.helpText && (
                    <p className="text-xs text-muted-foreground">{requirement.helpText}</p>
                  )}

                  <div>{renderRequirementField(requirement)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 bg-white dark:bg-black p-4 rounded-lg border border-yellow-400/20 shadow-lg">
        <Button
          onClick={handleSave}
          disabled={isSaving || isSubmitting}
          variant="outline"
          className="flex-1 border-yellow-400/40 hover:bg-yellow-400/10"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </>
          )}
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={isSaving || isSubmitting}
          className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Proposal
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
