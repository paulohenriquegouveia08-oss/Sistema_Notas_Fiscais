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
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }[];
}

interface GeminiResponse {
  candidates: {
    index: number;
    content: {
      role: string;
      parts: {
        text?: string;
        functionCall?: { name: string; args: Record<string, any> };
      }[];
    };
    finishReason: 'STOP' | 'TOOL_CALLS' | 'MAX_TOKENS';
  }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: 'groq' | 'gemini' | 'ollama' | 'openrouter';
  private readonly groqApiKey: string;
  private readonly geminiApiKey: string;
  private readonly openrouterApiKey: string;
  private readonly model: string;
  private readonly ollamaBaseUrl: string;
  private readonly openrouterBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('AI_PROVIDER', 'ollama') as 'groq' | 'gemini' | 'ollama' | 'openrouter');
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY', '');
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.openrouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY', '');
    this.model = this.configService.get<string>('AI_MODEL', 'qwen2.5:7b');
    this.ollamaBaseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://172.17.0.1:11434');
    this.openrouterBaseUrl = this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
  }

  async chat(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    if (this.provider === 'gemini') {
      return this.chatGemini(messages, tools);
    }
    if (this.provider === 'ollama') {
      return this.chatOllama(messages, tools);
    }
    if (this.provider === 'openrouter') {
      return this.chatOpenRouter(messages, tools);
    }
    return this.chatGroq(messages, tools);
  }

  private async chatOllama(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const ollamaTools = tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', properties: t.parameters, required: t.required ?? [] },
      },
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: messages.map(m => {
        const base: Record<string, any> = { role: m.role, content: m.content };
        if (m.tool_calls) base.tool_calls = m.tool_calls;
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        return base;
      }),
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    };

    if (ollamaTools?.length) {
      body.tools = ollamaTools;
    }

    try {
      const { data } = await axios.post(
        `${this.ollamaBaseUrl}/v1/chat/completions`, body, { timeout: 60000 },
      );

      const choice = data.choices?.[0];
      if (!choice) {
        return { message: { role: 'assistant', content: 'Sem resposta do modelo.' }, toolCalls: [] };
      }

      const msg = choice.message;
      const resultMessage: AiMessage = { role: 'assistant', content: msg.content || '' };

      const toolCalls: AiToolCall[] = (msg.tool_calls || []).map((tc: any) => ({
        id: tc.id, type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));

      if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls;

      return { message: resultMessage, toolCalls };
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error.message;
      this.logger.error(`Ollama API error: ${detail}`);
      return {
        message: { role: 'assistant', content: `Erro ao consultar IA: ${detail}` },
        toolCalls: [],
      };
    }
  }

  private async chatGemini(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const systemInstruction = systemMsgs.map(m => m.content).join('\n');

    const contents: Record<string, any>[] = [];

    for (const m of messages) {
      if (m.role === 'system') continue;

      if (m.role === 'user') {
        if (m.tool_call_id) {
          contents.push({
            role: 'user',
            parts: [{ functionResponse: { name: m.tool_call_id, response: { content: m.content } } }],
          });
        } else {
          contents.push({ role: 'user', parts: [{ text: m.content }] });
        }
      } else if (m.role === 'assistant') {
        if (m.tool_calls && m.tool_calls.length > 0) {
          contents.push({
            role: 'model',
            parts: m.tool_calls.map(tc => ({
              functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) },
            })),
          });
        } else {
          contents.push({ role: 'model', parts: [{ text: m.content }] });
        }
      } else if (m.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name: m.tool_call_id || '', response: { content: m.content } } }],
        });
      }
    }

    const body: Record<string, any> = { contents };

    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools && tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: {
            type: 'OBJECT',
            properties: t.parameters as any,
            required: t.required ?? [],
          },
        })),
      }];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.geminiApiKey}`;

    try {
      const { data } = await axios.post<GeminiResponse>(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const candidate = data.candidates?.[0];
      if (!candidate) {
        return { message: { role: 'assistant', content: 'Sem resposta da IA.' }, toolCalls: [] };
      }

      const parts = candidate.content?.parts || [];
      let text = '';
      const toolCalls: AiToolCall[] = [];

      for (const part of parts) {
        if (part.text != null) {
          text += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: part.functionCall.name,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          });
        }
      }

      const resultMessage: AiMessage = { role: 'assistant', content: text || '' };
      if (toolCalls.length > 0) {
        resultMessage.tool_calls = toolCalls;
      }

      return { message: resultMessage, toolCalls };
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error.message;
      this.logger.error(`Gemini API error: ${detail}`);
      return {
        message: { role: 'assistant', content: `Erro ao consultar IA: ${detail}` },
        toolCalls: [],
      };
    }
  }

  private async chatGroq(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const groqTools = tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', properties: t.parameters, required: t.required ?? [] },
      },
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: messages.map(m => {
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
      const { data } = await axios.post<GroqResponse>(
        'https://api.groq.com/openai/v1/chat/completions', body, {
          headers: { 'Authorization': `Bearer ${this.groqApiKey}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        },
      );

      const choice = data.choices[0];
      const msg = choice.message;

      const resultMessage: AiMessage = { role: 'assistant', content: msg.content || '' };

      const toolCalls: AiToolCall[] = (msg.tool_calls || []).map(tc => ({
        id: tc.id, type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));

      if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls;

      return { message: resultMessage, toolCalls };
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error.message;
      this.logger.error(`Groq API error: ${detail}`);
      return {
        message: { role: 'assistant', content: `Erro ao consultar IA: ${detail}` },
        toolCalls: [],
      };
    }
  }

  private async chatOpenRouter(
    messages: AiMessage[],
    tools?: AiTool[],
  ): Promise<{ message: AiMessage; toolCalls: AiToolCall[] }> {
    const openrouterTools = tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', properties: t.parameters, required: t.required ?? [] },
      },
    }));

    const body: Record<string, any> = {
      model: this.model,
      messages: messages.map(m => {
        const base: Record<string, any> = { role: m.role, content: m.content };
        if (m.tool_calls) base.tool_calls = m.tool_calls;
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        return base;
      }),
      temperature: 0.7,
      max_tokens: 2048,
    };

    if (openrouterTools?.length) {
      body.tools = openrouterTools;
      body.tool_choice = 'auto';
    }

    try {
      const { data } = await axios.post<GroqResponse>(
        `${this.openrouterBaseUrl}/chat/completions`, body, {
          headers: {
            'Authorization': `Bearer ${this.openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://sistemanotasfiscais.vercel.app',
            'X-Title': 'Sistema Financeiro',
          },
          timeout: 60000,
        },
      );

      const choice = data.choices[0];
      const msg = choice.message;

      const resultMessage: AiMessage = { role: 'assistant', content: msg.content || '' };

      const toolCalls: AiToolCall[] = (msg.tool_calls || []).map(tc => ({
        id: tc.id, type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));

      if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls;

      return { message: resultMessage, toolCalls };
    } catch (error: any) {
      const detail = error?.response?.data?.error?.message || error.message;
      this.logger.error(`OpenRouter API error: ${detail}`);
      return {
        message: { role: 'assistant', content: `Erro ao consultar IA: ${detail}` },
        toolCalls: [],
      };
    }
  }
}
