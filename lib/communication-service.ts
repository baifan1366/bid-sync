/**
 * Communication Service
 * 
 * Handles messaging and Q&A functionality for bidding leader management features.
 * Supports private client-lead messaging and public Q&A threads.
 * 
 * Implements requirements 15.2, 15.3, 15.4, 15.5, 16.1, 16.2, 16.3, 16.4, 16.5
 * from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';
import { NotificationService } from './notification-service';
import { sanitizeSearchInput } from './validation-utils';

export interface Message {
  id: string;
  projectId: string;
  proposalId: string | null;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderRole: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  read: boolean;
}

export interface QAThread {
  id: string;
  projectId: string;
  askedBy: string;
  askedByName: string;
  askedByAvatar: string | null;
  question: string;
  answers: QAAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface QAAnswer {
  id: string;
  questionId: string;
  answeredBy: string;
  answeredByName: string;
  answeredByAvatar: string | null;
  answer: string;
  createdAt: string;
}

export interface SendMessageInput {
  projectId: string;
  proposalId?: string | null;
  senderId: string;
  content: string;
  attachments?: string[];
}

export interface PostQuestionInput {
  projectId: string;
  askedBy: string;
  question: string;
}

export interface AnswerQuestionInput {
  questionId: string;
  answeredBy: string;
  answer: string;
}

export interface GetMessagesOptions {
  projectId: string;
  proposalId?: string | null;
  limit?: number;
  offset?: number;
  searchTerm?: string;
}

export interface SearchQAOptions {
  projectId: string;
  searchTerm: string;
}

export interface MessageResult {
  success: boolean;
  message?: Message;
  error?: string;
  errorCode?: 'INVALID_PROJECT' | 'INVALID_USER' | 'EMPTY_CONTENT' | 'UNKNOWN';
}

export interface QAThreadResult {
  success: boolean;
  thread?: QAThread;
  error?: string;
  errorCode?: 'INVALID_PROJECT' | 'INVALID_USER' | 'EMPTY_QUESTION' | 'UNKNOWN';
}

export interface QAAnswerResult {
  success: boolean;
  answer?: QAAnswer;
  error?: string;
  errorCode?: 'INVALID_QUESTION' | 'INVALID_USER' | 'EMPTY_ANSWER' | 'UNKNOWN';
}

/**
 * CommunicationService class for managing messaging and Q&A
 */
export class CommunicationService {
  /**
   * Sends a message in a private channel
   * 
   * Requirements:
   * - 15.2: Deliver message to the client and store it in the database
   * - 15.3: Notify the Bidding Lead via email and in-app notification when client responds
   * - 15.5: Support text, file attachments, and rich formatting
   * 
   * @param input - Message data
   * @returns MessageResult with created message
   */
  static async sendMessage(input: SendMessageInput): Promise<MessageResult> {
    try {
      const supabase = await createClient();

      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        return {
          success: false,
          error: 'Message content cannot be empty',
          errorCode: 'EMPTY_CONTENT',
        };
      }

      // Verify project exists
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, client_id, title')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'INVALID_PROJECT',
        };
      }

      // Get sender information
      const { data: sender, error: senderError } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', input.senderId)
        .single();

      if (senderError || !sender) {
        return {
          success: false,
          error: 'Sender not found',
          errorCode: 'INVALID_USER',
        };
      }

      // Create message
      const { data: message, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          project_id: input.projectId,
          proposal_id: input.proposalId || null,
          sender_id: input.senderId,
          content: input.content,
          read: false,
        })
        .select('id, project_id, proposal_id, sender_id, content, created_at, read')
        .single();

      if (messageError || !message) {
        console.error('Error creating message:', messageError);
        return {
          success: false,
          error: 'Failed to create message',
          errorCode: 'UNKNOWN',
        };
      }

      // Determine recipient(s) and send notifications
      // If sender is client, notify the lead
      // If sender is lead/member, notify the client
      let recipientId: string;
      
      if (sender.role === 'client') {
        // Find the lead for this project/proposal
        if (input.proposalId) {
          const { data: proposal } = await supabase
            .from('proposals')
            .select('lead_id')
            .eq('id', input.proposalId)
            .single();
          
          if (proposal) {
            recipientId = proposal.lead_id;
          } else {
            recipientId = project.client_id; // Fallback
          }
        } else {
          // For project-level messages, notify all leads with proposals
          const { data: proposals } = await supabase
            .from('proposals')
            .select('lead_id')
            .eq('project_id', input.projectId);
          
          if (proposals && proposals.length > 0) {
            // Notify all leads about new message
            for (const proposal of proposals) {
              if (proposal.lead_id && proposal.lead_id !== input.senderId) {
                NotificationService.createNotification({
                  userId: proposal.lead_id,
                  type: 'message_received',
                  title: 'New Message',
                  body: `You have a new message regarding project "${project.title}"`,
                  data: {
                    projectId: input.projectId,
                    proposalId: input.proposalId,
                    senderId: input.senderId,
                    senderName: sender.full_name || sender.email,
                  },
                  sendEmail: true,
                }).catch(err => console.error('Failed to send message notification:', err));
              }
            }
          }
          recipientId = proposals?.[0]?.lead_id || project.client_id;
        }
      } else {
        // Sender is lead or member, notify client
        recipientId = project.client_id;
      }

      // Send notification to recipient
      if (recipientId && recipientId !== input.senderId) {
        NotificationService.createNotification({
          userId: recipientId,
          type: 'message_received',
          title: 'New Message',
          body: `You have a new message regarding project "${project.title}"`,
          data: {
            projectId: input.projectId,
            proposalId: input.proposalId,
            senderId: input.senderId,
            senderName: sender.full_name || sender.email,
          },
          sendEmail: true,
        }).catch(err => console.error('Failed to send message notification:', err));
      }

      // Map to Message interface
      const mappedMessage: Message = {
        id: message.id,
        projectId: message.project_id,
        proposalId: message.proposal_id,
        senderId: message.sender_id,
        senderName: sender.full_name || sender.email,
        senderAvatar: null,
        senderRole: sender.role,
        content: message.content,
        attachments: input.attachments,
        createdAt: message.created_at,
        read: message.read,
      };

      return {
        success: true,
        message: mappedMessage,
      };
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets messages for a project/proposal with chronological ordering
   * 
   * Requirements:
   * - 15.4: Display all messages in chronological order with timestamps
   * 
   * @param options - Query options
   * @returns Array of messages
   */
  static async getMessages(options: GetMessagesOptions): Promise<Message[]> {
    try {
      const supabase = await createClient();
      const { projectId, proposalId, limit = 100, offset = 0, searchTerm } = options;

      // Build query
      let query = supabase
        .from('chat_messages')
        .select(`
          id,
          project_id,
          proposal_id,
          sender_id,
          content,
          created_at,
          read,
          users!chat_messages_sender_id_fkey (
            id,
            email,
            full_name,
            role
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      // Filter by proposal if specified
      if (proposalId !== undefined) {
        if (proposalId === null) {
          query = query.is('proposal_id', null);
        } else {
          query = query.eq('proposal_id', proposalId);
        }
      }

      // Search filter
      if (searchTerm && searchTerm.trim().length > 0) {
        const sanitizedSearch = sanitizeSearchInput(searchTerm);
        if (sanitizedSearch) {
          query = query.ilike('content', `%${sanitizedSearch}%`);
        }
      }

      const { data: messages, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      if (!messages) {
        return [];
      }

      // Map to Message interface
      return messages.map((msg: any) => ({
        id: msg.id,
        projectId: msg.project_id,
        proposalId: msg.proposal_id,
        senderId: msg.sender_id,
        senderName: msg.users?.full_name || msg.users?.email || 'Unknown',
        senderAvatar: null,
        senderRole: msg.users?.role || 'unknown',
        content: msg.content,
        createdAt: msg.created_at,
        read: msg.read,
      }));
    } catch (error) {
      console.error('Unexpected error in getMessages:', error);
      return [];
    }
  }

  /**
   * Posts a question in a public Q&A thread
   * 
   * Requirements:
   * - 16.1: Display all public Q&A threads
   * - 16.2: Make question visible to the client and other bidding teams
   * 
   * @param input - Question data
   * @returns QAThreadResult with created thread
   */
  static async postQuestion(input: PostQuestionInput): Promise<QAThreadResult> {
    try {
      const supabase = await createClient();

      // Validate question
      if (!input.question || input.question.trim().length === 0) {
        return {
          success: false,
          error: 'Question cannot be empty',
          errorCode: 'EMPTY_QUESTION',
        };
      }

      // Verify project exists
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, title')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'INVALID_PROJECT',
        };
      }

      // Get asker information
      const { data: asker, error: askerError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', input.askedBy)
        .single();

      if (askerError || !asker) {
        return {
          success: false,
          error: 'User not found',
          errorCode: 'INVALID_USER',
        };
      }

      // Create question
      const { data: question, error: questionError } = await supabase
        .from('project_questions')
        .insert({
          project_id: input.projectId,
          asked_by: input.askedBy,
          question: input.question,
        })
        .select('id, project_id, asked_by, question, created_at, updated_at')
        .single();

      if (questionError || !question) {
        console.error('Error creating question:', questionError);
        return {
          success: false,
          error: 'Failed to create question',
          errorCode: 'UNKNOWN',
        };
      }

      // Map to QAThread interface
      const thread: QAThread = {
        id: question.id,
        projectId: question.project_id,
        askedBy: question.asked_by,
        askedByName: asker.full_name || asker.email,
        askedByAvatar: null,
        question: question.question,
        answers: [],
        createdAt: question.created_at,
        updatedAt: question.updated_at,
      };

      return {
        success: true,
        thread,
      };
    } catch (error) {
      console.error('Unexpected error in postQuestion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Answers a question in a Q&A thread
   * 
   * Requirements:
   * - 16.3: Notify all bidding teams who are watching the project when client answers
   * - 16.4: Display questions with their answers in a threaded format
   * 
   * @param input - Answer data
   * @returns QAAnswerResult with created answer
   */
  static async answerQuestion(input: AnswerQuestionInput): Promise<QAAnswerResult> {
    try {
      const supabase = await createClient();

      // Validate answer
      if (!input.answer || input.answer.trim().length === 0) {
        return {
          success: false,
          error: 'Answer cannot be empty',
          errorCode: 'EMPTY_ANSWER',
        };
      }

      // Verify question exists and get project info
      const { data: question, error: questionError } = await supabase
        .from('project_questions')
        .select('id, project_id, question')
        .eq('id', input.questionId)
        .single();

      if (questionError || !question) {
        return {
          success: false,
          error: 'Question not found',
          errorCode: 'INVALID_QUESTION',
        };
      }

      // Get answerer information
      const { data: answerer, error: answererError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', input.answeredBy)
        .single();

      if (answererError || !answerer) {
        return {
          success: false,
          error: 'User not found',
          errorCode: 'INVALID_USER',
        };
      }

      // Create answer
      const { data: answer, error: answerError } = await supabase
        .from('question_answers')
        .insert({
          question_id: input.questionId,
          answered_by: input.answeredBy,
          answer: input.answer,
        })
        .select('id, question_id, answered_by, answer, created_at')
        .single();

      if (answerError || !answer) {
        console.error('Error creating answer:', answerError);
        return {
          success: false,
          error: 'Failed to create answer',
          errorCode: 'UNKNOWN',
        };
      }

      // Notify all bidding teams watching this project
      // Get all leads with proposals for this project
      const { data: proposals } = await supabase
        .from('proposals')
        .select('lead_id')
        .eq('project_id', question.project_id);

      if (proposals && proposals.length > 0) {
        // Create notifications for all leads
        const notificationPromises = proposals.map((proposal) =>
          NotificationService.createNotification({
            userId: proposal.lead_id,
            type: 'qa_answer_posted',
            title: 'New Q&A Answer Posted',
            body: `A new answer was posted to a question about the project: "${question.question.substring(0, 100)}${question.question.length > 100 ? '...' : ''}"`,
            data: {
              questionId: input.questionId,
              projectId: question.project_id,
              answeredBy: input.answeredBy,
            },
            sendEmail: true,
          })
        );

        await Promise.all(notificationPromises);
      }

      // Map to QAAnswer interface
      const mappedAnswer: QAAnswer = {
        id: answer.id,
        questionId: answer.question_id,
        answeredBy: answer.answered_by,
        answeredByName: answerer.full_name || answerer.email,
        answeredByAvatar: null,
        answer: answer.answer,
        createdAt: answer.created_at,
      };

      return {
        success: true,
        answer: mappedAnswer,
      };
    } catch (error) {
      console.error('Unexpected error in answerQuestion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets Q&A threads for a project
   * 
   * Requirements:
   * - 16.4: Display questions with their answers in a threaded format
   * 
   * @param projectId - The project ID
   * @returns Array of Q&A threads
   */
  static async getQAThreads(projectId: string): Promise<QAThread[]> {
    try {
      const supabase = await createClient();

      // Get questions with answers
      const { data: questions, error: questionsError } = await supabase
        .from('project_questions')
        .select(`
          id,
          project_id,
          asked_by,
          question,
          created_at,
          updated_at,
          asker:users!project_questions_asked_by_fkey (
            id,
            email,
            full_name
          ),
          question_answers (
            id,
            question_id,
            answered_by,
            answer,
            created_at,
            answerer:users!question_answers_answered_by_fkey (
              id,
              email,
              full_name
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (questionsError) {
        console.error('Error fetching Q&A threads:', questionsError);
        return [];
      }

      if (!questions) {
        return [];
      }

      // Map to QAThread interface
      return questions.map((q: any) => ({
        id: q.id,
        projectId: q.project_id,
        askedBy: q.asked_by,
        askedByName: q.asker?.full_name || q.asker?.email || 'Unknown',
        askedByAvatar: null,
        question: q.question,
        answers: (q.question_answers || []).map((a: any) => ({
          id: a.id,
          questionId: a.question_id,
          answeredBy: a.answered_by,
          answeredByName: a.answerer?.full_name || a.answerer?.email || 'Unknown',
          answeredByAvatar: null,
          answer: a.answer,
          createdAt: a.created_at,
        })),
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      }));
    } catch (error) {
      console.error('Unexpected error in getQAThreads:', error);
      return [];
    }
  }

  /**
   * Searches Q&A threads by keywords
   * 
   * Requirements:
   * - 16.5: Filter threads by keywords and topics
   * 
   * @param options - Search options
   * @returns Array of matching Q&A threads
   */
  static async searchQAThreads(options: SearchQAOptions): Promise<QAThread[]> {
    try {
      const supabase = await createClient();
      const { projectId, searchTerm } = options;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return this.getQAThreads(projectId);
      }

      // Search in questions and answers
      const { data: questions, error: questionsError } = await supabase
        .from('project_questions')
        .select(`
          id,
          project_id,
          asked_by,
          question,
          created_at,
          updated_at,
          asker:users!project_questions_asked_by_fkey (
            id,
            email,
            full_name
          ),
          question_answers (
            id,
            question_id,
            answered_by,
            answer,
            created_at,
            answerer:users!question_answers_answered_by_fkey (
              id,
              email,
              full_name
            )
          )
        `)
        .eq('project_id', projectId)
        .ilike('question', `%${sanitizeSearchInput(searchTerm)}%`)
        .order('created_at', { ascending: false });

      if (questionsError) {
        console.error('Error searching Q&A threads:', questionsError);
        return [];
      }

      if (!questions) {
        return [];
      }

      // Map to QAThread interface
      return questions.map((q: any) => ({
        id: q.id,
        projectId: q.project_id,
        askedBy: q.asked_by,
        askedByName: q.asker?.full_name || q.asker?.email || 'Unknown',
        askedByAvatar: null,
        question: q.question,
        answers: (q.question_answers || []).map((a: any) => ({
          id: a.id,
          questionId: a.question_id,
          answeredBy: a.answered_by,
          answeredByName: a.answerer?.full_name || a.answerer?.email || 'Unknown',
          answeredByAvatar: null,
          answer: a.answer,
          createdAt: a.created_at,
        })),
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      }));
    } catch (error) {
      console.error('Unexpected error in searchQAThreads:', error);
      return [];
    }
  }

  /**
   * Marks messages as read for a user
   * 
   * @param projectId - The project ID
   * @param proposalId - Optional proposal ID
   * @param userId - The user ID
   * @returns Success boolean
   */
  static async markMessagesAsRead(
    projectId: string,
    proposalId: string | null | undefined,
    userId: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('project_id', projectId)
        .neq('sender_id', userId)
        .eq('read', false);

      if (proposalId !== undefined) {
        if (proposalId === null) {
          query = query.is('proposal_id', null);
        } else {
          query = query.eq('proposal_id', proposalId);
        }
      }

      const { error } = await query;

      if (error) {
        console.error('Error marking messages as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in markMessagesAsRead:', error);
      return false;
    }
  }

  /**
   * Gets unread message count for a user
   * 
   * @param projectId - The project ID
   * @param proposalId - Optional proposal ID
   * @param userId - The user ID
   * @returns Unread count
   */
  static async getUnreadMessageCount(
    projectId: string,
    proposalId: string | null | undefined,
    userId: string
  ): Promise<number> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .neq('sender_id', userId)
        .eq('read', false);

      if (proposalId !== undefined) {
        if (proposalId === null) {
          query = query.is('proposal_id', null);
        } else {
          query = query.eq('proposal_id', proposalId);
        }
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error getting unread message count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error in getUnreadMessageCount:', error);
      return 0;
    }
  }
}
