import { z } from 'zod';

export type TextGenSettings = {
  baseUrl: string;
  model: string;
  apiKey?: string | undefined;
  timeoutMs: number;
};

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type TextRequest = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
};

export type TextResult =
  | { kind: 'ok'; text: string }
  | { kind: 'not-configured' }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string };

const completion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export function createTextGenerator(settings: TextGenSettings | undefined) {
  return async function generateText(request: TextRequest): Promise<TextResult> {
    if (!settings) return { kind: 'not-configured' };
    const { baseUrl, model, apiKey, timeoutMs } = settings;
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return { kind: 'error', message: `HTTP ${response.status}` };
      const parsed = completion.safeParse(await response.json());
      if (!parsed.success) return { kind: 'error', message: 'unexpected response shape' };
      const text = parsed.data.choices[0]!.message.content.trim();
      return text ? { kind: 'ok', text } : { kind: 'error', message: 'empty completion' };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError')
        return { kind: 'timeout' };
      return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  };
}
