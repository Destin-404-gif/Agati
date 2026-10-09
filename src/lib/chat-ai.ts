import { getCategories, getProducts } from "./queries";
import {
  CHAT_BUSINESS,
  HANDOFF_REPLIES,
  sanitizeChatText,
} from "./chat-shared";
import type { ChatMessage, FaqRow } from "./chat";

/**
 * The assistant behind the chat widget, in two layers.
 *
 *   1. `matchFaq` - an edited-in-the-admin answer, matched on keywords. Answers
 *      in a few milliseconds, so it is what the visitor almost always sees.
 *   2. `streamAssistantReply` - a language model, provider-agnostic, used when
 *      the FAQ has nothing. Streams so the reply feels like it is being typed.
 *
 * Server-only: it reads the catalogue and `process.env`.
 */

/** Cap on a single reply, so a confused model cannot write an essay into a bubble. */
const REPLY_MAX_CHARS = 900;

/** How much of the catalogue goes into the prompt. */
const PRODUCT_CONTEXT_LIMIT = 60;

/* ------------------------------------------------------- text matching */

/** Lowercase, strip punctuation to spaces, collapse runs of whitespace. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape a keyword so it is safe to drop into a RegExp. */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score one keyword list against a question.
 *
 * A multi-word keyword matches as a phrase; a single word must match on a word
 * boundary, so `ai` does not fire on `chair` and `pay` does not fire on `repaid`.
 */
function keywordScore(keywords: string, question: string): number {
  let score = 0;
  for (const raw of keywords.split(",")) {
    const keyword = normalize(raw);
    if (!keyword) continue;

    if (keyword.includes(" ")) {
      if (question.includes(keyword)) score += keyword.split(" ").length * 2;
      continue;
    }

    if (new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(question)) score += 1;
  }
  return score;
}

/**
 * The best FAQ answer for a question, or null if nothing is close enough.
 *
 * Two hits is the bar. A single common word matching by accident is worse than
 * letting the assistant take the question, because a wrong FAQ answer reads as
 * fact.
 */
export function matchFaq(question: string, faq: FaqRow[]): FaqRow | null {
  const normalized = normalize(question);
  if (!normalized) return null;

  let best: FaqRow | null = null;
  let bestScore = 1;

  for (const row of faq) {
    const score = keywordScore(row.question_keywords, normalized);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Whether the visitor is asking for a person rather than asking a question.
 *
 * Checked before the FAQ and the model, because "talk to a person" must reach a
 * human even though it has nothing to do with timber.
 */
export function detectHandoff(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;

  for (const phrase of HANDOFF_REPLIES) {
    if (normalized === phrase || normalized.includes(phrase)) return true;
  }

  return /\b(speak to|talk to|reach out to|connect me with|put me through to)\b/.test(
    normalized,
  );
}

/* --------------------------------------------------------- system prompt */

/**
 * Build the system prompt from live data, so the assistant can answer about the
 * catalogue without anyone maintaining a second copy of the products.
 */
export async function buildSystemPrompt(): Promise<string> {
  const [categories, { products }] = await Promise.all([
    getCategories(),
    getProducts({ limit: PRODUCT_CONTEXT_LIMIT }),
  ]);

  const categoryLines = categories.length
    ? categories
        .map(
          (c) =>
            `- ${c.name} (/${c.slug}) - ${c.product_count ?? 0} available product(s)`,
        )
        .join("\n")
    : "- Catalogue unavailable right now.";

  const productLines = products.length
    ? products.map((p) => {
        // Made-to-measure pieces are priced per commission. Saying the listed
        // price would be a lie, so the entry is marked as such.
        const price = p.is_custom
          ? "priced per commission, requires a quote"
          : p.price;
        const stock =
          p.stock_quantity > 0
            ? "in stock"
            : "check availability with the workshop";
        return `- ${p.name} [${p.category_name ?? "Uncategorised"}] - ${price}, ${stock} - /products/${p.slug}`;
      })
    .join("\n")
    : "- No products are published right now.";

  return `You are the customer assistant for ${CHAT_BUSINESS.name}, a solid-timber furniture workshop in ${CHAT_BUSINESS.location}.

BUSINESS DETAILS
- Phone: ${CHAT_BUSINESS.phone}
- WhatsApp: ${CHAT_BUSINESS.phone}
- Email: ${CHAT_BUSINESS.email}
- Opening hours: ${CHAT_BUSINESS.hours}

DEPARTMENTS
${categoryLines}

CURRENT CATALOGUE (${products.length} product(s))
${productLines}

HOW TO ANSWER
- Keep it to two to four short sentences. This is a chat panel, not an email.
- Use only the catalogue and business details above. Quote a price only where the catalogue gives one.
- NEVER invent a price, a discount, stock level, lead time or delivery date. You have no data for these.
- If someone asks for a specific price on a made-to-measure piece, say it is priced per piece and offer a quote instead of guessing.
- If you do not know something, say so plainly and offer to pass them to the workshop.
- Never invent products, timber species, services or policies that are not listed.
- Plain text only. No markdown, no bullet points, no emoji, no links unless you copy one from the data above.
- Reply in the same language the customer wrote in.
- Be warm and direct, the way a workshop owner would talk on WhatsApp.`;
}

/* -------------------------------------------------------------- provider */

export interface AiConfig {
  /** `openai-compatible` covers OpenAI, Groq, Together, OpenRouter, Ollama and friends. */
  provider: "openai-compatible" | "anthropic";
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_BASE_URL: Record<AiConfig["provider"], string> = {
  "openai-compatible": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

const DEFAULT_MODEL: Record<AiConfig["provider"], string> = {
  "openai-compatible": "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

/**
 * Read the assistant's configuration from the environment.
 *
 * Returns null when there is no key, which is the normal state on a fresh
 * install: the widget then answers from the FAQ alone and offers a human.
 */
export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  const raw = (process.env.AI_PROVIDER ?? "openai-compatible").trim().toLowerCase();
  const provider: AiConfig["provider"] =
    raw === "anthropic" || raw === "claude"
      ? "anthropic"
      : "openai-compatible";

  return {
    provider,
    apiKey,
    baseUrl: (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL[provider]).replace(
      /\/+$/,
      "",
    ),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL[provider],
  };
}

/* -------------------------------------------------------------- streaming */

export interface AssistantTurn {
  system: string;
  history: ChatMessage[];
  question: string;
}

export interface StreamHandlers {
  /** Called for each piece of text as the model produces it. */
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

/** Read a `text/event-stream` body, yielding each decoded chunk. */
async function* readSse(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      // Keep the tail: an event can straddle two chunks.
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/** Pull the text delta out of one server-sent event payload. */
function extractOpenAiDelta(payload: string): string | null {
  try {
    const json = JSON.parse(payload) as {
      choices?: { delta?: { content?: string | null } }[];
    };
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

function extractAnthropicDelta(payload: string): string | null {
  try {
    const json = JSON.parse(payload) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (json.type !== "content_block_delta") return null;
    if (json.delta?.type && json.delta.type !== "text_delta") return null;
    return json.delta?.text ?? null;
  } catch {
    return null;
  }
}

/** Convert stored rows into the role/content shape every provider expects. */
function toWireHistory(history: ChatMessage[]) {
  return history
    .filter((m) => m.sender !== "admin")
    .map((m) => ({
      role: m.sender === "bot" ? ("assistant" as const) : ("user" as const),
      content: m.body,
    }));
}

/**
 * Stream a reply from the configured provider.
 *
 * Returns the assembled text so the caller can persist it. Throws on a transport
 * or provider error; the route turns that into the visitor-visible fallback
 * rather than surfacing anything about our configuration.
 */
export async function streamAssistantReply(
  turn: AssistantTurn,
  handlers: StreamHandlers,
): Promise<string> {
  const config = getAiConfig();
  if (!config) throw new Error("AI is not configured");

  const history = toWireHistory(turn.history);
  const messages = [...history, { role: "user" as const, content: turn.question }];

  let text = "";
  const emit = (token: string | null) => {
    if (!token) return;
    // The cap is applied here too, not just on the stored body, so the visitor
    // never watches a reply grow past what the panel can show.
    const room = REPLY_MAX_CHARS - text.length;
    if (room <= 0) return;
    const slice = token.slice(0, room);
    text += slice;
    handlers.onToken(slice);
  };

  if (config.provider === "anthropic") {
    // Anthropic takes the system prompt outside the message list.
    const payload = JSON.stringify({
      model: config.model,
      max_tokens: 400,
      stream: true,
      system: turn.system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: payload,
      signal: handlers.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }

    let buffer = "";
    for await (const chunk of readSse(response, handlers.signal)) {
      buffer += chunk;
      const lines = buffer.split("\n");
      // Hold the last line back until its newline arrives.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        emit(extractAnthropicDelta(data));
      }
    }

    return text;
  }

  // OpenAI-compatible: one endpoint, used by most hosted and local providers.
  const payload = JSON.stringify({
    model: config.model,
    stream: true,
    max_tokens: 400,
    temperature: 0.3,
    messages: [{ role: "system", content: turn.system }, ...messages],
  });

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: payload,
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Assistant request failed: ${response.status}`);
  }

  let buffer = "";
  for await (const chunk of readSse(response, handlers.signal)) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      emit(extractOpenAiDelta(data));
    }
  }

  return text;
}

/**
 * The reply to show when the assistant is unavailable or failed.
 *
 * Deliberately points at the two things that always work: a human, and a phone.
 */
export const ASSISTANT_FALLBACK =
  "I am having trouble answering that just now. Tap Request a Quote or Talk to a person and the workshop will pick it up - we are on WhatsApp and phone at 0784088929, Monday to Saturday, 8:00am to 6:00pm.";

/** Reuse the shared sanitiser so a stored reply obeys the same rules as a question. */
export function cleanAssistantText(input: string): string {
  return sanitizeChatText(input, REPLY_MAX_CHARS);
}