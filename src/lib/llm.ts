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
        throw new Error(`Unknown provider: ${(config as LLMConfig).provider}`);
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
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  await readOpenAISSE(res, onChunk, onDone, signal);
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
      max_tokens: config.maxTokens ?? 4096,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  await readOpenAISSE(res, onChunk, onDone, signal, (d) => d?.delta?.text ?? '');
}

/**
 * Google Gemini streaming via the v1beta REST API.
 *
 * Key differences from OpenAI:
 * - Auth goes in the x-goog-api-key header (NOT the URL query param)
 * - System prompt goes in systemInstruction, not the messages array
 * - Assistant role is called 'model', not 'assistant'
 * - Response shape: candidates[0].content.parts[0].text
 * - The stream does NOT send a [DONE] sentinel — it just ends
 * - alt=sse tells the API to use Server-Sent Events format
 */
async function googleStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const systemContent = messages.find((m) => m.role === 'system')?.content;
  const convo = messages.filter((m) => m.role !== 'system');

  // Gemini requires alternating user/model turns — merge consecutive same-role messages
  const contents = mergeGeminiTurns(
    convo.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
  );

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: config.maxTokens ?? 8192,
      temperature: config.temperature ?? 0.9,
    },
  };

  if (systemContent) {
    body.systemInstruction = { parts: [{ text: systemContent }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  await readGeminiSSE(res, onChunk, onDone, signal);
}

/**
 * Gemini requires strictly alternating user/model turns.
 * If the history has consecutive same-role messages, merge them.
 */
function mergeGeminiTurns(
  turns: { role: string; parts: { text: string }[] }[]
): { role: string; parts: { text: string }[] }[] {
  const merged: { role: string; parts: { text: string }[] }[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.parts.push(...turn.parts);
    } else {
      merged.push({ role: turn.role, parts: [...turn.parts] });
    }
  }
  // Gemini requires the first turn to be 'user'
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', parts: [{ text: '(start)' }] });
  }
  return merged;
}

/** Parse OpenAI-style SSE: data: {...} lines, terminated by data: [DONE] */
async function readOpenAISSE(
  res: Response,
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
  extract: (d: unknown) => string = (d: unknown) =>
    (d as { choices?: { delta?: { content?: string } }[] })?.choices?.[0]?.delta?.content ?? '',
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming response body unavailable.');
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      if (signal?.aborted) { await reader.cancel(); return; }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (!payload || payload === '[DONE]') { if (payload === '[DONE]') { onDone(); return; } continue; }
          try { const t = extract(JSON.parse(payload)); if (t) onChunk(t); } catch { /* skip */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
  if (!signal?.aborted) onDone();
}

/**
 * Gemini SSE parser.
 * Same line format as OpenAI (data: {...}) but:
 * - Never sends [DONE] — stream just ends
 * - Text is at candidates[0].content.parts[0].text
 */
async function readGeminiSSE(
  res: Response,
  onChunk: (t: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming response body unavailable.');
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      if (signal?.aborted) { await reader.cancel(); return; }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (!payload) continue;
          try {
            const json = JSON.parse(payload);
            // Handle API-level errors embedded in the stream
            if (json.error) throw new Error(`Gemini stream error: ${json.error.message ?? JSON.stringify(json.error)}`);
            const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (text) onChunk(text);
          } catch (e) {
            if (e instanceof Error && e.message.startsWith('Gemini stream error')) throw e;
            /* skip malformed chunk */
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
  if (!signal?.aborted) onDone();
}
