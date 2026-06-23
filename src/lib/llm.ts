/**
 * llm.ts — Thin provider abstraction for browser-direct LLM calls.
 * Supports OpenAI-compatible APIs, Anthropic, Google Gemini, OpenRouter,
 * and custom OpenAI-compatible endpoints.
 *
 * CRITICAL CONTRACT:
 *   streamCompletion guarantees exactly one terminal call:
 *   - onDone(accumulated)  — on clean finish OR partial stream with content
 *   - onError(err)         — on hard errors with zero content accumulated
 *
 *   This means callers (dm.ts) will always receive the text that was
 *   streamed even if the connection drops mid-response.
 */

import type { Message, LLMConfig } from '../types';

export async function streamCompletion(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (accumulated: string) => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  // Each inner stream function accumulates text and returns it.
  // streamCompletion then calls onDone(text) or onError depending on outcome.
  let accumulated = '';
  const trackingChunk = (t: string) => { accumulated += t; onChunk(t); };

  try {
    switch (config.provider) {
      case 'openai':
        await openaiCompatibleStream(
          'https://api.openai.com/v1/chat/completions',
          config, apiKey, messages, trackingChunk, signal,
        );
        break;
      case 'openrouter':
        await openaiCompatibleStream(
          'https://openrouter.ai/api/v1/chat/completions',
          config, apiKey, messages, trackingChunk, signal,
          { 'HTTP-Referer': window.location.origin, 'X-Title': 'DungeonmAIstro' },
        );
        break;
      case 'custom': {
        const baseUrl = config.baseUrl?.trim();
        if (!baseUrl) throw new Error('Custom provider requires a baseUrl.');
        await openaiCompatibleStream(
          `${baseUrl.replace(/\/$/, '')}/chat/completions`,
          config, apiKey, messages, trackingChunk, signal,
        );
        break;
      }
      case 'anthropic':
        await anthropicStream(config, apiKey, messages, trackingChunk, signal);
        break;
      case 'google':
        await googleStream(config, apiKey, messages, trackingChunk, signal);
        break;
      default:
        throw new Error(`Unknown provider: ${(config as LLMConfig).provider}`);
    }

    if (!signal?.aborted) onDone(accumulated);

  } catch (err) {
    if (signal?.aborted) return; // user cancelled — no callback

    // If we already streamed some content, surface it rather than swallowing it.
    // This handles partial 503s where Gemini sends tokens then errors.
    if (accumulated.length > 0) {
      onDone(accumulated);
    } else {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (OpenAI, OpenRouter, custom)
// ---------------------------------------------------------------------------

async function openaiCompatibleStream(
  endpoint: string,
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
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
      messages: messages
        .filter((m) => m.role !== 'event')
        .map((m) => ({ role: m.role, content: m.content })),
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${extractApiErrorMessage(body, res.status)}`);
  }
  await readOpenAISSE(res, onChunk, signal);
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function anthropicStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  signal?: AbortSignal,
) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const convo = messages.filter((m) => m.role !== 'system' && m.role !== 'event');
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${extractApiErrorMessage(body, res.status)}`);
  }
  await readOpenAISSE(res, onChunk, signal, (d) => (d as { delta?: { text?: string } })?.delta?.text ?? '');
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

/**
 * Google Gemini streaming via the v1beta REST API.
 *
 * Key differences from OpenAI:
 * - Auth goes in x-goog-api-key header (NOT the URL query param)
 * - System prompt goes in systemInstruction, not the messages array
 * - Assistant role is 'model', not 'assistant'
 * - Response shape: candidates[0].content.parts[0].text
 * - Stream does NOT send [DONE] — it just ends
 * - alt=sse uses Server-Sent Events format
 * - thinkingBudget: 0 disables hidden thinking tokens for narrative calls,
 *   eliminating ~872 wasted tokens and the associated latency overhead.
 */
async function googleStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  signal?: AbortSignal,
) {
  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

  const systemContent = messages.find((m) => m.role === 'system')?.content;
  // Exclude 'event' role messages (dice rolls, local game events) — they are
  // display-only and must never appear in the LLM conversation history.
  const convo = messages.filter((m) => m.role !== 'system' && m.role !== 'event');

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
    // Disable hidden chain-of-thought for narrative DM responses.
    // Thinking tokens (thinkingBudget > 0) add latency and token cost with
    // no benefit for storytelling. Re-enable selectively for rules-lookup
    // calls if a dedicated adjudication endpoint is added in future.
    thinkingConfig: {
      thinkingBudget: 0,
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
    const errBody = await res.text();
    throw new Error(`Gemini ${res.status}: ${extractApiErrorMessage(errBody, res.status)}`);
  }

  await readGeminiSSE(res, onChunk, signal);
}

/**
 * Gemini requires strictly alternating user/model turns.
 * Merge consecutive same-role messages and ensure the first turn is 'user'.
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
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', parts: [{ text: '(begin)' }] });
  }
  return merged;
}

// ---------------------------------------------------------------------------
// SSE readers — DO NOT call onDone here; streamCompletion owns that call
// ---------------------------------------------------------------------------

/** OpenAI-style SSE: `data: {...}` lines, terminated by `data: [DONE]` */
async function readOpenAISSE(
  res: Response,
  onChunk: (t: string) => void,
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
      if (signal?.aborted) { reader.cancel(); return; }
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
          if (!payload || payload === '[DONE]') continue;
          try { const t = extract(JSON.parse(payload)); if (t) onChunk(t); } catch { /* skip malformed */ }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

/**
 * Gemini SSE parser.
 * Same `data: {...}` line format as OpenAI but:
 * - No [DONE] sentinel — stream just closes
 * - Text at candidates[0].content.parts[0].text
 * - Embedded errors at .error.message
 */
async function readGeminiSSE(
  res: Response,
  onChunk: (t: string) => void,
  signal?: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming response body unavailable.');
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      if (signal?.aborted) { reader.cancel(); return; }
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
            if (json.error) {
              throw new Error(`Gemini stream error: ${json.error.message ?? JSON.stringify(json.error)}`);
            }
            const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (text) onChunk(text);
          } catch (e) {
            if (e instanceof Error && e.message.startsWith('Gemini stream error')) throw e;
            /* skip other malformed chunks */
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a human-readable message from a JSON or plain-text API error body. */
function extractApiErrorMessage(body: string, status: number): string {
  try {
    const j = JSON.parse(body);
    return (
      j?.error?.message ??
      j?.message ??
      j?.error ??
      (status === 503 ? 'Service temporarily unavailable — the model may be overloaded. Try again in a moment.' : body)
    );
  } catch {
    if (status === 503) return 'Service temporarily unavailable — the model may be overloaded. Try again in a moment.';
    return body.slice(0, 300);
  }
}
