"use client"

import { useState, useRef, KeyboardEvent, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageComposerProps {
  projectId: string
  proposalId: string | null
  onMessageSent: (content: string) => Promise<void>
  disabled?: boolean
}

export function MessageComposer({
  projectId,
  proposalId,
  onMessageSent,
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    const trimmedContent = content.trim()

    if (!trimmedContent) {
      return
    }

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onMessageSent(trimmedContent)
      setContent("")
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends the message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter adds a new line (default behavior)
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter also sends the message
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setError(null)

    // Auto-expand textarea
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  const handleRetry = () => {
    setError(null)
    handleSubmit()
  }

  return (
    <div className="space-y-2" onKeyDown={handleComposerKeyDown}>
      {/* Error Message */}
      {error && (
        <div 
          className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-600 dark:text-red-400 flex-1">
            {error}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
            aria-label="Retry sending message"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
          disabled={disabled || isSubmitting}
          aria-label="Message input"
          aria-describedby="message-help-text"
          className={cn(
            "min-h-[44px] max-h-[200px] resize-none",
            "border-yellow-400/20 focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2",
            "bg-white dark:bg-black text-black dark:text-white",
            "placeholder:text-muted-foreground"
          )}
          rows={1}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !content.trim()}
          aria-label="Send message"
          className="bg-yellow-400 hover:bg-yellow-500 text-black h-[44px] px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Sending
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" aria-hidden="true" />
              Send
            </span>
          )}
        </Button>
      </div>

      {/* Helper Text */}
      <p id="message-help-text" className="text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line, Ctrl/Cmd+Enter also sends
      </p>
    </div>
  )
}
