import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { appConfig } from '../config/app-config.js';

export type AIProvider = 'openai' | 'anthropic';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMEngine {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private preferredProvider: AIProvider;

  constructor() {
    // Initialize providers if API keys are available
    if (appConfig.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: appConfig.openaiApiKey });
    }
    
    if (appConfig.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: appConfig.anthropicApiKey });
    }

    // Set preferred provider based on availability
    this.preferredProvider = this.anthropic ? 'anthropic' : 'openai';
  }

  /**
   * Check if any AI provider is available
   */
  isAvailable(): boolean {
    return this.openai !== undefined || this.anthropic !== undefined;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.openai) providers.push('openai');
    if (this.anthropic) providers.push('anthropic');
    return providers;
  }

  /**
   * Send a chat completion request
   */
  async chat(
    messages: AIMessage[],
    options?: {
      provider?: AIProvider;
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AIResponse> {
    const provider = options?.provider || this.preferredProvider;

    if (provider === 'anthropic' && this.anthropic) {
      return this.chatWithAnthropic(messages, options);
    } else if (provider === 'openai' && this.openai) {
      return this.chatWithOpenAI(messages, options);
    }

    throw new Error('No AI provider available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY.');
  }

  /**
   * Chat with OpenAI
   */
  private async chatWithOpenAI(
    messages: AIMessage[],
    options?: { model?: string; maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const model = options?.model || 'gpt-4-turbo-preview';

    const response = await this.openai.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens || 2000,
      temperature: options?.temperature || 0.7,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      provider: 'openai',
      model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Chat with Anthropic
   */
  private async chatWithAnthropic(
    messages: AIMessage[],
    options?: { model?: string; maxTokens?: number; temperature?: number }
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic not configured');
    }

    const model = options?.model || 'claude-3-sonnet-20240229';

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: options?.maxTokens || 2000,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];

    return {
      content: content.type === 'text' ? content.text : '',
      provider: 'anthropic',
      model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  /**
   * Simple completion (single prompt)
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    options?: { provider?: AIProvider; model?: string }
  ): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages, options);
    return response.content;
  }
}

export default LLMEngine;
