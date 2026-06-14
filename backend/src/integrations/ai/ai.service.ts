import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface AiToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, AiToolParameter>;
  required?: string[];
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: AiToolCall[];
}

export interface AiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqResponse {
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.model = this.configService.get<string>('AI_MODEL', 'llama-3.3-70b-versatile');
  }

  async chat(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const groqTools = tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters,
          required: t.required ?? [],
        },
      },
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: messages.map((m) => {
        const base: Record<string, any> = { role: m.role, content: m.content };
        if (m.tool_calls) base.tool_calls = m.tool_calls;
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        return base;
      }),
      temperature: 0.7,
      max_tokens: 1024,
    };

    if (groqTools?.length) {
      body.tools = groqTools;
      body.tool_choice = 'auto';
    }

    try {
      const { data } = await axios.post<GroqResponse>(this.baseUrl, body, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const choice = data.choices[0];
      const msg = choice.message;

      const resultMessage: AiMessage = {
        role: 'assistant',
        content: msg.content || '',
      };

      const toolCalls: AiToolCall[] = (msg.tool_calls || []).map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      if (toolCalls.length > 0) {
        resultMessage.tool_calls = toolCalls;
      }

      return { message: resultMessage, toolCalls };
    } catch (error: any) {
      this.logger.error(`AI API error: ${error.message}`);
      const detail = error?.response?.data?.error?.message || error.message;
      return {
        message: { role: 'assistant', content: `Erro ao consultar IA: ${detail}` },
        toolCalls: [],
      };
    }
  }
}
