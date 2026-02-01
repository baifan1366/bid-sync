/**
 * Section Comment Service
 * 
 * Handles section-specific comments similar to Microsoft Word comments.
 * Supports threaded replies, resolution tracking, and notifications.
 */

import { createClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notification-service';

export interface SectionComment {
  id: string;
  sectionId: string;
  documentId: string;
  userId: string;
  content: string;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  user?: {
    id: string;
    name: string;
    email: string;
  };
  replies?: SectionComment[];
}

export interface CreateCommentInput {
  sectionId: string;
  documentId: string;
  content: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  content: string;
}

export interface CommentResult {
  success: boolean;
  comment?: SectionComment;
  error?: string;
}

export interface CommentsResult {
  success: boolean;
  comments?: SectionComment[];
  error?: string;
}

export class SectionCommentService {
  /**
   * Creates a new comment on a section
   */
  static async createComment(
    input: CreateCommentInput,
    userId: string
  ): Promise<CommentResult> {
    try {
      const supabase = await createClient();

      // Verify user has access to the document
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('id')
        .eq('document_id', input.documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!collaborator) {
        return {
          success: false,
          error: 'You do not have access to this document',
        };
      }

      // Create the comment
      const { data: comment, error } = await supabase
        .from('section_comments')
        .insert({
          section_id: input.sectionId,
          document_id: input.documentId,
          user_id: userId,
          content: input.content,
          parent_id: input.parentId,
        })
        .select(`
          *,
          users:user_id (
            id,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !comment) {
        console.error('Error creating comment:', error);
        return {
          success: false,
          error: 'Failed to create comment',
        };
      }

      // Notify relevant users (section assignee, document owner, parent comment author)
      await this.notifyCommentCreated(comment, userId);

      return {
        success: true,
        comment: this.mapComment(comment),
      };
    } catch (error) {
      console.error('Unexpected error in createComment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets all comments for a section (with replies)
   */
  static async getSectionComments(
    sectionId: string,
    userId: string
  ): Promise<CommentsResult> {
    try {
      const supabase = await createClient();

      // Get all comments for the section
      const { data: comments, error } = await supabase
        .from('section_comments')
        .select(`
          *,
          users:user_id (
            id,
            raw_user_meta_data
          )
        `)
        .eq('section_id', sectionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return {
          success: false,
          error: 'Failed to fetch comments',
        };
      }

      // Organize comments into threads
      const commentMap = new Map<string, SectionComment>();
      const rootComments: SectionComment[] = [];

      comments?.forEach((comment) => {
        const mappedComment = this.mapComment(comment);
        commentMap.set(mappedComment.id, mappedComment);

        if (!mappedComment.parentId) {
          rootComments.push(mappedComment);
        }
      });

      // Build reply trees
      comments?.forEach((comment) => {
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            if (!parent.replies) parent.replies = [];
            const child = commentMap.get(comment.id);
            if (child) parent.replies.push(child);
          }
        }
      });

      return {
        success: true,
        comments: rootComments,
      };
    } catch (error) {
      console.error('Unexpected error in getSectionComments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Updates a comment
   */
  static async updateComment(
    commentId: string,
    input: UpdateCommentInput,
    userId: string
  ): Promise<CommentResult> {
    try {
      const supabase = await createClient();

      // Verify user owns the comment
      const { data: existingComment } = await supabase
        .from('section_comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (!existingComment || existingComment.user_id !== userId) {
        return {
          success: false,
          error: 'You can only edit your own comments',
        };
      }

      // Update the comment
      const { data: comment, error } = await supabase
        .from('section_comments')
        .update({
          content: input.content,
        })
        .eq('id', commentId)
        .select(`
          *,
          users:user_id (
            id,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !comment) {
        console.error('Error updating comment:', error);
        return {
          success: false,
          error: 'Failed to update comment',
        };
      }

      return {
        success: true,
        comment: this.mapComment(comment),
      };
    } catch (error) {
      console.error('Unexpected error in updateComment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolves a comment thread
   */
  static async resolveComment(
    commentId: string,
    userId: string
  ): Promise<CommentResult> {
    try {
      const supabase = await createClient();

      // Update the comment
      const { data: comment, error } = await supabase
        .from('section_comments')
        .update({
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select(`
          *,
          users:user_id (
            id,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !comment) {
        console.error('Error resolving comment:', error);
        return {
          success: false,
          error: 'Failed to resolve comment',
        };
      }

      return {
        success: true,
        comment: this.mapComment(comment),
      };
    } catch (error) {
      console.error('Unexpected error in resolveComment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reopens a resolved comment
   */
  static async reopenComment(
    commentId: string,
    userId: string
  ): Promise<CommentResult> {
    try {
      const supabase = await createClient();

      // Update the comment
      const { data: comment, error } = await supabase
        .from('section_comments')
        .update({
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
        })
        .eq('id', commentId)
        .select(`
          *,
          users:user_id (
            id,
            raw_user_meta_data
          )
        `)
        .single();

      if (error || !comment) {
        console.error('Error reopening comment:', error);
        return {
          success: false,
          error: 'Failed to reopen comment',
        };
      }

      return {
        success: true,
        comment: this.mapComment(comment),
      };
    } catch (error) {
      console.error('Unexpected error in reopenComment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deletes a comment
   */
  static async deleteComment(
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Verify user owns the comment or is document owner
      const { data: comment } = await supabase
        .from('section_comments')
        .select('user_id, document_id')
        .eq('id', commentId)
        .single();

      if (!comment) {
        return {
          success: false,
          error: 'Comment not found',
        };
      }

      // Check if user is comment author or document owner
      const isAuthor = comment.user_id === userId;
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', comment.document_id)
        .eq('user_id', userId)
        .maybeSingle();

      const isOwner = collaborator?.role === 'owner';

      if (!isAuthor && !isOwner) {
        return {
          success: false,
          error: 'You can only delete your own comments or you must be the document owner',
        };
      }

      // Delete the comment
      const { error } = await supabase
        .from('section_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        console.error('Error deleting comment:', error);
        return {
          success: false,
          error: 'Failed to delete comment',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in deleteComment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets unresolved comments count for a section
   */
  static async getUnresolvedCount(sectionId: string): Promise<number> {
    try {
      const supabase = await createClient();

      const { count, error } = await supabase
        .from('section_comments')
        .select('*', { count: 'exact', head: true })
        .eq('section_id', sectionId)
        .eq('is_resolved', false);

      if (error) {
        console.error('Error getting unresolved count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error in getUnresolvedCount:', error);
      return 0;
    }
  }

  /**
   * Notifies relevant users when a comment is created
   */
  private static async notifyCommentCreated(
    comment: any,
    authorId: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get section details
      const { data: section } = await supabase
        .from('document_sections')
        .select('title, assigned_to')
        .eq('id', comment.section_id)
        .single();

      if (!section) return;

      // Notify section assignee if exists and not the author
      if (section.assigned_to && section.assigned_to !== authorId) {
        await NotificationService.create({
          userId: section.assigned_to,
          type: 'section_comment',
          title: 'New comment on your section',
          body: `A comment was added to "${section.title}"`,
          data: {
            sectionId: comment.section_id,
            commentId: comment.id,
            documentId: comment.document_id,
          },
        });
      }

      // If it's a reply, notify the parent comment author
      if (comment.parent_id) {
        const { data: parentComment } = await supabase
          .from('section_comments')
          .select('user_id')
          .eq('id', comment.parent_id)
          .single();

        if (parentComment && parentComment.user_id !== authorId) {
          await NotificationService.create({
            userId: parentComment.user_id,
            type: 'comment_reply',
            title: 'Reply to your comment',
            body: `Someone replied to your comment on "${section.title}"`,
            data: {
              sectionId: comment.section_id,
              commentId: comment.id,
              parentCommentId: comment.parent_id,
              documentId: comment.document_id,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error notifying comment created:', error);
    }
  }

  /**
   * Maps database comment to SectionComment interface
   */
  private static mapComment(comment: any): SectionComment {
    const user = comment.users;
    return {
      id: comment.id,
      sectionId: comment.section_id,
      documentId: comment.document_id,
      userId: comment.user_id,
      content: comment.content,
      isResolved: comment.is_resolved,
      resolvedBy: comment.resolved_by,
      resolvedAt: comment.resolved_at,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: user
        ? {
            id: user.id,
            name: user.raw_user_meta_data?.name || 'Unknown User',
            email: user.raw_user_meta_data?.email || '',
          }
        : undefined,
    };
  }
}
