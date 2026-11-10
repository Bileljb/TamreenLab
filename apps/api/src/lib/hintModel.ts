import { z } from 'zod';
import { reasoningEffortFor, type ChatMessage, type TokenUsage } from './assistant';

export type HintCompletion = TokenUsage & { text: string };

/**
 * A chat model that writes formula hints (ADR 012). Groq is the provider for now; another is one
 * more class. Tests use a fake.
 */
export interface HintModel {
  readonly name: string;
  complete(messages: ChatMessage[], signal: AbortSignal): Promise<HintCompletion>;
}

/** The model replied with an error status or a body we do not understand. */
export class HintModelError extends Error {}

const CompletionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }),
});

/** Groq's OpenAI-compatible chat API, called with `fetch` (no SDK dependency). */
export class GroqModel implements HintModel {
  constructor(
    private readonly apiKey: string,
    readonly name: string,
    private readonly url = 'https://api.groq.com/openai/v1/chat/completions',
  ) {}

  async complete(messages: ChatMessage[], signal: AbortSignal): Promise<HintCompletion> {
    const effort = reasoningEffortFor(this.name);
    const res = await fetch(this.url, {
      method: 'POST',
      signal,
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.name,
        messages,
        max_completion_tokens: 300,
        temperature: 0.3,
        ...(effort ? { reasoning_effort: effort } : {}),
      }),
    });
    if (!res.ok) throw new HintModelError(`model replied ${res.status}`);
    const parsed = CompletionSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new HintModelError('unexpected model response');
    return {
      text: parsed.data.choices[0]!.message.content ?? '',
      inputTokens: parsed.data.usage.prompt_tokens,
      outputTokens: parsed.data.usage.completion_tokens,
    };
  }
}
