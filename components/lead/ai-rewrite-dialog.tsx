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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { AIAssistanceService } from "@/lib/ai-assistance-service"
import type { RewriteTextInput } from "@/lib/ai-assistance-service"
import {
  Loader2,
  RefreshCw,
  Check,
  X,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AIRewriteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalText: string
  onApply?: (content: string) => void
}

type ToneOption = "professional" | "technical" | "persuasive" | "concise"

const toneDescriptions: Record<ToneOption, string> = {
  professional: "Polished and business-appropriate",
  technical: "Precise with industry terminology",
  persuasive: "Compelling and benefit-focused",
  concise: "Clear and to-the-point",
}

/**
 * AIRewriteDialog Component
 * 
 * Dialog for rewriting text with AI to improve professionalism and clarity.
 * Supports different tone options and implements review-before-apply workflow.
 * 
 * Requirements: 10.3 - AI rewrite for text improvement
 * Requirements: 10.5 - Display content for review before applying
 */
export function AIRewriteDialog({
  open,
  onOpenChange,
  originalText,
  onApply,
}: AIRewriteDialogProps) {
  const [tone, setTone] = React.useState<ToneOption>("professional")
  const [context, setContext] = React.useState("")
  const [isRewriting, setIsRewriting] = React.useState(false)
  const [rewrittenContent, setRewrittenContent] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const { toast } = useToast()

  const handleRewrite = async () => {
    setIsRewriting(true)
    setError(null)

    try {
      const input: RewriteTextInput = {
        text: originalText,
        tone,
        context: context || undefined,
      }

      const result = await AIAssistanceService.rewriteText(input)

      if (result.success && result.data) {
        setRewrittenContent(result.data.content)
        toast({
          title: "Text Rewritten",
          description: "Review the improved text below and apply if satisfied.",
        })
      } else {
        setError(result.error || "Failed to rewrite text")
        toast({
          title: "Rewrite Failed",
          description: result.error || "Failed to rewrite text",
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
      setIsRewriting(false)
    }
  }

  const handleApply = () => {
    if (rewrittenContent && onApply) {
      onApply(rewrittenContent)
      toast({
        title: "Content Applied",
        description: "The rewritten text has been applied.",
      })
      handleClose()
    }
  }

  const handleClose = () => {
    setRewrittenContent(null)
    setError(null)
    setContext("")
    setTone("professional")
    onOpenChange(false)
  }

  const handleRegenerate = () => {
    setRewrittenContent(null)
    setError(null)
    handleRewrite()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <RefreshCw className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <DialogTitle className="text-black dark:text-white">
                Rewrite Text
              </DialogTitle>
              <DialogDescription>
                Improve your text for professionalism and clarity
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!rewrittenContent && !error && (
          <div className="space-y-4 py-4">
            {/* Original Text */}
            <div className="space-y-2">
              <Label className="text-black dark:text-white">
                Original Text
              </Label>
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 max-h-[200px] overflow-y-auto">
                <p className="text-sm text-black dark:text-white whitespace-pre-wrap">
                  {originalText}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {originalText.split(/\s+/).length} words
              </p>
            </div>

            {/* Tone Selection */}
            <div className="space-y-2">
              <Label htmlFor="tone" className="text-black dark:text-white">
                Writing Tone
              </Label>
              <Select value={tone} onValueChange={(value) => setTone(value as ToneOption)}>
                <SelectTrigger
                  id="tone"
                  className="border-yellow-400/20 focus:ring-yellow-400"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(toneDescriptions) as ToneOption[]).map((toneOption) => (
                    <SelectItem key={toneOption} value={toneOption}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium capitalize">{toneOption}</span>
                        <span className="text-xs text-muted-foreground">
                          {toneDescriptions[toneOption]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Additional Context */}
            <div className="space-y-2">
              <Label htmlFor="context" className="text-black dark:text-white">
                Additional Context (Optional)
              </Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Add context about the audience, purpose, or specific requirements..."
                className="min-h-[80px] border-yellow-400/20 focus-visible:ring-yellow-400"
              />
            </div>

            {/* Rewrite Button */}
            <Button
              onClick={handleRewrite}
              disabled={isRewriting}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            >
              {isRewriting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rewriting Text...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rewrite Text
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
                    Rewrite Failed
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
                disabled={isRewriting}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                {isRewriting ? (
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

        {rewrittenContent && (
          <div className="space-y-4 py-4">
            {/* Success Badge */}
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-400 text-black">
                <Check className="h-3 w-3 mr-1" />
                Text Rewritten
              </Badge>
              <Badge variant="outline" className="border-yellow-400/30 text-yellow-400 capitalize">
                {tone}
              </Badge>
            </div>

            {/* Comparison View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <Label className="text-black dark:text-white flex items-center gap-2">
                  Original
                  <Badge variant="outline" className="text-xs">
                    {originalText.split(/\s+/).length} words
                  </Badge>
                </Label>
                <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-black dark:text-white whitespace-pre-wrap">
                    {originalText}
                  </p>
                </div>
              </div>

              {/* Rewritten */}
              <div className="space-y-2">
                <Label className="text-black dark:text-white flex items-center gap-2">
                  Rewritten
                  <Badge variant="outline" className="text-xs border-yellow-400/30 text-yellow-400">
                    {rewrittenContent.split(/\s+/).length} words
                  </Badge>
                </Label>
                <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-black dark:text-white whitespace-pre-wrap">
                    {rewrittenContent}
                  </p>
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
                Apply Rewritten Text
              </Button>
              <Button
                onClick={handleRegenerate}
                variant="outline"
                disabled={isRewriting}
                className="border-yellow-400/20 hover:bg-yellow-400/10"
              >
                {isRewriting ? (
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
