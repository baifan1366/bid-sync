"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  FileText,
  RefreshCw,
  FileSignature,
  Wand2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AIDraftDialog } from "./ai-draft-dialog"
import { AIRewriteDialog } from "./ai-rewrite-dialog"
import { AISummaryDialog } from "./ai-summary-dialog"

interface AIAssistancePanelProps {
  projectTitle?: string
  projectDescription?: string
  sectionTitle?: string
  selectedText?: string
  proposalContent?: string
  onApplyContent?: (content: string) => void
  className?: string
}

/**
 * AIAssistancePanel Component
 * 
 * Main panel displaying AI assistance options for proposal writing.
 * Provides access to draft generation, text rewriting, and summarization.
 * 
 * Requirements: 10.1 - Display AI assistance options
 */
export function AIAssistancePanel({
  projectTitle,
  projectDescription,
  sectionTitle,
  selectedText,
  proposalContent,
  onApplyContent,
  className,
}: AIAssistancePanelProps) {
  const [isDraftDialogOpen, setIsDraftDialogOpen] = React.useState(false)
  const [isRewriteDialogOpen, setIsRewriteDialogOpen] = React.useState(false)
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false)

  const canGenerateDraft = projectTitle && projectDescription && sectionTitle
  const canRewrite = selectedText && selectedText.trim().length > 0
  const canSummarize = proposalContent && proposalContent.trim().length > 0

  return (
    <Card className={cn("p-6 border-yellow-400/20 bg-white dark:bg-black", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-yellow-400/10">
          <Sparkles className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white">
            AI Assistance
          </h3>
          <p className="text-sm text-muted-foreground">
            Enhance your proposal with AI-powered tools
          </p>
        </div>
      </div>

      {/* AI Options */}
      <div className="space-y-3">
        {/* Generate Draft */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
          <div className="p-2 rounded-lg bg-yellow-400/10 shrink-0">
            <FileText className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-black dark:text-white">
                Generate Draft
              </h4>
              <Badge
                variant="outline"
                className="border-yellow-400/30 text-yellow-400 text-xs"
              >
                New
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Create professional content based on project requirements
            </p>
            <Button
              size="sm"
              onClick={() => setIsDraftDialogOpen(true)}
              disabled={!canGenerateDraft}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Draft
            </Button>
            {!canGenerateDraft && (
              <p className="text-xs text-muted-foreground mt-2">
                Project details required
              </p>
            )}
          </div>
        </div>

        {/* Rewrite Text */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
          <div className="p-2 rounded-lg bg-yellow-400/10 shrink-0">
            <RefreshCw className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-black dark:text-white">
                Rewrite Text
              </h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Improve selected text for professionalism and clarity
            </p>
            <Button
              size="sm"
              onClick={() => setIsRewriteDialogOpen(true)}
              disabled={!canRewrite}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Rewrite Text
            </Button>
            {!canRewrite && (
              <p className="text-xs text-muted-foreground mt-2">
                Select text to rewrite
              </p>
            )}
          </div>
        </div>

        {/* Generate Summary */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
          <div className="p-2 rounded-lg bg-yellow-400/10 shrink-0">
            <FileSignature className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-black dark:text-white">
                Generate Summary
              </h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Create an executive summary from your proposal content
            </p>
            <Button
              size="sm"
              onClick={() => setIsSummaryDialogOpen(true)}
              disabled={!canSummarize}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <FileSignature className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
            {!canSummarize && (
              <p className="text-xs text-muted-foreground mt-2">
                Proposal content required
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AIDraftDialog
        open={isDraftDialogOpen}
        onOpenChange={setIsDraftDialogOpen}
        projectTitle={projectTitle || ""}
        projectDescription={projectDescription || ""}
        sectionTitle={sectionTitle || ""}
        onApply={onApplyContent}
      />

      <AIRewriteDialog
        open={isRewriteDialogOpen}
        onOpenChange={setIsRewriteDialogOpen}
        originalText={selectedText || ""}
        onApply={onApplyContent}
      />

      <AISummaryDialog
        open={isSummaryDialogOpen}
        onOpenChange={setIsSummaryDialogOpen}
        proposalContent={proposalContent || ""}
        onApply={onApplyContent}
      />
    </Card>
  )
}
