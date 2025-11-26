/**
 * AI Assistance Service
 * 
 * Provides AI-powered assistance for proposal content generation and improvement.
 * Implements Requirements 10.2, 10.3, 10.4, 10.5
 * 
 * Features:
 * - Draft generation from project requirements
 * - Text rewriting for professionalism and clarity
 * - Executive summary generation
 * - Review workflow (display before applying)
 */

import { z } from 'zod';

// ============================================================
// TYPES AND VALIDATION
// ============================================================

const GenerateDraftInputSchema = z.object({
  projectTitle: z.string().min(1, 'Project title is required'),
  projectDescription: z.string().min(1, 'Project description is required'),
  sectionTitle: z.string().min(1, 'Section title is required'),
  additionalContext: z.string().optional(),
  budget: z.number().optional(),
  deadline: z.string().optional(),
});

const RewriteTextInputSchema = z.object({
  text: z.string().min(1, 'Text to rewrite is required'),
  tone: z.enum(['professional', 'technical', 'persuasive', 'concise']).default('professional'),
  context: z.string().optional(),
});

const GenerateSummaryInputSchema = z.object({
  proposalContent: z.string().min(1, 'Proposal content is required'),
  maxLength: z.number().int().positive().default(300),
  focusAreas: z.array(z.string()).optional(),
});

export interface GenerateDraftInput {
  projectTitle: string;
  projectDescription: string;
  sectionTitle: string;
  additionalContext?: string;
  budget?: number;
  deadline?: string;
}

export interface RewriteTextInput {
  text: string;
  tone?: 'professional' | 'technical' | 'persuasive' | 'concise';
  context?: string;
}

export interface GenerateSummaryInput {
  proposalContent: string;
  maxLength?: number;
  focusAreas?: string[];
}

export interface AIAssistanceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
}

export interface AIGeneratedContent {
  content: string;
  suggestions?: string[];
  metadata?: {
    model: string;
    tokensUsed: number;
    generatedAt: string;
  };
}

// ============================================================
// OPENROUTER API CLIENT
// ============================================================

class OpenRouterClient {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string;

  constructor() {
    // Load API keys from environment
    this.apiKeys = this.loadApiKeys();
    
    // Use the tool calling model for better structured outputs
    this.model = process.env.OPEN_ROUTER_TOOL_CALLING_MODEL || 'z-ai/glm-4.5-air:free';
  }

  private loadApiKeys(): string[] {
    const keys: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const key = process.env[`OPEN_ROUTER_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  }

  private getNextApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No OpenRouter API keys configured');
    }
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  async generateCompletion(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 1000
  ): Promise<{ content: string; tokensUsed: number }> {
    const apiKey = this.getNextApiKey();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bidsync.app',
          'X-Title': 'BidSync AI Assistant',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || 0;

      return { content, tokensUsed };
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw error;
    }
  }
}

// ============================================================
// AI ASSISTANCE SERVICE
// ============================================================

export class AIAssistanceService {
  private static _client: OpenRouterClient | null = null;

  private static getClient(): OpenRouterClient {
    if (!this._client) {
      this._client = new OpenRouterClient();
    }
    return this._client;
  }

  /**
   * Generate a draft section based on project requirements
   * Requirement 10.2: AI draft generation from project requirements
   * 
   * @param input - Draft generation parameters
   * @returns Generated draft content
   */
  static async generateDraft(
    input: GenerateDraftInput
  ): Promise<AIAssistanceResult<AIGeneratedContent>> {
    try {
      // Validate input
      const validated = GenerateDraftInputSchema.parse(input);

      const systemPrompt = `You are an expert proposal writer helping to create professional, compelling bid proposals. 
Your task is to generate high-quality content for proposal sections that will help win contracts.
Focus on being clear, professional, and persuasive while addressing the client's needs.`;

      const userPrompt = `Generate content for a proposal section with the following details:

Project Title: ${validated.projectTitle}
Project Description: ${validated.projectDescription}
Section Title: ${validated.sectionTitle}
${validated.budget ? `Budget: $${validated.budget.toLocaleString()}` : ''}
${validated.deadline ? `Deadline: ${validated.deadline}` : ''}
${validated.additionalContext ? `Additional Context: ${validated.additionalContext}` : ''}

Please write a comprehensive, professional section that:
1. Addresses the project requirements
2. Demonstrates understanding of the client's needs
3. Provides specific, actionable details
4. Uses professional language
5. Is well-structured with clear paragraphs

Generate the content now:`;

      const { content, tokensUsed } = await this.getClient().generateCompletion(
        systemPrompt,
        userPrompt,
        1500
      );

      return {
        success: true,
        data: {
          content: content.trim(),
          metadata: {
            model: process.env.OPEN_ROUTER_TOOL_CALLING_MODEL || 'z-ai/glm-4.5-air:free',
            tokensUsed,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in generateDraft:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate draft',
      };
    }
  }

  /**
   * Rewrite text for improved professionalism and clarity
   * Requirement 10.3: AI rewrite for text improvement
   * 
   * @param input - Rewrite parameters
   * @returns Rewritten text
   */
  static async rewriteText(
    input: RewriteTextInput
  ): Promise<AIAssistanceResult<AIGeneratedContent>> {
    try {
      // Validate input
      const validated = RewriteTextInputSchema.parse(input);

      const toneDescriptions = {
        professional: 'professional, polished, and business-appropriate',
        technical: 'technical, precise, and detailed with industry terminology',
        persuasive: 'persuasive, compelling, and focused on benefits',
        concise: 'concise, clear, and to-the-point',
      };

      const systemPrompt = `You are an expert editor specializing in proposal writing. 
Your task is to rewrite text to be ${toneDescriptions[validated.tone || 'professional']}.
Maintain the core message while improving clarity, flow, and impact.`;

      const userPrompt = `Rewrite the following text to be ${validated.tone || 'professional'}:

Original Text:
${validated.text}

${validated.context ? `Context: ${validated.context}` : ''}

Requirements:
1. Maintain the original meaning and key points
2. Improve clarity and readability
3. Use ${validated.tone || 'professional'} language
4. Fix any grammar or spelling issues
5. Enhance the overall impact

Provide only the rewritten text:`;

      const { content, tokensUsed } = await this.getClient().generateCompletion(
        systemPrompt,
        userPrompt,
        1000
      );

      return {
        success: true,
        data: {
          content: content.trim(),
          metadata: {
            model: process.env.OPEN_ROUTER_TOOL_CALLING_MODEL || 'z-ai/glm-4.5-air:free',
            tokensUsed,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in rewriteText:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rewrite text',
      };
    }
  }

  /**
   * Generate an executive summary from proposal content
   * Requirement 10.4: AI summarization for executive summaries
   * 
   * @param input - Summary generation parameters
   * @returns Generated executive summary
   */
  static async generateSummary(
    input: GenerateSummaryInput
  ): Promise<AIAssistanceResult<AIGeneratedContent>> {
    try {
      // Validate input
      const validated = GenerateSummaryInputSchema.parse(input);

      const systemPrompt = `You are an expert at creating compelling executive summaries for business proposals.
Your summaries are concise, highlight key value propositions, and capture decision-makers' attention.`;

      const userPrompt = `Create an executive summary from the following proposal content:

${validated.proposalContent}

${validated.focusAreas && validated.focusAreas.length > 0 
  ? `Focus on these key areas: ${validated.focusAreas.join(', ')}` 
  : ''}

Requirements:
1. Maximum length: ${validated.maxLength} words
2. Highlight the key value propositions
3. Include the main benefits and outcomes
4. Use compelling, professional language
5. Make it suitable for executive-level readers
6. Focus on what matters most to decision-makers

Generate the executive summary now:`;

      const { content, tokensUsed } = await this.getClient().generateCompletion(
        systemPrompt,
        userPrompt,
        800
      );

      return {
        success: true,
        data: {
          content: content.trim(),
          suggestions: [
            'Consider adding specific metrics or ROI figures',
            'Ensure alignment with client\'s stated objectives',
            'Highlight unique differentiators',
          ],
          metadata: {
            model: process.env.OPEN_ROUTER_TOOL_CALLING_MODEL || 'z-ai/glm-4.5-air:free',
            tokensUsed,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in generateSummary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate summary',
      };
    }
  }

  /**
   * Generate suggestions for improving a proposal section
   * 
   * @param content - Section content to analyze
   * @returns Improvement suggestions
   */
  static async generateSuggestions(
    content: string
  ): Promise<AIAssistanceResult<string[]>> {
    try {
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'Content is required',
        };
      }

      const systemPrompt = `You are an expert proposal reviewer. 
Analyze proposal content and provide specific, actionable suggestions for improvement.`;

      const userPrompt = `Review this proposal section and provide 3-5 specific suggestions for improvement:

${content}

Focus on:
1. Clarity and structure
2. Persuasiveness and impact
3. Completeness and detail
4. Professional tone
5. Addressing client needs

Provide suggestions as a numbered list:`;

      const { content: suggestions } = await this.getClient().generateCompletion(
        systemPrompt,
        userPrompt,
        500
      );

      // Parse suggestions into array
      const suggestionList = suggestions
        .split('\n')
        .filter((line) => line.trim().match(/^\d+\./))
        .map((line) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((s) => s.length > 0);

      return {
        success: true,
        data: suggestionList,
      };
    } catch (error) {
      console.error('Error in generateSuggestions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      };
    }
  }
}
