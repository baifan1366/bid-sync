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
import { Textarea } from "@/components/ui/textarea"
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
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [editorContent, setEditorContent] = React.useState<JSONContent | string>(
    initialData?.content || ""
  )
  const [formData, setFormData] = React.useState<ProposalFormData>({
    title: initialData?.title || "",
    content: initialData?.content || "",
    budgetEstimate: initialData?.budgetEstimate || null,
    timelineEstimate: initialData?.timelineEstimate || "",
    additionalInfo: initialData?.additionalInfo || {},
  })

  const handleEditorUpdate = (content: JSONContent) => {
    // Convert JSONContent to HTML string for storage
    const htmlContent = JSON.stringify(content)
    setFormData((prev) => ({ ...prev, content: htmlContent }))
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
    const missingRequired = sortedRequirements
      .filter((req) => req.required && !formData.additionalInfo[req.id])
      .map((req) => req.fieldName)

    if (missingRequired.length > 0) {
      alert(`Please fill in all required fields: ${missingRequired.join(", ")}`)
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

    switch (requirement.fieldType) {
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
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => updateAdditionalInfo(requirement.id, val)}
          >
            <SelectTrigger className="border-yellow-400/20">
              <SelectValue placeholder={`Select ${requirement.fieldName}`} />
            </SelectTrigger>
            <SelectContent>
              {requirement.options?.map((option) => (
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
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Enter a descriptive title for your proposal"
                className="border-yellow-400/20 focus:border-yellow-400"
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
                <Label htmlFor="budget">Budget Estimate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budgetEstimate || ""}
                    onChange={(e) =>
                      updateField("budgetEstimate", parseFloat(e.target.value) || null)
                    }
                    placeholder="0.00"
                    className="pl-9 border-yellow-400/20 focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="timeline">Timeline Estimate</Label>
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
          disabled={isSaving || isSubmitting || !formData.title || !formData.content}
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
