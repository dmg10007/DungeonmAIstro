/**
 * llm.ts — Thin provider abstraction for OpenAI, Anthropic, Google Gemini.
 * All calls go directly from the browser to the provider API using the
 * user's own key retrieved from the encrypted vault.
 */

import type { Message, LLMConfig } from '../types';

export async function streamCompletion(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    switch (config.provider) {
      case 'openai':
        return await openaiStream(config, apiKey, messages, onChunk, onDone);
      case 'anthropic':
        return await anthropicStream(config, apiKey, messages, onChunk, onDone);
      case 'google':
        return await googleStream(config, apiKey, messages, onChunk, onDone);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function openaiStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void
) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  await readSSE(res, onChunk, onDone, (d) => d?.choices?.[0]?.delta?.content ?? '');
}

// ─── Anthropic ───────────────────────────────────────────────────────────────
async function anthropicStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void
) {
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const convo = messages.filter((m) => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
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
  await readSSE(res, onChunk, onDone, (d) => d?.delta?.text ?? '');
}

// ─── Google Gemini ───────────────────────────────────────────────────────────
async function googleStream(
  config: LLMConfig,
  apiKey: string,
  messages: Message[],
  onChunk: (t: string) => void,
  onDone: () => void
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: config.maxTokens, temperature: config.temperature } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  await readSSE(res, onChunk, onDone, (d) => d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

// ─── SSE reader ──────────────────────────────────────────────────────────────
async function readSSE(
  res: Response,
  onChunk: (t: string) => void,
  onDone: () => void,
  extract: (d: any) => string // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') { onDone(); return; }
      try { const text = extract(JSON.parse(payload)); if (text) onChunk(text); } catch { /* skip */ }
    }
  }
  onDone();
}
