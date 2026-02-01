'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, Avatar as AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  X,
  Send,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  MoreVertical,
  Edit2,
  Trash2,
  Reply
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SectionCommentService, type SectionComment } from '@/lib/section-comment-service'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'

interface SectionCommentPanelProps {
  sectionId: string
  documentId: string
  currentUserId: string
  isLead: boolean
  onClose: () => void
}

/**
 * Section Comment Panel Component
 * 
 * Displays and manages comments for a specific section.
 * Similar to Microsoft Word comments with threading and resolution.
 */
export function SectionCommentPanel({
  sectionId,
  documentId,
  currentUserId,
  isLead,
  onClose,
}: SectionCommentPanelProps) {
  const [comments, setComments] = useState<SectionComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadComments()
  }, [sectionId])

  const loadComments = async () => {
    setLoading(true)
    const result = await SectionCommentService.getSectionComments(sectionId, currentUserId)
    if (result.success && result.comments) {
      setComments(result.comments)
    }
    setLoading(false)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    const result = await SectionCommentService.createComment(
      {
        sectionId,
        documentId,
        content: newComment,
        parentId: replyTo || undefined,
      },
      currentUserId
    )

    if (result.success) {
      setNewComment('')
      setReplyTo(null)
      await loadComments()
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to add comment',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return

    const result = await SectionCommentService.updateComment(
      commentId,
      { content: editContent },
      currentUserId
    )

    if (result.success) {
      setEditingComment(null)
      setEditContent('')
      await loadComments()
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update comment',
        variant: 'destructive',
      })
    }
  }

  const handleResolveComment = async (commentId: string) => {
    const result = await SectionCommentService.resolveComment(commentId, currentUserId)

    if (result.success) {
      await loadComments()
      toast({
        title: 'Comment resolved',
        description: 'The comment has been marked as resolved',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to resolve comment',
        variant: 'destructive',
      })
    }
  }

  const handleReopenComment = async (commentId: string) => {
    const result = await SectionCommentService.reopenComment(commentId, currentUserId)

    if (result.success) {
      await loadComments()
      toast({
        title: 'Comment reopened',
        description: 'The comment has been reopened',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to reopen comment',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    const result = await SectionCommentService.deleteComment(commentId, currentUserId)

    if (result.success) {
      await loadComments()
      toast({
        title: 'Comment deleted',
        description: 'The comment has been deleted',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete comment',
        variant: 'destructive',
      })
    }
  }

  const renderComment = (comment: SectionComment, isReply = false) => {
    const isAuthor = comment.userId === currentUserId
    const isEditing = editingComment === comment.id

    return (
      <div
        key={comment.id}
        className={cn(
          'p-3 rounded-lg border transition-colors',
          comment.isResolved
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-yellow-400/20 bg-white dark:bg-black',
          isReply && 'ml-8 mt-2'
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 bg-yellow-400">
              <AvatarFallback className="text-black text-xs font-bold">
                {comment.user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{comment.user?.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {comment.isResolved && (
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!comment.isResolved && !isReply && (
                  <DropdownMenuItem onClick={() => setReplyTo(comment.id)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                )}
                {isAuthor && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingComment(comment.id)
                      setEditContent(comment.content)
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {(isLead || isAuthor) && !comment.isResolved && (
                  <DropdownMenuItem onClick={() => handleResolveComment(comment.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Resolve
                  </DropdownMenuItem>
                )}
                {(isLead || isAuthor) && comment.isResolved && (
                  <DropdownMenuItem onClick={() => handleReopenComment(comment.id)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reopen
                  </DropdownMenuItem>
                )}
                {(isLead || isAuthor) && (
                  <DropdownMenuItem
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] border-yellow-400/20 focus-visible:ring-yellow-400"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleUpdateComment(comment.id)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingComment(null)
                  setEditContent('')
                }}
                className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Reply form */}
        {replyTo === comment.id && (
          <div className="mt-3 ml-8 space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[80px] border-yellow-400/20 focus-visible:ring-yellow-400"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddComment}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <Send className="h-4 w-4 mr-1" />
                Reply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyTo(null)
                  setNewComment('')
                }}
                className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-yellow-400/20">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-yellow-400" />
          <h3 className="font-semibold">Comments</h3>
          <Badge className="bg-yellow-400 text-black">
            {comments.filter(c => !c.isResolved).length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment on this section</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
      </ScrollArea>

      {/* New Comment Form */}
      {!replyTo && (
        <div className="p-4 border-t border-yellow-400/20 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[100px] border-yellow-400/20 focus-visible:ring-yellow-400"
          />
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            <Send className="h-4 w-4 mr-2" />
            Post Comment
          </Button>
        </div>
      )}
    </div>
  )
}
