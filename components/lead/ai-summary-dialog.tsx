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
import type { GenerateSummaryInput } from "@/lib/ai-assistance-service"
import {
  Loader2,
  FileSignature,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Lightbulb,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AISummaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalContent: string
  onApply?: (content: string) => void
}

/**
 * AISummaryDialog Component
 * 
 * Dialog for generating executive summaries from proposal content using AI.
 * Supports customizable length and focus areas with review-before-apply workflow.
 * 
 * Requirements: 10.4 - AI summarization for executive summaries
 * Requirements: 10.5 - Display content for review before applying
 */
export function AISummaryDialog({
  open,
  onOpenChange,
  proposalContent,
  onApply,
}: AISummaryDialogProps) {
  const [maxLength, setMaxLength] = React.useState(300)
  const [focusAreas, setFocusAreas] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedSummary, setGeneratedSummary] = React.useState<string | null>(null)
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const focusAreasArray = focusAreas
        .split(",")
        .map((area) => area.trim())
        .filter((area) => area.length > 0)

      const input: GenerateSummaryInput = {
        proposalContent,
        maxLength,
        focusAreas: focusAreasArray.length > 0 ? focusAreasArray : undefined,
      }

      const result = await AIAssistanceService.generateSummary(input)

      if (result.success && result.data) {
        setGeneratedSummary(result.data.content)
        setSuggestions(result.data.suggestions || [])
        toast({
          title: "Summary Generated",
          description: "Review the executive summary below and apply if satisfied.",
        })
      } else {
        setError(result.error || "Failed to generate summary")
        toast({
          title: "Generation Failed",
          description: result.error || "Failed to generate summary",
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
    if (generatedSummary && onApply) {
      onApply(generatedSummary)
      toast({
        title: "Summary Applied",
        description: "The executive summary has been added to your proposal.",
      })
      handleClose()
    }
  }

  const handleClose = () => {
    setGeneratedSummary(null)
    setSuggestions([])
    setError(null)
    setFocusAreas("")
    setMaxLength(300)
    onOpenChange(false)
  }

  const handleRegenerate = () => {
    setGeneratedSummary(null)
    setSuggestions([])
    setError(null)
    handleGenerate()
  }

  const wordCount = proposalContent.split(/\s+/).filter((w) => w.length > 0).length
  const summaryWordCount = generatedSummary
    ? generatedSummary.split(/\s+/).filter((w) => w.length > 0).length
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <FileSignature className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <DialogTitle className="text-black dark:text-white">
                Generate Executive Summary
              </DialogTitle>
              <DialogDescription>
                Create a concise summary from your proposal content
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!generatedSummary && !error && (
          <div className="space-y-4 py-4">
            {/* Content Info */}
            <div className="p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-yellow-400" />
                <p className="text-sm font-semibold text-black dark:text-white">
                  Proposal Content
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Badge variant="outline" className="border-yellow-400/30 text-yellow-400">
                  {wordCount} words
                </Badge>
                <span>Will be summarized to ~{maxLength} words</span>
              </div>
            </div>

            {/* Max Length */}
            <div className="space-y-2">
              <Label htmlFor="maxLength" className="text-black dark:text-white">
                Maximum Length (words)
              </Label>
              <Input
                id="maxLength"
                type="number"
                min="50"
                max="1000"
                step="50"
                value={maxLength}
                onChange={(e) => setMaxLength(parseInt(e.target.value) || 300)}
                className="border-yellow-400/20 focus-visible:ring-yellow-400"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 200-400 words for executive summaries
              </p>
            </div>

            {/* Focus Areas */}
            <div className="space-y-2">
              <Label htmlFor="focusAreas" className="text-black dark:text-white">
                Focus Areas (Optional)
              </Label>
              <Textarea
                id="focusAreas"
                value={focusAreas}
                onChange={(e) => setFocusAreas(e.target.value)}
                placeholder="e.g., cost savings, timeline, ROI, technical approach"
                className="min-h-[80px] border-yellow-400/20 focus-visible:ring-yellow-400"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple areas with commas
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
                  Generating Summary...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Generate Summary
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

        {generatedSummary && (
          <div className="space-y-4 py-4">
            {/* Success Badge */}
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-400 text-black">
                <Check className="h-3 w-3 mr-1" />
                Summary Generated
              </Badge>
              <Badge variant="outline" className="border-yellow-400/30 text-yellow-400">
                {summaryWordCount} words
              </Badge>
            </div>

            {/* Generated Summary */}
            <div className="space-y-2">
              <Label className="text-black dark:text-white">
                Executive Summary
              </Label>
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 max-h-[300px] overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-black dark:text-white">
                    {generatedSummary}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  <Label className="text-black dark:text-white">
                    Improvement Suggestions
                  </Label>
                </div>
                <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                  <ul className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-yellow-400 shrink-0">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleApply}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                <Check className="h-4 w-4 mr-2" />
                Apply Summary
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
