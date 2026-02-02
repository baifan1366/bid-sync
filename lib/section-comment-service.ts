/**
 * Section Comment Service
 * 
 * Handles section-specific comments similar to Microsoft Word comments.
 * Supports threaded replies, resolution tracking, and notifications.
 */

import { createClient } from '@/lib/supabase/client';

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
   * Uses GraphQL mutation to handle notifications server-side
   */
  static async createComment(
    input: CreateCommentInput,
    userId: string
  ): Promise<CommentResult> {
    try {
      // Call GraphQL mutation to create comment and send notifications
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateSectionComment($input: CreateSectionCommentInput!) {
              createSectionComment(input: $input) {
                success
                comment {
                  id
                  sectionId
                  documentId
                  userId
                  user {
                    id
                    name
                    email
                  }
                  content
                  isResolved
                  resolvedBy
                  resolvedAt
                  parentId
                  createdAt
                  updatedAt
                }
                error
              }
            }
          `,
          variables: {
            input: {
              sectionId: input.sectionId,
              documentId: input.documentId,
              content: input.content,
              parentId: input.parentId,
            },
          },
        }),
      });

      const { data, errors } = await response.json();

      if (errors || !data?.createSectionComment?.success) {
        return {
          success: false,
          error: errors?.[0]?.message || data?.createSectionComment?.error || 'Failed to create comment',
        };
      }

      return {
        success: true,
        comment: data.createSectionComment.comment,
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
      const supabase = createClient();

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
      const supabase = createClient();

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
      const supabase = createClient();

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
      const supabase = createClient();

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
      const supabase = createClient();

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
      const supabase = createClient();

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

  // Note: Notification logic removed from client service
  // Should be handled server-side via API routes or database triggers

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
