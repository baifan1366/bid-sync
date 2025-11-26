"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AIAssistancePanel } from "./ai-assistance-panel"
import { Sparkles } from "lucide-react"

/**
 * AI Assistance Example Component
 * 
 * Demonstrates how to integrate AI assistance components into a proposal editor.
 * Shows the complete workflow from text selection to content application.
 * 
 * Usage:
 * 1. User selects text in the editor
 * 2. AI assistance panel shows available options
 * 3. User chooses an AI operation (draft, rewrite, or summarize)
 * 4. AI generates content and displays for review
 * 5. User approves and content is applied to the editor
 */
export function AIAssistanceExample() {
  const [content, setContent] = React.useState("")
  const [selectedText, setSelectedText] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Mock project data
  const projectData = {
    title: "E-Commerce Platform Modernization",
    description: "Modernize legacy e-commerce platform with microservices architecture, improve performance, and enhance user experience.",
    sectionTitle: "Technical Approach",
    budget: 250000,
    deadline: "2024-12-31",
  }

  const handleTextSelection = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      const selected = content.substring(start, end)
      setSelectedText(selected)
    }
  }

  const handleApplyContent = (newContent: string) => {
    if (selectedText) {
      // Replace selected text with new content
      const start = content.indexOf(selectedText)
      if (start !== -1) {
        const before = content.substring(0, start)
        const after = content.substring(start + selectedText.length)
        setContent(before + newContent + after)
      }
    } else {
      // Append new content
      setContent((prev) => (prev ? prev + "\n\n" + newContent : newContent))
    }
    setSelectedText("")
  }

  return (
    <div className="container mx-auto p-6 max-w-[1400px]">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-black dark:text-white">
            AI Assistance Example
          </h1>
        </div>
        <p className="text-muted-foreground">
          Demonstration of AI-powered proposal writing tools
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 border-yellow-400/20">
            <h2 className="text-lg font-semibold text-black dark:text-white mb-4">
              Proposal Editor
            </h2>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={handleTextSelection}
              placeholder="Start writing your proposal or use AI assistance to generate content..."
              className="min-h-[500px] border-yellow-400/20 focus-visible:ring-yellow-400 font-mono text-sm"
            />
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{content.split(/\s+/).filter((w) => w.length > 0).length} words</span>
              {selectedText && (
                <span className="text-yellow-400">
                  {selectedText.split(/\s+/).filter((w) => w.length > 0).length} words selected
                </span>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <Card className="p-4 border-yellow-400/20 bg-yellow-400/5">
            <h3 className="font-semibold text-black dark:text-white mb-2">
              How to Use
            </h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• <strong>Generate Draft:</strong> Create new content from project requirements</li>
              <li>• <strong>Rewrite Text:</strong> Select text in the editor, then click Rewrite</li>
              <li>• <strong>Generate Summary:</strong> Create an executive summary from all content</li>
              <li>• All AI-generated content is shown for review before applying</li>
            </ul>
          </Card>
        </div>

        {/* AI Assistance Panel */}
        <div className="lg:col-span-1">
          <AIAssistancePanel
            projectTitle={projectData.title}
            projectDescription={projectData.description}
            sectionTitle={projectData.sectionTitle}
            selectedText={selectedText}
            proposalContent={content}
            onApplyContent={handleApplyContent}
          />
        </div>
      </div>
    </div>
  )
}
