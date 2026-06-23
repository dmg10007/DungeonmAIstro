/**
 * llm.ts — Thin provider abstraction for browser-direct LLM calls.
 * Supports OpenAI-compatible APIs, Anthropic, Google Gemini, OpenRouter,
 * and custom OpenAI-compatible endpoints.
 */

import type { Message, LLMConfig } from '../types';

export async function streamCompletion(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    switch (config.provider) {
      case 'openai':
        return await openaiCompatibleStream(
          'https://api.openai.com/v1/chat/completions',
          config,
          apiKey,
          messages,
          onChunk,
          onDone,
          signal,
        );
      case 'openrouter':
        return await openaiCompatibleStream(
          'https://openrouter.ai/api/v1/chat/completions',
          config,
          apiKey,
          messages,
          onChunk,
          onDone,
          signal,
          {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'DungeonmAIstro',
          },
        );
      case 'custom': {
        const baseUrl = config.baseUrl?.trim();
        if (!baseUrl) throw new Error('Custom provider requires a baseUrl.');
        const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        return await openaiCompatibleStream(
          endpoint,
          config,
          apiKey,
          messages,
          onChunk,
          onDone,
          signal,
        );
      }
      case 'anthropic':
        return await anthropicStream(config, apiKey, messages, onChunk, onDone, signal);
      case 'google':
        return await googleStream(config, apiKey, messages, onChunk, onDone, signal);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

async function openaiCompatibleStream(
  endpoint: string,
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
) {
  const res = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}: ${await res.text()}`);
  await readSSE(res, onChunk, onDone, (d) => d?.choices?.[0]?.delta?.content ?? '', signal);
}

async function anthropicStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const convo = messages.filter((m) => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: convo.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: config.maxTokens,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  await readSSE(res, onChunk, onDone, (d) => d?.delta?.text ?? '', signal);
}

async function googleStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  await readSSE(res, onChunk, onDone, (d) => d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', signal);
}

async function readSSE(
  res: Response,
  onChunk: (t: string) => void,
  onDone: () => void,
  extract: (d: any) => string,
  signal?: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming response body unavailable.');

  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* noop */ }
      return;
    }

    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const chunks = buf.split('\n\n');
    buf = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const lines = chunk.split('\n').map((line) => line.trim());
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') {
          onDone();
          return;
        }
        try {
          const text = extract(JSON.parse(payload));
          if (text) onChunk(text);
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  }

  if (!signal?.aborted) onDone();
}
