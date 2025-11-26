"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { AIAssistanceService } from "@/lib/ai-assistance-service"
import type { GenerateDraftInput } from "@/lib/ai-assistance-service"
import {
  Loader2,
  Wand2,
  Check,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AIDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectTitle: string
  projectDescription: string
  sectionTitle: string
  budget?: number
  deadline?: string
  onApply?: (content: string) => void
}

/**
 * AIDraftDialog Component
 * 
 * Dialog for generating draft content using AI based on project requirements.
 * Implements review-before-apply workflow.
 * 
 * Requirements: 10.2 - AI draft generation from project requirements
 * Requirements: 10.5 - Display content for review before applying
 */
export function AIDraftDialog({
  open,
  onOpenChange,
  projectTitle,
  projectDescription,
  sectionTitle,
  budget,
  deadline,
  onApply,
}: AIDraftDialogProps) {
  const [additionalContext, setAdditionalContext] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedContent, setGeneratedContent] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const input: GenerateDraftInput = {
        projectTitle,
        projectDescription,
        sectionTitle,
        additionalContext: additionalContext || undefined,
        budget,
        deadline,
      }

      const result = await AIAssistanceService.generateDraft(input)

      if (result.success && result.data) {
        setGeneratedContent(result.data.content)
        toast({
          title: "Draft Generated",
          description: "Review the content below and apply if satisfied.",
        })
      } else {
        setError(result.error || "Failed to generate draft")
        toast({
          title: "Generation Failed",
          description: result.error || "Failed to generate draft",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApply = () => {
    if (generatedContent && onApply) {
      onApply(generatedContent)
      toast({
        title: "Content Applied",
        description: "The generated content has been added to your section.",
      })
      handleClose()
    }
  }

  const handleClose = () => {
    setGeneratedContent(null)
    setError(null)
    setAdditionalContext("")
    onOpenChange(false)
  }

  const handleRegenerate = () => {
    setGeneratedContent(null)
    setError(null)
    handleGenerate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <Wand2 className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <DialogTitle className="text-black dark:text-white">
                Generate Draft Content
              </DialogTitle>
              <DialogDescription>
                AI will create professional content based on your project details
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!generatedContent && !error && (
          <div className="space-y-4 py-4">
            {/* Project Details Summary */}
            <div className="p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <p className="text-sm font-semibold text-black dark:text-white">
                  Project Details
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-black dark:text-white">Project:</span>{" "}
                  {projectTitle}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-black dark:text-white">Section:</span>{" "}
                  {sectionTitle}
                </p>
                {budget && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-black dark:text-white">Budget:</span>{" "}
                    ${budget.toLocaleString()}
                  </p>
                )}
                {deadline && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-black dark:text-white">Deadline:</span>{" "}
                    {new Date(deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <Label htmlFor="context" className="text-black dark:text-white">
                Additional Context (Optional)
              </Label>
              <Textarea
                id="context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Add any specific requirements, tone preferences, or key points to include..."
                className="min-h-[100px] border-yellow-400/20 focus-visible:ring-yellow-400"
              />
              <p className="text-xs text-muted-foreground">
                Provide extra details to help AI generate more relevant content
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Draft
                </>
              )}
            </Button>
          </div>
        )}

        {error && (
          <div className="py-4">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 dark:text-red-100 mb-1">
                    Generation Failed
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Try Again"
                )}
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-yellow-400/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {generatedContent && (
          <div className="space-y-4 py-4">
            {/* Success Badge */}
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-400 text-black">
                <Check className="h-3 w-3 mr-1" />
                Draft Generated
              </Badge>
              <p className="text-sm text-muted-foreground">
                Review and apply if satisfied
              </p>
            </div>

            {/* Generated Content */}
            <div className="space-y-2">
              <Label className="text-black dark:text-white">
                Generated Content
              </Label>
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 max-h-[400px] overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-black dark:text-white">
                    {generatedContent}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleApply}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                <Check className="h-4 w-4 mr-2" />
                Apply Content
              </Button>
              <Button
                onClick={handleRegenerate}
                variant="outline"
                disabled={isGenerating}
                className="border-yellow-400/20 hover:bg-yellow-400/10"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Regenerate"
                )}
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-yellow-400/20 hover:bg-yellow-400/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
